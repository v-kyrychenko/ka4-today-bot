import {pollUntil} from '../utils/poller.js';
import {httpRequest} from "./httpClient.js";
import {OpenAIError} from '../utils/errors.js';
import {DEFAULT_LANG, POLLING} from '../config/constants.js';
import {OPENAI_API_KEY, OPENAI_ASSISTANT_ID, OPENAI_PROJECT_ID} from '../config/env.js';
import {dynamoDbService} from "./dynamoDbService.js";

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

    /**
     * Runs the OpenAI Assistant on a new thread and extracts the final assistant reply.
     *
     * @param lang - language that should be used for prompt
     * @param promptRef - reference to prompt that will be used for assistant
     * @returns {Promise<string>} - The extracted assistant reply as plain text.
     * @throws {OpenAIError} If the run did not complete successfully or no reply is found.
     */
    fetchOpenAiReply: async ({lang = DEFAULT_LANG, promptRef}) => {
        const prompt = await dynamoDbService.getPrompt(lang, promptRef)

        const threadId = await openAiService.createThread();
        await openAiService.addMessageToThread(threadId, prompt);

        const runId = await openAiService.run(OPENAI_ASSISTANT_ID, threadId);

        const completed = await openAiService.waitForRun(threadId, runId);
        if (!completed) {
            throw new OpenAIError(`Run ${runId} did not complete successfully`);
        }

        const messages = await openAiService.getMessages(threadId);
        return extractAssistantReply(messages);
    },
}

/**
 * @param {{ data: Array<{ role: string, created_at: number, content: any[] }> }} messages
 */
function extractAssistantReply(messages) {
    if (!Array.isArray(messages?.data)) {
        throw new OpenAIError('Invalid messages format: expected data[] array');
    }

    const assistantMessages = messages.data
        .filter(m => m.role === 'assistant')
        .sort((a, b) => b.created_at - a.created_at);

    if (!assistantMessages.length) {
        throw new OpenAIError('No assistant messages found in thread');
    }

    const last = assistantMessages[0];

    const textPart = last.content.find(part => part.type === 'text');

    if (!textPart || !textPart.text?.value) {
        throw new OpenAIError('Assistant message does not contain valid text content');
    }

    return postProcessText(textPart.text);
}

/**
 * Delete all text annotations (example: 4:10†source) from assistant response.
 * @param {{ value: string, annotations?: Array<{ text: string }> }} text
 * @returns {string}
 */
function postProcessText({value, annotations = []}) {
    let result = value;

    for (const annotation of annotations) {
        if (!annotation.text) continue;
        result = result.replaceAll(annotation.text, '');
    }

    return result.trim();
}
