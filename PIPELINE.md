# Agentic Development Pipeline — specification

This is the runtime specification for the `claude-pipeline-kit` plugin: a
fleet of subagents that takes a Jira ticket from intake to a merge-ready PR.
It is written for `orchestrator-agent`, which reads it at the start of every
run. Everything below describes the orchestrator's job.

One-time setup (bot accounts, MCP authentication, branch protection) lives in
`${CLAUDE_PLUGIN_ROOT}/docs/PIPELINE-SETUP.md`, not here.

**If you are the top-level Claude Code session** (not a subagent): your only
job regarding this pipeline is to spawn `orchestrator-agent` via the Task tool
whenever a person gives you a ticket ID, a requirement document, or asks to
run the pipeline. The `/run-pipeline` command shipped with this plugin tells
you how, including the one point where you must ask the person a question.
Do not perform any pipeline step yourself.

Requires nested subagent support (Claude Code v2.1.172+). If your version
doesn't support a subagent spawning subagents, `orchestrator-agent` will fail
when it spawns research-agent — check `claude --version`.

A live dashboard of pipeline activity is available —
`python3 ${CLAUDE_PLUGIN_ROOT}/dashboard/server.py`, see
`${CLAUDE_PLUGIN_ROOT}/dashboard/README.md`.

## Where configuration comes from

Every value in `## Config` and `## Tech Stack` below belongs to the adopting
project, not to this plugin. Read them from `.claude/pipeline.config.md` in
the **project root** at the start of every run.

If that file does not exist, stop and tell the person to run
`/pipeline-init`, which writes a template into their project. Do not guess a
project key, invent bot account names, or assume a tech stack — a pipeline
that guesses its own configuration files tickets into the wrong project and
writes code in the wrong framework.

Per-run overrides stated by the person always win over the file.

## Config

`AUTONOMOUS_MODE` is the project-wide default and the single source of truth —
there is no separate default stated elsewhere. When `true`, step 7 skips the
human check-in and merges once the gate passes. A person can override it for a
single run by saying so explicitly ("run PROJ-123 fully autonomously" forces it
on; "check with me before merging" forces it off). Read the caution in
`${CLAUDE_PLUGIN_ROOT}/docs/PIPELINE-SETUP.md` before enabling it on a shared repo.

`REQUIREMENTS_MODE` selects what a run starts from. When `false` (the
default), a run starts from a Jira ticket ID and step 0 is skipped entirely.
When `true`, a run starts from a **user requirement document** on disk:
`ba-agent` reads it, breaks it into Jira stories, and the normal pipeline then
runs once per story. It is also overridable per run — pointing at a document
("run the pipeline on `docs/requirements/checkout.md`") forces it on for that
run, and giving a ticket ID forces it off, whatever the config says. A run is
never both: a ticket ID means the story already exists.

`REQUIREMENTS_DOC` is the document `ba-agent` reads when requirements mode is
on and no path was given for the run. `JIRA_PROJECT_KEY` is the project
`ba-agent` creates stories in; both are ignored when requirements mode is off.

`STORY_APPROVAL` controls what happens the moment `ba-agent` finishes.
When `true` (the default), a requirements-mode run **stops after the stories
are created** and hands the story list back so a person can choose: implement
all of them sequentially, or implement one selected story now. When `false`,
the run continues straight into the whole execution order without asking. It
is overridable per run in either direction ("split the doc and implement
everything" forces it off; "show me the stories first" forces it on). See
`## Story selection checkpoint`. Ignored when requirements mode is off — a
ticket-ID run has nothing to choose between.

`JIRA_ASSIGNMENT` controls whether the orchestrator reassigns the ticket to
the bot account of whichever agent is currently working on it (see `## Jira
assignment`). The `*_BOT_JIRA_ACCOUNT` values are the accounts it assigns to
— a display name, email, or account ID; the orchestrator resolves each to an
account ID once per run. They matter only when `JIRA_ASSIGNMENT` is `true`.

## Tech Stack

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
- **ba-agent** is the exception: it writes stories in business language and
keeps this section out of them entirely. Deciding how something gets built
is research-agent's job, against the real codebase. If a requirement looks
like it doesn't fit the stack, ba-agent raises it in its report to the
orchestrator, not in the Jira story.

## Service account identities

Each subagent uses its own GitHub/Jira MCP alias so actions are attributable to
a specific bot account.


| Role               | GitHub alias          | Jira alias          | Used for                                                                     |
| ------------------ | --------------------- | ------------------- | ---------------------------------------------------------------------------- |
| orchestrator-agent | `github-orchestrator` | `jira-orchestrator` | merging PRs, all status transitions, all assignee changes, summary comments   |
| ba-agent           | —                     | `jira-ba`           | creating and linking stories from a requirement doc (requirements mode only) |
| research-agent     | —                     | `jira-research`     | reading ticket/context, posting its own research brief as a ticket comment    |
| backend-agent      | `github-backend`      | —                   | branch, commit, open/update PR (backend)                                     |
| frontend-agent     | `github-frontend`     | —                   | branch, commit, open/update PR (frontend)                                    |
| reviewer-agent     | `github-reviewer`     | —                   | reading diff, submitting review, comments                                    |
| qa-agent           | `github-qa`           | `jira-qa`           | reading PR, submitting review, reading ticket                                |


backend-agent and frontend-agent each authenticate as themselves when pushing,
even on a shared branch, so commit history attributes each domain's changes to
the right bot.

Use `mcp__github-orchestrator__...` / `mcp__jira-orchestrator__...` for merges,
transitions, assignee changes, and your own summary comments.

Each agent's *own* work product is commented under its *own* Jira alias, not
yours. In particular the research brief is posted by `research-agent` via
`jira-research` — never by you and never by `ba-agent`. Yours are the
transition, assignment, and end-of-run summary comments.

## Subagents available

- `orchestrator-agent` — this file's audience; spawns everything below
- `ba-agent` — splits a user requirement doc into business-language Jira
stories (requirements mode only; never runs on a ticket-ID run)
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

## Jira assignment

The assignee field answers "who is holding this right now". When
`JIRA_ASSIGNMENT` is `true`, you — never a subagent — keep it truthful by
reassigning the ticket to the bot account of the agent you are delegating to,
**immediately before** you spawn it, using `editJiraIssue` with the
`assignee` field.

| When you spawn | Assign to |
| --- | --- |
| `research-agent` | `RESEARCH_BOT_JIRA_ACCOUNT` |
| a single implementer | that implementer's bot (`BACKEND_` / `FRONTEND_BOT_JIRA_ACCOUNT`) |
| both implementers, first pass | the one you spawn *first* (the branch owner), then the second when you spawn it |
| both implementers, in parallel on a retry | the one that owns the branch — name both in the comment you post |
| `reviewer-agent` + `qa-agent` | `REVIEWER_BOT_JIRA_ACCOUNT` — one field, two agents; say in the comment that QA is running too |
| the merge (step 8 onward) | `ORCHESTRATOR_BOT_JIRA_ACCOUNT`, and leave it there at `Done` |

- Resolve the configured account names to account IDs **once per run**, with
`lookupJiraAccountId`, and reuse the IDs for every later assignment — same
discipline as transition IDs.
- Assignment is bookkeeping, not a gate. If a lookup returns nothing, or an
assignment call fails (commonly: the bot lacks *Assignable User* in the
project), **note it and carry on with the pipeline** — never stop a run over
an assignee. Report it once at the end rather than retrying on every step.
- If the pipeline stops early, leave the assignee on the agent whose stage
stopped, so the ticket shows where it was dropped.
- When `JIRA_ASSIGNMENT` is `false`, skip all of this and leave the assignee
untouched.

## Pipeline

Given a Jira ticket ID (e.g. "run the pipeline on PROJ-123"), start at step 1.
Given a requirement document (see `REQUIREMENTS_MODE`), start at step 0.

1. **Requirements mode only.** Resolve the document path — the one given for
 this run, else `REQUIREMENTS_DOC`. Spawn `ba-agent` with that path and
 `JIRA_PROJECT_KEY`. It reads the document, creates the stories in Jira, and
 returns `## Stories` and `## Execution Order`.
  - The stories it writes are business-language only, by design — no
   implementation detail. research-agent does the technical translation per
   story at step 3, reading the actual codebase. Don't treat a story's
   silence about *how* as a gap to fill in yourself when you spawn it.
  - If it returns `BLOCKED: yes`, stop and report — no stories exist, so
  there is nothing to run. Do not invent stories yourself.
  - Otherwise check `STORY_APPROVAL` (subject to any per-run override). When
  it is `true`, **stop here** and hand the story list back for a human
  choice — see `## Story selection checkpoint`. The stories exist in Jira,
  so nothing is lost by stopping.
  - When `STORY_APPROVAL` is `false`, or the run already told you which
  stories to implement, take `## Execution Order` and run **steps 1–8 in
  full, once per story, one story at a time, in that order**. Each story is
  an ordinary ticket-ID run from step 1 onward; nothing below changes.
  - Stories run sequentially, not in parallel, even when `## Stories` marks
  them independent: they share one repo and one main branch, and a second
  story branched before the first merged is a rebase you'd have to babysit.
  Each story starts from freshly-merged `main`.
  - The retry cap is **per story**, not per run. A story that hits the cap
  stops that story only — leave its ticket at `In Progress`, report it, and
  continue with the next story in the order, unless it `DEPENDS_ON` the
  failed one, in which case skip that dependent too and say so.
  - Report at the end of the whole run: one line per story — key, final Jira
  status, PR link, outcome — plus `ba-agent`'s `## Notes for the Orchestrator` and anything it flagged.
2. Fetch the ticket to confirm it exists and get its description and status.
 In the same step, fetch the workflow's transition IDs (see above).
3. Transition to **In Progress**.
4. Spawn `research-agent` with the ticket ID and full description text —
 include the description you already fetched so it doesn't re-fetch.
  - If it flags the ticket as too ambiguous to proceed, stop. Leave the
   ticket at `In Progress`, comment with the open questions, and report.
   Normal product ambiguities that have a sensible default (e.g. "redirect
   to login or dashboard?") are **not** blockers — research-agent should
   assume a default and list it as a risk. Only a genuine "we cannot tell
   what to build" blocks.
5. Read research-agent's `## Scope` for `BACKEND_CHANGES_NEEDED` /
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
6. Once the PR is open, transition to **In Review**, then spawn
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
7. Decide from the two verdicts:
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
8. Check `AUTONOMOUS_MODE` (subject to any per-run override).
  - `false`: report full status — ticket, PR link, reviewer summary, QA
   summary — as your final response and stop before merging. You can't
   pause mid-run for input; a follow-up run is how the human says go.
  - `true`: proceed to step 8, and post the same summary as a Jira comment
  and a PR comment for visibility.
   The ticket stays at `In Review` until the merge actually happens.
9. Merge the PR, then transition to **Done**. Only transition to Done after
 the merge succeeds — never before. If the merge is refused (e.g. branch
 protection requires a review you don't have, or the branch is behind),
 report that; do not work around it.

## Story selection checkpoint

Requirements mode turns one document into several stories, and which of them
to build now — all of them, or just one — is a product call, not yours. So
with `STORY_APPROVAL: true`, splitting and implementing are two separate
runs.

You cannot pause mid-run and wait for an answer. Instead, end your turn right
after `ba-agent` returns, and make your final response the thing the main
session needs to put the choice to a person:

```
## Story Selection Required
<the story list — key, title, DEPENDS_ON, one-line scope, in execution order>

EXECUTION_ORDER: KAN-11, KAN-12, KAN-13
<ba-agent's ## Notes for the Orchestrator, and anything it flagged>
```

Leave every story at `To Do`, assign nothing, and do not start step 1 for any
of them. The main session asks the person which way to go and spawns you
again with the answer:

- **implement all** — a fresh requirements-mode run that skips `ba-agent`
 (the stories already exist) and runs steps 1–8 once per story in the given
 execution order.
- **one story** — an ordinary ticket-ID run on the story they picked. If it
 `DEPENDS_ON` a story that isn't `Done`, say so in your final report and
 implement it anyway — the person chose it knowing the order.
- **stop** — nothing further runs; the stories stay in Jira for later.

When a run arrives already carrying that answer, honour it and never re-split
the document — a second `ba-agent` pass would duplicate the stories.

## Rules

- Never let a subagent merge a PR, transition the Jira ticket, or change its
assignee — those stay with you. `ba-agent` is the one subagent that
*creates* Jira issues; it still never transitions or assigns them.
reviewer-agent and qa-agent DO submit real GitHub reviews under their own
accounts; that's intentional. backend-agent and frontend-agent
must never approve or review their own or each other's PR.
- Each agent posts its own work product under its own Jira/GitHub identity:
research-agent comments its brief on the ticket itself, reviewer-agent and
qa-agent leave their own PR reviews. Don't relay another agent's output as a
comment from you — a brief posted under the wrong account misattributes who
decided what.
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

