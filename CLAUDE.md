# Agentic Development Pipeline

This project uses a fleet of subagents to take a Jira ticket from intake to a
merge-ready PR.

One-time setup (bot accounts, MCP registration, branch protection) lives in
`docs/PIPELINE-SETUP.md`, not here — this file is injected into every
subagent's context on every run, so it stays limited to what agents need at
runtime.

**If you are the top-level Claude Code session** (not a subagent): your only
job regarding this pipeline is to spawn `orchestrator-agent` via the Task tool
whenever a person gives you a ticket ID or asks to run the pipeline, passing
along the ticket ID and any explicit overrides they mentioned (e.g. autonomous
mode for this run). Wait for it to finish, then relay its final summary. Do
not perform any pipeline step yourself, and do not read the rest of this file
as instructions for yourself — the sections below describe
`orchestrator-agent`'s job.

Requires nested subagent support (Claude Code v2.1.172+). If your version
doesn't support a subagent spawning subagents, `orchestrator-agent` will fail
when it spawns research-agent — check `claude --version`.

**If you are `orchestrator-agent`**: you do not write or review code yourself
— you decide which subagent runs next, pass context between them, and perform
the final merge once the gate passes. Everything below is written for you.

A live dashboard of pipeline activity is available — `python3
dashboard/server.py`, see `dashboard/README.md`.

## Config

```
AUTONOMOUS_MODE: true
REVIEWER_BOT_GITHUB_USERNAME: revieweragent2
QA_BOT_GITHUB_USERNAME: qaagent3
```

`AUTONOMOUS_MODE` is the project-wide default and the single source of truth —
there is no separate default stated elsewhere. When `true`, step 7 skips the
human check-in and merges once the gate passes. A person can override it for a
single run by saying so explicitly ("run PROJ-123 fully autonomously" forces it
on; "check with me before merging" forces it off). Read the caution in
`docs/PIPELINE-SETUP.md` before enabling it on a shared repo.

## Tech Stack

```
Backend: .NET 10
Frontend: React 19
Database: PostgreSQL 18
Testing (backend): xUnit
Testing (frontend): Vitest + React Testing Library
Package manager: npm / NuGet
Other conventions: REST APIs and Tailwind for styling
```

Every subagent that writes, reviews, or evaluates code treats this as a hard
constraint:

- **research-agent**: the recommended approach must be achievable within this
  stack. If the ticket seems to require something outside it, flag that under
  "Open Questions / Risks" rather than quietly recommending the off-stack
  option.
- **backend-agent / frontend-agent**: use the exact version listed. If the
  existing codebase conflicts (e.g. repo is still on .NET 8), match the
  *existing codebase* for this ticket and flag the mismatch in the PR
  description — a stack upgrade is its own ticket, never a side effect.
- **reviewer-agent**: REJECT a PR that introduces a library, framework, or
  version inconsistent with this config without a called-out reason (a one-off
  script dependency is fine; quietly adding a second HTTP client isn't).
- **qa-agent**: run the stack's actual test tooling (see Testing rows) rather
  than guessing commands.

## Service account identities

Each subagent uses its own GitHub/Jira MCP alias so actions are attributable to
a specific bot account.

| Role | GitHub alias | Jira alias | Used for |
|---|---|---|---|
| orchestrator-agent | `github-orchestrator` | `jira-orchestrator` | merging PRs, all status transitions, summary comments |
| research-agent | — | `jira-research` | reading ticket/context only |
| backend-agent | `github-backend` | — | branch, commit, open/update PR (backend) |
| frontend-agent | `github-frontend` | — | branch, commit, open/update PR (frontend) |
| reviewer-agent | `github-reviewer` | — | reading diff, submitting review, comments |
| qa-agent | `github-qa` | `jira-qa` | reading PR, submitting review, reading ticket |

backend-agent and frontend-agent each authenticate as themselves when pushing,
even on a shared branch, so commit history attributes each domain's changes to
the right bot.

Use `mcp__github-orchestrator__...` / `mcp__jira-orchestrator__...` for merges,
transitions, and comments.

## Subagents available

- `orchestrator-agent` — this file's audience; spawns everything below
- `research-agent` — investigates ticket + codebase, produces a brief
- `backend-agent` — implements backend/API changes
- `frontend-agent` — implements frontend/UI changes
- `reviewer-agent` — code review, returns APPROVE/REJECT
- `qa-agent` — runs tests + validates acceptance criteria, returns PASS/FAIL

## Jira status transitions

The orchestrator — not any subagent — owns all Jira status changes.

Status flow: `To Do → In Progress → In Review → Done`

- Verify current status when you fetch the ticket. If it isn't `To Do` (e.g.
  already `In Progress` from a partial run), proceed anyway but note the
  discrepancy in your final report.
- Look up the exact transition IDs for this project's workflow first — the
  names above are display names. **Fetch transitions once at the start of the
  run and reuse the IDs**; don't re-fetch before every transition.
- If a transition doesn't exist on this workflow, stop and ask rather than
  guessing or skipping the update silently.
- If the pipeline stops early, leave the ticket where it is and comment
  explaining why, rather than forcing a status that doesn't reflect reality.
- Every transition is a real action. If a transition call fails, surface the
  error rather than treating the ticket as if it moved.

## Pipeline

Given a Jira ticket ID (e.g. "run the pipeline on PROJ-123"):

1. Fetch the ticket to confirm it exists and get its description and status.
   In the same step, fetch the workflow's transition IDs (see above).
2. Transition to **In Progress**.
3. Spawn `research-agent` with the ticket ID and full description text —
   include the description you already fetched so it doesn't re-fetch.
   - If it flags the ticket as too ambiguous to proceed, stop. Leave the
     ticket at `In Progress`, comment with the open questions, and report.
     Normal product ambiguities that have a sensible default (e.g. "redirect
     to login or dashboard?") are **not** blockers — research-agent should
     assume a default and list it as a risk. Only a genuine "we cannot tell
     what to build" blocks.
4. Read research-agent's `## Scope` for `BACKEND_CHANGES_NEEDED` /
   `FRONTEND_CHANGES_NEEDED`, and `## Interface Contract` if both are needed.
   - **One implementer needed**: spawn it as branch owner — it creates the
     branch, implements, and opens the PR itself. Go to step 5.
   - **Both needed**: they share one branch, in the order research-agent's
     `IMPLEMENTATION_ORDER` specifies. Spawn the first as branch owner; it
     creates the branch, implements, pushes, and does **not** open the PR.
     Then spawn the second with the branch name, instructing it to build on
     that branch and open the PR (it finishes last).
   - Pass `## Interface Contract` verbatim to **both** implementers. That
     contract is what lets the second agent work without re-deriving the
     first's API shapes, and what lets a retry pass touch one side without
     breaking the other.
5. Once the PR is open, transition to **In Review**, then spawn
   `reviewer-agent` and `qa-agent` **in parallel** — a single message with
   both Task calls. Give each the PR number, the ticket ID and acceptance
   criteria, and the head commit SHA.
   - They are independent read-only verdicts, so serializing them wastes a
     full agent turn and, worse, produces a fix-review-fix-QA ladder where
     each round surfaces only one class of problem. Running both means one
     retry pass addresses everything found.
   - qa-agent works in an isolated git worktree, so it will not disturb
     reviewer-agent's view of the tree or the user's working copy.
   - Collect both verdicts before deciding anything.
6. Decide from the two verdicts:
   - **Both APPROVE/PASS**: go to step 7.
   - **Either REJECT or FAIL**: transition back to **In Progress**. Merge
     `BLOCKING_ISSUES` and unmet `ACCEPTANCE_CRITERIA`/`TEST_RESULTS` into one
     feedback set, split it by domain, and spawn the relevant implementers —
     backend issues to `backend-agent`, frontend to `frontend-agent`, both in
     **parallel** if issues span both, since they touch disjoint directories.
     Whichever pushes second must rebase/pull first. Then return to step 5.
   - On a retry pass, tell reviewer-agent and qa-agent the **previous head
     SHA** so they review the incremental diff and re-run the affected tests,
     rather than re-reviewing the whole PR from scratch.
   - Cap at 3 full cycles. If still failing, stop, leave the ticket at
     `In Progress`, and report the blocker rather than looping.
7. Check `AUTONOMOUS_MODE` (subject to any per-run override).
   - `false`: report full status — ticket, PR link, reviewer summary, QA
     summary — as your final response and stop before merging. You can't
     pause mid-run for input; a follow-up run is how the human says go.
   - `true`: proceed to step 8, and post the same summary as a Jira comment
     and a PR comment for visibility.
   The ticket stays at `In Review` until the merge actually happens.
8. Merge the PR, then transition to **Done**. Only transition to Done after
   the merge succeeds — never before. If the merge is refused (e.g. branch
   protection requires a review you don't have, or the branch is behind),
   report that; do not work around it.

## Rules

- Never let a subagent merge a PR or transition the Jira ticket — those stay
  with you. reviewer-agent and qa-agent DO submit real GitHub reviews under
  their own accounts; that's intentional. backend-agent and frontend-agent
  must never approve or review their own or each other's PR.
- Always pass full context explicitly in each subagent prompt — ticket text,
  acceptance criteria, branch name, PR number, head SHA, prior feedback, the
  interface contract, and (for implementers) whether they own the branch.
  Subagents have no memory of earlier steps or of each other.
- Pass context by **value, not by reference**: paste the ticket text and
  contract into the prompt rather than telling an agent to go fetch it. Every
  redundant fetch is a round trip and a chance to read a different version.
- Prefer parallel spawns wherever two agents don't depend on each other's
  output: reviewer + QA always; backend + frontend on retry passes when the
  feedback spans both.
- Retry cap is 3 full cycles per ticket, counted across review and QA
  together.
