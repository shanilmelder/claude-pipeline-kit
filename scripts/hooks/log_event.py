#!/usr/bin/env python3
"""
Claude Code hook handler for the agentic pipeline dashboard.

Reads the hook's JSON payload from stdin, normalizes it into a single log
line, and appends it to .claude/pipeline-status.jsonl in the project root.
Never blocks or errors out the pipeline — if anything goes wrong here, it
fails silently and exits 0, since a broken dashboard log should never break
the actual pipeline run.
"""

import json
import os
import sys
from datetime import datetime, timezone

def project_root():
    return os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())

def log_path():
    root = project_root()
    claude_dir = os.path.join(root, ".claude")
    os.makedirs(claude_dir, exist_ok=True)
    return os.path.join(claude_dir, "pipeline-status.jsonl")

def summarize(data):
    event = data.get("hook_event_name", "unknown")
    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {}) or {}
    tool_response = data.get("tool_response", {}) or {}

    # agent_id/agent_type are only present on events firing inside a
    # subagent (per Claude Code's hook schema). orchestrator-agent is now a
    # real subagent (name: orchestrator-agent) and gets a proper agent_type
    # like everyone else. If agent_type is absent, this event belongs to the
    # top-level Claude Code session itself, which — per CLAUDE.md — does
    # nothing but spawn orchestrator-agent, so we label it "main-session"
    # rather than "orchestrator" to avoid double-counting the two as the
    # same thing on the dashboard.
    agent_type = data.get("agent_type") or tool_input.get("subagent_type") or "main-session"

    summary = event
    if event in ("SubagentStart", "SubagentStop"):
        label = data.get("agent_type") or tool_input.get("description") or "subagent"
        summary = f"{event}: {label}"
    elif event == "UserPromptSubmit":
        summary = "Main session: pipeline run requested"
    elif event == "Stop":
        summary = "Main session: turn complete"
    elif event == "PreToolUse" and tool_name == "Task":
        summary = f"Spawning: {tool_input.get('subagent_type', 'agent')} — {tool_input.get('description', '')}"
    elif event in ("PreToolUse", "PostToolUse"):
        summary = f"{event}: {tool_name}"
        # Pull a few useful fields out of common MCP calls, best-effort only.
        for key in ("branch", "title", "event", "status", "transition", "state"):
            if key in tool_input:
                summary += f" ({key}={tool_input[key]})"
        if event == "PostToolUse" and isinstance(tool_response, dict):
            err = tool_response.get("error") or tool_response.get("isError")
            if err:
                summary += " [ERROR]"

    return {
        "ts": datetime.now(timezone.utc).isoformat(),
        "event": event,
        "tool_name": tool_name,
        "agent_type": agent_type,
        "session_id": data.get("session_id"),
        "summary": summary,
        "raw_tool_input": tool_input,
    }

def main():
    try:
        raw = sys.stdin.read()
        data = json.loads(raw) if raw else {}
        record = summarize(data)
        with open(log_path(), "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")
    except Exception:
        # Never break the pipeline over a logging failure.
        pass
    sys.exit(0)

if __name__ == "__main__":
    main()
