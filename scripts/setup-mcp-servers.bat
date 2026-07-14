@echo off
setlocal enabledelayedexpansion

rem Loads bot PATs/tokens from a local .env-style file and registers each
rem pipeline MCP server against its own bot account.

set ENV_FILE=%~dp0..\.env.mcp

if not exist "%ENV_FILE%" (
    echo ERROR: %ENV_FILE% not found. Copy .env.mcp.example and fill in bot tokens.
    exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
    set %%A=%%B
)

if "%ORCHESTRATOR_BOT_GITHUB_PAT%"=="" (
    echo ERROR: ORCHESTRATOR_BOT_GITHUB_PAT missing from %ENV_FILE%.
    exit /b 1
)
if "%IMPLEMENTATION_BOT_GITHUB_PAT%"=="" (
    echo ERROR: IMPLEMENTATION_BOT_GITHUB_PAT missing from %ENV_FILE%.
    exit /b 1
)
if "%REVIEWER_BOT_GITHUB_PAT%"=="" (
    echo ERROR: REVIEWER_BOT_GITHUB_PAT missing from %ENV_FILE%.
    exit /b 1
)
if "%QA_BOT_GITHUB_PAT%"=="" (
    echo ERROR: QA_BOT_GITHUB_PAT missing from %ENV_FILE%.
    exit /b 1
)
if "%ORCHESTRATOR_BOT_JIRA_TOKEN%"=="" (
    echo ERROR: ORCHESTRATOR_BOT_JIRA_TOKEN missing from %ENV_FILE%.
    exit /b 1
)
if "%RESEARCH_BOT_JIRA_TOKEN%"=="" (
    echo ERROR: RESEARCH_BOT_JIRA_TOKEN missing from %ENV_FILE%.
    exit /b 1
)
if "%QA_BOT_JIRA_TOKEN%"=="" (
    echo ERROR: QA_BOT_JIRA_TOKEN missing from %ENV_FILE%.
    exit /b 1
)

echo == GitHub servers ==

call claude mcp add --transport http github-orchestrator https://api.githubcopilot.com/mcp ^
  -H "Authorization: Bearer %ORCHESTRATOR_BOT_GITHUB_PAT%"
if errorlevel 1 goto :error

call claude mcp add --transport http github-implementation https://api.githubcopilot.com/mcp ^
  -H "Authorization: Bearer %IMPLEMENTATION_BOT_GITHUB_PAT%"
if errorlevel 1 goto :error

call claude mcp add --transport http github-reviewer https://api.githubcopilot.com/mcp ^
  -H "Authorization: Bearer %REVIEWER_BOT_GITHUB_PAT%"
if errorlevel 1 goto :error

call claude mcp add --transport http github-qa https://api.githubcopilot.com/mcp ^
  -H "Authorization: Bearer %QA_BOT_GITHUB_PAT%"
if errorlevel 1 goto :error

echo == Jira / Atlassian servers ==

call claude mcp add --transport http jira-orchestrator https://mcp.atlassian.com/v1/mcp ^
  -H "Authorization: Bearer %ORCHESTRATOR_BOT_JIRA_TOKEN%"
if errorlevel 1 goto :error

call claude mcp add --transport http jira-research https://mcp.atlassian.com/v1/mcp ^
  -H "Authorization: Bearer %RESEARCH_BOT_JIRA_TOKEN%"
if errorlevel 1 goto :error

call claude mcp add --transport http atlassian-qa https://mcp.atlassian.com/v1/mcp ^
  -H "Authorization: Bearer %QA_BOT_JIRA_TOKEN%"
if errorlevel 1 goto :error

echo == Verifying ==
call claude mcp list

goto :eof

:error
echo Failed to register one or more MCP servers.
exit /b 1
