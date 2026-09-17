import {getEnvVar} from './envVar.js';

export {getEnvVar} from './envVar.js';

export const TELEGRAM_BOT_TOKEN = getEnvVar('TELEGRAM_BOT_TOKEN');
export const TELEGRAM_SECURITY_TOKEN = getEnvVar('TELEGRAM_SECURITY_TOKEN');
export const OPENAI_API_KEY = getEnvVar('OPENAI_API_KEY');
export const OPENAI_PROJECT_ID = getEnvVar('OPENAI_PROJECT_ID');
export const MAIN_MESSAGE_QUEUE_URL = getEnvVar('MAIN_MESSAGE_QUEUE_URL');
export const AWS_REGION = getEnvVar('AWS_REGION', false);
export const BEDROCK_AGENTCORE_GATEWAY_ARN = getEnvVar('BEDROCK_AGENTCORE_GATEWAY_ARN', false);
