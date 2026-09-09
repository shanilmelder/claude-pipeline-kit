#!/usr/bin/env python3
"""
Local dashboard for the agentic pipeline. Stdlib-only, no dependencies.

Usage:
    python3 dashboard/server.py
    then open http://localhost:8787

Two sources feed the dashboard, and they answer different questions:

  * .claude/pipeline-status.jsonl (written by scripts/hooks/log_event.py) —
    who is active, what tool they just ran, and the full text each agent
    handed to the next. This works for any run, including one you start
    yourself in the Claude Code CLI.
  * .claude/runs/<id>.log — the raw stream-json transcript of a run that
    *this* server launched. Parsing it gives the dashboard the same
    play-by-play the CLI prints: the agent's own prose, its tool calls, and
    the results coming back.

Runs are launched with POST /api/run, which spawns
`claude -p "/run-pipeline <TICKET>" --output-format stream-json --verbose`
in the project root. Set PIPELINE_OUTPUT_FORMAT=text to fall back to plain
output (no live transcript, only the final result).

Security posture: this process can execute Claude Code with tool access, so it
binds to loopback only, rejects cross-origin requests, and validates ticket
IDs against a strict pattern before they reach a subprocess (which is spawned
without a shell). Do not expose this port.
"""

import json
import os
import re
import shutil
import subprocess
import threading
import time
import http.server
import socketserver
from datetime import datetime, timezone
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get("PIPELINE_DASHBOARD_PORT", "8787"))
HOST = "127.0.0.1"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_PATH = os.path.join(ROOT, ".claude", "pipeline-status.jsonl")
RUN_LOG_DIR = os.path.join(ROOT, ".claude", "runs")
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))

# A ticket ID and nothing else. This is the only user-supplied value that
# reaches a subprocess argument, so it is validated rather than escaped.
TICKET_RE = re.compile(r"^[A-Z][A-Z0-9]{1,9}-\d{1,6}$")

# The other accepted target: a requirements-mode run, given as a relative path
# to a Markdown document in this repo. Held to the same standard as TICKET_RE —
# a conservative character class, plus a resolved-path check below that the
# file really is inside the repo and really exists.
DOC_RE = re.compile(r"^[A-Za-z0-9._/-]+\.md$")

# Extra flags for the spawned CLI, e.g. PIPELINE_CLAUDE_ARGS="--model opus".
EXTRA_ARGS = os.environ.get("PIPELINE_CLAUDE_ARGS", "").split()

# stream-json gives a live transcript; text gives only the final result.
STREAM_JSON = os.environ.get("PIPELINE_OUTPUT_FORMAT", "stream-json") != "text"

MAX_EVENTS = 1500
MAX_TRANSCRIPT = 400

# The agents the tracker knows about, in pipeline order. Anything else that
# shows up still appears in the log, just not as a lane.
PIPELINE_AGENTS = [
    "main-session", "orchestrator-agent", "ba-agent", "research-agent",
    "backend-agent", "frontend-agent", "reviewer-agent", "qa-agent",
]

_runs = {}           # run_id -> run dict
_runs_lock = threading.Lock()


# ---------------------------------------------------------------- events

def read_events(limit=MAX_EVENTS):
    if not os.path.exists(LOG_PATH):
        return []
    events = []
    with open(LOG_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                events.append(_clip_legacy(json.loads(line)))
            except json.JSONDecodeError:
                continue
    return events[-limit:]


def _clip_legacy(ev):
    """Bound a record written before the hook learned to clip its own input.

    Lines from an older run can carry a whole push_files payload; sending
    those to the browser is how the log used to stall the dashboard.
    """
    raw = ev.get("raw_tool_input")
    if isinstance(raw, dict):
        clipped = {}
        for key, value in list(raw.items())[:8]:
            text = value if isinstance(value, (int, float, bool)) else json.dumps(value, default=str)
            if isinstance(text, str) and len(text) > 300:
                text = text[:300] + "…"
            clipped[key] = text
        ev["raw_tool_input"] = clipped
    return ev


def detect_ticket(events):
    """Best-effort: pull the most recent ticket ID seen in the event stream.

    Ticket IDs show up in Jira tool inputs (issueIdOrKey), in branch names,
    and in the prompt text the orchestrator passes to subagents. Scanning
    backwards means the dashboard header follows the current run rather than
    the first one ever logged.
    """
    for ev in reversed(events):
        raw = ev.get("raw_tool_input") or {}
        key = raw.get("issueIdOrKey")
        if isinstance(key, str) and TICKET_RE.match(key):
            return key
        blob = json.dumps(raw)[:4000] + " " + str(ev.get("summary") or "")
        m = re.search(r"\b[A-Z][A-Z0-9]{1,9}-\d{1,6}\b", blob)
        if m:
            return m.group(0)
    return None


def derive_state(events):
    """Fold the event stream into the picture the dashboard draws.

    Everything here is derived, never stored: the log is the only state, so
    a browser that connects mid-run sees exactly what one that watched from
    the start sees.
    """
    agents = {}
    handoffs = []
    order = []

    def agent(name):
        if name not in agents:
            agents[name] = {
                "name": name,
                "state": "idle",
                "started": None,
                "ended": None,
                "last_ts": None,
                "last_action": "",
                "tools": 0,
                "errors": 0,
                "handed_to": None,
                "received_from": None,
            }
            order.append(name)
        return agents[name]

    for ev in events:
        name = ev.get("agent_type") or "main-session"
        rec = agent(name)
        ts = ev.get("ts")
        rec["last_ts"] = ts
        event = ev.get("event")

        if event == "SubagentStart":
            rec["state"] = "running"
            rec["started"] = ts
            rec["ended"] = None
            rec["last_action"] = "started"
        elif event == "SubagentStop":
            rec["state"] = "failed" if rec["errors"] and ev.get("error") else "done"
            if ev.get("error"):
                rec["state"] = "failed"
            rec["ended"] = ts
            rec["last_action"] = "finished"
        elif event in ("PreToolUse", "PostToolUse"):
            if rec["state"] in ("idle", "done"):
                # A tool call from an agent we never saw start (e.g. the
                # dashboard connected mid-run) still means it is working.
                rec["state"] = "running"
                rec["started"] = rec["started"] or ts
                rec["ended"] = None
            if event == "PreToolUse":
                rec["tools"] += 1
                rec["last_action"] = ev.get("summary") or ""
            if ev.get("error"):
                rec["errors"] += 1
        elif event == "Stop" and name == "main-session":
            rec["state"] = "done"
            rec["ended"] = ts

        h = ev.get("handoff")
        if h:
            entry = {
                "ts": ts,
                "from": h.get("from"),
                "to": h.get("to"),
                "direction": h.get("direction"),
                "description": h.get("description") or "",
                "text": h.get("text") or "",
                "chars": len(h.get("text") or ""),
                "error": bool(ev.get("error")),
            }
            handoffs.append(entry)
            if h.get("direction") == "out":
                agent(h.get("from") or name)["handed_to"] = h.get("to")
                target = agent(h.get("to") or "?")
                target["received_from"] = h.get("from")
                if target["state"] == "idle":
                    target["state"] = "running"
            else:
                agent(h.get("to") or name)["received_from"] = h.get("from")

    # Anything still "running" whose parent already reported it back is done.
    for h in handoffs:
        if h["direction"] == "in":
            rec = agents.get(h["from"])
            if rec and rec["state"] == "running":
                rec["state"] = "failed" if h["error"] else "done"
                rec["ended"] = rec["ended"] or h["ts"]

    active = [n for n, r in agents.items() if r["state"] == "running"]
    # main-session is the shell around everything; it isn't interesting as
    # "the active agent" while a real subagent is working.
    focus = [n for n in active if n != "main-session"] or active

    ordered = sorted(
        agents.values(),
        key=lambda r: (PIPELINE_AGENTS.index(r["name"])
                       if r["name"] in PIPELINE_AGENTS else 99, order.index(r["name"])),
    )
    return {
        "agents": ordered,
        "active": focus,
        "handoffs": handoffs[-60:],
        "ticket": detect_ticket(events),
    }


# ------------------------------------------------ stream-json transcript

def _content_text(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        out = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text":
                    out.append(block.get("text", ""))
                elif "text" in block:
                    out.append(str(block["text"]))
            else:
                out.append(str(block))
        return "\n".join(p for p in out if p)
    if isinstance(content, dict):
        return _content_text(content.get("content", ""))
    return str(content or "")


def _tool_line(name, tool_input):
    """Same phrasing the hook uses, so both feeds read alike."""
    ti = tool_input if isinstance(tool_input, dict) else {}
    if name == "Bash":
        cmd = str(ti.get("command", "")).strip().splitlines()
        return "$ " + (cmd[0] if cmd else "")
    if name in ("Read", "Write", "Edit", "MultiEdit", "NotebookEdit"):
        path = str(ti.get("file_path") or ti.get("notebook_path") or "")
        return f"{name} {path.replace(os.sep, '/').split('/')[-1] or path}"
    if name == "Task":
        return f"→ {ti.get('subagent_type', 'agent')}: {ti.get('description', '')}"
    if name == "Grep":
        return f"Grep /{ti.get('pattern', '')}/"
    if name.startswith("mcp__"):
        parts = name.split("__")
        return f"{parts[1] if len(parts) > 2 else ''}: {parts[-1]}"
    return name


def parse_stream(path, offset=0, limit=MAX_TRANSCRIPT):
    """Turn a stream-json run log into CLI-shaped transcript entries.

    Subagent output arrives with parent_tool_use_id pointing at the Task
    call that spawned it, so remembering each Task's subagent_type is what
    lets every line be attributed to the agent that produced it.
    """
    entries = []
    owner = {}          # tool_use_id -> agent name (for subagent attribution)
    pending = {}        # tool_use_id -> tool label, to pair results with calls
    stats = {}
    consumed = 0
    plain = []

    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
    except OSError:
        return {"entries": [], "offset": offset, "stats": {}}

    for raw in lines:
        consumed += 1
        raw = raw.strip()
        if not raw:
            continue
        if not raw.startswith("{"):
            plain.append(raw)
            if consumed > offset:
                entries.append({"agent": "cli", "kind": "raw", "text": raw})
            continue
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            continue

        parent = msg.get("parent_tool_use_id")
        who = owner.get(parent, "main-session") if parent else "main-session"
        emit = consumed > offset
        mtype = msg.get("type")

        if mtype == "system":
            if emit and msg.get("subtype") == "init":
                model = msg.get("model", "")
                entries.append({"agent": "cli", "kind": "system",
                                "text": f"session started{f' · {model}' if model else ''}"})
        elif mtype == "assistant":
            for block in (msg.get("message", {}) or {}).get("content", []) or []:
                if not isinstance(block, dict):
                    continue
                if block.get("type") == "text" and block.get("text", "").strip():
                    if emit:
                        entries.append({"agent": who, "kind": "text",
                                        "text": block["text"].strip()})
                elif block.get("type") == "tool_use":
                    name = block.get("name", "tool")
                    label = _tool_line(name, block.get("input"))
                    pending[block.get("id")] = label
                    if name == "Task":
                        child = (block.get("input") or {}).get("subagent_type", "agent")
                        owner[block.get("id")] = child
                        if emit:
                            entries.append({
                                "agent": who, "kind": "handoff", "tool": name,
                                "text": label,
                                "detail": (block.get("input") or {}).get("prompt", ""),
                                "to": child,
                            })
                            continue
                    if emit:
                        entries.append({"agent": who, "kind": "tool", "tool": name,
                                        "text": label})
        elif mtype == "user":
            for block in (msg.get("message", {}) or {}).get("content", []) or []:
                if not isinstance(block, dict) or block.get("type") != "tool_result":
                    continue
                body = _content_text(block.get("content"))
                if emit:
                    entries.append({
                        "agent": who, "kind": "result",
                        "tool": pending.get(block.get("tool_use_id"), ""),
                        "text": body[:4000],
                        "error": bool(block.get("is_error")),
                    })
        elif mtype == "result":
            stats = {
                "subtype": msg.get("subtype"),
                "duration_ms": msg.get("duration_ms"),
                "num_turns": msg.get("num_turns"),
                "cost_usd": msg.get("total_cost_usd"),
            }
            if emit:
                entries.append({"agent": "cli", "kind": "final",
                                "text": _content_text(msg.get("result")) or
                                        str(msg.get("subtype", "done"))})

    if plain and not entries and offset == 0:
        # Plain-text mode: the whole log is one blob of output.
        entries = [{"agent": "cli", "kind": "raw", "text": "\n".join(plain[-200:])}]

    return {"entries": entries[-limit:], "offset": consumed, "stats": stats}


# ------------------------------------------------------------------ runs

def claude_binary():
    for name in ("claude", "claude.cmd", "claude.exe"):
        found = shutil.which(name)
        if found:
            return found
    return None


def _serialize(run):
    return {
        "id": run["id"],
        "ticket": run["ticket"],
        "autonomous": run["autonomous"],
        "started": run["started"],
        "ended": run.get("ended"),
        "status": run["status"],
        "exit_code": run.get("exit_code"),
        "pid": run.get("pid"),
        "log": os.path.relpath(run["log_path"], ROOT).replace("\\", "/"),
        "stream": run.get("stream", False),
        "error": run.get("error"),
    }


def _reap():
    """Refresh terminal state for finished processes."""
    with _runs_lock:
        for run in _runs.values():
            proc = run.get("proc")
            if proc is None or run["status"] != "running":
                continue
            code = proc.poll()
            if code is not None:
                run["status"] = "completed" if code == 0 else "failed"
                run["exit_code"] = code
                run["ended"] = datetime.now(timezone.utc).isoformat()


def validate_target(target):
    """Classify a run target. Returns (kind, error) where kind is 'ticket' or 'doc'.

    A ticket ID starts an ordinary run. A Markdown path starts a
    requirements-mode run, where ba-agent splits the document into stories
    first. Everything else is rejected — this value becomes a subprocess
    argument.
    """
    target = target or ""
    if TICKET_RE.match(target):
        return "ticket", None
    if not DOC_RE.match(target) or ".." in target.split("/"):
        return None, ("Invalid target. Expected a ticket ID like PROJ-123, or a "
                      "path to a requirement document like docs/requirements/x.md.")
    resolved = os.path.realpath(os.path.join(ROOT, target))
    if os.path.commonpath([resolved, os.path.realpath(ROOT)]) != os.path.realpath(ROOT):
        return None, "Requirement document must be inside the project directory."
    if not os.path.isfile(resolved):
        return None, f"Requirement document not found: {target}"
    return "doc", None


def start_run(ticket, autonomous=None):
    """Spawn a headless pipeline run. Returns (run_dict, error_message)."""
    kind, err = validate_target(ticket)
    if err:
        return None, err

    binary = claude_binary()
    if not binary:
        return None, "`claude` CLI not found on PATH. Install Claude Code or add it to PATH."

    _reap()
    with _runs_lock:
        for run in _runs.values():
            if run["ticket"] == ticket and run["status"] == "running":
                return None, f"{ticket} is already running (started {run['started']})."

    prompt = f"/run-pipeline {ticket}"
    if autonomous is True:
        prompt += " — run fully autonomously, merge without checking with me."
    elif autonomous is False:
        prompt += " — check with me before merging; do not merge."

    os.makedirs(RUN_LOG_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    # A doc target contains slashes and a .md suffix; the run id becomes a
    # filename, so flatten it.
    slug = ticket if kind == "ticket" else re.sub(r"[^A-Za-z0-9]+", "-", ticket[:-3]).strip("-")
    run_id = f"{slug}-{stamp}"
    log_path = os.path.join(RUN_LOG_DIR, f"{run_id}.log")

    cmd = [binary, "-p", prompt]
    if STREAM_JSON:
        # --verbose is required alongside stream-json in -p mode; without it
        # the CLI emits only the final result and the transcript stays empty.
        cmd += ["--output-format", "stream-json", "--verbose"]
    cmd += EXTRA_ARGS
    try:
        log_file = open(log_path, "w", encoding="utf-8", buffering=1)
        proc = subprocess.Popen(
            cmd,
            cwd=ROOT,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            shell=False,
        )
    except OSError as exc:
        return None, f"Failed to start run: {exc}"

    run = {
        "id": run_id,
        "ticket": ticket,
        "autonomous": autonomous,
        "started": datetime.now(timezone.utc).isoformat(),
        "status": "running",
        "proc": proc,
        "pid": proc.pid,
        "log_path": log_path,
        "log_file": log_file,
        "stream": STREAM_JSON,
    }
    with _runs_lock:
        _runs[run_id] = run
    return run, None


def stop_run(run_id):
    _reap()
    with _runs_lock:
        run = _runs.get(run_id)
    if not run:
        return None, "No such run."
    if run["status"] != "running":
        return _serialize(run), None
    proc = run["proc"]
    proc.terminate()
    for _ in range(20):
        if proc.poll() is not None:
            break
        time.sleep(0.1)
    else:
        proc.kill()
    with _runs_lock:
        run["status"] = "stopped"
        run["exit_code"] = proc.poll()
        run["ended"] = datetime.now(timezone.utc).isoformat()
    return _serialize(run), None


def run_log_path(run_id):
    with _runs_lock:
        run = _runs.get(run_id)
    if run:
        return run["log_path"]
    # Runs from an earlier server session are still on disk and worth reading.
    candidate = os.path.join(RUN_LOG_DIR, f"{os.path.basename(run_id)}.log")
    return candidate if os.path.isfile(candidate) else None


def run_tail(run_id, lines=60):
    path = run_log_path(run_id)
    if not path:
        return None
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return "".join(f.readlines()[-lines:])
    except OSError:
        return ""


# --------------------------------------------------------------- server

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    # -- helpers

    def _json(self, obj, code=200):
        body = json.dumps(obj, default=str).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _local_only(self):
        """Reject requests a random web page could have caused.

        The dashboard can start Claude runs, so a browser on this machine
        visiting some other site must not be able to POST here. Same-origin
        requests from the dashboard itself send either no Origin or this
        server's own origin.
        """
        origin = self.headers.get("Origin")
        if origin and origin not in (f"http://{HOST}:{PORT}", f"http://localhost:{PORT}"):
            self._json({"error": "Cross-origin requests are not allowed."}, 403)
            return False
        return True

    def _body_json(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
            if not length:
                return {}
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, json.JSONDecodeError):
            return {}

    # -- routes

    def do_GET(self):
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)

        if parsed.path == "/api/events":
            since = query.get("since", [None])[0]
            events = read_events()
            payload = derive_state(events)
            if since:
                events = [e for e in events if e.get("ts", "") > since]
            payload["events"] = events
            return self._json(payload)

        if parsed.path == "/api/runs":
            _reap()
            with _runs_lock:
                runs = [_serialize(r) for r in _runs.values()]
            runs.sort(key=lambda r: r["started"], reverse=True)
            return self._json({"runs": runs, "claude_available": bool(claude_binary()),
                               "stream": STREAM_JSON})

        if parsed.path == "/api/transcript":
            run_id = query.get("id", [""])[0]
            try:
                offset = int(query.get("offset", ["0"])[0])
            except ValueError:
                offset = 0
            path = run_log_path(run_id)
            if not path:
                return self._json({"error": "No such run."}, 404)
            return self._json(parse_stream(path, offset))

        if parsed.path == "/api/run-log":
            run_id = query.get("id", [""])[0]
            tail = run_tail(run_id)
            if tail is None:
                return self._json({"error": "No such run."}, 404)
            return self._json({"id": run_id, "tail": tail})

        if parsed.path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if not self._local_only():
            return

        if parsed.path == "/api/run":
            data = self._body_json()
            ticket = (data.get("ticket") or "").strip()
            # Ticket IDs are case-insensitive to type; document paths are not.
            if "/" not in ticket and not ticket.lower().endswith(".md"):
                ticket = ticket.upper()
            autonomous = data.get("autonomous")
            if autonomous not in (True, False, None):
                autonomous = None
            run, err = start_run(ticket, autonomous)
            if err:
                return self._json({"error": err}, 400)
            return self._json({"run": _serialize(run)})

        if parsed.path == "/api/stop":
            run_id = (self._body_json().get("id") or "").strip()
            run, err = stop_run(run_id)
            if err:
                return self._json({"error": err}, 404)
            return self._json({"run": run})

        return self._json({"error": "Not found."}, 404)

    def log_message(self, format, *args):
        pass  # keep console quiet


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    with Server((HOST, PORT), Handler) as httpd:
        print(f"Pipeline dashboard running at http://{HOST}:{PORT}")
        print(f"Reading events from: {LOG_PATH}")
        print(f"Run logs:            {RUN_LOG_DIR}")
        print(f"Run output format:   {'stream-json (live transcript)' if STREAM_JSON else 'text'}")
        if not claude_binary():
            print("WARNING: `claude` not found on PATH — launching runs from the "
                  "dashboard will be disabled.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")
