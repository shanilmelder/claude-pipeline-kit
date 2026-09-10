Set this project up to run the agentic development pipeline.

1. Check whether `.claude/pipeline.config.md` already exists in the project
   root. If it does, do not overwrite it — show the person what is in it and
   ask what they want changed.
2. Otherwise copy the template from
   `${CLAUDE_PLUGIN_ROOT}/config/pipeline.config.example.md` to
   `.claude/pipeline.config.md`.
3. Fill in what you can determine from the repository itself rather than
   leaving placeholders: detect the real tech stack and versions from the
   project files (`*.csproj`, `package.json`, lockfiles, `docker-compose*`)
   and write those into the `## Tech Stack` block. Say which values you
   inferred and from which file.
4. Ask the person for what the repo cannot tell you — the Jira project key,
   the bot account names, and whether they want `AUTONOMOUS_MODE` on. Use
   AskUserQuestion. Leave `AUTONOMOUS_MODE: false` unless they say otherwise.
5. Point them at `${CLAUDE_PLUGIN_ROOT}/docs/PIPELINE-SETUP.md` for the parts
   that cannot be automated: creating the bot accounts, authenticating each
   Jira alias under the right account, and branch protection.

Do not run the pipeline as part of this command — `/run-pipeline` does that.
