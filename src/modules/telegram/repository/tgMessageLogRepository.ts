import {eq} from 'drizzle-orm';
import {
    telegramSentMessageLogMapper,
    type TelegramSentMessageLogInput,
} from '../../../infrastructure/persistence/postgres/mappers/telegramSentMessageLogMapper.js';
import {getPostgresDb} from '../../../infrastructure/persistence/postgres/postgresDb.js';
import {dictPrompt} from '../../../infrastructure/persistence/postgres/schema/dictPrompt.js';
import {tgMsg} from '../../../infrastructure/persistence/postgres/schema/tgMsg.js';

export const tgMessageLogRepository = {
    logSentMessage,
};

export async function logSentMessage(input: TelegramSentMessageLogInput): Promise<void> {
    const dictPromptId = await findDictPromptId(input.promptRef);

    await getPostgresDb()
        .insert(tgMsg)
        .values(telegramSentMessageLogMapper.toCreateRow(input, dictPromptId, new Date().toISOString()));
}

async function findDictPromptId(promptRef?: string | null): Promise<number | null> {
    const normalizedPromptRef = promptRef?.trim();
    if (!normalizedPromptRef) {
        return null;
    }

    const [prompt] = await getPostgresDb()
        .select({id: dictPrompt.id})
        .from(dictPrompt)
        .where(eq(dictPrompt.key, normalizedPromptRef))
        .limit(1);

    return prompt?.id ?? null;
}
