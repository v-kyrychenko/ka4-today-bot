---
id: T12
title: "Wire cross-context pre-emption and lazy auto-expiry"
layer: "wiring"
deps: ["T10"]
acs: ["AC-10", "AC-11"]
files_hint: ["src/modules/telegram/routes/routesProcessor.ts", "src/modules/telegram/features/conversations/engine.ts"]
owner: "<TBD lead>"
estimate: "M"
status: "todo"
---

# T12 — Wire cross-context pre-emption and lazy auto-expiry

## Why

ADR-0003: session-state invariants beyond explicit start/end are enforced by extending the conversation engine's existing lazy `expires_at` check and a single `routesProcessor` call site, not a new scheduled sweep — accepted trade-off noted in `sad.md` §11 (auto-close discovered on next check, not pushed proactively).

## What

In `routesProcessor.ts`, before handling any other route or a cron-enqueued reminder for a client with an active workout-logging session, close it (`end_reason: 'pre-empted'`) and discard any unconfirmed candidate state (AC-10, sad.md §6 Flow 2). In the conversation engine's lazy expiry check, when a session's `expires_at` (2h since start or last entry, whichever is later) has passed, close it (`end_reason: 'auto-closed'`) before treating the client as having no open session (AC-11).

## Definition of Done

- [ ] integration test: another route firing for a client with an active session pre-empts it (`end_reason='pre-empted'`) before proceeding with that route
- [ ] integration test: a session idle >2h from start or last entry is closed (`end_reason='auto-closed'`) on the next check, with no client message required to trigger it
- [ ] no new Lambda, queue, or cron resource added (ADR-0003)
- [ ] lint + vet clean

## Notes

Depends on T10 for `closeSession`/lifecycle plumbing to reuse.
