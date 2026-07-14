@echo off

set "ENV_FILE=%~1"
if "%ENV_FILE%"=="" set "ENV_FILE=.env"

if not exist "%ENV_FILE%" (
    echo ERROR: env file not found: %ENV_FILE%
    echo Copy .env.example to .env and fill in your tokens first.
    exit /b 1
)

echo Loading tokens from %ENV_FILE% ...

for /f "usebackq tokens=1,* delims== eol=#" %%A in ("%ENV_FILE%") do (
    if not "%%A"=="" (
        set "%%A=%%B"
    )
)

REM Validate all required vars were loaded

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

echo.
echo Done. Run 'claude' then '/mcp' inside a session to confirm auth status
echo on each server before trusting the pipeline to use them.
goto :eof

:error
echo.
echo ERROR: an mcp add command failed. Check the output above.
exit /b 1
