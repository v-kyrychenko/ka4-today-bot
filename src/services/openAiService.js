import {pollUntil} from '../utils/poller.js';
import {httpRequest} from "./httpClient.js";
import {BadRequestError, OpenAIError} from '../utils/errors.js';
import {DEFAULT_LANG, DEFAULT_MODEL, POLLING} from '../config/constants.js';
import {OPENAI_API_KEY, OPENAI_PROJECT_ID} from '../config/env.js';
import {dynamoDbService} from "./dynamoDbService.js";
import {log} from "../utils/logger.js";

const OPEN_AI_API_LABEL = 'OPEN-AI';
const OPEN_AI_BASE_URL = 'https://api.openai.com/v1';
const OPEN_AI_API_HEADERS = {
    Authorization: `Bearer ${OPENAI_API_KEY}`,
    'OpenAI-Project': `${OPENAI_PROJECT_ID}`,
    'Content-Type': 'application/json',
};

export const openAiService = {

    /**
     * Creates a response using the new OpenAI Responses API (async version).
     *
     * @param {Object} context - main execution context (expects context.user.language_code)
     * @param {string} promptRef - reference to prompt that will be used for assistant (user prompt key in DB)
     * @param {Object} variables - parameters for prompt customization
     * @returns {Promise<Object>} - response stub { id, status: "in_progress", ... } (async mode)
     */
    fetchOpenAiReply: async ({
                                 context,
                                 promptRef,
                                 variables = {}
                             }) => {
        const lang = context.user.language_code || DEFAULT_LANG
        const promptConfig = await dynamoDbService.getPrompt(lang, promptRef);
        const systemPromptRef = promptConfig.systemPromptRef;
        const vectorStoreIds = promptConfig.vectorStoreIds;
        if (!systemPromptRef) {
            throw new BadRequestError(`Prompt '${promptRef}' has no systemPromptRef configuration`);
        }
        const systemPromptConfig = await dynamoDbService.getPrompt(lang, systemPromptRef);

        const systemPrompt = renderPromptTemplate(systemPromptConfig.prompts[lang], variables);
        const userPrompt = renderPromptTemplate(promptConfig.prompts[lang], variables);

        const response = await openAiService.createResponse(systemPrompt, userPrompt, vectorStoreIds);
        const responseId = response.id;

        const completed = await openAiService.waitForResponse(responseId, context);
        if (!completed) {
            throw new OpenAIError(`Run ${responseId} did not complete successfully`);
        }
        const messages = await openAiService.getResponse(responseId);
        return extractAssistantReply(messages);
    },

    createResponse: async (systemPrompt, userPrompt, vectorStoreIds = []) => {
        const background = true
        const body = {
            model: DEFAULT_MODEL,
            background,
            input: [
                {role: "system", content: systemPrompt},
                {role: "user", content: userPrompt},
            ],
        };

        if (vectorStoreIds.length > 0) {
            body.tools = [{type: "file_search", vector_store_ids: vectorStoreIds}];
        }

        return await httpRequest({
            method: "POST",
            path: "/responses",
            endpointUrl: OPEN_AI_BASE_URL,
            headers: {
                ...OPEN_AI_API_HEADERS
            },
            body,
            label: `${OPEN_AI_API_LABEL}:responses`,
            errorClass: OpenAIError,
        });
    },

    /**
     * Polls the status of a response until it is completed or a maximum number of retries is reached.
     * If the run requires a tool output action (requires_action: submit_tool_outputs),
     * it calls the `processRequiredAction` handler with the provided context.
     *
     * @param {string} responseId - The unique identifier of the reseponse.
     * @param {Object} context - A context object containing data for dynamic argument overrides
     *                           and other runtime information.
     * @returns {Promise<boolean>} - Resolves to `true` if the run is completed successfully,
     *                               otherwise `false` if the maximum polling attempts are reached.
     */
    waitForResponse: async (responseId, context) => {
        return pollUntil(
            async () => {
                const response = await openAiService.getResponse(responseId);
                log(`🔧 Run status: ${response.status}, requires_action: ${response?.required_action?.type}`);

                if (response.status === 'completed') {
                    return true;
                }

                if (response.status === 'requires_action' &&
                    response.required_action.type === 'submit_tool_outputs') {
                    throw new OpenAIError("Not implemented yeat");
                }

                return false;
            },
            POLLING.DELAY_MS,
            POLLING.MAX_RETRIES
        );
    },

    getResponse: async (responseId) => {
        return await httpRequest({
            method: 'GET',
            path: `/responses/${responseId}`,
            endpointUrl: OPEN_AI_BASE_URL,
            headers: OPEN_AI_API_HEADERS,
            body: undefined,
            label: OPEN_AI_API_LABEL,
            errorClass: OpenAIError,
        });
    },
}

function extractAssistantReply(messages) {
    if (!Array.isArray(messages?.output)) {
        throw new OpenAIError('Invalid messages format: expected data[] array');
    }

    const assistantMessages = messages.output
        .filter(m => m.role === 'assistant')
        .sort((a, b) => b.created_at - a.created_at);

    if (!assistantMessages.length) {
        throw new OpenAIError('No assistant messages found in thread');
    }

    const last = assistantMessages[0];

    const textPart = last.content.find(part => part.type === 'output_text');

    if (!textPart || !textPart.text) {
        throw new OpenAIError('Assistant message does not contain valid text content');
    }

    return textPart.text;
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

/**
 * Render a template string by replacing placeholders ${key} with values from variables.
 * - Arrays: joined by ", "
 * - Plain objects: flattened into "k1: v1, k2: v2"
 * - Nested objects inside: JSON.stringify
 * - null/undefined: empty string
 * If variables is empty → template is returned unchanged.
 *
 * @param {string} template - Raw template containing placeholders.
 * @param {Object} variables - Key-value pairs to substitute.
 * @returns {string} - Rendered template.
 */
function renderPromptTemplate(template, variables = {}) {
    if (!template || typeof template !== "string") return template;
    if (!variables || typeof variables !== "object") return template;

    return Object.entries(variables).reduce((out, [key, val]) => {
        const str = formatValue(val);
        return out.replaceAll(`\${${key}}`, str);
    }, template);
}

function formatValue(v) {
    if (v == null) return "";
    if (Array.isArray(v)) return v.map(x => String(x ?? "")).join(", ");
    if (isPlainObject(v)) {
        return Object.entries(v)
            .map(([k, val]) => `${k}: ${formatNested(val)}`)
            .join(", ");
    }
    return String(v);
}

function formatNested(v) {
    if (v == null) return "";
    if (Array.isArray(v)) return v.map(x => String(x ?? "")).join(", ");
    if (isPlainObject(v)) return JSON.stringify(v);
    return String(v);
}

function isPlainObject(o) {
    return typeof o === "object" && o !== null && !Array.isArray(o);
}
