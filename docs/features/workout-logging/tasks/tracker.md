# Tracker — workout-logging

> Status of every task in the epic. `implement` updates `done` as it commits each task.
> States: `todo` · `in_progress` · `blocked` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | Promote workout_log_session staged migration | migration | user | S | — | done |
| T2 | Promote workout_log_entry staged migration | migration | user | S | T1 | done |
| T3 | Add WorkoutLogSession/WorkoutLogEntry domain models | domain | <TBD lead> | S | — | todo |
| T4 | Build workoutLogRepository for session + entry CRUD | infra | <TBD lead> | M | T1, T2, T3 | todo |
| T5 | Fix exerciseRepository.search to call search_dict_exercises | infra | <TBD lead> | S | — | todo |
| T6 | Add OpenAI structured-output parse for exercise messages | app | <TBD lead> | M | — | todo |
| T7 | Build candidate-match confirmation payload | app | <TBD lead> | M | T5 | todo |
| T8 | Handle initial exercise-description message | app | <TBD lead> | M | T4, T6, T7 | todo |
| T9 | Handle exercise confirmation response | app | <TBD lead> | M | T8 | todo |
| T10 | Implement session start/end lifecycle | app | <TBD lead> | M | T4 | todo |
| T11 | Wire workoutLoggingConversation into the conversation engine | ports | <TBD lead> | M | T9, T10 | todo |
| T12 | Wire cross-context pre-emption and lazy auto-expiry | wiring | <TBD lead> | M | T10 | todo |
| T13 | Add QG-1/QG-3 integration test coverage | tests | <TBD lead> | M | T11, T12 | todo |

**Total:** 13 tasks, ~7-8 person-days.

**Note (2026-08-23):** T1/T2 (promoting staged migrations to the live `migrations/` tree and applying/reverting against Postgres) were done manually by the user outside this automated run — this repo has no migration tool and no local/testcontainers Postgres for `implement` to do it itself. No real-DB integration tier exists for this feature's own test suite either way (nothing in the repo wires Docker to a disposable Postgres for tests), so T4/T13 are verified with unit tests only (mocked drizzle/pg client / mocked repositories). `sad.md` §10 QG-1/QG-3 "How verify" and the T4/T13 DoD in `tasks.json` were updated to match.
