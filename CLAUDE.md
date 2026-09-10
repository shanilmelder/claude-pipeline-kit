# claude-pipeline-kit — plugin source

This repository **is** the `claude-pipeline-kit` plugin, and also serves as
its own marketplace. It is not a project that runs the pipeline; nothing here
should be read as instructions for a run.

The pipeline specification agents actually follow lives in `PIPELINE.md`.
Adopting projects supply their own values in `.claude/pipeline.config.md`,
templated by `config/pipeline.config.example.md`.

## Layout

| Path | What it is |
| --- | --- |
| `.claude-plugin/plugin.json` | Manifest: components, and the five GitHub PATs as `userConfig` |
| `.claude-plugin/marketplace.json` | Marketplace listing; points at this repo root |
| `PIPELINE.md` | The pipeline spec — read by `orchestrator-agent` every run |
| `agents/` | The seven subagents |
| `skills/` | `run-tests`, `resume-run` |
| `commands/` | `/run-pipeline`, `/pipeline-init` |
| `hooks/hooks.json` | Event logging that feeds the dashboard |
| `.mcp.json` | Nine MCP servers — five GitHub bots, four Jira aliases |
| `config/` | Templates `/pipeline-init` copies into a project: config, lessons file |
| `dashboard/` | Live run dashboard (`python3 dashboard/server.py`) |
| `docs/PIPELINE-SETUP.md` | One-time human setup: accounts, OAuth, branch protection |
| `scripts/` | Hook script, plus manual MCP registration for debugging |

## Working on this repo

- Paths inside plugin files resolve with `${CLAUDE_PLUGIN_ROOT}` (the
  installed plugin) or `${CLAUDE_PROJECT_DIR}` (the adopter's repo). Getting
  these backwards fails silently — a hook that never fires, a file never
  found. `log_event.py` must always write under the *project* dir.
- Anything adopter-specific — project key, bot names, tech stack — belongs in
  `config/pipeline.config.example.md`, never hardcoded into an agent.
- Bump `version` in `plugin.json` when agent prompts change behaviour;
  adopters can pin a release with `@vX.Y`.
