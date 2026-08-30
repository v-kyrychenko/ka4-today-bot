---
id: T3
title: "Add WorkoutLogSession/WorkoutLogEntry domain models"
layer: "domain"
deps: []
acs: ["AC-01", "AC-03", "AC-13"]
files_hint: ["src/modules/telegram/features/workoutLogging/domain/workoutLogEntry.ts"]
owner: "<TBD lead>"
estimate: "S"
status: "todo"
---

# T3 — Add WorkoutLogSession/WorkoutLogEntry domain models

## Why

Establishes the domain-facing shapes (`sad.md` §5 Internal decomposition) that the repository (T4) and service layer (T8-T10) work against, kept separate from the Postgres row shape per `AGENTS.md`'s mapper-boundary convention.

## What

Add `WorkoutLogSession` (`clientId`, `sessionDay`, `startedAt`, `endedAt`, `endReason`) and `WorkoutLogEntry` (`sessionId`, `dictExerciseId`, `rawDescription`, `reps`, `sets`, `weight`, `createdAt`) camelCase domain types in `domain/workoutLogEntry.ts`, matching `data-model.md` §Entities field-for-field.

## Definition of Done

- [ ] unit test confirms both types' fields match `data-model.md`'s column list, with `endedAt`/`endReason` nullable while a session is open
- [ ] lint + vet clean

## Notes

No persistence or Drizzle imports here — that boundary belongs to T4's mappers.
