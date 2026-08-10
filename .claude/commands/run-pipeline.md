Spawn `orchestrator-agent` via the Task tool to run the full agentic
development pipeline for the target below. Pass it that target verbatim and
any explicit overrides mentioned (e.g. autonomous mode for this run only).
Wait for it to finish, then relay its final summary — ticket status, PR link,
reviewer/QA outcome — back as your response. Do not run the pipeline steps
yourself; that's orchestrator-agent's job.

The target is either:

- a **Jira ticket ID** (e.g. `PROJ-123`) — an ordinary single-ticket run; or
- a **path to a user requirement document** (e.g.
  `docs/requirements/checkout.md`) — a requirements-mode run, where
  `ba-agent` first splits the document into Jira stories and the pipeline
  then runs once per story.

If nothing is given below, `REQUIREMENTS_MODE` in `CLAUDE.md` decides: when
`true`, run in requirements mode against `REQUIREMENTS_DOC`; when `false`,
ask which ticket to run.

Target: $ARGUMENTS
