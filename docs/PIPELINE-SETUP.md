# Pipeline setup (one-time)

This is setup documentation for humans. It is deliberately **not** in
`CLAUDE.md`, because everything in `CLAUDE.md` is injected into the context of
every subagent on every run — including retries. Setup instructions that only
matter once shouldn't be paid for on every LLM call in the pipeline.

## 1. Provision bot accounts

Create real, separate accounts on both GitHub and Jira:

- `pipeline-orchestrator-bot`
- `pipeline-backend-bot`
- `pipeline-frontend-bot`
- `pipeline-reviewer-bot`
- `pipeline-qa-bot`

Give each the minimum permissions its role actually needs:

| Account | GitHub | Jira |
|---|---|---|
| orchestrator | `Contents: read`, `Pull requests: write` (merge) | transition + comment |
| backend | `Contents: write`, `Pull requests: write` | — |
| frontend | `Contents: write`, `Pull requests: write` | — |
| reviewer | `Pull requests: write` only — never `Contents: write` | — |
| qa | `Pull requests: write` only — never `Contents: write` | read issues |

If every alias points at the same underlying account, the attribution in the
dashboard and PR history is cosmetic only. Separate accounts are what makes it
real, and what makes the "reviewer can't push code" boundary enforced by
GitHub rather than by prompt text.

## 2. Register the MCP servers

Each agent connects under a distinct alias backed by that bot's token:

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

`scripts/setup-mcp-servers.sh` / `.bat` automate this.

Jira tool names differ by server version: `jira-research` may expose
`get_issue`/`search_issues` while `atlassian-qa` exposes the Atlassian-style
`getAccessibleAtlassianResources`/`getJiraIssue` (which needs a `cloudId`
fetched first). Check `/mcp` for what your connected servers actually expose
rather than assuming, and update the `tools:` frontmatter in
`.claude/agents/*.md` to match — a tool name in frontmatter that doesn't exist
is silently unavailable at runtime.

## 3. Branch protection (strongly recommended)

Set a rule on `main` requiring approving reviews from both
`pipeline-reviewer-bot` and `pipeline-qa-bot` before a PR is mergeable.

This makes the approval gate real at the GitHub level instead of something the
orchestrator's prompt logic merely intends to check. It is the backstop that
makes `AUTONOMOUS_MODE: true` defensible: even if the orchestrator misreads a
verdict, GitHub refuses the merge.

## 4. Permissions allowlist

`.claude/settings.local.json` allowlists the tool calls the pipeline makes
routinely. Without it, an autonomous run stalls on permission prompts with
nobody watching — which is the most common way these runs "hang". Re-run
`/fewer-permission-prompts` after any change to agent tool lists.

## 5. Dashboard

`python3 dashboard/server.py` — see `dashboard/README.md`. It reads
`.claude/pipeline-status.jsonl`, written by the hooks in
`.claude/settings.json`. No other setup.

## Before turning on `AUTONOMOUS_MODE`

`AUTONOMOUS_MODE: true` means code can reach `main` with no human ever looking
at it, gated only on reviewer-agent and qa-agent's judgment. Reasonable for
low-stakes repos, internal tools, and well-covered test suites; riskier for
anything customer-facing or security-sensitive. Do step 3 first regardless.
