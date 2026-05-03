import {eq} from 'drizzle-orm';
import {dictPromptMapper} from '../../../infrastructure/persistence/postgres/mappers/dictPromptMapper.js';
import type {DictPromptRow} from '../../../infrastructure/persistence/postgres/models/dictPromptRow.js';
import {getPostgresDb} from '../../../infrastructure/persistence/postgres/postgresDb.js';
import {dictPrompt} from '../../../infrastructure/persistence/postgres/schema/dictPrompt.js';
import {BadRequestError} from '../../../shared/errors';
import type {PromptDict} from '../features/prompts/prompt.js';

export const dictPromptRepository = {
    getPromptByKey,
};

export async function getPromptByKey(key: string): Promise<PromptDict> {
    const prompt = await findPromptByKey(key);
    if (!prompt) {
        throw new BadRequestError(`Prompt: ${key} not found in db`);
    }

    const systemPrompt = prompt.sys_prompt_id != null
        ? await findPromptById(prompt.sys_prompt_id)
        : null;

    return dictPromptMapper.toAppModel(
        prompt,
        systemPrompt ? dictPromptMapper.toSystemPromptModel(systemPrompt) : null
    );
}

async function findPromptByKey(key: string): Promise<DictPromptRow | null> {
    const [row] = await getPostgresDb()
        .select()
        .from(dictPrompt)
        .where(eq(dictPrompt.key, key))
        .limit(1);

    return (row as DictPromptRow | undefined) ?? null;
}

async function findPromptById(id: number): Promise<DictPromptRow | null> {
    const [row] = await getPostgresDb()
        .select()
        .from(dictPrompt)
        .where(eq(dictPrompt.id, id))
        .limit(1);

    return (row as DictPromptRow | undefined) ?? null;
}
