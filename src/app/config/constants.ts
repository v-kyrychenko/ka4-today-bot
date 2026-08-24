export const PAGINATION_DEFAULT_PAGE = 0;
export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;
export const POLLING = {
    MAX_RETRIES: 30,
    DELAY_MS: 1000,
} as const;

export const DEFAULT_LANG = 'ua';
export const EMPTY_VIEW_VALUE = '--';

/**
 * Fixed app-wide local-time offset (Europe/Kyiv, UTC+3) used wherever a "client's local day"
 * needs computing (e.g. workout-logging's session_day, AC-13) -- no per-client timezone is
 * stored anywhere in this repo, and Telegram's webhook payload doesn't carry one either. Not
 * DST-aware; revisit with a real per-client value if that precision is ever needed.
 */
export const APP_TIMEZONE_OFFSET_MINUTES = 180;

export const POSTGRES_TIMEOUT_MS = 5000;
export const TELEGRAM_MINI_APP_INIT_DATA_MAX_LENGTH = 4096;

export const TG_ERROR_POSTGRES_UNAVAILABLE = '🌐 💥 🔁 ⏳';
export const TG_ERROR_DEFAULT = '🧠 💥 🪄 🐞';
