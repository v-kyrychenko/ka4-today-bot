# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the application code. Use `src/handlers/` for Lambda entrypoints, `src/services/` for business logic and AWS/OpenAI integrations, `src/repositories/` for persistence access, `src/controllers/` for request dispatch, `src/models/` for shared types/classes, and `src/utils/` for reusable helpers. Configuration lives in `src/config/`. Deployment is defined in `template.yaml` and `stack/`. Local helper scripts live in `scripts/`. Static assets such as diagrams belong in `assets/`.

## Build, Test, and Development Commands
Install dependencies with `npm install`.

- `npm run typecheck` validates the TypeScript codebase with `tsc --noEmit`.
- `npm run local -- Ka4TodayTelegramWebhook event-samples/telegram-event.json` runs a Lambda handler locally through the SAM helper script.
- `npm run local -- Ka4TodayAsyncTelegramProcessor event-samples/default-event.json` runs the async queue processor locally.
- `npm run local-api -- HttpApiClients` starts the HTTP API handler locally.

## Coding Style & Naming Conventions
This repository uses TypeScript with ESM (`"type": "module"`). Follow the existing style: 4-space indentation, semicolons, single quotes, and named exports for shared modules. Keep handlers thin and push logic into services or repositories. Use `camelCase` for functions and variables, `PascalCase` for classes like `AppUser`, and descriptive file names such as `clientsService.ts` or `createMethodController.ts`.

## Testing Guidelines
There is no dedicated automated test suite yet. Treat `npm run typecheck` as the minimum gate. For behavior changes, run the affected handler locally with the scripts above and verify the response payloads manually. When adding tests later, place them next to the feature or in a dedicated `tests/` folder, and name them after the target module, for example `clientsService.test.ts`.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commit subjects such as `typescript migration`. Keep commits focused and small. For pull requests, include a concise summary, affected handlers or services, required config changes, and local verification steps. Add request/response examples for API changes and screenshots only when UI or rendered output is affected.

## Security & Configuration Tips
Never run deploy. Do not commit `.env` files, AWS credentials, or Telegram/OpenAI secrets. Use `.env` for local development and SAM parameter overrides for deployment. When changing event shapes or resource names, update both code and `template.yaml` together.
