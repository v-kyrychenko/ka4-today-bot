---
id: T9
title: "Handle exercise confirmation response"
layer: "app"
deps: ["T8"]
acs: ["AC-06", "AC-07b", "AC-08"]
files_hint: ["src/modules/telegram/features/workoutLogging/workoutLoggingService.ts"]
owner: "<TBD lead>"
estimate: "M"
status: "todo"
---

# T9 — Handle exercise confirmation response

## Why

Completes `sad.md` §6 Flow 1: the client's reply to T8's confirmation prompt decides whether an entry is saved linked, unlinked, retried, or (after a failed retry) saved raw and unconfirmed — the one named exception to QG-1 (sad.md §10, AC-08).

## What

Add the confirmation-response branch of `workoutLoggingService.ts`: confirming a candidate saves an entry linked to `dict_exercise_id` (AC-03/AC-05); keeping own description or having no candidates saves unlinked (AC-05b/AC-06); rejecting the proposal re-enters the same one-retry unclear flow as AC-07 (AC-07b); if the retried message still fails to parse, save the client's original wording unconfirmed and unlinked (AC-08).

## Definition of Done

- [ ] unit test: confirming a candidate calls `workoutLogRepository.addEntry` with `dictExerciseId` set
- [ ] unit test: keep-own-description and reject-all-candidates both save unlinked (`dictExerciseId: null`)
- [ ] unit test: rejecting the confirmed proposal triggers the retry path (AC-07b), not an immediate save
- [ ] unit test: a second parse failure after retry saves the original wording with `reps`/`sets`/`weight` null (AC-08)
- [ ] lint + vet clean

## Notes

Shares `workoutLoggingService.ts` with T8 (same file, serialized lane).
