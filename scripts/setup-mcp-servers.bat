@echo off
setlocal enabledelayedexpansion

REM Registers all MCP server connections for the 7-account agentic pipeline.
REM
REM Jira auth: OAuth, not API tokens. The four Jira servers are registered
REM with no Authorization header; Claude Code runs the Atlassian OAuth flow on
REM first connect. After this script finishes, start 'claude', run '/mcp' and
REM Authenticate each Jira alias in turn, completing the browser consent while
REM logged into that bot's Atlassian account. A browser holds one Atlassian
REM session at a time, so do them one at a time in private windows, or the
REM three aliases all end up as the same identity.
REM
REM The env file therefore only needs the GitHub PATs.

REM Env file: an explicit argument wins, otherwise search the current directory
REM and then the directory this script lives in, .env.local before .env.
set "ENV_FILE=%~1"
if "%ENV_FILE%"=="" (
    for %%F in (".env.local" ".env" "%~dp0.env.local" "%~dp0.env") do (
        if not defined ENV_FILE if exist "%%~F" set "ENV_FILE=%%~F"
    )
)

if not defined ENV_FILE (
    echo ERROR: no env file found. Looked for, in order:
    echo   .env.local
    echo   .env
    echo   %~dp0.env.local
    echo   %~dp0.env
    echo.
    echo Copy scripts\.env.example to scripts\.env.local and fill in your
    echo tokens, or pass the path explicitly:
    echo   %~nx0 path\to\your.env
    exit /b 1
)

if not exist "%ENV_FILE%" (
    echo ERROR: env file not found: %ENV_FILE%
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
if "%BACKEND_BOT_GITHUB_PAT%"=="" (
    echo ERROR: BACKEND_BOT_GITHUB_PAT missing from %ENV_FILE%.
    exit /b 1
)
if "%FRONTEND_BOT_GITHUB_PAT%"=="" (
    echo ERROR: FRONTEND_BOT_GITHUB_PAT missing from %ENV_FILE%.
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

echo == GitHub servers ==

call claude mcp add --transport http github-orchestrator https://api.githubcopilot.com/mcp ^
  -H "Authorization: Bearer %ORCHESTRATOR_BOT_GITHUB_PAT%"
if errorlevel 1 goto :error

call claude mcp add --transport http github-backend https://api.githubcopilot.com/mcp ^
  -H "Authorization: Bearer %BACKEND_BOT_GITHUB_PAT%"
if errorlevel 1 goto :error

call claude mcp add --transport http github-frontend https://api.githubcopilot.com/mcp ^
  -H "Authorization: Bearer %FRONTEND_BOT_GITHUB_PAT%"
if errorlevel 1 goto :error

call claude mcp add --transport http github-reviewer https://api.githubcopilot.com/mcp ^
  -H "Authorization: Bearer %REVIEWER_BOT_GITHUB_PAT%"
if errorlevel 1 goto :error

call claude mcp add --transport http github-qa https://api.githubcopilot.com/mcp ^
  -H "Authorization: Bearer %QA_BOT_GITHUB_PAT%"
if errorlevel 1 goto :error

echo == Jira / Atlassian servers ==

REM No -H: registering without an Authorization header is what makes Claude
REM Code treat the server as OAuth and offer Authenticate in /mcp.
REM 'mcp add' won't overwrite an existing registration, and a leftover one from
REM the old API-token setup still carries its Authorization header - which
REM suppresses the OAuth flow. Drop it first; a "not found" here is harmless.
for %%S in (jira-orchestrator jira-ba jira-research jira-qa) do (
    call claude mcp remove %%S >nul 2>&1
    call claude mcp add --transport http %%S https://mcp.atlassian.com/v1/mcp
    if errorlevel 1 goto :error
)

echo == Verifying ==
call claude mcp list

echo.
echo Next: the four Jira servers are registered but NOT yet authenticated.
echo Run 'claude', then '/mcp', and Authenticate each one in turn - each in a
echo private window logged into that bot's Atlassian account:
echo   jira-orchestrator -^> pipeline-orchestrator-bot
echo   jira-ba           -^> pipeline-ba-bot (requirements mode only)
echo   jira-research     -^> pipeline-research-bot
echo   jira-qa           -^> pipeline-qa-bot
echo.
echo Then use '/mcp' to confirm auth status on every server before trusting
echo the pipeline to use them. Check the tool
echo names each Jira server exposes and make sure they match the 'tools:'
echo frontmatter in .claude\agents\*.md - a name that doesn't exist there is
echo silently unavailable at runtime.
goto :eof

:error
echo.
echo ERROR: an mcp add command failed. Check the output above.
exit /b 1
