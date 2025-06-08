import {pollUntil} from '../utils/poller.js';
import {httpRequest} from "./httpClient.js";
import {OpenAIError} from '../utils/errors.js';
import {DEFAULT_LANG, POLLING} from '../config/constants.js';
import {OPENAI_API_KEY, OPENAI_ASSISTANT_ID, OPENAI_PROJECT_ID} from '../config/env.js';
import {dynamoDbService} from "./dynamoDbService.js";
import openAiFunctionProcessor from "./openAiFunctionProcessor.js";
import {log} from "../utils/logger.js";

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

    run: async (threadId, functions = []) => {
        const body = {
            assistant_id: OPENAI_ASSISTANT_ID,
        };

        if (functions.length > 0) {
            body.tools = functions.map(func => ({
                type: "function",
                function: func
            }));
        }

        const resp = await httpRequest({
            method: 'POST',
            path: `/threads/${threadId}/runs`,
            endpointUrl: OPEN_AI_BASE_URL,
            headers: OPEN_AI_API_HEADERS,
            body: body,
            label: OPEN_AI_API_LABEL,
            errorClass: OpenAIError,
        });
        return resp.id;
    },

    waitForRun: async (threadId, runId) => {
        return pollUntil(
            async () => {
                const runInfo = await openAiService.getRunInfo(threadId, runId);
                log(`🔧 Run status: ${runInfo.status}, requires_action: ${runInfo?.required_action?.type}`);

                if (runInfo.status === 'completed') {
                    return true;
                }

                if (runInfo.status === 'requires_action' &&
                    runInfo.required_action.type === 'submit_tool_outputs') {

                    //TODO
                    const chatId = 7074512472
                    const context = {chatId}
                    await processRequiredAction(context, runInfo);
                }

                return false;
            },
            POLLING.DELAY_MS,
            POLLING.MAX_RETRIES
        );
    },

    getRunInfo: async (threadId, runId) => {
        return await httpRequest({
            method: 'GET',
            path: `/threads/${threadId}/runs/${runId}`,
            endpointUrl: OPEN_AI_BASE_URL,
            headers: OPEN_AI_API_HEADERS,
            body: undefined,
            label: OPEN_AI_API_LABEL,
            errorClass: OpenAIError,
        });
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
     * @param functions - list of openAi functions definitions
     * @returns {Promise<string>} - The extracted assistant reply as plain text.
     * @throws {OpenAIError} If the run did not complete successfully or no reply is found.
     */
    fetchOpenAiReply: async ({lang = DEFAULT_LANG, promptRef, functions = []}) => {
        const prompt = await dynamoDbService.getPrompt(lang, promptRef)

        const threadId = await openAiService.createThread();
        await openAiService.addMessageToThread(threadId, prompt);

        const runId = await openAiService.run(threadId, functions);

        const completed = await openAiService.waitForRun(threadId, runId);
        if (!completed) {
            throw new OpenAIError(`Run ${runId} did not complete successfully`);
        }

        const messages = await openAiService.getMessages(threadId);
        return extractAssistantReply(messages);
    },

    /**
     * Submits the results of function calls back to OpenAI Assistants API.
     *
     * @param {string} threadId - The unique identifier of the thread.
     * @param {string} runId - The unique identifier of the run.
     * @param {Array<{ tool_call_id: string, output: string }>} toolOutputs - An array of tool outputs to submit.
     * @returns {Promise<void>} - Resolves when the submission is successful.
     */
    submitToolOutputs: async (threadId, runId, toolOutputs) => {
        await httpRequest({
            method: 'POST',
            path: `/threads/${threadId}/runs/${runId}/submit_tool_outputs`,
            endpointUrl: OPEN_AI_BASE_URL,
            headers: OPEN_AI_API_HEADERS,
            body: {
                tool_outputs: toolOutputs,
            },
            label: `${OPEN_AI_API_LABEL}:submit_tool_outputs`,
            errorClass: OpenAIError,
        });
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

/**
 * Processes the "requires_action" step of a Run, specifically when the Assistant API
 * requests tool (function) outputs. This function dynamically calls the corresponding
 * processor for each tool call, then submits the results back to the Assistant API.
 * @param {Object} context - command execution context
 * @param {Object} runInfo - The full run information from the Assistant API,
 *                           containing the required tool calls.
 * @returns {Promise<void>} - Resolves when all tool outputs have been processed and submitted.
 */
async function processRequiredAction(context, runInfo) {
    const threadId = runInfo.thread_id;
    const runId = runInfo.id;
    const toolCalls = runInfo.required_action.submit_tool_outputs.tool_calls

    log(`🔧 Requires action for run ${runId} in thread ${threadId}. Number of tool calls: ${toolCalls.length}`);

    const toolOutputs = await Promise.all(
        toolCalls.map(async (toolCall) => {
            const {id: toolCallId, function: func} = toolCall;

            log(`🔧 Processing tool call: ${toolCallId}, function: ${func.name}`);

            const args = JSON.parse(func.arguments || '{}');

            const processorFunction = openAiFunctionProcessor[func.name];
            if (typeof processorFunction !== 'function') {
                throw new OpenAIError(`Function "${func.name}" not found in openAiFunctionProcessor`);
            }

            const mergedArgs = mergeArgsWithContext(args, context);
            const output = await processorFunction(mergedArgs);
            return {
                tool_call_id: toolCallId,
                output: JSON.stringify(output),
            };
        })
    );

    log(`✅ Submitting tool outputs for run ${runId}.`);
    await openAiService.submitToolOutputs(threadId, runId, toolOutputs);
}

/**
 * Merges the given args with values from the context.
 * If a key in args exists in context, it overrides the value.
 *
 * @param {Object} args - The arguments object (parsed from function call).
 * @param {Object} context - The context object with possible override values.
 * @returns {Object} - The merged args object.
 */
function mergeArgsWithContext(args, context) {
    log("🔍 Merging args with context...");
    for (const key in args) {
        if (context.hasOwnProperty(key)) {
            log(`🟢 Overriding ${key}: ${args[key]} → ${context[key]}`);
            args[key] = context[key];
        }
    }
    return args;
}
