import {DEFAULT_LANG} from '../../../../app/config/constants.js';
import {openAiClient} from '../../../../infrastructure/integrations/openai/openAiClient.js';
import {BadRequestError, OpenAIError} from '../../../../shared/errors';
import {OpenAiCreateResponseInput, OpenAiResponseDetails} from '../../../../shared/types/openai.js';
import {dictPromptRepository} from '../../repository/dictPromptRepository.js';
import {log} from '../../../../shared/logging';
import type {PromptDict} from './prompt.js';

type TemplateVariableValue = unknown;

export interface FetchOpenAiReplyRequest {
    lang?: string | null;
    promptRef: string;
    variables?: Record<string, TemplateVariableValue>;
}

interface PromptTemplates {
    systemPrompt: string;
    userPrompt: string;
}

export async function fetchOpenAiReply(request: FetchOpenAiReplyRequest): Promise<string> {
    const promptLang = normalizeLang(request.lang ?? DEFAULT_LANG);
    const prompt = await dictPromptRepository.getPromptByKey(request.promptRef);
    const templates = resolvePromptTemplates(prompt, promptLang);

    log(`Fetched prompt: ${prompt.key}, system prompt: ${prompt.systemPrompt?.key}`);

    const systemPrompt = renderPromptTemplate(templates.systemPrompt, request.variables);
    const userPrompt = renderPromptTemplate(templates.userPrompt, request.variables);

    return runOpenAiReply(systemPrompt, userPrompt, prompt);
}

function resolvePromptTemplates(prompt: PromptDict, lang: string): PromptTemplates {
    const systemPromptDict = prompt.systemPrompt;
    if (!systemPromptDict) {
        throw new BadRequestError(`Prompt '${prompt.key}' has no systemPromptRef configuration`);
    }

    const systemPrompt = systemPromptDict.prompts[lang];
    const userPrompt = prompt.prompts[lang];

    if (!systemPrompt) {
        throw new BadRequestError(`Prompt '${systemPromptDict.key}' has no translation for language '${lang}'.`);
    }
    if (!userPrompt) {
        throw new BadRequestError(`Prompt '${prompt.key}' has no translation for language '${lang}'.`);
    }

    return {systemPrompt, userPrompt};
}

async function runOpenAiReply(systemPrompt: string, userPrompt: string, dictPrompt: PromptDict): Promise<string> {
    const response = await openAiClient.createResponse(
        buildOpenAiCreateResponseInput(systemPrompt, userPrompt, dictPrompt));

    const responseId = response.id;

    const completed = await openAiClient.waitForResponse(responseId);
    if (!completed) {
        throw new OpenAIError(`Run ${responseId} did not complete successfully`);
    }

    const messages = await openAiClient.getResponse(responseId);
    return extractAssistantReply(messages);
}

function buildOpenAiCreateResponseInput(systemPrompt: string, userPrompt: string, dictPrompt: PromptDict): OpenAiCreateResponseInput {
    return {
        systemPrompt,
        userPrompt,
        vectorStoreIds: dictPrompt.vectorStoreIds,
        model: resolvePromptSetting(dictPrompt.model, dictPrompt.systemPrompt?.model ?? null),
        temperature: resolvePromptSetting(dictPrompt.temperature, dictPrompt.systemPrompt?.temperature ?? null),
        textFormat: resolvePromptSetting(dictPrompt.textFormat, dictPrompt.systemPrompt?.textFormat ?? null),
    };
}

function resolvePromptSetting<T>(value: T | null, fallback: T | null): T | null {
    return value ?? fallback ?? null;
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
