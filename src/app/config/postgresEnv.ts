import {getEnvVar} from './envVar.js';

export const POSTGRES_HOST = getEnvVar('POSTGRES_HOST');
export const POSTGRES_PORT = getEnvVar('POSTGRES_PORT');
export const POSTGRES_DB = getEnvVar('POSTGRES_DB');
export const POSTGRES_USER = getEnvVar('POSTGRES_USER');
export const POSTGRES_PASSWORD = getEnvVar('POSTGRES_PASSWORD', false);
export const POSTGRES_SSL = getEnvVar('POSTGRES_SSL', false);
