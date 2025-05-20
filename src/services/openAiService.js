import {pollUntil} from '../utils/poller.js';
import {httpRequest} from "./httpClient.js";
import {OpenAIError} from '../utils/errors.js';
import {POLLING} from '../config/constants.js';
import {OPENAI_API_KEY, OPENAI_PROJECT_ID} from '../config/env.js';

const OPEN_AI_API_LABEL = 'OPEN-AI';
const OPEN_AI_BASE_URL = 'https://api.openai.com/v1';
const OPEN_AI_API_HEADERS = {
    Authorization: `Bearer ${OPENAI_API_KEY}`,
    'OpenAI-Project': `${OPENAI_PROJECT_ID}`,
    'OpenAI-Beta': 'assistants=v2',
    'Content-Type': 'application/json',
};

export const openAiService = {
    createThread: async () => {
        const resp = await httpRequest({
            method: 'POST',
            path: '/threads',
            endpointUrl: OPEN_AI_BASE_URL,
            headers: OPEN_AI_API_HEADERS,
            body: {},
            label: OPEN_AI_API_LABEL,
            errorClass: OpenAIError,
        });
        return resp.id;
    },

    addMessageToThread: async (threadId, message) => {
        const resp = await httpRequest({
            method: 'POST',
            path: `/threads/${threadId}/messages`,
            endpointUrl: OPEN_AI_BASE_URL,
            headers: OPEN_AI_API_HEADERS,
            body: {
                "role": "user",
                "content": message,
            },
            label: OPEN_AI_API_LABEL,
            errorClass: OpenAIError,
        });
        return resp.id;
    },

    run: async (assistantId, threadId) => {
        const resp = await httpRequest({
            method: 'POST',
            path: `/threads/${threadId}/runs`,
            endpointUrl: OPEN_AI_BASE_URL,
            headers: OPEN_AI_API_HEADERS,
            body: {
                "assistant_id": assistantId,
            },
            label: OPEN_AI_API_LABEL,
            errorClass: OpenAIError,
        });
        return resp.id;
    },

    waitForRun: async (threadId, runId) => {
        return pollUntil(
            async () => {
                const status = await openAiService.getRunInfo(threadId, runId);
                return status === 'completed';
            },
            POLLING.DELAY_MS,
            POLLING.MAX_RETRIES
        );
    },

    getRunInfo: async (threadId, runId) => {
        const resp = await httpRequest({
            method: 'GET',
            path: `/threads/${threadId}/runs/${runId}`,
            endpointUrl: OPEN_AI_BASE_URL,
            headers: OPEN_AI_API_HEADERS,
            body: undefined,
            label: OPEN_AI_API_LABEL,
            errorClass: OpenAIError,
        });
        return resp.status;
    },

    getMessages: async (threadId) => {
        return await httpRequest({
            method: 'GET',
            path: `/threads/${threadId}/messages`,
            endpointUrl: OPEN_AI_BASE_URL,
            headers: OPEN_AI_API_HEADERS,
            body: undefined,
            label: OPEN_AI_API_LABEL,
            errorClass: OpenAIError,
        });
    },
}
