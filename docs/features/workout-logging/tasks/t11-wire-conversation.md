---
id: T11
title: "Wire workoutLoggingConversation into the conversation engine"
layer: "ports"
deps: ["T9", "T10"]
acs: ["AC-01", "AC-03", "AC-04", "AC-05", "AC-06", "AC-07", "AC-07b", "AC-08", "AC-09", "AC-09b", "AC-12", "AC-14"]
files_hint: ["src/modules/telegram/features/workoutLogging/workoutLoggingConversation.ts", "src/modules/telegram/features/conversations/registry.ts"]
owner: "<TBD lead>"
estimate: "M"
status: "todo"
---

# T11 — Wire workoutLoggingConversation into the conversation engine

## Why

`sad.md` §5: a new conversation type (`WAITING_INPUT` / `WAITING_CONFIRMATION` steps, mirroring `bodyMeasurementsConversation.ts`) is the entrypoint the Telegram handler dispatches to; it must be registered before any of T8-T10's service logic is reachable from a real message.

## What

Add `workoutLoggingConversation.ts` with the two-step state machine delegating to `workoutLoggingService` (T8/T9/T10), and register the new conversation type in `conversations/registry.ts`. A message with no open session and no start command gets the existing standard out-of-context reply (AC-04, sad.md §6 AC-coverage table — no workout-logging-specific branch needed).

## Definition of Done

- [ ] integration test drives start → describe exercise → confirm → end through the registered conversation end to end
- [ ] integration test confirms an exercise-shaped message with no open session gets the standard out-of-context reply, not a workout-logging-specific one (AC-04)
- [ ] lint + vet clean

## Notes

Depends on T9 (confirmation handling) and T10 (lifecycle) both being implemented first.
