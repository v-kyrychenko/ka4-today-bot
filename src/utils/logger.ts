const isLocal = true; // TODO return later process.env.IS_OFFLINE === 'true' || process.env.STAGE === 'dev';

export function log(...args: unknown[]): void {
    if (isLocal) console.log(...args);
}

export function logError(...args: unknown[]): void {
    if (isLocal) console.error(...args);
}
