import dotenv from 'dotenv';

dotenv.config();

function getEnvVar(name, required = true) {
    const value = process.env[name];
    if (!value && required) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value || undefined;
}

export const TELEGRAM_BOT_TOKEN = getEnvVar('TELEGRAM_BOT_TOKEN');
export const TELEGRAM_SECURITY_TOKEN = getEnvVar('TELEGRAM_SECURITY_TOKEN');
export const OPENAI_API_KEY = getEnvVar('OPENAI_API_KEY');
export const OPENAI_PROJECT_ID = getEnvVar('OPENAI_PROJECT_ID');
export const OPENAI_ASSISTANT_ID = getEnvVar('OPENAI_ASSISTANT_ID');
export const OPENAI_DEFAULT_PROMPT = getEnvVar('OPENAI_DEFAULT_PROMPT');
export const DYNAMODB_ENDPOINT = getEnvVar('DYNAMODB_ENDPOINT', false);

