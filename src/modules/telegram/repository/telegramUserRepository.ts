import {eq} from 'drizzle-orm';
import {tgUserMapper} from '../../../infrastructure/persistence/postgres/mappers/tgUserMapper.js';
import {getPostgresDb} from '../../../infrastructure/persistence/postgres/postgresDb.js';
import {isPostgresUniqueViolation} from '../../../infrastructure/persistence/postgres/postgresErrors.js';
import {client} from '../../../infrastructure/persistence/postgres/schema/client.js';
import {tgUser} from '../../../infrastructure/persistence/postgres/schema/tgUser.js';
import {CLIENT_STATUS_INACTIVE} from '../../coach/client/domain/client.js';
import {BadRequestError} from '../../../shared/errors';
import {TelegramMessage} from '../domain/telegram.js';

export const telegramUserRepository = {
    getOrCreateUser,
    markInactive,
};

export async function getOrCreateUser(chatId: number, message: TelegramMessage) {
    const existing = await findByChatId(chatId);
    if (existing) {
        return existing;
    }

    try {
        const [created] = await getPostgresDb()
            .insert(tgUser)
            .values(tgUserMapper.toCreateRow(chatId, message.from))
            .returning();

        return tgUserMapper.toAppModel(created);
    } catch (error) {
        if (isPostgresUniqueViolation(error)) {
            const user = await findByChatId(chatId);
            if (user) {
                return user;
            }

            throw new BadRequestError(`User for chat id: ${chatId} not found after retry`);
        }

        throw error;
    }
}

export async function markInactive(chatId: number): Promise<boolean> {
    return getPostgresDb().transaction(async (tx) => {
        const [user] = await tx
            .select({
                chatId: tgUser.chat_id,
                clientId: tgUser.client_id,
                isActive: tgUser.is_active,
            })
            .from(tgUser)
            .where(eq(tgUser.chat_id, chatId))
            .limit(1);

        if (!user) {
            return false;
        }

        if (user.isActive) {
            await tx
                .update(tgUser)
                .set({is_active: false})
                .where(eq(tgUser.chat_id, chatId));
        }

        if (user.clientId != null) {
            await tx
                .update(client)
                .set({status: CLIENT_STATUS_INACTIVE})
                .where(eq(client.id, user.clientId));
        }

        return true;
    });
}

async function findByChatId(chatId: number) {
    const [row] = await getPostgresDb()
        .select()
        .from(tgUser)
        .where(eq(tgUser.chat_id, chatId))
        .limit(1);

    return row ? tgUserMapper.toAppModel(row) : null;
}
