# Example user requirement document

This file is a template, not a live requirement. Copy it to
`docs/requirements/<feature>.md`, replace the content, and run:

```
/run-pipeline docs/requirements/<feature>.md
```

`ba-agent` reads the whole document, splits it into Jira stories under
`JIRA_PROJECT_KEY`, and the pipeline then runs once per story. Nothing here is
a required schema — the BA reads whatever structure you give it — but the more
concrete the acceptance criteria, the less it has to assume.

---

## Feature: Self-service password reset

### Background

Users who forget their password currently have to email support, who reset it
manually. This is the single largest source of support tickets.

### Goals

- A user can reset their own password without contacting support.
- Reset links are single-use and expire.
- Support can see that a reset happened, for audit purposes.

### Out of scope

- Multi-factor authentication.
- Changing the email address on an account.

### Behaviour

1. From the login screen, a "Forgot password?" link asks for an email address.
2. If the address belongs to an account, we email a reset link. If it doesn't,
   we show the same confirmation either way — no account enumeration.
3. The link opens a form to set a new password. It works once and expires
   after 1 hour.
4. Using the link successfully signs the user out of all existing sessions.
5. Each reset is recorded with a timestamp and source IP.

### Constraints

- Passwords keep the existing strength rules — this feature doesn't change
  them.
- Reset emails go through the existing transactional email sender.

### Open questions

- Should a reset attempt on an unknown address be rate-limited per IP or per
  address? (BA: pick a sensible default and note it.)
