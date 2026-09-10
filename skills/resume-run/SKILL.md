---
name: resume-run
description: Resume a pipeline run that stopped part-way — a ticket left at In Progress or In Review with a branch and possibly a PR already in flight — instead of restarting it from step 1. Use when orchestrator-agent is handed a ticket that a previous run already touched, including a story that hit the retry cap. Determines the real resume point from Jira and GitHub state and reuses the existing brief, branch and PR.
---

# Resuming a stopped run

A run stops part-way for ordinary reasons: the retry cap, an ambiguity
block, a failed merge, an interrupted session. The ticket is left where it
died by design, so the state on Jira and GitHub *is* the checkpoint. Restarting
at step 1 throws that away — it re-runs research that is already written and
can open a second branch for one ticket.

This skill is for `orchestrator-agent`. Subagents never resume anything; they
do the stage they are given.

## 1. Decide whether this is a resume at all

It is a resume only if the ticket is **not** at `To Do`, or a
`feature/<ticket-id>-*` branch already exists. A `To Do` ticket with no
branch is an ordinary fresh run — go to step 1 of the pipeline and ignore the
rest of this.

Never resume across stories. In requirements mode each story is its own
ticket with its own state; check the story you are about to start, not the run.

## 2. Read the checkpoint

Gather all of it before deciding anything:

- **Jira** — `getJiraIssue` on the ticket, *including comments*. Current
  status tells you how far the last run got. The comments hold
  research-agent's brief (posted under `jira-research`) and the
  orchestrator's own stop comment explaining why it ended.
- **GitHub** — look for a branch named `feature/<ticket-id>-<slug>` and any
  open PR from it. If a PR exists, read its reviews: reviewer-agent and
  qa-agent submit real reviews under their own accounts, so their verdicts
  survive the session that produced them.

The research brief being a Jira comment is the important one. If it is there,
**do not spawn research-agent again** — paste the comment into the
implementer's prompt exactly as you would have passed a fresh brief. A second
brief on the same ticket costs an agent turn and can contradict the first,
which is worse than costing a turn.

## 3. Resume point

| Checkpoint state | Resume at |
| --- | --- |
| Status moved past `To Do`, no branch, no brief comment | Step 4 — spawn research-agent |
| Brief comment exists, no branch | Step 5 — spawn implementer(s) as branch owner, brief pasted in |
| Branch exists, no PR | Step 5 — spawn the implementer that owns the branch, told to build on it and open the PR |
| PR open, no reviews | Step 6 — transition to `In Review` if needed, spawn reviewer + QA in parallel |
| PR open with REJECT/FAIL reviews | Step 7 retry — merge the review bodies and unmet criteria into one feedback set, split by domain, spawn the relevant implementers |
| PR open, both verdicts good, ticket still `In Review` | Step 8 — the run died before merging; check `AUTONOMOUS_MODE` and proceed |
| PR already merged, ticket not `Done` | Transition to `Done` and report. Never re-merge |

Transition the ticket only if the status does not already match where you are
resuming — the transition is a real action, not bookkeeping you replay.

## 4. Carry the retry count forward

The cap is 3 cycles **per story**, and a resumed run continues that count
rather than restarting it. The stop comment on the ticket should say how many
cycles the previous run spent; if it does not, count the review rounds on the
PR — each round of reviewer/QA verdicts is one cycle.

**If the previous run stopped because it hit the cap, do not silently start a
fourth cycle.** Looping again on the same blocker is exactly what the cap
exists to prevent. Stop and report the blocker, unless the person asking for
this run explicitly said to keep going — in which case say plainly in your
final report that the cap was overridden and on whose say-so.

## 5. Reassign and say what you did

`JIRA_ASSIGNMENT` still applies: reassign to the bot of whichever agent you
are about to spawn, immediately before spawning it, exactly as on a fresh run.

Post one Jira comment when you resume, saying which stage you resumed at and
what you reused (brief, branch, PR, prior verdicts). Someone reading the
ticket later needs to see that the second run picked up rather than started
over — otherwise two runs on one ticket look like a duplicate.

Open your final report with the resume point and the reused artifacts, then
report the rest of the run normally.

## 6. When the checkpoint is inconsistent

Two branches for one ticket, a PR whose head is not the ticket's branch, a
`Done` ticket with an unmerged PR — do not guess your way past it and do not
delete anything. Stop, leave the state alone, and report what you found. A
confused resume is more expensive than a human spending a minute on it.
