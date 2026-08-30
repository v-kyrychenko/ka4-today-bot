---
id: T2
title: "Promote workout_log_entry staged migration"
layer: "migration"
deps: ["T1"]
acs: ["AC-03", "AC-05", "AC-05b", "AC-06", "AC-07", "AC-08"]
files_hint: ["docs/features/workout-logging/migrations/02_create_workout_log_entry.up.sql", "docs/features/workout-logging/migrations/02_create_workout_log_entry.down.sql"]
owner: "<TBD lead>"
estimate: "S"
status: "todo"
---

# T2 — Promote workout_log_entry staged migration

## Why

`workout_log_entry` holds each recorded exercise (`data-model.md` §Entities, ADR-0004), linked or unlinked to the catalog per AC-05b/AC-06/AC-08.

## What

Apply the staged `02_create_workout_log_entry.up.sql` (columns, FK to `workout_log_session(id)`, nullable FK to `dict_exercise(id)`, `idx_workout_log_entry_session_id`, `idx_workout_log_entry_dict_exercise_id`) per `data-model.md`. Same hand-edit promotion convention as T1.

## Definition of Done

- [ ] `02_create_workout_log_entry.up.sql` applies cleanly against a local/dev Postgres instance with `workout_log_session` already present
- [ ] `02_create_workout_log_entry.down.sql` reverts cleanly
- [ ] both FKs and both indexes exist after apply
- [ ] lint + vet clean

## Notes

Depends on T1 for the FK target table; migration tasks are serialized regardless.
