# Pipeline lessons

Rules this project's reviewer has had to state more than once. Implementers
read this before writing code; the agent that fixes a rejected PR appends the
rule it just learned.

**Keep this under 20 rules.** It is read on every implementation pass, so a
long file is one that gets skimmed and ignored while still costing context —
strictly worse than no file at all. If you are adding a 21st rule, something
has to graduate or go.

**Rules leave this file by becoming checks.** When a rule is mechanically
checkable, write the analyzer rule, ESLint rule, `.editorconfig` entry, or
architecture test instead — the build then enforces it and no agent has to
remember it. Delete the line here when you do. This file should shrink over
time; if it only grows, the real gap is an unwritten conventions document,
not missing memory.

Format — one line each, newest last:

```
- YYYY-MM-DD | DOMAIN | TICKET | <the rule, stated for code that doesn't exist yet>
```

Delete a rule that turns out to be wrong. Nothing here is audited by anyone
but you, and an agent will follow a bad rule forever without questioning it.

## Rules

<!-- Example, delete it:
- 2026-01-15 | backend | PROJ-42 | Endpoints returning collections stream with IAsyncEnumerable rather than materializing a List.
-->
