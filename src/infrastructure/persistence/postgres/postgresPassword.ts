import {GetParameterCommand, SSMClient} from '@aws-sdk/client-ssm';
import {DEFAULT_POSTGRES_PASSWORD_PARAMETER_NAME} from '../../../app/config/constants.js';
import {POSTGRES_PASSWORD} from '../../../app/config/env.js';

const ssmClient = new SSMClient({});

let postgresPasswordPromise: Promise<string> | null = null;

export async function getPostgresPassword(): Promise<string> {
    const localPassword = POSTGRES_PASSWORD?.trim();
    if (localPassword) {
        return localPassword;
    }

    if (!postgresPasswordPromise) {
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

    return password;
}
