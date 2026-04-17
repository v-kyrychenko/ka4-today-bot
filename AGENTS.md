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

## Build, Test, and Development Commands
Install dependencies with `npm install`.

- `npm run typecheck` validates the TypeScript codebase with `tsc --noEmit`.

## Coding Style & Naming Conventions
This repository uses TypeScript with ESM (`"type": "module"`). Follow the existing style: 4-space indentation, semicolons, single quotes, and named exports for shared modules. Keep handlers thin and push orchestration into module `application/` code or repositories as appropriate. Put generic helpers in `shared`, low-level external integration code in `infrastructure`, and product behavior in the owning module under `modules`.

Inside module `application/` folders, prefer focused use-case files such as `listClients.ts`, `getClient.ts`, `createClient.ts`, or `searchExercises.ts` when the logic is small and clearly maps to one behavior. Use broader `*Service.ts` files only when multiple closely related operations truly need to stay together. Use `camelCase` for functions and variables, `PascalCase` for classes like `AppUser`, and descriptive file names such as `telegramMessagingService.ts`, `listClients.ts`, or `createRouteKeyController.ts`.

For coach REST APIs, keep the REST model, domain model, and persistence row shape separated. Request and response payloads should stay camelCase, PostgreSQL rows and schema definitions should stay snake_case, and translation between them should happen through dedicated mappers in `src/infrastructure/persistence/postgres/mappers/`. Handlers should parse and validate REST payloads, application code should work with domain or REST-facing models, and repositories should be the boundary where mapped persistence rows are read or written.

## Testing Guidelines
There is no dedicated automated test suite yet. Treat `npm run typecheck` as the minimum gate. If runtime verification is explicitly requested, run the relevant local command and verify the response payloads manually; otherwise, prefer compilation-only verification. When adding tests later, place them next to the feature or in a dedicated `tests/` folder, and name them after the target module or use case, for example `listClients.test.ts` or `searchExercises.test.ts`.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commit subjects such as `typescript migration`. Keep commits focused and small. For pull requests, include a concise summary, affected modules or handlers, required config changes, and verification steps. Add request/response examples for API changes and screenshots only when UI or rendered output is affected.

## Security & Configuration Tips
Never run deploy. Do not commit `.env` files, AWS credentials, or Telegram/OpenAI secrets. Use `.env` for local development and SAM parameter overrides for deployment. When changing event shapes or resource names, update both code and `template.yaml` together.
