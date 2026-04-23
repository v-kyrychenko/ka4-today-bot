import {initializePostgresDb} from '../infrastructure/persistence/postgres/postgresDb.js';

let appInitializationPromise: Promise<void> | null = null;

export async function initializeApp(): Promise<void> {
    if (appInitializationPromise) {
        await appInitializationPromise;
        return;
    }

    appInitializationPromise = Promise.all([
        initializePostgresDb(),
    ])
        .then(() => undefined)
        .catch((error) => {
            appInitializationPromise = null;
            throw error;
        });

    await appInitializationPromise;
}
