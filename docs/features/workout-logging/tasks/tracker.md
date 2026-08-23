# Tracker — workout-logging

> Status of every task in the epic. `implement` updates `done` as it commits each task.
> States: `todo` · `in_progress` · `blocked` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | Promote workout_log_session staged migration | migration | user | S | — | done |
| T2 | Promote workout_log_entry staged migration | migration | user | S | T1 | done |
| T3 | Add WorkoutLogSession/WorkoutLogEntry domain models | domain | <TBD lead> | S | — | done |
| T4 | Build workoutLogRepository for session + entry CRUD | infra | <TBD lead> | M | T1, T2, T3 | done |
| T5 | Fix exerciseRepository.search to call search_dict_exercises | infra | <TBD lead> | S | — | done |
| T6 | Add OpenAI structured-output parse for exercise messages | app | <TBD lead> | M | — | done |
| T7 | Build candidate-match confirmation payload | app | <TBD lead> | M | T5 | todo |
| T8 | Handle initial exercise-description message | app | <TBD lead> | M | T4, T6, T7 | todo |
| T9 | Handle exercise confirmation response | app | <TBD lead> | M | T8 | todo |
| T10 | Implement session start/end lifecycle | app | <TBD lead> | M | T4 | done |
| T11 | Wire workoutLoggingConversation into the conversation engine | ports | <TBD lead> | M | T9, T10 | todo |
| T12 | Wire cross-context pre-emption and lazy auto-expiry | wiring | <TBD lead> | M | T10 | in_progress |
| T13 | Add QG-1/QG-3 integration test coverage | tests | <TBD lead> | M | T11, T12 | todo |

**Total:** 13 tasks, ~7-8 person-days.

**Note (2026-08-23):** T1/T2 (promoting staged migrations to the live `migrations/` tree and applying/reverting against Postgres) were done manually by the user outside this automated run — this repo has no migration tool and no local/testcontainers Postgres for `implement` to do it itself. No real-DB integration tier exists for this feature's own test suite either way (nothing in the repo wires Docker to a disposable Postgres for tests), so T4/T13 are verified with unit tests only (mocked drizzle/pg client / mocked repositories). `sad.md` §10 QG-1/QG-3 "How verify" and the T4/T13 DoD in `tasks.json` were updated to match.

**Note (2026-08-24):** T5's RED test asserted `name` as a plain string; `dict_exercise.name` is `jsonb` and the shared `exerciseMapper` correctly normalizes any non-object value to `{}`, so the fixture was wrong, not the AC — fixed the fixture to a locale-keyed object (`{en: '...'}`) and re-verified GREEN.

**Note (2026-08-24):** T12's implementer reached GREEN for `workoutLoggingService.preemptActiveSession`/`closeExpiredSession` (+ `workoutLogRepository.findLastEntryAt`) but escalated on the actual `routesProcessor.ts`/`engine.ts` call sites: `sad.md` Flow 2's sequence diagram confirms `routesProcessor` (the "AsyncProcessor") is meant to call these directly and unconditionally on every request — this is a deliberate ADR-0003 coupling, not a missing abstraction — but two existing test files (`measurementsRouting.test.mjs`, `conversationEngine.multiStep.test.mjs`) bundle `routesProcessor.ts`/`engine.ts` with esbuild without mocking the new import chain, so adding the real call sites breaks them on `pg`'s dynamic `require`. Re-dispatching with instructions to extend those two test files' existing `mockModule` coverage (same pattern already used for `tgUserRepository.js`/`tgConversationStateRepository.js`) before wiring the call sites.

**Note (2026-08-24):** User review flagged that T6's parser called `openAiClient` directly instead of the repo's established `promptReplyService.fetchOpenAiReply(promptRef, variables)` pattern (all prompts DB-managed via `dict_prompt`, which already has a `text_format` column for structured output). Fixed: `workoutExerciseParser.ts` now calls `promptReplyService` with `promptRef: 'workout_exercise_parser'`, matching `bodyMeasurementsConversation.ts`'s convention. Still needed before this runs against a live DB: a hand-inserted `dict_prompt` row for that key carrying the system prompt, a `${USER_INPUT}`-templated user prompt, and the JSON schema the parser expects back (exerciseName/reps/sets/weight/weightRequired/multipleExercises) — same manual-DB-object pattern as T1/T2's migrations.
