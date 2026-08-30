# Data-model audit — workout-logging — 2026-08-23

## Convention source

- `docs/architecture-map.md` §Migrations + workflow: **no migration tool exists** (`migration_tool: ""`, no `drizzle.config.*`, no migrations directory). Schema is hand-edited directly into `src/infrastructure/persistence/postgres/schema/*.ts`, with no SQL ever committed to the repo up to this feature.
- `sad.md` §2 Constraints: `drizzle-orm` 0.45.2 + `pg` (PostgreSQL/RDS, the only datastore); Postgres `bigserial` numeric PK convention (no UUID/nanoid); no CHECK/enum usage anywhere in the existing schema.
- ADR-0002: `search_dict_exercises` is a stored Postgres function that exists only in the live database, untracked by any migration — corroborated (grepped `src/`, zero references outside the ADR/SAD).
- ADR-0004: fixes the two new tables and their core columns (`workout_log_session`: client, day, started_at, ended_at, end_reason; `workout_log_entry`: session FK, catalog exercise FK or null, raw description, reps, sets, weight, created_at) — this pass derives exact types/constraints/indexes from that shape plus the repo's live schema conventions.

## Promote-time hint

This repo has **no migration tool and no live `migrations/` tree to promote into.** The staged `.up.sql`/`.down.sql` pairs under `docs/features/workout-logging/migrations/` are the first SQL ever committed for this project — they document the exact DDL a human hand-applies to RDS, matching how every existing table in this repo was created. `implement` should:
1. Hand-apply the two `.up.sql` files against RDS (in ordinal order: `01_` then `02_`), the same way the existing tables were created.
2. Add matching Drizzle schema files (`src/infrastructure/persistence/postgres/schema/workoutLogSession.ts`, `workoutLogEntry.ts`) mirroring the DDL, following the existing file style (see `bodyMeasurementSummary.ts` for the array-callback index/constraint pattern this repo already uses).

There is no live `migrations/` directory to write a real sequence number into — this is a genuine gap the repo already carries (SAD §11 risk row), not something this pass can fix.

## Staged migrations

| File | Purpose |
|---|---|
| `migrations/01_create_workout_log_session.up.sql` / `.down.sql` | new `workout_log_session` table + `idx_workout_log_session_client_id` + partial-unique `uq_workout_log_session_open_client` |
| `migrations/02_create_workout_log_entry.up.sql` / `.down.sql` | new `workout_log_entry` table + `idx_workout_log_entry_session_id` + `idx_workout_log_entry_dict_exercise_id` |

## Convention deviations (flagged, not silently applied)

- **This is the first table in the repo with an explicit index/partial-unique-index in its DDL.** Every existing FK column in the live schema (`body_measurement_log.client_id`, `workout_schedule.client_id`, `tg_conversation_state.chat_id`, …) has **no** index today. `data-model`'s universal FK-safety mandate (index every `REFERENCES`) is applied here regardless — existing tables are untouched, only the two new tables get indexes. Flagging this so `implement`/reviewers don't read it as a stray style choice.
- No CHECK constraint on `end_reason` even though only three literal values are ever written (`client-ended` / `auto-closed` / `pre-empted`) — the repo never uses CHECK/DB-level enums (`client.status` is the same pattern: an unconstrained `varchar`). Followed, not overridden.
- No `updated_at` column on either table — matches the repo's mixed convention (`client`, `body_measurement_log`, `workout_schedule` have none; only `tg_conversation_state` does) and the SAD §11 accepted debt ("session records carry no edit/audit history").

## Self-check (4/4 pass)

1. **Naming** — snake_case, singular table names (`workout_log_session`, `workout_log_entry`) matching `client`, `dict_exercise`, `body_measurement_log`. Pass.
2. **Down reversibility** — every `CREATE TABLE` has a matching `DROP TABLE`; every `CREATE INDEX` has a matching `DROP INDEX`. Pass.
3. **FK indexes** — `workout_log_session.client_id`, `workout_log_entry.session_id`, `workout_log_entry.dict_exercise_id` are all indexed. Pass.
4. **Convention adherence** — bigserial PK, no CHECK, `pg`/Drizzle-compatible types; deviations (index precedent) flagged above rather than silently applied. Pass.

## Drift detection

No `workoutLogging` domain/persistence code exists yet in `src/` (feature is pre-`implement`) — nothing to diff against. No drift findings; skip `_drift/`.

## Open items / TBD

- None marked `<!-- TBD -->` in `data-model.md` — ADR-0004 fixed enough of the shape that no column was left undecided.
- Carried from `sad.md` §11 (not this stage's to resolve): no migration tooling exists, so the staged SQL here has no automated apply/rollback path — hand-application risk is explicit, tracked as repo-level debt, not new to this feature.

## Next stage

`/sdd:api workout-logging` — no new/changed REST endpoint is introduced by this schema alone (this feature's client-facing surface is Telegram conversation turns, not a REST contract, per `sad.md` §4 solution strategy). Route is `standard` (`.route` = `standard`), so `api`'s own N/A evaluation and skip offer happens there, not here.
