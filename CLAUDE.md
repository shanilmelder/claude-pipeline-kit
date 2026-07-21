# Agentic Development Pipeline

This project uses a fleet of subagents to take a Jira ticket from intake to a
merge-ready PR.

**If you are the top-level Claude Code session** (not a subagent): your only
job regarding this pipeline is to spawn `orchestrator-agent` via the Task
tool whenever a person gives you a ticket ID or asks to run the pipeline,
passing along the ticket ID and any explicit overrides they mentioned (e.g.
autonomous mode for this run). Wait for `orchestrator-agent` to finish, then
relay its final summary back to the person. Do not perform any pipeline step
yourself, and do not read the rest of this file as instructions for
yourself — the sections below (`Pipeline`, `Rules`, etc.) describe
`orchestrator-agent`'s job, not yours. This requires nested subagent support
(Claude Code v2.1.172+); if your version doesn't support a subagent spawning
subagents, `orchestrator-agent` will fail when it tries to spawn
research-agent/backend-agent/etc. — check `claude --version` and upgrade if
needed, or fall back to running the pipeline steps directly from the
top-level session instead (older approach, still works, just loses the
"orchestrator shows up as its own agent in the dashboard" benefit).

**If you are `orchestrator-agent`**: you do not write code or review it
yourself — you decide which subagent runs next, pass context between them,
and perform the final merge action once QA passes. Everything below is
written for you.

A live dashboard of pipeline activity is available — see `dashboard/README.md`
to run it. It reads events logged by hooks configured in `.claude/settings.json`
and requires no setup beyond `python3 dashboard/server.py`.

## Config

```
AUTONOMOUS_MODE: true
REVIEWER_BOT_GITHUB_USERNAME: revieweragent2
QA_BOT_GITHUB_USERNAME: qaagent3
```

Fill in the actual GitHub usernames of the `pipeline-reviewer-bot` and
`pipeline-qa-bot` accounts above — backend-agent and frontend-agent need
these to add them as requested reviewers when either opens a PR.

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

## Tech Stack

```
Backend: .NET 10
Frontend: React 19
Database: <set me>
Testing (backend): <set me, e.g. xUnit>
Testing (frontend): <set me, e.g. Vitest + React Testing Library>
Package manager: <set me, e.g. npm / pnpm / NuGet>
Other conventions: <set me, e.g. "REST APIs only, no GraphQL" or "Tailwind for styling">
```

Every subagent that writes, reviews, or evaluates code must treat this as a
hard constraint, not a suggestion:

- **research-agent**: when recommending an approach, it must be achievable
  within this stack. If the ticket seems to require a technology outside this
  list (e.g. a ticket asking for a Python microservice when the stack says
  .NET), flag that explicitly under "Open Questions / Risks" rather than
  quietly recommending the off-stack option.
- **backend-agent**: must use the exact "Backend" technology/version. If
  the existing codebase conflicts with this config (e.g. repo is still on
  .NET 8), flag the mismatch in the PR description and default to matching
  the *existing codebase* over this config for that specific ticket, rather
  than doing a surprise framework upgrade as a side effect of an unrelated
  feature. A stack upgrade should be its own ticket, not smuggled in.
- **frontend-agent**: same rule, using the exact "Frontend" technology/
  version. Same fallback to matching the existing codebase over a surprise
  upgrade.
- **reviewer-agent**: should REJECT a PR that introduces a library, framework,
  or version inconsistent with this config without a called-out reason (e.g.
  a one-off script dependency is fine; quietly adding a second HTTP client
  library isn't).
- **qa-agent**: no special action needed here beyond running the stack's
  actual test tooling (see Testing rows above) rather than guessing commands.

Update the placeholders above with your real choices — the two you mentioned
(.NET 10 backend, React 19 frontend) are filled in as an example.

Each subagent uses its own GitHub and Jira MCP server connection, registered
under a distinct alias, so its actions are attributable to a specific bot
account rather than one shared identity. The orchestrator (this file) has its
own identity too, since it's the one performing merges and Jira transitions —
it should not reuse any subagent's credentials.

| Role              | GitHub alias           | Jira/Atlassian alias  | Used for |
|-------------------|-------------------------|------------------------|----------|
| orchestrator-agent | `github-orchestrator`  | `jira-orchestrator`   | merging PRs, all status transitions |
| research-agent     | —                       | `jira-research`       | reading ticket/context only |
| backend-agent      | `github-backend`       | —                      | branch, commit, open/update PR (backend changes) |
| frontend-agent     | `github-frontend`      | —                      | branch, commit, open/update PR (frontend changes) |
| reviewer-agent     | `github-reviewer`      | —                      | reading diff, submitting APPROVE/REQUEST_CHANGES review, posting comments |
| qa-agent           | `github-qa`            | `atlassian-qa`        | reading PR, submitting APPROVE/REQUEST_CHANGES review, reading ticket for verification |

backend-agent and frontend-agent each use their own GitHub identity —
`github-backend` and `github-frontend` — even though they often commit to
the same branch/PR. Whichever one is building on the other's branch (see
Pipeline below) authenticates as itself when pushing its own commits, so PR
commit history still attributes each domain's changes to the right bot
account.

Note: research-agent and qa-agent connect to Jira through different actual
MCP tool sets (`jira-research` exposes `get_issue`/`search_issues`;
`atlassian-qa` exposes the Atlassian-style `getAccessibleAtlassianResources`/
`getJiraIssue`, which requires fetching the cloudId first). Match whichever
tool names your actual connected server exposes — check with `/mcp` rather
than assuming, since server versions vary.

Register each as a separate MCP server pointing at a distinct bot account's
token, e.g.:

```bash
claude mcp add --transport http github-orchestrator https://api.githubcopilot.com/mcp \
  -H "Authorization: Bearer ORCHESTRATOR_BOT_PAT"
claude mcp add --transport http github-backend https://api.githubcopilot.com/mcp \
  -H "Authorization: Bearer BACKEND_BOT_PAT"
claude mcp add --transport http github-frontend https://api.githubcopilot.com/mcp \
  -H "Authorization: Bearer FRONTEND_BOT_PAT"
claude mcp add --transport http github-reviewer https://api.githubcopilot.com/mcp \
  -H "Authorization: Bearer REVIEWER_BOT_PAT"
claude mcp add --transport http github-qa https://api.githubcopilot.com/mcp \
  -H "Authorization: Bearer QA_BOT_PAT"

claude mcp add --transport http jira-orchestrator https://mcp.atlassian.com/v1/mcp \
  -H "Authorization: Bearer ORCHESTRATOR_BOT_JIRA_TOKEN"
claude mcp add --transport http jira-research https://mcp.atlassian.com/v1/mcp \
  -H "Authorization: Bearer RESEARCH_BOT_JIRA_TOKEN"
claude mcp add --transport http atlassian-qa https://mcp.atlassian.com/v1/mcp \
  -H "Authorization: Bearer QA_BOT_JIRA_TOKEN"
```

Provision each as a real, separate bot account (`pipeline-orchestrator-bot`,
`pipeline-backend-bot`, `pipeline-frontend-bot`, `pipeline-reviewer-bot`,
`pipeline-qa-bot`) on both GitHub and Jira, each with the minimum permissions
that role actually needs (e.g. `github-reviewer` and `github-qa` need
`Pull requests: write` to submit a review, but never need `Contents: write`
— they don't push code; `jira-research` never needs transition permissions).
This is what makes the separation meaningful — if every alias points at the
same underlying account, the attribution is cosmetic only.

Use `mcp__github-orchestrator__...` / `mcp__jira-orchestrator__...` tool names
for merges and transitions elsewhere in this file.

## Subagents available

- `orchestrator-agent` — this file's audience; spawns everything below,
  transitions the ticket, merges the PR
- `research-agent` — investigates the ticket + codebase, produces a brief
- `backend-agent` — implements backend/API changes, on the "Backend" stack
- `frontend-agent` — implements frontend/UI changes, on the "Frontend" stack
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
     questions, and end your run reporting this rather than guessing —
     you can't pause and wait for a human reply mid-run.
4. Read research-agent's `## Scope` section to see which implementer(s) are
   needed: `BACKEND_CHANGES_NEEDED` and `FRONTEND_CHANGES_NEEDED`.
   - **Only backend needed**: spawn `backend-agent` as branch owner (it
     creates the branch and opens the PR itself). Skip to step 6.
   - **Only frontend needed**: spawn `frontend-agent` as branch owner
     (creates branch, opens PR itself). Skip to step 6.
   - **Both needed**: spawn whichever research-agent's "Recommended
     Approach" said should go first (usually `backend-agent`, since
     frontend often needs the API contract) as branch owner — it creates the
     branch, implements, pushes, but does NOT open the PR. Wait for its
     branch name, then spawn the second agent, explicitly telling it the
     branch name and instructing it to build on top of that branch and open
     the PR itself once done (it's finishing last).
5. Once the PR is open (from whichever agent finished last), transition the
   ticket to **In Review**, then spawn `reviewer-agent` with the PR link/
   number. reviewer-agent submits an actual GitHub review (APPROVE or
   REQUEST_CHANGES) under its own account, in addition to reporting its
   verdict back to you.
   - If REJECT: transition the ticket back to **In Progress**. Read
     `BLOCKING_ISSUES` and route each item to the right agent — backend
     issues go to `backend-agent`, frontend issues go to `frontend-agent`,
     both if issues span both — as a retry pass on the *same* branch. Then
     return to the start of step 5. Cap retries at 3 total cycles — if still
     rejected after 3 attempts, stop and report to the human instead of
     looping forever (leave the ticket at `In Progress`).
   - If APPROVE: continue to step 6.
6. Spawn `qa-agent` with the PR link/number and ticket ID. qa-agent likewise
   submits its own GitHub review (APPROVE or REQUEST_CHANGES) under its own
   account. The ticket stays at `In Review` while QA runs.
   - If FAIL: transition the ticket back to **In Progress**, route
     `TEST_RESULTS`/unmet criteria to the relevant agent(s) (backend and/or
     frontend, same logic as above) as a retry pass, then return to the
     start of step 5 (re-review after a fix, don't skip straight back to QA
     — reviewer-agent should re-approve the new commits too). Same retry cap
     as above.
   - If PASS: continue to step 7.
7. Check `AUTONOMOUS_MODE` (see Config section, subject to any per-run
   override the human gave you).
   - If `false`: report full status — ticket, PR link, reviewer summary, QA
     summary — as your final response and stop before merging. You can't
     literally pause mid-run for input (see "Boundaries specific to you as a
     subagent" in your own agent definition); a follow-up run is how the
     human tells you to proceed.
   - If `true`: skip the check-in and proceed straight to step 8, but still
     post the same summary as a Jira comment and PR comment for visibility.
   The ticket stays at `In Review` until the merge actually happens either way.
8. On go-ahead, merge the PR via the GitHub MCP tool, then transition the
   ticket to **Done**. Only transition to Done after the merge succeeds —
   never before.

## Rules

- Never let a subagent merge a PR or transition the Jira ticket — those
  actions stay with you, the orchestrator. reviewer-agent and qa-agent DO
  submit real GitHub reviews (approve/request changes) under their own
  accounts — that's expected and intentional, not something to prevent.
  backend-agent and frontend-agent must never approve or review their own
  (or each other's) PR.
- Always pass full context explicitly in each subagent prompt (ticket text,
  branch name, PR number, prior feedback, and — for backend-agent/
  frontend-agent — whether they're the branch owner or building on an
  existing branch). Subagents have no memory of earlier steps.
- If research-agent flags the ticket as too ambiguous to proceed, stop and
  report rather than spawning backend-agent or frontend-agent.
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
- Recommended: set a branch protection rule on `main` requiring both
  `pipeline-reviewer-bot` and `pipeline-qa-bot`'s approving reviews before a
  PR is mergeable at all. This makes the approval gate real at the GitHub
  level, not just something the orchestrator's logic happens to check for.
- Every Jira transition is a real orchestrator action, not a status implied
  by conversation — if a transition call fails (e.g. invalid transition for
  the ticket's workflow), stop and surface the error rather than treating the
  ticket as if it moved.
