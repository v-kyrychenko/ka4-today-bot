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

const shouldUseSsl = POSTGRES_SSL === 'true';

function createPool(): Pool {
    if (!POSTGRES_HOST || !POSTGRES_PORT || !POSTGRES_DB || !POSTGRES_USER || !POSTGRES_PASSWORD) {
        throw new Error('PostgreSQL configuration is incomplete');
    }

    return new Pool({
        host: POSTGRES_HOST,
        port: Number(POSTGRES_PORT),
        database: POSTGRES_DB,
        user: POSTGRES_USER,
        password: POSTGRES_PASSWORD,
        ssl: shouldUseSsl ? {rejectUnauthorized: false} : false,
        max: 5,
    });
}

let postgresDb: NodePgDatabase | null = null;

export function getPostgresDb(): NodePgDatabase {
    if (!postgresDb) {
        postgresDb = drizzle(createPool());
    }

    return postgresDb;
}
