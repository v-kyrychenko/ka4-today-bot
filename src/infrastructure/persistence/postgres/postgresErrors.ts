type PostgresError = Error & {
    code?: string;
    cause?: unknown;
};

export const POSTGRES_UNIQUE_VIOLATION = '23505';
const POSTGRES_UNAVAILABLE_CODES = new Set([
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ENETUNREACH',
    'EHOSTUNREACH',
]);

export function isPostgresUniqueViolation(error: unknown): error is PostgresError {
    return error instanceof Error
        && 'code' in error
        && error.code === POSTGRES_UNIQUE_VIOLATION;
}

export function isPostgresUnavailableError(error: unknown): error is PostgresError {
    if (isDirectPostgresUnavailableError(error)) {
        return true;
    }

    if (!error || typeof error !== 'object' || !('cause' in error)) {
        return false;
    }

    return isDirectPostgresUnavailableError(error.cause);
}

export function isPostgresError(error: unknown): error is PostgresError {
    return isPostgresUnavailableError(error)
        || isPostgresUniqueViolation(error)
        || isDrizzleQueryError(error);
}

function isDirectPostgresUnavailableError(error: unknown): error is PostgresError {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
    if (POSTGRES_UNAVAILABLE_CODES.has(code)) {
        return true;
    }

    const message = error instanceof Error ? error.message : '';
    return message.includes('connect ETIMEDOUT')
        || message.includes('connect ECONNREFUSED')
        || message.includes('Connection terminated unexpectedly');
}

function isDrizzleQueryError(error: unknown): error is PostgresError {
    if (!(error instanceof Error)) {
        return false;
    }

    return error.message.startsWith('Failed query:');
}
