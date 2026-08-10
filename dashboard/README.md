# Pipeline Dashboard

A local, live view of what the agentic pipeline is doing — which agent is
running, what it just did (branch created, PR opened, review submitted,
Jira transitioned), and a stage tracker across
Orchestrator → Research → Backend/Frontend → Review + QA.

It can also **start runs**: type a ticket ID, pick an autonomy override, and
hit Run. No need to switch to a terminal to kick off a ticket.

## How it works

0. As of this version, `orchestrator-agent` is itself a real subagent
   (`.claude/agents/orchestrator-agent.md`), not the top-level Claude Code
   session — it spawns ba-agent/research-agent/backend-agent/frontend-agent/
   reviewer-agent/qa-agent itself using nested subagent support (requires
   Claude Code v2.1.172+). The top-level session's only job is to spawn
   `orchestrator-agent` and relay its final report. This means orchestrator
   now shows up on the dashboard exactly like the other agents, via
   the same `SubagentStart`/`SubagentStop` events, rather than needing
   special-cased handling.
1. `.claude/settings.json` registers hooks on `SubagentStart`/`SubagentStop`
   (fires when any subagent — including orchestrator-agent — starts/finishes), `UserPromptSubmit`/`Stop` (the top-level session's own
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

**3. Start a run** — either from the dashboard's "Start a run" box, or as
before in Claude Code (`/run-pipeline PROJ-123`, or `/run-pipeline
docs/requirements/feature.md` for a BA-first run). Either way, events appear
within a couple of seconds of the first subagent spawning.

## Starting runs from the dashboard

`POST /api/run` spawns `claude -p "/run-pipeline <TARGET>"` as a headless
subprocess with the project root as its working directory — the same entry
point as typing the slash command yourself, so hooks, agents, and permissions
all behave identically. `<TARGET>` is either a ticket ID (`PROJ-123`) or the
path to a requirement document inside the repo
(`docs/requirements/feature.md`), which starts a requirements-mode run:
ba-agent splits the document into stories, then the pipeline runs once per
story. Both forms are validated against a strict pattern — and the doc form
additionally has to resolve to a file that exists inside the project — since
the value becomes a subprocess argument. The autonomy dropdown appends an explicit per-run
override to that prompt, which `CLAUDE.md` already honors above the
`AUTONOMOUS_MODE` config value.

Each run writes stdout to `.claude/runs/<target>-<timestamp>.log` (a document
path is flattened into a filename-safe slug). The runs
panel shows status and elapsed time, tails that log on demand, and can
terminate a run. A ticket already running can't be started twice.

**Headless runs can't answer permission prompts.** If the pipeline needs a
tool that isn't allowlisted, the run stalls silently until you stop it — it
will sit in `running` with no new events. Keep `.claude/settings.local.json`
current (`/fewer-permission-prompts` regenerates it), or pass flags via the
`PIPELINE_CLAUDE_ARGS` env var, e.g.:

```bash
PIPELINE_CLAUDE_ARGS="--model opus" python3 dashboard/server.py
```

### Security

The server can execute Claude Code with tool access, so:

- it binds to `127.0.0.1` only — never expose the port or bind it wider;
- it rejects cross-origin POSTs, so a page you visit in the same browser
  can't trigger runs;
- ticket IDs are validated against `^[A-Z][A-Z0-9]{1,9}-\d{1,6}$` before
  reaching a subprocess argument, and processes are spawned without a shell.

Treat access to this port as equivalent to shell access to the project.

## Notes

- `.claude/pipeline-status.jsonl` grows over time — it's a plain append-only
  log. Delete it any time to reset the dashboard's history; the dashboard
  itself doesn't need a restart, it'll just pick up from an empty file.
- `.claude/pipeline-status.jsonl` and `.claude/runs/` are gitignored — local
  run history, not something to commit.
- The dashboard can start and stop runs, but it can't steer one mid-flight
  (pause before merge, force a retry, answer a question). Those would require
  the orchestrator to poll for out-of-band instructions rather than just
  emitting events — a bigger change; ask if you want it. Stopping a run
  terminates the CLI process; it does not roll back a branch, PR, or Jira
  transition already made.
- The stage tracker shows Review and QA as a single parallel gate because
  that's how the pipeline runs them (see `CLAUDE.md` step 5). Backend and
  Frontend are also drawn as a parallel column — they run sequentially on the
  first pass but in parallel on retry passes.
- Nested subagent support (needed for `orchestrator-agent` to spawn the
  other five) landed in Claude Code v2.1.172. Check `claude --version` if
  `orchestrator-agent` fails immediately when trying to spawn a subagent —
  older versions silently block subagents from spawning subagents.
- If a hook command fails silently and nothing shows up, run
  `echo '{}' | python3 scripts/hooks/log_event.py` manually to confirm
  Python and the script work, then check `.claude/settings.json` hook
  commands match your actual Python invocation (`python3` vs `python`).
