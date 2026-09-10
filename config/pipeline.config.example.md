# Pipeline configuration

Copy this file to `.claude/pipeline.config.md` in your project root and fill
it in. `orchestrator-agent` reads it at the start of every run; the plugin
ships no defaults for these — see `## Where configuration comes from` in the
plugin's `PIPELINE.md` for what each value means.

Keep it in version control. It describes the project, not a person.

## Config

```
AUTONOMOUS_MODE: false
REQUIREMENTS_MODE: false
REQUIREMENTS_DOC: docs/requirements/EXAMPLE.md
JIRA_PROJECT_KEY: PROJ
STORY_APPROVAL: true
REVIEWER_BOT_GITHUB_USERNAME: your-reviewer-bot
QA_BOT_GITHUB_USERNAME: your-qa-bot
JIRA_ASSIGNMENT: true
RESEARCH_BOT_JIRA_ACCOUNT: pipeline-research-bot
BACKEND_BOT_JIRA_ACCOUNT: pipeline-backend-bot
FRONTEND_BOT_JIRA_ACCOUNT: pipeline-frontend-bot
REVIEWER_BOT_JIRA_ACCOUNT: pipeline-reviewer-bot
QA_BOT_JIRA_ACCOUNT: pipeline-qa-bot
ORCHESTRATOR_BOT_JIRA_ACCOUNT: pipeline-orchestrator-bot
```

`AUTONOMOUS_MODE: false` is the shipped default deliberately — it stops the
run before the merge and reports instead. Turn it on once you have watched a
few runs land correctly, and read the caution in `docs/PIPELINE-SETUP.md`
first if this repo is shared.

## Tech Stack

Replace every row with your project's real stack and versions. Agents treat
these as a hard constraint: reviewer-agent rejects a PR that introduces a
library or version inconsistent with what is written here, and qa-agent runs
this stack's test tooling.

```
Backend: .NET 10
Frontend: React 19
Database: PostgreSQL 18
Testing (backend): xUnit
Testing (frontend): Vitest + React Testing Library
Package manager: npm / NuGet
Other conventions: REST APIs and Tailwind for styling
```
