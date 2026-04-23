export const PAGINATION_DEFAULT_PAGE = 0;
export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;

export const DEFAULT_LANG = 'ua';
export const DEFAULT_MODEL = 'gpt-4o-mini';
export const DEFAULT_POSTGRES_PASSWORD_PARAMETER_NAME = '/ka4today/postgres/app-password';

export const POLLING = {
    MAX_RETRIES: 50,
    DELAY_MS: 2000,
} as const;
