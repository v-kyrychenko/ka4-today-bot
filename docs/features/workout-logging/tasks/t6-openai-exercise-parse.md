---
id: T6
title: "Add OpenAI structured-output parse for exercise messages"
layer: "app"
deps: []
acs: ["AC-03", "AC-07", "AC-08", "AC-14"]
files_hint: ["src/modules/telegram/features/workoutLogging/workoutExerciseParser.ts"]
owner: "<TBD lead>"
estimate: "M"
status: "todo"
---

# T6 — Add OpenAI structured-output parse for exercise messages

## Why

ADR-0001 commits to one OpenAI structured-output call per exercise message to extract name/reps/sets/weight regardless of language (AC-14), since a deterministic parser cannot satisfy the any-language requirement.

## What

Add `workoutExerciseParser.ts` calling the existing OpenAI client in JSON/structured-output mode, returning either a parsed `{name, reps, sets, weight}` result or an explicit unclear/incomplete outcome (missing reps/sets/weight-when-needed, multiple exercises described, or otherwise unclear — AC-07). Use the client's stored `lang` only to know parsing is language-agnostic; no per-message language detection.

## Definition of Done

- [ ] unit test (mocked OpenAI client) confirms extraction works across at least two different input languages (AC-14)
- [ ] unit test confirms a message missing reps/sets, or missing weight for a weighted exercise, or describing 2+ exercises returns the unclear outcome (AC-07/AC-08 upstream)
- [ ] OpenAI errors/timeouts surface via the existing `OpenAIError`/`toShortErrorLog()` path (sad.md §8), no new error class
- [ ] lint + vet clean

## Notes

Pure parse step — no catalog matching (T7) or persistence here.
