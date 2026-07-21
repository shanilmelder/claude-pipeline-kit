# Pipeline Dashboard

A local, live view of what the agentic pipeline is doing — which agent is
running, what it just did (branch created, PR opened, review submitted,
Jira transitioned), and a stage tracker across
Orchestrator → Research → Backend/Frontend → Review → QA.

## How it works

0. As of this version, `orchestrator-agent` is itself a real subagent
   (`.claude/agents/orchestrator-agent.md`), not the top-level Claude Code
   session — it spawns research-agent/backend-agent/frontend-agent/
   reviewer-agent/qa-agent itself using nested subagent support (requires
   Claude Code v2.1.172+). The top-level session's only job is to spawn
   `orchestrator-agent` and relay its final report. This means orchestrator
   now shows up on the dashboard exactly like the other five agents, via
   the same `SubagentStart`/`SubagentStop` events, rather than needing
   special-cased handling.
1. `.claude/settings.json` registers hooks on `SubagentStart`/`SubagentStop`
   (fires when any of the six subagents — including orchestrator-agent —
   starts/finishes), `UserPromptSubmit`/`Stop` (the top-level session's own
   trivial start/end of turn, logged for completeness but not shown on the
   stage tracker), and relevant tool calls (`Task`, and any
   `mcp__github-*`/`mcp__jira-*`/`mcp__atlassian-*` tool).
2. Each hook fires `scripts/hooks/log_event.py`, which appends one JSON line
   per event to `.claude/pipeline-status.jsonl`. Events that don't carry an
   `agent_type` (i.e. anything not happening inside a subagent — just the
   top-level session's own spawn-and-wait) are attributed to `main-session`,
   which the dashboard doesn't chart on the stage tracker but does log.
3. `dashboard/server.py` is a small stdlib-only Python web server that reads
   that file and serves `dashboard/index.html`, which polls for new events
   every 2 seconds and updates the stage tracker + live log.

No external dependencies — everything here is Python's standard library and
vanilla JS, so `pip install` isn't needed.

## Setup

**1. Confirm Python is available** (`python3 --version` or `python
--version`). If your system only has `python` (common on Windows), edit
`.claude/settings.json` and change `python3` to `python` in each hook
command.

**2. Start the dashboard** (in its own terminal, separate from your Claude
Code session):
```bash
python3 dashboard/server.py
```
Then open **http://localhost:8787** in a browser and leave it open.

**3. Run the pipeline as normal** in Claude Code (`/run-pipeline PROJ-123`
or by asking directly). Events will start appearing within a couple of
seconds of the first subagent spawning.

## Notes

- `.claude/pipeline-status.jsonl` grows over time — it's a plain append-only
  log. Delete it any time to reset the dashboard's history; the dashboard
  itself doesn't need a restart, it'll just pick up from an empty file.
- Add `.claude/pipeline-status.jsonl` to `.gitignore` — it's local run
  history, not something to commit.
- The dashboard is read-only. It can't pause, retry, or cancel a pipeline
  run — it's purely observability. If you want controls (e.g. a "pause
  before merge" button), that would need to move beyond a static log file
  into something the orchestrator actively polls, which is a bigger change —
  ask if you want that built out.
- Nested subagent support (needed for `orchestrator-agent` to spawn the
  other five) landed in Claude Code v2.1.172. Check `claude --version` if
  `orchestrator-agent` fails immediately when trying to spawn a subagent —
  older versions silently block subagents from spawning subagents.
- If a hook command fails silently and nothing shows up, run
  `echo '{}' | python3 scripts/hooks/log_event.py` manually to confirm
  Python and the script work, then check `.claude/settings.json` hook
  commands match your actual Python invocation (`python3` vs `python`).
