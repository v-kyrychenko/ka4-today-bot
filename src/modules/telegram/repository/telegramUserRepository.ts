import {eq} from 'drizzle-orm';
import {getPostgresDb} from '../../../infrastructure/persistence/postgres/postgresDb.js';
import {client} from '../../../infrastructure/persistence/postgres/schema/client.js';
import {tgUser} from '../../../infrastructure/persistence/postgres/schema/tgUser.js';
import {CLIENT_STATUS_INACTIVE} from '../../coach/client/domain/client.js';

export const telegramUserRepository = {
    markInactive,
};

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
