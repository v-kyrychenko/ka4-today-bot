declare const process: {
    env: Record<string, string | undefined>;
};

function getEnvVar(name: string, required = true): string | undefined {
    const value = process.env[name];
    if (!value && required) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value ?? undefined;
}

export {getEnvVar};

export const MAIN_MESSAGE_QUEUE_URL = getEnvVar('MAIN_MESSAGE_QUEUE_URL');
export const POSTGRES_HOST = getEnvVar('POSTGRES_HOST');
export const POSTGRES_PORT = getEnvVar('POSTGRES_PORT');
export const POSTGRES_DB = getEnvVar('POSTGRES_DB');
export const POSTGRES_USER = getEnvVar('POSTGRES_USER');
export const POSTGRES_SSL = getEnvVar('POSTGRES_SSL', false);
