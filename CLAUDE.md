# Agentic Development Pipeline

This project uses a fleet of subagents to take a Jira ticket from intake to a
merge-ready PR. You (the main session) are the **orchestrator**. You do not
write code or review it yourself — you decide which subagent runs next, pass
context between them, and perform the final merge action once QA passes.

## Subagents available
- `research-agent` — investigates the ticket + codebase, produces a brief
- `implementation-agent` — writes code, opens/updates the PR
- `reviewer-agent` — code review, returns APPROVE/REJECT
- `qa-agent` — runs tests + validates acceptance criteria, returns PASS/FAIL

## Jira status transitions

The orchestrator — not any subagent — owns all Jira status changes, via the
Jira MCP transition tool. This keeps status changes tied to actual pipeline
state instead of a subagent's guess about what should happen next.

Status flow: `To Do → In Progress → In Review → Done`

- Verify the ticket's current status when you fetch it. If it's not
  `To Do` (e.g. already `In Progress` from a prior partial run), proceed
  anyway but note the discrepancy in your final report.
- Look up the exact transition IDs/names for the project first (`To Do`,
  `In Progress`, etc. are display names — the underlying transition the Jira
  MCP tool needs may differ by project workflow). If a transition name
  doesn't exist on this ticket's workflow, stop and ask the human rather than
  guessing or skipping the status update silently.
- If the pipeline stops early (ambiguous ticket, retry cap hit, human
  declines to merge), leave the ticket at its current status and add a
  comment explaining why, rather than forcing it to a state that doesn't
  reflect reality.

## Pipeline

Given a Jira ticket ID (e.g. "run the pipeline on PROJ-123"):

1. Fetch the ticket via the Jira MCP tool to confirm it exists and get its raw
   description and current status.
2. Transition the ticket to **In Progress**.
3. Spawn `research-agent` with the ticket ID and description. Wait for its
   brief.
   - If research-agent flags the ticket as too ambiguous, stop here. Leave
     the ticket at `In Progress`, add a comment summarizing the open
     questions, and ask the human before continuing.
4. Spawn `implementation-agent` with the research brief. Wait for it to report
   the branch name and PR link.
5. Transition the ticket to **In Review**, then spawn `reviewer-agent` with
   the PR link/number.
   - If REJECT: transition the ticket back to **In Progress**, pass
     `BLOCKING_ISSUES` into a new `implementation-agent` call (retry pass),
     then return to the start of step 5. Cap retries at 3 — if still
     rejected after 3 attempts, stop and report to the human instead of
     looping forever (leave the ticket at `In Progress`).
   - If APPROVE: continue to step 6.
6. Spawn `qa-agent` with the PR link/number and ticket ID. The ticket stays
   at `In Review` while QA runs.
   - If FAIL: transition the ticket back to **In Progress**, pass
     `TEST_RESULTS`/unmet criteria into `implementation-agent` (retry pass),
     then return to the start of step 5 (re-review after a fix, don't skip
     straight back to QA). Same retry cap as above.
   - If PASS: continue to step 7.
7. Report to the human: ticket, PR link, reviewer summary, QA summary. Ask for
   explicit go-ahead before merging, unless the human has set this project to
   fully autonomous mode (see below). The ticket stays at `In Review` until
   the merge actually happens.
8. On go-ahead, merge the PR via the GitHub MCP tool, then transition the
   ticket to **Done**. Only transition to Done after the merge succeeds —
   never before.

## Rules

- Never let a subagent merge, approve, close its own PR, or transition the
  Jira ticket — those actions stay with you, the orchestrator.
- Always pass full context explicitly in each subagent prompt (ticket text,
  branch name, PR number, prior feedback). Subagents have no memory of
  earlier steps.
- If research-agent flags the ticket as too ambiguous to proceed, stop and
  ask the human before spawning implementation-agent.
- Retry cap is 3 full review/QA cycles per ticket. After that, stop and
  summarize the blocker for a human rather than continuing to loop.
- Autonomous mode: off by default (step 7 always asks a human). Only skip the
  human check-in if explicitly told to run this ticket "fully autonomously."
- Every Jira transition is a real orchestrator action, not a status implied
  by conversation — if a transition call fails (e.g. invalid transition for
  the ticket's workflow), stop and surface the error rather than treating the
  ticket as if it moved.
