declare const process: {
    env: Record<string, string | undefined>;
};

export function getEnvVar(name: string, required = true): string | undefined {
    const value = process.env[name];
    if (!value && required) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value ?? undefined;
}
