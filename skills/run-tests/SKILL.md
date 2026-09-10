---
name: run-tests
description: Discover and run a project's real test, lint, typecheck and build commands, against the stack declared in .claude/pipeline.config.md. Use when verifying a branch or PR, when qa-agent needs the actual commands rather than guessing them, or when a change needs proving before it is reported as working. Covers bringing up a throwaway database for integration tests and telling a real failure apart from a broken environment.
---

# Running this project's tests

Read the `## Tech Stack` block in `.claude/pipeline.config.md` first — that
is what the project has committed to, and the tooling below is chosen by it.
Run the stack's real tooling. Never report a verdict from a command you did
not actually run, and never paraphrase a failure — paste it.

## 1. Discover before you run

Check what exists before assuming a command works:

```bash
ls .github/workflows/*.yml 2>/dev/null            # most authoritative
ls package.json Makefile *.sln 2>/dev/null
find . -name '*.csproj' -o -name 'pyproject.toml' -o -name 'go.mod' | grep -v node_modules
```

**If CI runs a command, that is the command.** A workflow file beats every
recipe below, because it is what the project actually gates merges on.

**If a side of the stack has no project at all** — no `package.json`, no
`*.csproj` — that side has no tests to run. Say exactly that. Do not report
it as passing, and do not report it as failing; it is neither.

## 2. .NET / xUnit

```bash
dotnet restore
dotnet build --nologo --configuration Release
dotnet test --nologo --configuration Release --verbosity normal
```

Run `dotnet build` separately even though `dotnet test` builds. A build error
and a test failure are different findings that get fixed differently.
`dotnet format --verify-no-changes` is the style gate — report a violation,
but don't fail the branch on it unless CI runs it.

## 3. Node / Vitest / Jest

```bash
npm ci                    # not `npm install` — respect the lockfile
npm run test -- --run     # `--run` disables watch mode
npx tsc --noEmit
npm run lint --if-present
npm run build
```

If `test` isn't defined in `package.json`, use `npx vitest run` or
`npx jest --ci`. **Never invoke a test runner in watch mode** — bare
`vitest`, `jest --watch`, `npm test` without `--run`. Watch mode never
exits, so the turn dies on timeout instead of reporting a result. This is the
single most common way an automated test run fails to produce a verdict.

## 4. Any other stack

Take the commands from CI, or from the project's own README/Makefile. The
shape is always the same and you need all four: install/restore, build,
test, and whatever static gate the project runs (lint, typecheck, format).

## 5. Integration tests that need a database

If a compose file exists, use it — it holds the credentials the tests expect.
Otherwise start a throwaway instance of whatever `## Tech Stack` names, e.g.
for PostgreSQL:

```bash
docker run --rm -d --name pgtest-$TICKET -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:18
# point the suite at it, e.g. ConnectionStrings__Default / DATABASE_URL
docker rm -f pgtest-$TICKET   # always, even when the run fails
```

Use a non-default host port so you never collide with a database the user is
running locally, and always tear the container down.

## 6. Environmental failure vs. real failure

They are not the same finding and must not be reported the same way.

**Environmental** — Docker not installed, no network for `restore`/`ci`, a
missing SDK, a port already bound. The branch is not implicated. Report the
commands you could not run and why, mark them explicitly as not executed, and
base the verdict only on what did run. If nothing meaningful ran, do not
issue a PASS — you have no evidence for one. Report it as a failure to
verify, in whatever verdict format your caller requires, and lead with the
environmental cause so nobody mistakes it for a defect in the branch.

**Real** — compile error, assertion failure, type error, failing build on
committed code. That is the branch's problem. Paste the failing test name and
the actual error text.

When you are unsure which one you are looking at, re-run that one command
once. A failure that reproduces identically is real; one that changes shape
between runs is usually the environment or a flaky test — call flakiness out
by name instead of hiding it behind a retry.

## 7. Report

Report the exact commands you ran, verbatim and in order, so the next agent
can rerun them without rediscovering any of this. That is what
`COMMANDS_RUN` in qa-agent's output block is for.
