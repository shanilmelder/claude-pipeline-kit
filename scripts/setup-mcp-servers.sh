#!/usr/bin/env bash
# Registers all MCP server connections for the 6-account agentic pipeline.
#
# Before running:
#   1. Create 6 bot accounts: pipeline-orchestrator-bot, pipeline-research-bot,
#      pipeline-backend-bot, pipeline-frontend-bot, pipeline-reviewer-bot,
#      pipeline-qa-bot on GitHub and/or Jira per the table below.
#   2. Generate a token for each (GitHub: PAT with minimum scope; Jira/Atlassian:
#      OAuth or API token per your org's setup).
#   3. Fill in the placeholder tokens below, or export them as env vars first
#      and reference $VAR_NAME instead of pasting tokens into this file.
#   4. Run: bash scripts/setup-mcp-servers.sh
#
# | Bot account                    | Services  | Minimum permissions                          |
# |---------------------------------|-----------|-----------------------------------------------|
# | pipeline-orchestrator-bot       | GH + Jira | GH: merge PRs. Jira: transition issue status  |
# | pipeline-research-bot           | Jira      | Read-only: view/search issues                 |
# | pipeline-backend-bot            | GH        | Create branch, push, open/update PR (no merge)|
# | pipeline-frontend-bot           | GH        | Create branch, push, open/update PR (no merge)|
# | pipeline-reviewer-bot           | GH        | Read PR/diff, write reviews (no push/merge)   |
# | pipeline-qa-bot                 | GH + Jira | Read-only both sides + submit review          |

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

claude mcp add --transport http jira-orchestrator https://mcp.atlassian.com/v1/mcp \
  -H "Authorization: Bearer ${ORCHESTRATOR_BOT_JIRA_TOKEN:?set ORCHESTRATOR_BOT_JIRA_TOKEN}"

claude mcp add --transport http jira-research https://mcp.atlassian.com/v1/mcp \
  -H "Authorization: Bearer ${RESEARCH_BOT_JIRA_TOKEN:?set RESEARCH_BOT_JIRA_TOKEN}"

claude mcp add --transport http atlassian-qa https://mcp.atlassian.com/v1/mcp \
  -H "Authorization: Bearer ${QA_BOT_JIRA_TOKEN:?set QA_BOT_JIRA_TOKEN}"

echo "== Verifying =="
claude mcp list

echo
echo "Done. Run 'claude' then '/mcp' inside a session to confirm auth status"
echo "on each server before trusting the pipeline to use them."
