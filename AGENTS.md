# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the application code and is organized by role and product module. Use `src/app/config/` for environment and constants, `src/shared/` for cross-cutting helpers and types, `src/infrastructure/` for persistence and low-level third-party integrations, and `src/modules/` for product-facing code.

Telegram bot logic lives under `src/modules/telegram/`:
- `handlers/` for Lambda entrypoints
- `application/` for orchestration and module services
- `commands/` for bot commands
- `domain/` for Telegram-specific types and context models

Coach/admin logic lives under `src/modules/coach/`:
- `api/` for the top-level HTTP API entrypoint
- `client/` for client-specific handlers, focused application use cases, and repository code
- `exercise/` for exercise-specific handlers, focused application use cases, domain models, and repository code
- `workout/` is reserved for future coach workout functionality

Generic REST controller helpers live in `src/shared/http/controllers/`. PostgreSQL code lives under `src/infrastructure/persistence/postgres/`. Legacy DynamoDB compatibility code lives under `src/infrastructure/persistence/dynamodb/legacy/` and should not be expanded. Low-level OpenAI and Telegram HTTP clients live under `src/infrastructure/integrations/`.

Deployment is defined in `template.yaml` and `stack/`. Local helper scripts live in `scripts/`. Static assets such as diagrams belong in `assets/`.

## Reusable Shared Features
Before adding new helpers, services, repositories, parsers, or integration wrappers, check these existing reusable features and extend them only when the new behavior belongs there.

- `src/shared/errors/` defines common application errors (`BadRequestError`, `HttpApiError`, `NotFoundError`, `OpenAIError`, `TelegramError`) and short error logging helpers.
- `src/shared/logging/` provides `log` and `logError`; prefer this over direct logging in application code.
- `src/shared/i18n/` provides `I18N_KEYS`, locale JSON files, language normalization, and `i18nService.tr(...)`; use it for all user-facing localized text.
- `src/shared/http/` provides API Gateway helpers for route/method controllers, JSON request parsing, validation helpers, query/path params, JSON responses, and error responses.
- `src/shared/http/httpClient.ts` provides the generic HTTP request builder/client foundation used by external integrations.
- `src/shared/types/` contains shared AWS Lambda/SQS response/event shapes and OpenAI response/config types.
- `src/shared/utils/dateUtils.ts` provides date-only parsing/formatting, `today`, `nowIso`, age calculation, minus-days, and day-distance helpers.
- `src/shared/utils/dayOfWeek.ts` provides current day-code calculation for workout scheduling.
- `src/shared/utils/json.ts` extracts JSON objects/arrays from text responses; reuse it for OpenAI text that embeds JSON.
- `src/shared/utils/collectionUtils.ts` provides set/intersection helpers for tag and filter logic.
- `src/shared/pagination/pageRequest.ts` provides cursor-style page request parsing.
- `src/infrastructure/persistence/postgres/` provides the Drizzle DB singleton, schema definitions, row models, persistence error detection, and mappers between snake_case rows and domain models.
- `src/infrastructure/integrations/openai/openAiClient.ts` is the low-level OpenAI client wrapper; application code should normally go through prompt services instead.
- `src/infrastructure/integrations/telegram/telegramClient.ts` is the low-level Telegram HTTP client; route and feature code should normally use `telegramMessagingService`.
- `src/modules/telegram/features/messaging/telegramMessagingService.ts` centralizes Telegram message sending, media sending, callback answers, reply-markup removal, and sent-message logging.
- `src/modules/telegram/features/prompts/promptReplyService.ts` loads prompt dictionaries, applies translations/variables, calls OpenAI, and returns the latest assistant text.
- `src/modules/telegram/features/conversations/` provides the reusable multi-step conversation engine, conversation registry, localized conversation responses, callback/text handling, cancellation, and state persistence.
- `src/modules/telegram/features/measurements/` provides body-measurement models, parsing, missing-type detection, storage rules, repositories, and the body-measurements conversation.
- `src/modules/telegram/features/progress/` builds progress view models/captions, detects empty progress data, renders progress PNGs, and caches generated summaries.
- `src/modules/telegram/features/nutrition/` provides nutrition domain models, macro target calculation, meal template repositories/mappers, meal picking with fallback rules, macro adjustment, plan totals, and `dailyNutritionPlanner.generate(...)`.
- `src/modules/telegram/features/sqs/` provides Telegram queue envelopes and FIFO metadata builders for webhook and scheduled-job messages.
- `src/modules/telegram/features/web/miniAppService.ts` validates Telegram Mini App init data and extracts Telegram user profiles.
- `src/modules/telegram/repository/` contains reusable Telegram persistence boundaries for users, prompts, conversation state, and sent-message logs.
- `src/modules/coach/client/` contains reusable client profile use cases and repository access; keep coach REST parsing separate from domain and persistence row models.
- `src/modules/coach/exercise/` contains exercise search domain models, application use case, and repository access for exercise catalog functionality.

## Build, Test, and Development Commands
Install dependencies with `npm install`.

- `npm run typecheck` validates the TypeScript codebase with `tsc --noEmit`.
- `npm test` runs the automated Node.js test suite with `node --test "test/**/*.test.mjs"`.
- Do not run script interpreters or ad-hoc scripting languages such as `ruby`, `python`, or similar for repository tasks. Prefer standard shell utilities and the documented `npm` commands instead.

## Coding Style & Naming Conventions
This repository uses TypeScript with ESM (`"type": "module"`). Follow the existing style: 4-space indentation, semicolons, single quotes, and named exports for shared modules. Keep handlers thin and push orchestration into module `application/` code or repositories as appropriate. Put generic helpers in `shared`, low-level external integration code in `infrastructure`, and product behavior in the owning module under `modules`.

For the shared logging module, prefer the shortened import path without `/index.js`, for example `import {log, logError} from '../shared/logging';`.
Prefer keeping imports on one line when they fit within 120 symbols; wrap import lists only when needed for readability or line length.
Prefer keeping function signatures on one line when the function name and parameters fit within 120 symbols; wrap only when needed for readability or line length.
When a function signature must wrap because the total line would exceed 120 symbols, prefer keeping the first parameter after `(` and aligning subsequent parameters under it, for example:
`function initDraftPlan(request: DailyNutritionPlannerRequest,
                       goal: GoalTag,
                       meals: DailyNutritionPlanMeal[]): DailyNutritionPlan`.
Use destructured function parameters only for very small functions that need a few fields. For workflow code, branching logic, or functions that pass context onward, prefer a named parameter such as `context` or `request` and read fields as `context.user`, `request.text`, and so on.
Prefer `log(...)` and `logError(...)` calls on a single line when they fit within 120 symbols; only wrap them
when needed to stay under the line-length limit.

Inside module `application/` folders, prefer focused use-case files such as `listClients.ts`, `getClient.ts`, `createClient.ts`, or `searchExercises.ts` when the logic is small and clearly maps to one behavior. Use broader `*Service.ts` files only when multiple closely related operations truly need to stay together. Use `camelCase` for functions and variables, `PascalCase` for classes like `AppUser`, and descriptive file names such as `telegramMessagingService.ts`, `listClients.ts`, or `createRouteKeyController.ts`.

For coach REST APIs, keep the REST model, domain model, and persistence row shape separated. Request and response payloads should stay camelCase, PostgreSQL rows and schema definitions should stay snake_case, and translation between them should happen through dedicated mappers in `src/infrastructure/persistence/postgres/mappers/`. Handlers should parse and validate REST payloads, application code should work with domain or REST-facing models, and repositories should be the boundary where mapped persistence rows are read or written.

For small service modules, prefer placing exported service objects such as `export const telegramMessagingService = { ... }` near the top of the file, right after imports, so the public API is visible immediately when the file is opened. Treat this as a strong default, not a hard rule: if a different placement makes the file substantially easier to read top-to-bottom, prefer readability.

Prefer KISS-oriented service code: small focused methods, with a soft maximum of 20 lines per method. If a method has branching or loop-heavy logic, keep each branch or loop body around 5 lines and extract helper methods early when readability starts to drop.

For command classes, keep `execute(context)` as high-level orchestration only. Split detailed branches into focused helpers with names that describe the behavior, so command flow stays easy to scan and future tests can target smaller units.

When changing progress view-model behavior or template rendering, keep the root `test/modules/telegram/commands/progress/` fixtures updated in the same change so previews and future tests continue to represent production behavior.

## Testing Guidelines
There is a small automated test suite using Node.js built-in `node:test`. Run it with `npm test`, which executes every `test/**/*.test.mjs` file. The current automated test lives at `test/modules/telegram/features/conversations/conversationEngine.multiStep.test.mjs` and verifies the Telegram conversation engine multi-step flow with bundled TypeScript source through `esbuild`.

Treat `npm run typecheck` as the minimum gate for code changes, and run `npm test` when changing tested behavior or adding tests. If runtime verification is explicitly requested, run the relevant local command and verify the response payloads manually; otherwise, prefer compilation plus targeted tests.

When adding tests, use Node.js built-in `node:test` unless the repo adopts a broader test framework. Place tests under `test/` using the owning module path, and name them after the target module or use case, for example `listClients.test.mjs`, `searchExercises.test.mjs`, or `conversationEngine.multiStep.test.mjs`.

Local SAM verification depends on a working container runtime. `sam build` succeeds in this repo, but `sam local invoke` will fail unless Docker or Finch is installed and running; a recent attempt to run `npm run local -- Ka4TodayAsyncTelegramProcessor event-samples/progress.json` was blocked for that reason rather than by an application error.
For local TypeScript preview scripts, do not assume Node.js can execute repo source files directly with `--experimental-strip-types`. This codebase uses ESM imports that end in `.js`, so a direct TypeScript entrypoint can fail to resolve sibling source modules at runtime. The current progress preview works by using a small `esbuild` bootstrap script (`scripts/progressPreview.mjs`) that builds and runs the TypeScript preview entry under Node.js 22.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commit subjects such as `typescript migration`. Keep commits focused and small. For pull requests, include a concise summary, affected modules or handlers, required config changes, and verification steps. Add request/response examples for API changes and screenshots only when UI or rendered output is affected.

## Security & Configuration Tips
Never run deploy. Do not commit `.env` files, AWS credentials, or Telegram/OpenAI secrets. Use `.env` for local development and SAM parameter overrides for deployment. When changing event shapes or resource names, update both code and `template.yaml` together.
