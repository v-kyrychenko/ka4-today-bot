export const PAGINATION_DEFAULT_PAGE = 0;
export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;

export const DEFAULT_LANG = 'ua';
export const DEFAULT_MODEL = 'gpt-4o-mini';

export const DEFAULT_POSTGRES_PASSWORD_PARAMETER_NAME = '/ka4today/postgres/app-password';
export const POSTGRES_TIMEOUT_MS = 5000;
export const DEFAULT_TELEGRAM_BOT_TOKEN_PARAMETER_NAME = '/ka4today/telegram/bot-token';
export const DEFAULT_TELEGRAM_SECURITY_TOKEN_PARAMETER_NAME = '/ka4today/telegram/security-token';
export const DEFAULT_OPENAI_API_KEY_PARAMETER_NAME = '/ka4today/openai/api-key';
export const DEFAULT_OPENAI_PROJECT_ID_PARAMETER_NAME = '/ka4today/openai/project-id';

export const POLLING = {
    MAX_RETRIES: 50,
    DELAY_MS: 2000,
} as const;
