import {DEFAULT_LANG} from '../../../app/config/constants.js';
import {openAiClient} from '../../../infrastructure/integrations/openai/openAiClient.js';
import {dynamoDbService} from '../../../infrastructure/persistence/dynamodb/legacy/dynamoDbService.js';
import {BadRequestError, OpenAIError} from '../../../shared/errors';
import type {PromptVariableValue} from '../../../shared/types/app.js';
import {OpenAiResponseDetails} from '../../../shared/types/openai.js';
import type {ProcessorContext} from '../domain/context.js';

export interface FetchOpenAiReplyRequest {
    context: ProcessorContext;
    promptRef: string;
    variables?: Record<string, PromptVariableValue>;
}

export async function fetchOpenAiReply({
    context,
    promptRef,
    variables = {},
}: FetchOpenAiReplyRequest): Promise<string> {
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

    const response = await openAiClient.createResponse(systemPrompt, userPrompt, vectorStoreIds);
    const responseId = response.id;

    const completed = await openAiClient.waitForResponse(responseId);
    if (!completed) {
        throw new OpenAIError(`Run ${responseId} did not complete successfully`);
    }

    const messages = await openAiClient.getResponse(responseId);
    return extractAssistantReply(messages);
}

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
        return output.split(`\${${key}}`).join(stringValue);
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

export const promptReplyService = {
    fetchOpenAiReply,
};

export const openAiService = promptReplyService;
