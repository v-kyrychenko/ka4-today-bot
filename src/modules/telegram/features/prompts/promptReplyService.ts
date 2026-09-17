import {openAiClient} from '../../../../infrastructure/integrations/openai/openAiClient.js';
import {OpenAIError} from '../../../../shared/errors';
import type {OpenAiCreateResponseInput, OpenAiResponseDetails} from '../../../../shared/types/openai.js';
import {log} from '../../../../shared/logging';
import type {PromptDict} from './prompt.js';
import {promptTemplateService} from './promptTemplateService.js';

export interface FetchOpenAiReplyRequest {
    lang?: string | null;
    promptRef: string;
    variables?: Record<string, unknown>;
    background?: boolean;
}

export async function fetchOpenAiReply(request: FetchOpenAiReplyRequest): Promise<string> {
    const resolved = await promptTemplateService.resolve(request);
    const {prompt, systemPrompt, userPrompt} = resolved;

    log(`Fetched prompt: ${prompt.key}, system prompt: ${prompt.systemPrompt?.key}`);

    return runOpenAiReply(systemPrompt, userPrompt, prompt, request.background);
}

async function runOpenAiReply(
    systemPrompt: string,
    userPrompt: string,
    dictPrompt: PromptDict,
    background?: boolean,
): Promise<string> {
    const response = await openAiClient.createResponse(
        buildOpenAiCreateResponseInput(systemPrompt, userPrompt, dictPrompt, background),
    );

    if (response.status === 'completed') {
        return extractAssistantReply(response);
    }

    if (response.status === 'requires_action' && response.required_action?.type === 'submit_tool_outputs') {
        throw new OpenAIError('submit_tool_outputs is not implemented');
    }

    if (!shouldWaitForResponse(response)) {
        throw new OpenAIError(`Run ${response.id} finished with status ${response.status}`);
    }

    const completed = await openAiClient.waitForResponse(response.id);
    if (!completed) {
        throw new OpenAIError(`Run ${response.id} did not complete successfully`);
    }

    const messages = await openAiClient.getResponse(response.id);
    return extractAssistantReply(messages);
}

function buildOpenAiCreateResponseInput(
    systemPrompt: string,
    userPrompt: string,
    dictPrompt: PromptDict,
    background?: boolean,
): OpenAiCreateResponseInput {
    return {
        systemPrompt,
        userPrompt,
        vectorStoreIds: dictPrompt.vectorStoreIds,
        model: resolvePromptSetting(dictPrompt.model, dictPrompt.systemPrompt?.model ?? null),
        temperature: resolvePromptSetting(dictPrompt.temperature, dictPrompt.systemPrompt?.temperature ?? null),
        config: resolvePromptSetting(dictPrompt.config, dictPrompt.systemPrompt?.config ?? null),
        background: background ?? false,
    };
}

function shouldWaitForResponse(response: OpenAiResponseDetails): boolean {
    return response.background && (response.status === 'queued' || response.status === 'in_progress');
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
        (
            part,
        ): part is {
            type: 'output_text';
            text: string;
        } => part.type === 'output_text' && typeof part.text === 'string',
    );

    if (!textPart) {
        throw new OpenAIError('Assistant message does not contain valid text content');
    }

    return textPart.text;
}


export const promptReplyService = {
    fetchOpenAiReply,
};

export const openAiService = promptReplyService;
