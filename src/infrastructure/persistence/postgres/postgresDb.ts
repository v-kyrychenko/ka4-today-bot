import {type NodePgDatabase, drizzle} from 'drizzle-orm/node-postgres';
import {Pool} from 'pg';
import {
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_SSL,
    POSTGRES_USER,
} from '../../../app/config/env.js';
import {POSTGRES_TIMEOUT_MS} from '../../../app/config/constants.js';
import {log, logError} from '../../../shared/logging';

const shouldUseSsl = POSTGRES_SSL === 'true';

async function createPool(): Promise<Pool> {
    if (!POSTGRES_HOST || !POSTGRES_PORT || !POSTGRES_DB || !POSTGRES_USER) {
        throw new Error('PostgreSQL configuration is incomplete');
    }

    log('[postgres.init] Creating PostgreSQL pool', {
        host: POSTGRES_HOST,
        port: POSTGRES_PORT,
        database: POSTGRES_DB,
        user: POSTGRES_USER,
        ssl: shouldUseSsl,
    });

    return new Pool({
        host: POSTGRES_HOST,
        port: Number(POSTGRES_PORT),
        database: POSTGRES_DB,
        user: POSTGRES_USER,
        password: POSTGRES_PASSWORD,
        ssl: shouldUseSsl ? {rejectUnauthorized: false} : false,
        max: 5,
        connectionTimeoutMillis: POSTGRES_TIMEOUT_MS,
        query_timeout: POSTGRES_TIMEOUT_MS,
        statement_timeout: POSTGRES_TIMEOUT_MS,
    });
}

let postgresDb: NodePgDatabase | null = null;
let postgresDbInitPromise: Promise<void> | null = null;

export async function initializePostgresDb(): Promise<void> {
    if (postgresDb) {
        log('[postgres.init] PostgreSQL already initialized');
        return;
    }

    if (postgresDbInitPromise) {
        log('[postgres.init] Waiting for in-flight PostgreSQL initialization');
        await postgresDbInitPromise;
        return;
    }

    log('[postgres.init] Starting PostgreSQL initialization');
    postgresDbInitPromise = createPool()
        .then((pool) => {
            postgresDb = drizzle(pool);
            log('[postgres.init] PostgreSQL initialization completed');
        })
        .catch((error) => {
            postgresDbInitPromise = null;
            logError('[postgres.init] PostgreSQL initialization failed', error);
            throw error;
        });

    await postgresDbInitPromise;
}

export function getPostgresDb(): NodePgDatabase {
    if (!postgresDb) {
        throw new Error('PostgreSQL has not been initialized');
    }

    return postgresDb;
}
