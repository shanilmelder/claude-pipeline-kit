# Pipeline Dashboard

A local, live view of what the agentic pipeline is doing. Five things are on
screen at once:

- **Active agent** — a badge in the header naming whoever is holding the work
  right now, and the tool call they are in the middle of. Two names appear
  when reviewer and QA run as a parallel gate.
- **Stage tracker** — Orchestrator → BA → Research → Backend/Frontend →
  Review + QA, each stage showing its state, its most recent action, and how
  many tool calls (and errors) it has racked up.
- **Live transcript** — the same play-by-play the CLI prints: the agent's own
  prose, every tool call phrased as the CLI phrases it (`$ dotnet test`,
  `Edit Program.cs`), and the results coming back, each line coloured by the
  agent that produced it. Tool results collapse to three lines with a `more`
  toggle.
- **Handoffs** — every Task spawn and every report back, as
  `orchestrator-agent handed to → research-agent`, expandable to the full
  prompt text or the full returned brief. This is the "what did A actually
  tell B" view.
- **Event log** — the flat, filterable stream of everything, errors-only
  toggle included.

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
   (fires when any subagent — including orchestrator-agent — starts/finishes),
   `UserPromptSubmit`/`Stop` (the top-level session's own trivial start/end of
   turn, logged for completeness but not shown on the stage tracker), **every**
   `PreToolUse` (that's what makes the transcript a play-by-play rather than a
   list of Jira calls), and `PostToolUse` on the tools whose *result* matters —
   `Task`, `Bash`, the file writers, and the GitHub/Jira MCP tools.
2. Each hook fires `scripts/hooks/log_event.py`, which appends one JSON line
   per event to `.claude/pipeline-status.jsonl`. Events that don't carry an
   `agent_type` (i.e. anything not happening inside a subagent — just the
   top-level session's own spawn-and-wait) are attributed to `main-session`,
   which the dashboard doesn't chart on the stage tracker but does log.
   A `Task` call is logged twice on purpose: the `PreToolUse` record carries
   the full prompt one agent hands to another, and the `PostToolUse` record
   carries the report handed back. Those two are what the Handoffs panel
   draws. Everything else has its tool input clipped before it is written —
   a single `push_files` call can carry a megabyte of file contents.
3. `dashboard/server.py` is a small stdlib-only Python web server. It folds
   the event log into the derived picture the UI draws (who is active, per-agent
   state, the handoff chain) and serves `dashboard/index.html`, which polls
   every 2 seconds.
4. Runs launched from the dashboard are spawned with `--output-format
   stream-json --verbose`, so their log is a structured transcript rather
   than just a final answer. The server parses it — attributing each line to
   the right agent via `parent_tool_use_id` — and serves it incrementally to
   the Live transcript pane. Set `PIPELINE_OUTPUT_FORMAT=text` to go back to
   plain output; the transcript pane then only shows the final result.

No external dependencies — everything here is Python's standard library and
vanilla JS, so `pip install` isn't needed.

## Setup

**1. Confirm Python is available** (`python3 --version` or `python
--version`). Each hook command tries `python3` and falls back to `python`,
which covers the two common cases — a Linux box with no `python` alias, and a
Windows box where `python3` resolves to the Microsoft Store stub that prints
an install prompt and exits non-zero. If neither name works, edit
`.claude/settings.json` and put your interpreter in each hook command.

If the dashboard stays empty while a run is clearly happening, this is the
first thing to check: a hook whose command can't start fails silently by
design, so a broken interpreter path looks exactly like an idle pipeline.

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

A headless run can't answer a question either, so with `STORY_APPROVAL: true`
a requirements-mode run launched from here ends right after ba-agent, with the
created stories listed in its log. That's a finished run, not a stall — pick
up from there by starting a run on one of those story keys, or add "implement
all the stories" to the prompt to opt out of the checkpoint for that run.

Each run writes stdout to `.claude/runs/<target>-<timestamp>.log` (a document
path is flattened into a filename-safe slug). The runs panel shows status and
elapsed time, and can terminate a run. Clicking a run follows it in the Live
transcript pane; the newest run is followed automatically. When a run
finishes, the pane's header picks up its duration, turn count and cost from
the stream's final `result` line. A ticket already running can't be started
twice.

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
- The Live transcript pane only has content for runs started **from the
  dashboard** — that's where the stream-json log comes from. A run you type
  into the CLI yourself still drives everything else (active agent, stage
  tracker, handoffs, event log) via hooks, since those don't depend on
  capturing the process's stdout.
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
