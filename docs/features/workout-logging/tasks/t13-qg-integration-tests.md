---
id: T13
title: "Add QG-1/QG-3 integration test coverage"
layer: "tests"
deps: ["T11", "T12"]
acs: ["AC-01", "AC-03", "AC-05", "AC-05b", "AC-06", "AC-07", "AC-07b", "AC-08", "AC-09", "AC-09b", "AC-10", "AC-11", "AC-12"]
files_hint: ["test/modules/telegram/features/workoutLogging/"]
owner: "<TBD lead>"
estimate: "M"
status: "todo"
---

# T13 — Add QG-1/QG-3 integration test coverage

## Why

`sad.md` §10 QG-1 and QG-3 name the exact verification each quality goal needs; this closes them as the feature's final gate before the epic is considered done.

## What

Add integration tests under `test/modules/telegram/features/workoutLogging/`: (QG-1) assert no `workout_log_entry` row exists before a confirmation action for the confirm/keep-own/reject branches, and that AC-08's fallback is the only path saving without a confirmation; (QG-3) assert matched-route pre-emption, replacement start, and expiry always leave at most one active row per `chat_id`.

## Definition of Done

- [ ] QG-1 test suite passes: no premature writes across confirm/keep-own/reject, AC-08 exception verified explicitly
- [ ] QG-3 test suite passes: at most one active row per `chat_id` after matched-route pre-emption, replacement start, or expiry
- [ ] `npm test` and `npm run typecheck` clean
