import {AWS_REGION} from '../../../app/config/env.js';

export const BEDROCK_RESPONSES_API_LABEL = 'BEDROCK:responses';
export const BEDROCK_RESPONSES_ENDPOINT = new URL(`https://bedrock-mantle.${AWS_REGION}.api.aws/v1/responses`);
export const BEDROCK_DEFAULT_MODEL_ID = 'openai.gpt-oss-120b';
export const BEDROCK_RESPONSES_TIMEOUT_MS = 100_000;
