import {DEFAULT_LANG} from '../../../../app/config/constants.js';
import {openAiClient} from '../../../../infrastructure/integrations/openai/openAiClient.js';
import {BadRequestError, OpenAIError} from '../../../../shared/errors';
import {OpenAiResponseDetails} from '../../../../shared/types/openai.js';
import type {ProcessorContext} from '../../model/context.js';
import {dictPromptRepository} from '../../repository/dictPromptRepository.js';
import {log} from '../../../../shared/logging';

type TemplateVariableValue = unknown;

export interface FetchOpenAiReplyRequest {
    context: ProcessorContext;
    promptRef: string;
    variables?: Record<string, TemplateVariableValue>;
}

export async function fetchOpenAiReply({
                                           context,
                                           promptRef,
                                           variables = {},
                                       }: FetchOpenAiReplyRequest): Promise<string> {
    const lang = normalizeLang(context.user.lang || DEFAULT_LANG);
    const prompt = await dictPromptRepository.getPromptByKey(promptRef);

    const systemPromptDict = prompt.systemPrompt;
    if (!systemPromptDict) {
        throw new BadRequestError(`Prompt '${promptRef}' has no systemPromptRef configuration`);
    }
    const systemPromptTemplate = systemPromptDict.prompts[lang];
    const userPromptTemplate = prompt.prompts[lang];

    if (!systemPromptTemplate) {
        throw new BadRequestError(`Prompt '${systemPromptDict.key}' has no translation for language '${lang}'.`);
    }
    if (!userPromptTemplate) {
        throw new BadRequestError(`Prompt '${prompt.key}' has no translation for language '${lang}'.`);
    }
    log(`Fetched prompt: ${prompt.key}, system prompt: ${systemPromptDict.key}`);

    const systemPrompt = renderPromptTemplate(systemPromptTemplate, variables);
    const userPrompt = renderPromptTemplate(userPromptTemplate, variables);

    const response = await openAiClient.createResponse(systemPrompt, userPrompt, prompt.vectorStoreIds);
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
        (part): part is {
            type: 'output_text';
            text: string
        } => part.type === 'output_text' && typeof part.text === 'string'
    );

    if (!textPart) {
        throw new OpenAIError('Assistant message does not contain valid text content');
    }

    return textPart.text;
}

function renderPromptTemplate(template: string, variables: Record<string, TemplateVariableValue> = {}): string {
    if (!template) return template;

    return Object.entries(variables).reduce((output, [key, value]) => {
        const stringValue = formatValue(value);
        return output.split(`\${${key}}`).join(stringValue);
    }, template);
}

function formatValue(value: TemplateVariableValue): string {
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

//FIXME consider migrate prompts in db to uk instead of ua
function normalizeLang(lang: string | null | undefined): string {
    const normalized = (lang || DEFAULT_LANG).trim().toLowerCase();

    if (normalized === 'uk') {
        return 'ua';
    } else {
        return normalized
    }
}

export const promptReplyService = {
    fetchOpenAiReply,
};

export const openAiService = promptReplyService;
