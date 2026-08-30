---
id: T1
title: "Promote workout_log_session staged migration"
layer: "migration"
deps: []
acs: ["AC-01", "AC-09", "AC-09b", "AC-10", "AC-11", "AC-12", "AC-13"]
files_hint: ["docs/features/workout-logging/migrations/01_create_workout_log_session.up.sql", "docs/features/workout-logging/migrations/01_create_workout_log_session.down.sql"]
owner: "<TBD lead>"
estimate: "S"
status: "todo"
---

# T1 — Promote workout_log_session staged migration

## Why

`workout_log_session` is the aggregate root the whole feature depends on (`data-model.md` §Entities, ADR-0004).

## What

Apply the staged `01_create_workout_log_session.up.sql` (columns, FK to `client`, `idx_workout_log_session_client_id`, and the `uq_workout_log_session_open_client` partial unique index) per `data-model.md`. This repo hand-edits schema directly (sad.md §2/§11 — no migration tooling exists), so promotion means running the staged SQL against the target Postgres instance following the existing hand-edit convention, and keeping the paired `.down.sql` verified for local rollback.

## Definition of Done

- [ ] `01_create_workout_log_session.up.sql` applies cleanly against a local/dev Postgres instance
- [ ] `01_create_workout_log_session.down.sql` reverts cleanly
- [ ] `uq_workout_log_session_open_client` (partial unique on `client_id` WHERE `ended_at IS NULL`) exists after apply
- [ ] lint + vet clean

## Notes

Serialized ahead of T2 (`layer: migration` tasks always run in sequence) since `workout_log_entry` FKs to this table.
