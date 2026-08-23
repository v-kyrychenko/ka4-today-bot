---
id: T4
title: "Build workoutLogRepository for session + entry CRUD"
layer: "infra"
deps: ["T1", "T2", "T3"]
acs: ["AC-01", "AC-09", "AC-09b", "AC-10", "AC-11", "AC-12", "AC-13"]
files_hint: ["src/modules/telegram/features/workoutLogging/repository/workoutLogRepository.ts", "src/infrastructure/persistence/postgres/schema/workoutLogSession.ts", "src/infrastructure/persistence/postgres/schema/workoutLogEntry.ts", "src/infrastructure/persistence/postgres/models/workoutLogSessionRow.ts", "src/infrastructure/persistence/postgres/models/workoutLogEntryRow.ts", "src/infrastructure/persistence/postgres/mappers/workoutLogSessionMapper.ts", "src/infrastructure/persistence/postgres/mappers/workoutLogEntryMapper.ts"]
owner: "<TBD lead>"
estimate: "M"
status: "todo"
---

# T4 — Build workoutLogRepository for session + entry CRUD

## Why

Persists and reads session/entry state for every lifecycle and recording flow (`sad.md` §5 `repository/workoutLogRepository.ts`, ADR-0004), mirroring the `bodyMeasurementLog`/mapper pattern already in the repo.

## What

Add Drizzle schema definitions for both tables, row models, mappers (row ↔ domain, per `AGENTS.md`'s coach-API mapper convention extended here for consistency), and `workoutLogRepository` with: `findActiveByClientId`, `startSession`, `closeSession(id, endReason)`, `addEntry`, `countEntries(sessionId)`.

## Definition of Done

- [ ] integration test against a real/local Postgres asserts `findActiveByClientId` returns only the row with `ended_at IS NULL`
- [ ] integration test asserts `closeSession` sets `ended_at`/`end_reason` and `addEntry`/`countEntries` round-trip correctly
- [ ] mappers translate row snake_case ↔ domain camelCase with no leakage either direction
- [ ] lint + vet clean

## Notes

Blocked by T1/T2 (tables must exist) and T3 (domain shapes to map into).
