#!/usr/bin/env python3
"""
Claude Code hook handler for the agentic pipeline dashboard.

Reads the hook's JSON payload from stdin, normalizes it into a single log
line, and appends it to .claude/pipeline-status.jsonl in the project root.
Never blocks or errors out the pipeline — if anything goes wrong here, it
fails silently and exits 0, since a broken dashboard log should never break
the actual pipeline run.

Three kinds of record come out of here:

  * agent lifecycle  — SubagentStart / SubagentStop, so the dashboard knows
    who is currently active.
  * tool activity    — one line per tool call, phrased the way the CLI
    phrases it ("$ npm test", "Edit src/App.tsx"), so the dashboard shows
    the same play-by-play a person sees in the terminal.
  * handoffs         — a Task call carries the full prompt one agent hands
    to another, and the Task result carries the report handed back. Both
    are captured verbatim (bounded), because "what did research-agent
    actually tell backend-agent" is the question the dashboard exists to
    answer.

Tool inputs are clipped before they are written. A single push_files call
can carry a megabyte of file contents, and that whole payload used to end
up in the log and then in the browser.
"""

import json
import os
import sys
from datetime import datetime, timezone

# Bounds. Handoff text is the point of the exercise, so it gets a generous
# budget; incidental tool arguments get a small one.
MAX_HANDOFF = 20000
MAX_SUMMARY = 300
MAX_VALUE = 300
MAX_PREVIEW_KEYS = 8


def project_root():
    return os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())


def log_path():
    root = project_root()
    claude_dir = os.path.join(root, ".claude")
    os.makedirs(claude_dir, exist_ok=True)
    return os.path.join(claude_dir, "pipeline-status.jsonl")


def clip(value, limit=MAX_VALUE):
    if not isinstance(value, str):
        value = json.dumps(value, default=str)
    value = value.strip()
    if len(value) <= limit:
        return value
    return value[:limit] + f"… (+{len(value) - limit} chars)"


def one_line(value, limit=MAX_SUMMARY):
    return clip(" ".join(str(value).split()), limit)


def short_path(p):
    """Repo-relative where possible — absolute paths make the log unreadable."""
    if not isinstance(p, str):
        return ""
    root = os.path.normpath(project_root())
    norm = os.path.normpath(p)
    if norm.startswith(root):
        norm = norm[len(root):].lstrip("\\/")
    return norm.replace("\\", "/")


def text_of(response):
    """Pull readable text out of a tool_response of whatever shape."""
    if response is None:
        return ""
    if isinstance(response, str):
        return response
    if isinstance(response, list):
        return "\n".join(text_of(item) for item in response)
    if isinstance(response, dict):
        for key in ("text", "content", "result", "output", "stdout", "message"):
            if key in response:
                return text_of(response[key])
        return json.dumps(response, default=str)
    return str(response)


def describe_tool(tool_name, ti):
    """Phrase a tool call the way the CLI phrases it."""
    if tool_name == "Bash":
        cmd = str(ti.get("command", "")).strip().splitlines()
        return "$ " + one_line(cmd[0] if cmd else "", 200)
    if tool_name in ("Read", "Write", "Edit", "MultiEdit", "NotebookEdit"):
        return f"{tool_name} {short_path(ti.get('file_path') or ti.get('notebook_path') or '')}"
    if tool_name == "Grep":
        target = short_path(ti.get("path") or "")
        return f"Grep /{one_line(ti.get('pattern', ''), 80)}/" + (f" in {target}" if target else "")
    if tool_name == "Glob":
        return f"Glob {one_line(ti.get('pattern', ''), 80)}"
    if tool_name in ("WebSearch", "WebFetch"):
        return f"{tool_name} {one_line(ti.get('query') or ti.get('url') or '', 120)}"
    if tool_name == "Task":
        return f"→ {ti.get('subagent_type', 'agent')}: {one_line(ti.get('description', ''), 120)}"
    if tool_name.startswith("mcp__"):
        parts = tool_name.split("__")
        alias = parts[1] if len(parts) > 2 else ""
        fn = parts[-1]
        extras = []
        for key in ("issueIdOrKey", "branch", "pullNumber", "title", "transition", "assignee"):
            if key in ti:
                extras.append(f"{key}={one_line(ti[key], 60)}")
        suffix = f" ({', '.join(extras)})" if extras else ""
        return f"{alias}: {fn}{suffix}"
    return tool_name


def preview(ti):
    """A small, safe echo of the tool input — never the full payload."""
    if not isinstance(ti, dict):
        return {}
    out = {}
    for key, value in ti.items():
        if key in ("prompt", "content", "files", "body"):
            continue  # bulky; handoffs capture what matters separately
        out[key] = clip(value) if not isinstance(value, (int, float, bool)) else value
        if len(out) >= MAX_PREVIEW_KEYS:
            break
    return out


def summarize(data):
    event = data.get("hook_event_name", "unknown")
    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {}) or {}
    tool_response = data.get("tool_response", {})

    # agent_id/agent_type are only present on events firing inside a
    # subagent (per Claude Code's hook schema). orchestrator-agent is now a
    # real subagent (name: orchestrator-agent) and gets a proper agent_type
    # like everyone else. If agent_type is absent, this event belongs to the
    # top-level Claude Code session itself, which — per CLAUDE.md — does
    # nothing but spawn orchestrator-agent, so we label it "main-session"
    # rather than "orchestrator" to avoid double-counting the two as the
    # same thing on the dashboard.
    actor = data.get("agent_type") or "main-session"

    handoff = None
    detail = ""
    error = False
    summary = event

    if event in ("SubagentStart", "SubagentStop"):
        label = data.get("agent_type") or tool_input.get("description") or "subagent"
        summary = f"{event}: {label}"
    elif event == "UserPromptSubmit":
        summary = "Main session: pipeline run requested"
        detail = clip(data.get("prompt") or "", MAX_HANDOFF)
    elif event == "Stop":
        summary = "Main session: turn complete"
    elif tool_name == "Task":
        target = tool_input.get("subagent_type", "agent")
        if event == "PreToolUse":
            summary = f"Spawning {target} — {one_line(tool_input.get('description', ''), 120)}"
            handoff = {
                "direction": "out",
                "from": actor,
                "to": target,
                "description": one_line(tool_input.get("description", ""), 200),
                "text": clip(tool_input.get("prompt") or "", MAX_HANDOFF),
            }
        else:
            report = text_of(tool_response)
            summary = f"{target} reported back"
            handoff = {
                "direction": "in",
                "from": target,
                "to": actor,
                "description": one_line(tool_input.get("description", ""), 200),
                "text": clip(report, MAX_HANDOFF),
            }
            error = bool(isinstance(tool_response, dict) and
                         (tool_response.get("error") or tool_response.get("isError")))
    elif event in ("PreToolUse", "PostToolUse"):
        summary = describe_tool(tool_name, tool_input)
        if event == "PostToolUse":
            body = text_of(tool_response)
            detail = clip(body, 1200)
            if isinstance(tool_response, dict):
                error = bool(tool_response.get("error") or tool_response.get("isError"))
            if not error and tool_name == "Bash":
                # A non-zero Bash exit shows up in the response body, not a flag.
                error = "command failed" in body.lower() or "exit code 1" in body.lower()

    return {
        "ts": datetime.now(timezone.utc).isoformat(),
        "event": event,
        "phase": "post" if event == "PostToolUse" else "pre" if event == "PreToolUse" else event,
        "tool_name": tool_name,
        "agent_type": actor,
        "agent_id": data.get("agent_id"),
        "session_id": data.get("session_id"),
        "summary": one_line(summary, MAX_SUMMARY),
        "detail": detail,
        "error": error,
        "handoff": handoff,
        "raw_tool_input": preview(tool_input),
    }


def main():
    try:
        raw = sys.stdin.read()
        data = json.loads(raw) if raw else {}
        record = summarize(data)
        with open(log_path(), "a", encoding="utf-8") as f:
            f.write(json.dumps(record, default=str) + "\n")
    except Exception:
        # Never break the pipeline over a logging failure.
        pass
    sys.exit(0)


if __name__ == "__main__":
    main()
