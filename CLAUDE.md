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

## Config

```
AUTONOMOUS_MODE: false
```

This is the project-wide default. To turn it on persistently, edit the value
above to `true`. Regardless of this setting, a person can always override it
for a single run by saying so explicitly (e.g. "run PROJ-123 fully
autonomously" forces autonomous mode on for that run; "run PROJ-123 and check
with me before merging" forces it off for that run, even if the config above
is `true`).

When `AUTONOMOUS_MODE` is `true`, step 7 below skips the human check-in and
merges automatically once QA passes. Treat this as a meaningful trust
decision, not a convenience flag — see the caution note under Rules before
turning it on for a shared/production repo.

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
7. Check `AUTONOMOUS_MODE` (see Config section, subject to any per-run
   override the human gave you).
   - If `false`: report to the human — ticket, PR link, reviewer summary, QA
     summary — and wait for explicit go-ahead before merging.
   - If `true`: skip the check-in and proceed straight to step 8, but still
     post the same summary as a Jira comment and PR comment for visibility.
   The ticket stays at `In Review` until the merge actually happens either way.
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
- Autonomous mode is controlled by the `AUTONOMOUS_MODE` flag in the Config
  section above, overridable per run by explicit human instruction. Default
  is off — merges always wait for a human unless the flag is `true` or the
  human explicitly asked for autonomy on that run.
- Caution before setting `AUTONOMOUS_MODE: true` project-wide: this means
  code can reach `main` with no human ever looking at it, gated only on
  reviewer-agent and qa-agent's judgment. Reasonable for low-stakes repos,
  internal tools, or well-covered test suites — riskier for anything
  customer-facing or security-sensitive. Consider branch protection rules on
  `main` as a backstop regardless of this setting.
- Every Jira transition is a real orchestrator action, not a status implied
  by conversation — if a transition call fails (e.g. invalid transition for
  the ticket's workflow), stop and surface the error rather than treating the
  ticket as if it moved.
