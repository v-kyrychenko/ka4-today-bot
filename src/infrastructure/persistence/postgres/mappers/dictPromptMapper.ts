import {PromptDict, PromptDictSystem} from '../../../../modules/telegram/features/prompts/prompt.js';
import type {OpenAiConfig, OpenAiReasoningEffort, OpenAiTextFormat} from '../../../../shared/types/openai.js';
import type {DictPromptRow} from '../models/dictPromptRow.js';

export const dictPromptMapper = {
    toAppModel,
    toSystemPromptModel,
};

export function toAppModel(row: DictPromptRow, systemPrompt: PromptDictSystem | null): PromptDict {
    return new PromptDict({
        id: row.id,
        key: row.key,
        prompts: toPromptsRecord(row.prompt),
        vectorStoreIds: toVectorStoreIds(row.vector_store_ids),
        model: row.model,
        temperature: toTemperature(row.temperature),
        config: toConfig(row.config),
        systemPrompt,
    });
}

export function toSystemPromptModel(row: DictPromptRow): PromptDictSystem {
    return new PromptDictSystem({
        id: row.id,
        key: row.key,
        prompts: toPromptsRecord(row.prompt),
        model: row.model,
        temperature: toTemperature(row.temperature),
        config: toConfig(row.config),
    });
}

function toPromptsRecord(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
}

function toVectorStoreIds(value: string): string[] {
    try {
        const parsed = JSON.parse(value) as unknown;
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter((item): item is string => typeof item === 'string');
    } catch {
        return [];
    }
}

function toTemperature(value: string | null): number | null {
    if (value == null) {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toConfig(value: unknown): OpenAiConfig | null {
    if (!isPlainObject(value)) {
        return null;
    }

    return {
        textFormat: toTextFormat(value.text),
        reasoning: toReasoning(value.reasoning),
    };
}

function toTextFormat(value: unknown): OpenAiTextFormat | null {
    if (!isPlainObject(value) || !isPlainObject(value.format)) {
        return null;
    }

    return {format: value.format};
}

function toReasoning(value: unknown): OpenAiConfig['reasoning'] {
    if (!isPlainObject(value) || typeof value.effort !== 'string') {
        return null;
    }

    return {effort: value.effort as OpenAiReasoningEffort};
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
