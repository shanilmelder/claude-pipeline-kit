@echo off
setlocal enabledelayedexpansion

set "ENV_FILE=%~1"
if "%ENV_FILE%"=="" set "ENV_FILE=.env"

if not exist "%ENV_FILE%" (
    echo ERROR: env file not found: %ENV_FILE%
    echo Copy scripts\.env.example to .env and fill in your tokens first.
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
