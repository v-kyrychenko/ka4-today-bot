type PostgresError = Error & {
    code?: string;
};

export const POSTGRES_UNIQUE_VIOLATION = '23505';

export function isPostgresUniqueViolation(error: unknown): error is PostgresError {
    return error instanceof Error
        && 'code' in error
        && error.code === POSTGRES_UNIQUE_VIOLATION;
}
