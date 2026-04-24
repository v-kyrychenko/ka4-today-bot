import {GetParameterCommand, SSMClient} from '@aws-sdk/client-ssm';
import {
    DEFAULT_OPENAI_API_KEY_PARAMETER_NAME,
    DEFAULT_OPENAI_PROJECT_ID_PARAMETER_NAME,
    DEFAULT_POSTGRES_PASSWORD_PARAMETER_NAME,
    DEFAULT_TELEGRAM_BOT_TOKEN_PARAMETER_NAME,
    DEFAULT_TELEGRAM_SECURITY_TOKEN_PARAMETER_NAME,
} from '../../../app/config/constants.js';
import {getEnvVar} from '../../../app/config/env.js';
import {log} from '../../../shared/logging';

const ssmClient = new SSMClient({});
const secretCache = new Map<string, Promise<string>>();

export const ssmSecretService = {
    getOpenAiApiKey,
    getOpenAiProjectId,
    getPostgresPassword,
    getTelegramBotToken,
    getTelegramSecurityToken,
};

interface SecretDefinition {
    envVarName: string;
    parameterName: string;
}

export async function getPostgresPassword(): Promise<string> {
    return getSecret({
        envVarName: 'POSTGRES_PASSWORD',
        parameterName: DEFAULT_POSTGRES_PASSWORD_PARAMETER_NAME,
    });
}

export async function getTelegramBotToken(): Promise<string> {
    return getSecret({
        envVarName: 'TELEGRAM_BOT_TOKEN',
        parameterName: DEFAULT_TELEGRAM_BOT_TOKEN_PARAMETER_NAME,
    });
}

export async function getTelegramSecurityToken(): Promise<string> {
    return getSecret({
        envVarName: 'TELEGRAM_SECURITY_TOKEN',
        parameterName: DEFAULT_TELEGRAM_SECURITY_TOKEN_PARAMETER_NAME,
    });
}

export async function getOpenAiApiKey(): Promise<string> {
    return getSecret({
        envVarName: 'OPENAI_API_KEY',
        parameterName: DEFAULT_OPENAI_API_KEY_PARAMETER_NAME,
    });
}

export async function getOpenAiProjectId(): Promise<string> {
    return getSecret({
        envVarName: 'OPENAI_PROJECT_ID',
        parameterName: DEFAULT_OPENAI_PROJECT_ID_PARAMETER_NAME,
    });
}

async function getSecret(definition: SecretDefinition): Promise<string> {
    const envValue = getEnvVar(definition.envVarName, false)?.trim();
    if (envValue) {
        log('[secret.ssm] Using secret from environment', {
            envVarName: definition.envVarName,
        });
        return envValue;
    }

    const cachedSecret = secretCache.get(definition.parameterName);
    if (cachedSecret) {
        log('[secret.ssm] Using cached secret', {
            parameterName: definition.parameterName,
        });
        return cachedSecret;
    }

    log('[secret.ssm] Loading secret from SSM', {
        parameterName: definition.parameterName,
    });

    const secretPromise = loadSecretFromSsm(definition.parameterName).catch((error) => {
        secretCache.delete(definition.parameterName);
        throw error;
    });

    secretCache.set(definition.parameterName, secretPromise);
    return secretPromise;
}

async function loadSecretFromSsm(parameterName: string): Promise<string> {
    const response = await ssmClient.send(new GetParameterCommand({
        Name: parameterName,
        WithDecryption: true,
    }));

    const value = response.Parameter?.Value?.trim();
    if (!value) {
        throw new Error(`Missing secret in SSM parameter: ${parameterName}`);
    }

    log('[secret.ssm] Loaded secret from SSM', {
        parameterName,
    });

    return value;
}
