# ka4-today-bot

A lightweight, serverless Telegram bot built with AWS Lambda, OpenAI Assistants API, and Node.js.  
It processes a simple webhook message, interacts with OpenAI to generate a response, and sends it back via Telegram.

---

## 🧩 Project Structure

```
src/
├── config/              # Environment variables and constants
├── handlers/            # Lambda entrypoints
├── services/            # Core business logic (Telegram, OpenAI, etc.)
├── utils/               # Shared helpers (http client, logger, poller, errors)
template.yaml            # AWS SAM template
.env.sample              # Local environment variables sample
```

---

## 🚀 Running Locally

> Requires Node.js 18+

1. Clone the repo
2. Copy a `.env.sample` file and rename it to `.env` :
3. Install dependencies:

```bash
npm install
```

4. Test individual handlers (via [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli.html)):

Run entrypoint:
```bash
npm run local -- Ka4TodayTelegramWebhook event-samples/telegram-event.json
```

Run async processor
```bash
npm run local -- Ka4TodayAsyncTelegramProcessor event-samples/async-event.json
```

---

## ☁️ Deploying to AWS

> Requires [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html) and configured AWS credentials.

### One-time setup:

```bash
sam build
sam deploy --guided
```

You will be prompted to enter your environment variables. These are saved to `samconfig.toml`.

### Or deploy manually:

```bash
sam deploy \
  --stack-name ka4-today-bot \
  --region eu-central-1 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    TelegramBotToken=your-token \
    TelegramSecurityToken=your-secret \
    OpenAiToken=your-openai-key \
    OpenAiAssistantId=your-assistant-id
    OpenAiProjectId=your-openai-project-id \
    OpenAiDefaultPrompt=your-openai-assistant-default-promt
```

## ☁️ Delete all from AWS

```bash
aws cloudformation delete-stack --stack-name ka4-today-bot
```

---

## 🛠️ Environment Requirements

- Node.js 18.x
- AWS CLI + AWS SAM CLI
- AWS account with permissions to:
  - Deploy Lambda functions
  - Manage API Gateway (HTTP API)
  - Create IAM roles
- Telegram bot with webhook access (set via `setWebhook` API)
- OpenAI Assistant API access (Beta)

---

## License

MIT – use it freely, improve it boldly.
