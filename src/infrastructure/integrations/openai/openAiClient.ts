import {DEFAULT_MODEL, POLLING} from '../../../app/config/constants.js';
import {getOpenAiApiKey, getOpenAiProjectId} from '../secrets/ssmSecretService.js';
import {OpenAIError} from '../../../shared/errors';
import {httpRequest} from '../../../shared/http/httpClient.js';
import {log} from '../../../shared/logging';
import {OpenAiResponseDetails} from '../../../shared/types/openai.js';
import {pollUntil} from '../../../shared/utils/poller.js';

const OPEN_AI_API_LABEL = 'OPEN-AI';
const OPEN_AI_BASE_URL = 'https://api.openai.com/v1';

export const openAiClient = {
    createResponse,
    waitForResponse,
    getResponse,
};

interface OpenAiResponseCreatePayload {
    model: string;
    background: boolean;
    temperature: number;
    input: Array<{ role: 'system' | 'user'; content: string }>;
    tools?: Array<{ type: 'file_search'; vector_store_ids: string[] }>;
}

export async function createResponse(
    systemPrompt: string,
    userPrompt: string,
    vectorStoreIds: string[] = []
): Promise<OpenAiResponseDetails> {
    const body: OpenAiResponseCreatePayload = {
        model: DEFAULT_MODEL,
        background: true,
        temperature: 1.0,
        input: [
            {role: 'system', content: systemPrompt},
            {role: 'user', content: userPrompt},
        ],
    };

    if (vectorStoreIds.length > 0) {
        body.tools = [{type: 'file_search', vector_store_ids: vectorStoreIds}];
    }

    const headers = await buildOpenAiHeaders();
    const response = await httpRequest<OpenAiResponseDetails, OpenAiResponseCreatePayload>({
        method: 'POST',
        path: '/responses',
        endpointUrl: OPEN_AI_BASE_URL,
        headers,
        body,
        label: `${OPEN_AI_API_LABEL}:responses`,
        errorClass: OpenAIError,
    });

    return new OpenAiResponseDetails(response);
}

export async function waitForResponse(responseId: string): Promise<boolean> {
    return pollUntil(async () => {
        const response = await getResponse(responseId);
        log(`Run status: ${response.status}, incomplete_details: ${JSON.stringify(response.incomplete_details)}`);

        if (response.status === 'completed') {
            return true;
        }

        if (response.status === 'requires_action' && response.required_action?.type === 'submit_tool_outputs') {
            throw new OpenAIError('submit_tool_outputs is not implemented');
        }

        return false;
    }, POLLING.DELAY_MS, POLLING.MAX_RETRIES);
}

export async function getResponse(responseId: string): Promise<OpenAiResponseDetails> {
    const headers = await buildOpenAiHeaders();
    const response = await httpRequest<OpenAiResponseDetails>({
        method: 'GET',
        path: `/responses/${responseId}`,
        endpointUrl: OPEN_AI_BASE_URL,
        headers,
        label: OPEN_AI_API_LABEL,
        errorClass: OpenAIError,
    });

    return new OpenAiResponseDetails(response);
}

async function buildOpenAiHeaders(): Promise<Record<string, string>> {
    const [apiKey, projectId] = await Promise.all([
        getOpenAiApiKey(),
        getOpenAiProjectId(),
    ]);

    return {
        Authorization: `Bearer ${apiKey}`,
        'OpenAI-Project': projectId,
        'Content-Type': 'application/json',
    };
}
