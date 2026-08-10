#!/usr/bin/env bash
# Registers all MCP server connections for the 7-account agentic pipeline.
#
# Before running:
#   1. Create 7 bot accounts: pipeline-orchestrator-bot, pipeline-ba-bot,
#      pipeline-research-bot, pipeline-backend-bot, pipeline-frontend-bot,
#      pipeline-reviewer-bot, pipeline-qa-bot on GitHub and/or Jira per the
#      table below. pipeline-ba-bot is only used in requirements mode
#      (REQUIREMENTS_MODE in CLAUDE.md) — skip it if you always start runs
#      from an existing ticket.
#   2. Generate a GitHub PAT with minimum scope for each GitHub bot. Jira needs
#      no token — it authenticates interactively via OAuth, see below.
#   3. Copy scripts/.env.example to .env.local and fill it in, then:
#        set -a; source .env.local; set +a
#   4. Run: bash scripts/setup-mcp-servers.sh
#
# | Bot account                    | Services  | Minimum permissions                          |
# |---------------------------------|-----------|-----------------------------------------------|
# | pipeline-orchestrator-bot       | GH + Jira | GH: merge PRs. Jira: transition issue status  |
# | pipeline-ba-bot                 | Jira      | Create + link issues (no transitions)         |
# | pipeline-research-bot           | Jira      | Read-only: view/search issues                 |
# | pipeline-backend-bot            | GH        | Create branch, push, open/update PR (no merge)|
# | pipeline-frontend-bot           | GH        | Create branch, push, open/update PR (no merge)|
# | pipeline-reviewer-bot           | GH        | Read PR/diff, write reviews (no push/merge)   |
# | pipeline-qa-bot                 | GH + Jira | Read-only both sides + submit review          |
#
# Jira auth: OAuth, not API tokens. The four Jira servers are registered with
# no Authorization header; Claude Code runs the Atlassian OAuth flow on first
# connect. After this script finishes you must, per Jira alias:
#
#   1. Start `claude`, run `/mcp`, pick the alias, choose Authenticate.
#   2. Complete the browser consent screen **while logged into that bot's
#      Atlassian account** — jira-orchestrator as the orchestrator bot,
#      jira-ba as the BA bot, jira-research as the research bot, jira-qa as
#      the QA bot.
#
# A browser only holds one Atlassian session at a time, so authenticate the
# four aliases one at a time, each in its own private/incognito window (or
# separate browser profile). Authenticating them all from whichever account
# happens to be logged in silently collapses the identity separation the
# seven-account setup exists to provide.
#
# Tokens are stored by Claude Code and refreshed automatically; re-run
# /mcp -> Authenticate if a grant is revoked or expires.

set -euo pipefail

echo "== GitHub servers =="

claude mcp add --transport http github-orchestrator https://api.githubcopilot.com/mcp \
  -H "Authorization: Bearer ${ORCHESTRATOR_BOT_GITHUB_PAT:?set ORCHESTRATOR_BOT_GITHUB_PAT}"

claude mcp add --transport http github-backend https://api.githubcopilot.com/mcp \
  -H "Authorization: Bearer ${BACKEND_BOT_GITHUB_PAT:?set BACKEND_BOT_GITHUB_PAT}"

claude mcp add --transport http github-frontend https://api.githubcopilot.com/mcp \
  -H "Authorization: Bearer ${FRONTEND_BOT_GITHUB_PAT:?set FRONTEND_BOT_GITHUB_PAT}"

claude mcp add --transport http github-reviewer https://api.githubcopilot.com/mcp \
  -H "Authorization: Bearer ${REVIEWER_BOT_GITHUB_PAT:?set REVIEWER_BOT_GITHUB_PAT}"

claude mcp add --transport http github-qa https://api.githubcopilot.com/mcp \
  -H "Authorization: Bearer ${QA_BOT_GITHUB_PAT:?set QA_BOT_GITHUB_PAT}"

echo "== Jira / Atlassian servers =="

JIRA_MCP_URL="https://mcp.atlassian.com/v1/mcp"

# No -H: registering without an Authorization header is what makes Claude Code
# treat the server as OAuth and offer Authenticate in /mcp.
for alias in jira-orchestrator jira-ba jira-research jira-qa; do
  # `mcp add` won't overwrite an existing registration, and a leftover one from
  # the old API-token setup still carries its Authorization header — which
  # suppresses the OAuth flow. Drop it first; ignore "not found".
  claude mcp remove "$alias" >/dev/null 2>&1 || true
  claude mcp add --transport http "$alias" "$JIRA_MCP_URL"
done

echo "== Verifying =="
claude mcp list

echo
echo "Next: the four Jira servers are registered but NOT yet authenticated."
echo "Run 'claude', then '/mcp', and Authenticate each one in turn — each in a"
echo "private window logged into that bot's Atlassian account:"
echo "  jira-orchestrator -> pipeline-orchestrator-bot"
echo "  jira-ba           -> pipeline-ba-bot (requirements mode only)"
echo "  jira-research     -> pipeline-research-bot"
echo "  jira-qa           -> pipeline-qa-bot"
echo
echo "Then use '/mcp' to confirm auth status on every server before trusting"
echo "the pipeline to use them. Check the tool"
echo "names each Jira server exposes and make sure they match the 'tools:'"
echo "frontmatter in .claude/agents/*.md — a name that doesn't exist is"
echo "silently unavailable at runtime."
