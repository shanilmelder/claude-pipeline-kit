#!/usr/bin/env python3
"""
Local dashboard for the agentic pipeline. Stdlib-only, no dependencies.

Usage:
    python3 dashboard/server.py
    then open http://localhost:8787

Reads .claude/pipeline-status.jsonl (written by scripts/hooks/log_event.py)
and serves it to the browser, which polls every 2 seconds. Can also launch
pipeline runs: POST /api/run spawns `claude -p "/run-pipeline <TICKET>"` as a
headless subprocess in the project root, so the hooks log it like any other
run and the dashboard tracks it live.

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

MAX_EVENTS = 500

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
                events.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return events[-limit:]


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

    cmd = [binary, "-p", prompt] + EXTRA_ARGS
    try:
        log_file = open(log_path, "w", encoding="utf-8")
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


def run_tail(run_id, lines=40):
    with _runs_lock:
        run = _runs.get(run_id)
    if not run:
        return None
    try:
        with open(run["log_path"], "r", encoding="utf-8", errors="replace") as f:
            return "".join(f.readlines()[-lines:])
    except OSError:
        return ""


# --------------------------------------------------------------- server

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    # -- helpers

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode("utf-8")
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
            ticket = detect_ticket(events)
            if since:
                events = [e for e in events if e.get("ts", "") > since]
            return self._json({"events": events, "ticket": ticket})

        if parsed.path == "/api/runs":
            _reap()
            with _runs_lock:
                runs = [_serialize(r) for r in _runs.values()]
            runs.sort(key=lambda r: r["started"], reverse=True)
            return self._json({"runs": runs, "claude_available": bool(claude_binary())})

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
        if not claude_binary():
            print("WARNING: `claude` not found on PATH — launching runs from the "
                  "dashboard will be disabled.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")
