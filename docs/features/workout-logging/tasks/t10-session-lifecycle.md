---
id: T10
title: "Implement session start/end lifecycle"
layer: "app"
deps: ["T4"]
acs: ["AC-01", "AC-02", "AC-09", "AC-09b", "AC-13"]
files_hint: ["src/modules/telegram/features/workoutLogging/workoutLoggingService.ts"]
owner: "<TBD lead>"
estimate: "M"
status: "todo"
---

# T10 — Implement session start/end lifecycle

## Why

`sad.md` §6 Flow 2/3: a client opens exactly one session at a time and closes it explicitly, distinguishing an empty session from a recorded one for the §7 completion-rate KPI (AC-09b).

## What

Add the session-lifecycle branch of `workoutLoggingService.ts`: `startSession` checks registration (AC-02) and defensively rejects a start if an open row still exists before calling `workoutLogRepository.startSession` with `sessionDay` set from the client's local start time (AC-13); `endSession` calls `countEntries` then `closeSession` with `end_reason: 'client-ended'`, replying differently for zero vs. ≥1 recorded entries (AC-09/AC-09b). The Telegram repeat-start behavior is owned by route pre-emption in T12.

## Definition of Done

- [ ] unit test: starting a session for a non-client is denied without opening a row (AC-02)
- [ ] unit test: the defensive service guard rejects a start while an open session row still exists
- [ ] unit test: `sessionDay` is derived from the client's local start time, not UTC (AC-13)
- [ ] unit test: ending an empty session closes it with `end_reason='client-ended'` and no workout-record confirmation; ending one with entries confirms completion (AC-09/AC-09b)
- [ ] lint + vet clean

## Notes

Auto-close (AC-11) and pre-emption (AC-10) are wired separately in T12; this task only covers the explicit start/end path.
