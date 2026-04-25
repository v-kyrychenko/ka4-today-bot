import {PromptDict, PromptDictSystem} from '../../../../modules/telegram/domain/prompt.js';
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
        systemPrompt,
    });
}

export function toSystemPromptModel(row: DictPromptRow): PromptDictSystem {
    return new PromptDictSystem({
        id: row.id,
        key: row.key,
        prompts: toPromptsRecord(row.prompt),
    });
}

function toPromptsRecord(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
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
