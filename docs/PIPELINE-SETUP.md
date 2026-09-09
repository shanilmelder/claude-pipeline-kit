# Pipeline setup (one-time)

This is setup documentation for humans. It is deliberately **not** in
`CLAUDE.md`, because everything in `CLAUDE.md` is injected into the context of
every subagent on every run — including retries. Setup instructions that only
matter once shouldn't be paid for on every LLM call in the pipeline.

## 1. Provision bot accounts

Create real, separate accounts on both GitHub and Jira:

- `pipeline-orchestrator-bot`
- `pipeline-ba-bot` (Jira only; requirements mode only — see §5)
- `pipeline-research-bot` (Jira only)
- `pipeline-backend-bot`
- `pipeline-frontend-bot`
- `pipeline-reviewer-bot`
- `pipeline-qa-bot`

Give each the minimum permissions its role actually needs:

| Account | GitHub | Jira |
|---|---|---|
| orchestrator | `Contents: read`, `Pull requests: write` (merge) | transition, assign, comment |
| ba | — | create + link issues (never transition, never comment) |
| research | — | view/search issues + **comment** (it posts its own brief) |
| backend | `Contents: write`, `Pull requests: write` | — |
| frontend | `Contents: write`, `Pull requests: write` | — |
| reviewer | `Pull requests: write` only — never `Contents: write` | — |
| qa | `Pull requests: write` only — never `Contents: write` | read issues |

If every alias points at the same underlying account, the attribution in the
dashboard and PR history is cosmetic only. Separate accounts are what makes it
real, and what makes the "reviewer can't push code" boundary enforced by
GitHub rather than by prompt text.

## 2. Register the MCP servers

Each agent connects under a distinct alias backed by that bot's credentials —
a PAT on the GitHub side, an OAuth grant on the Jira side:

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

# Jira: no Authorization header. Omitting it is what makes Claude Code treat
# the server as OAuth and offer Authenticate in /mcp.
claude mcp add --transport http jira-orchestrator https://mcp.atlassian.com/v1/mcp
claude mcp add --transport http jira-ba https://mcp.atlassian.com/v1/mcp
claude mcp add --transport http jira-research https://mcp.atlassian.com/v1/mcp
claude mcp add --transport http jira-qa https://mcp.atlassian.com/v1/mcp
```

`scripts/setup-mcp-servers.sh` / `.bat` automate this — fill the GitHub PATs
into `scripts/.env.example` (copied to `.env.local`); the Jira side needs no
secrets in the env file at all.

### Authenticating the Jira servers

Registering a Jira server does not connect it. Start `claude`, run `/mcp`,
select the alias, and choose **Authenticate** — a browser opens the Atlassian
consent screen, and the resulting OAuth grant is stored and auto-refreshed by
Claude Code.

The identity you get is whichever Atlassian account that browser is logged
into, and a browser holds only one Atlassian session at a time. So do them one
at a time, each in a fresh private/incognito window (or its own browser
profile):

| Alias | Authenticate as | Needs |
|---|---|---|
| `jira-orchestrator` | `pipeline-orchestrator-bot` | transition issues, comment |
| `jira-ba` | `pipeline-ba-bot` | create + link issues (requirements mode only) |
| `jira-research` | `pipeline-research-bot` | view/search issues, comment |
| `jira-qa` | `pipeline-qa-bot` | view issues |

Authenticating them all from whatever account happened to be logged in is the
easy mistake, and it silently collapses the identity separation the
seven-account setup exists to provide — every Jira action then lands under one
name. Verify in `/mcp` (or by calling `atlassianUserInfo` on each alias) that
they report different accounts.

Two project permissions are easy to miss, because the pipeline degrades
quietly without them rather than failing loudly:

- **Add Comments** for `pipeline-research-bot`. research-agent posts its own
  brief on the ticket under its own account — deliberately, so a technical
  decision is attributable to the agent that made it rather than showing up
  under the BA's or the orchestrator's name. Without the permission the brief
  still reaches the implementers (it's the agent's return value), it just
  never lands on the ticket.
- **Assignable User** for every bot the orchestrator assigns to, plus **Assign
  Issues** for `pipeline-orchestrator-bot`. With `JIRA_ASSIGNMENT: true` the
  orchestrator moves the assignee to whichever agent is working the ticket, so
  the board shows who's holding it. A missing permission is noted in the run
  report and skipped — it never stops a run.

Grant each bot's Jira permissions in Jira itself — OAuth consent gives the
server access to what that account can already do, it doesn't widen it. Unlike
API tokens, OAuth does not depend on your org admin enabling API-token auth for
the Rovo MCP server, which is the main reason to prefer it here. The `/v1/sse`
endpoint is retired as of 30 June 2026 — use `/v1/mcp`.

Re-run `/mcp` → Authenticate if a grant is revoked or expires. Because the
tokens live in Claude Code's own credential store rather than in `.env.local`,
a fresh machine needs the OAuth flow repeated; there is no file to copy over.

Jira tool names differ by server version: `jira-research` may expose
`get_issue`/`search_issues` while `jira-qa` exposes the Atlassian-style
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

## 5. Requirements mode (optional)

By default a run starts from a Jira ticket that a human already wrote. In
requirements mode it starts from a **user requirement document** in the repo:
`ba-agent` reads it, splits it into Jira stories under `JIRA_PROJECT_KEY`, and
the orchestrator then runs the normal pipeline once per story, sequentially.

To enable it:

1. Provision `pipeline-ba-bot` and register + authenticate `jira-ba` (§1, §2).
   The account needs permission to **create** issues in the target project —
   and deliberately not to transition them; status stays with the
   orchestrator.
2. Set `JIRA_PROJECT_KEY` in `CLAUDE.md` to the project stories land in.
3. Either set `REQUIREMENTS_MODE: true` and point `REQUIREMENTS_DOC` at your
   document, or leave the flag `false` and turn it on per run by naming a
   document: `/run-pipeline docs/requirements/checkout.md`.
4. Decide `STORY_APPROVAL`. Left at `true`, the run stops once the stories
   exist and asks you whether to implement all of them in order or just one
   you pick — the stories are already in Jira, so it costs nothing to look
   first. Set it to `false` only when you want a document to go all the way
   to merged code unattended.

Requirement documents are ordinary Markdown — `ba-agent` reads whatever
structure you give it. The more concrete the acceptance criteria in the
document, the less the BA has to assume; whatever it does assume comes back
under `## Notes for the Orchestrator`.

The stories it creates are deliberately business-language only: what a user
can do and how you'd know it works, with no endpoints, schemas, components, or
library choices in them. That isn't tidiness — `ba-agent` has not read the
codebase, so any technical detail it wrote would be a guess arriving with a
ticket's authority behind it. research-agent decides the *how* per story,
against the real code. If you want design detail to reach the implementers,
put it in the requirement document, where it reads as input rather than as a
decision already made.

Worth knowing before you turn it on: this is the one mode where the pipeline
creates Jira issues on its own. A vague document produces a lot of stories,
and with `AUTONOMOUS_MODE: true` as well, each of those stories can reach a
merge with no human in the loop at any point — including the point where the
work was defined. Run the first document with `AUTONOMOUS_MODE` off, or
review the created stories before the implementation passes get far.
`STORY_APPROVAL: true` is the cheap guard here: it puts a human between "the
work was defined" and "the work was built", which is the gap
`AUTONOMOUS_MODE` on its own leaves open.

## 6. Dashboard

`python3 dashboard/server.py` — see `dashboard/README.md`. It reads
`.claude/pipeline-status.jsonl`, written by the hooks in
`.claude/settings.json`. No other setup.

## Before turning on `AUTONOMOUS_MODE`

`AUTONOMOUS_MODE: true` means code can reach `main` with no human ever looking
at it, gated only on reviewer-agent and qa-agent's judgment. Reasonable for
low-stakes repos, internal tools, and well-covered test suites; riskier for
anything customer-facing or security-sensitive. Do step 3 first regardless.
