const isLocal = true; // TODO return later process.env.IS_OFFLINE === 'true' || process.env.STAGE === 'dev';

export function log(...args: unknown[]): void {
    if (isLocal) console.log(formatLogLine(args));
}

export function logError(...args: unknown[]): void {
    if (isLocal) console.error(formatLogLine(args));
}

function formatLogLine(args: unknown[]): string {
    return args.map(formatLogArg).join(' ');
}

function formatLogArg(arg: unknown): string {
    if (typeof arg === 'string') {
        return arg;
    }

    return JSON.stringify(normalizeLogValue(arg));
}

function normalizeLogValue(value: unknown): unknown {
    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
            stack: value.stack,
        };
    }

    if (Array.isArray(value)) {
        return value.map(normalizeLogValue);
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, entryValue]) => [key, normalizeLogValue(entryValue)])
        );
    }

    return value;
}
