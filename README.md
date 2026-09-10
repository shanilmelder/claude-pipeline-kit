# claude-pipeline-kit

A fleet of Claude Code subagents that takes a Jira ticket — or a whole
requirement document — from intake to a merge-ready PR.

A run researches the ticket against your codebase, implements it, opens a PR,
then gates that PR behind an independent code review and a QA pass that runs
your real test suite. Each stage acts as its own bot account, so the Jira
history and the GitHub review trail show who decided what.

## Install

```bash
claude plugin marketplace add shanilmelder/claude-pipeline-kit
claude plugin install claude-pipeline-kit@claude-pipeline-kit
```

Install prompts for five GitHub bot tokens and stores them as secrets. Running
everything as one account instead? Set `ACCOUNT_SEPARATION: false` (see
below) and paste the same token into all five prompts. Pin a
release with `claude plugin marketplace add shanilmelder/claude-pipeline-kit@v1.0`
— agent prompts are behaviour, and you probably don't want them changing
under a running team.

Then, in the project you want the pipeline to work on:

```
/pipeline-init
```

That writes `.claude/pipeline.config.md` — your Jira project key, bot account
names, tech stack, and whether runs merge autonomously. Commit it.

Before the first run, work through `docs/PIPELINE-SETUP.md` for the parts no
installer can do: creating the bot accounts, authenticating each Jira alias
while logged in as the right bot, and branch protection.

## Use

```
/run-pipeline PROJ-123                      # one ticket
/run-pipeline docs/requirements/checkout.md # split a document into stories, then build them
```

With `STORY_APPROVAL: true`, a document run stops after the stories are
created and asks which to build — all of them, one, or none.

`python3 dashboard/server.py` shows runs live.

## What's in it

Seven agents (`ba`, `research`, `backend`, `frontend`, `reviewer`, `qa`,
`orchestrator`), two skills (`run-tests`, `resume-run`), two commands, and
nine MCP server definitions. `PIPELINE.md` is the specification the
orchestrator follows; read it if you want to know exactly what a run does.

### One account or several

`ACCOUNT_SEPARATION` in `.claude/pipeline.config.md` decides whether the
pipeline runs as five GitHub bots and four Jira bots, or as a single account
wearing every hat.

Separated is the default and the stronger setup: a different account approves
the PR than opened it, so branch protection can make the review gate binding.
Single-account is far quicker to set up and runs the identical pipeline —
same research, same review, same tests — with one difference GitHub imposes:
an account cannot approve, request changes on, or be requested as a reviewer
on its own PR. So no reviewers are attached to the PR, and reviewer-agent and
qa-agent post their findings as `COMMENT` reviews instead. Their verdicts
still gate the merge; they just gate it through the orchestrator rather than
through GitHub.

Pairing `ACCOUNT_SEPARATION: false` with `AUTONOMOUS_MODE: true` removes the
last independent check on a merge. Do it deliberately or not at all.

### Models

Each agent pins a model in its frontmatter: **Opus** everywhere except
`qa-agent`, which runs on **Sonnet**. The principle is to cheapen execution
before cheapening a gate — with a 3-cycle retry cap, a reviewer that misses a
defect costs a whole research/implement/review/QA round, far more than the
model saving. QA is the safe one to run cheaper because it reads exit codes
and acceptance criteria rather than exercising judgment.

Aliases are used rather than pinned model IDs, so each agent follows your
account to the current Opus or Sonnet. To change the split, edit `model:` in
`agents/*.md` — plugin `userConfig` cannot reach agent frontmatter, and
`CLAUDE_CODE_SUBAGENT_MODEL` would flatten all seven to one model.

## Requires

Claude Code v2.1.172+ — `orchestrator-agent` spawns other subagents, which
older versions don't support.
