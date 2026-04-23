import {type NodePgDatabase, drizzle} from 'drizzle-orm/node-postgres';
import {Pool} from 'pg';
import {
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PORT,
    POSTGRES_SSL,
    POSTGRES_USER,
} from '../../../app/config/env.js';
import {getPostgresPassword} from './postgresPassword.js';

const shouldUseSsl = POSTGRES_SSL === 'true';

async function createPool(): Promise<Pool> {
    if (!POSTGRES_HOST || !POSTGRES_PORT || !POSTGRES_DB || !POSTGRES_USER) {
        throw new Error('PostgreSQL configuration is incomplete');
    }

    const password = await getPostgresPassword();

    return new Pool({
        host: POSTGRES_HOST,
        port: Number(POSTGRES_PORT),
        database: POSTGRES_DB,
        user: POSTGRES_USER,
        password,
        ssl: shouldUseSsl ? {rejectUnauthorized: false} : false,
        max: 5,
    });
}

let postgresDb: NodePgDatabase | null = null;
let postgresDbInitPromise: Promise<void> | null = null;

export async function initializePostgresDb(): Promise<void> {
    if (postgresDb) {
        return;
    }

    if (postgresDbInitPromise) {
        await postgresDbInitPromise;
        return;
    }

    postgresDbInitPromise = createPool()
        .then((pool) => {
            postgresDb = drizzle(pool);
        })
        .catch((error) => {
            postgresDbInitPromise = null;
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
