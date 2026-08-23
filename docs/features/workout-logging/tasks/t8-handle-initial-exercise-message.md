---
id: T8
title: "Handle initial exercise-description message"
layer: "app"
deps: ["T4", "T6", "T7"]
acs: ["AC-03", "AC-05", "AC-05b", "AC-07", "AC-14"]
files_hint: ["src/modules/telegram/features/workoutLogging/workoutLoggingService.ts"]
owner: "<TBD lead>"
estimate: "M"
status: "todo"
---

# T8 — Handle initial exercise-description message

## Why

Orchestrates `sad.md` §6 Flow 1's first half: parse (T6) → match (T7) → present a combined exercise+numbers confirmation, or an unclear-message reply with one retry (AC-07), with nothing written to `workout_log_entry` yet (QG-1, sad.md §10).

## What

Add the message-handling branch of `workoutLoggingService.ts`: call `workoutExerciseParser` (T6); on success call `workoutCandidateMatcher` (T7) and build the combined confirmation reply (AC-03/AC-05/AC-05b); on unclear/incomplete, reply with what's missing and mark the conversation state for one retry (AC-07). Reply text uses the client's stored `lang` (AC-14), never per-message detection.

## Definition of Done

- [ ] unit test: a well-formed message produces a confirmation payload combining exercise + numbers, no `workoutLogRepository.addEntry` call
- [ ] unit test: an incomplete/multi-exercise message produces the unclear reply and flags one retry remaining, no entry write
- [ ] unit test: reply language matches the client's stored `lang`, independent of the message's own language
- [ ] lint + vet clean

## Notes

Confirmation-response handling (candidate choice, keep-own, reject, AC-08 fallback) is T9, sharing this file (overlapping `files_hint` — same lane, serialize T8 before T9).
