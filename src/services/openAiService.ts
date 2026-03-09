import {pollUntil} from '../utils/poller.js';
import {httpRequest} from './httpClient.js';
import {BadRequestError, OpenAIError} from '../utils/errors.js';
import {DEFAULT_LANG, DEFAULT_MODEL, POLLING} from '../config/constants.js';
import {OPENAI_API_KEY, OPENAI_PROJECT_ID} from '../config/env.js';
import {dynamoDbService} from './dynamoDbService.js';
import {log} from '../utils/logger.js';
import type {PromptVariableValue} from '../models/app.js';
import {OpenAiResponseDetails, type FetchOpenAiReplyRequest} from '../models/openai.js';

const OPEN_AI_API_LABEL = 'OPEN-AI';
const OPEN_AI_BASE_URL = 'https://api.openai.com/v1';
const OPEN_AI_API_HEADERS: Record<string, string> = {
    Authorization: `Bearer ${OPENAI_API_KEY}`,
    'OpenAI-Project': `${OPENAI_PROJECT_ID}`,
    'Content-Type': 'application/json',
};

interface OpenAiResponseCreatePayload {
    model: string;
    background: boolean;
    input: Array<{role: 'system' | 'user'; content: string}>;
    tools?: Array<{type: 'file_search'; vector_store_ids: string[]}>;
}

export const openAiService = {
    fetchOpenAiReply: async ({context, promptRef, variables = {}}: FetchOpenAiReplyRequest): Promise<string> => {
        const lang = context.user.language_code || DEFAULT_LANG;
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

        const completed = await openAiService.waitForResponse(responseId);
        if (!completed) {
            throw new OpenAIError(`Run ${responseId} did not complete successfully`);
        }
        const messages = await openAiService.getResponse(responseId);
        return extractAssistantReply(messages);
    },

    createResponse: async (
        systemPrompt: string,
        userPrompt: string,
        vectorStoreIds: string[] = []
    ): Promise<OpenAiResponseDetails> => {
        const body: OpenAiResponseCreatePayload = {
            model: DEFAULT_MODEL,
            background: true,
            input: [
                {role: 'system', content: systemPrompt},
                {role: 'user', content: userPrompt},
            ],
        };

        if (vectorStoreIds.length > 0) {
            body.tools = [{type: 'file_search', vector_store_ids: vectorStoreIds}];
        }

        const response = await httpRequest<OpenAiResponseDetails, OpenAiResponseCreatePayload>({
            method: 'POST',
            path: '/responses',
            endpointUrl: OPEN_AI_BASE_URL,
            headers: OPEN_AI_API_HEADERS,
            body,
            label: `${OPEN_AI_API_LABEL}:responses`,
            errorClass: OpenAIError,
        });

        return new OpenAiResponseDetails(response);
    },

    waitForResponse: async (responseId: string): Promise<boolean> =>
        pollUntil(async () => {
            const response = await openAiService.getResponse(responseId);
            log(`Run status: ${response.status}, requires_action: ${response.required_action?.type}`);

            if (response.status === 'completed') {
                return true;
            }

            if (response.status === 'requires_action' && response.required_action?.type === 'submit_tool_outputs') {
                throw new OpenAIError('submit_tool_outputs is not implemented');
            }

            return false;
        }, POLLING.DELAY_MS, POLLING.MAX_RETRIES),

    getResponse: async (responseId: string): Promise<OpenAiResponseDetails> => {
        const response = await httpRequest<OpenAiResponseDetails>({
            method: 'GET',
            path: `/responses/${responseId}`,
            endpointUrl: OPEN_AI_BASE_URL,
            headers: OPEN_AI_API_HEADERS,
            label: OPEN_AI_API_LABEL,
            errorClass: OpenAIError,
        });

        return new OpenAiResponseDetails(response);
    },
};

function extractAssistantReply(messages: OpenAiResponseDetails): string {
    if (!Array.isArray(messages.output)) {
        throw new OpenAIError('Invalid messages format: expected output[] array');
    }

    const assistantMessages = messages.output
        .filter((message) => message.role === 'assistant')
        .sort((left, right) => right.created_at - left.created_at);

    if (!assistantMessages.length) {
        throw new OpenAIError('No assistant messages found in thread');
    }

    const last = assistantMessages[0];
    const textPart = last.content.find(
        (part): part is {type: 'output_text'; text: string} => part.type === 'output_text' && typeof part.text === 'string'
    );

    if (!textPart) {
        throw new OpenAIError('Assistant message does not contain valid text content');
    }

    return textPart.text;
}

function renderPromptTemplate(
    template: string,
    variables: Record<string, PromptVariableValue> = {}
): string {
    if (!template || typeof template !== 'string') return template;

    return Object.entries(variables).reduce((output, [key, value]) => {
        const stringValue = formatValue(value);
        return output.replaceAll(`\${${key}}`, stringValue);
    }, template);
}

function formatValue(value: PromptVariableValue): string {
    if (value == null) return '';
    if (Array.isArray(value)) return value.map((item) => String(item ?? '')).join(', ');
    if (isPlainObject(value)) {
        return Object.entries(value)
            .map(([key, nested]) => `${key}: ${formatNested(nested)}`)
            .join(', ');
    }
    return String(value);
}

function formatNested(value: unknown): string {
    if (value == null) return '';
    if (Array.isArray(value)) return value.map((item) => String(item ?? '')).join(', ');
    if (isPlainObject(value)) return JSON.stringify(value);
    return String(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
