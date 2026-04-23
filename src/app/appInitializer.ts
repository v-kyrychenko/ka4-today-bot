import {initializePostgresDb} from '../infrastructure/persistence/postgres/postgresDb.js';
import {log, logError} from '../shared/logging/index.js';

let appInitializationPromise: Promise<void> | null = null;

export async function initializeApp(): Promise<void> {
    if (appInitializationPromise) {
        log('[app.init] Reusing in-flight app initialization');
        await appInitializationPromise;
        return;
    }

    log('[app.init] Starting app initialization');
    appInitializationPromise = Promise.all([
        initializePostgresDb(),
    ])
        .then(() => {
            log('[app.init] App initialization completed');
        })
        .catch((error) => {
            appInitializationPromise = null;
            logError('[app.init] App initialization failed', error);
            throw error;
        });

    await appInitializationPromise;
}
