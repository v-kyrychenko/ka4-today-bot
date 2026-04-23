import {GetParameterCommand, SSMClient} from '@aws-sdk/client-ssm';
import {DEFAULT_POSTGRES_PASSWORD_PARAMETER_NAME} from '../../../app/config/constants.js';
import {POSTGRES_PASSWORD} from '../../../app/config/env.js';
import {log} from '../../../shared/logging/index.js';

const ssmClient = new SSMClient({});

let postgresPasswordPromise: Promise<string> | null = null;

export async function getPostgresPassword(): Promise<string> {
    const localPassword = POSTGRES_PASSWORD?.trim();
    if (localPassword) {
        log('[postgres.password] Using password from environment');
        return localPassword;
    }

    if (!postgresPasswordPromise) {
        log('[postgres.password] Loading password from SSM', {
            parameterName: DEFAULT_POSTGRES_PASSWORD_PARAMETER_NAME,
        });
        postgresPasswordPromise = loadPostgresPasswordFromSsm();
    }

    return postgresPasswordPromise;
}

async function loadPostgresPasswordFromSsm(): Promise<string> {
    const response = await ssmClient.send(new GetParameterCommand({
        Name: DEFAULT_POSTGRES_PASSWORD_PARAMETER_NAME,
        WithDecryption: true,
    }));

    const password = response.Parameter?.Value;
    if (!password) {
        throw new Error(`Missing PostgreSQL password in SSM parameter: ${DEFAULT_POSTGRES_PASSWORD_PARAMETER_NAME}`);
    }

    log('[postgres.password] Loaded password from SSM');
    return password;
}
