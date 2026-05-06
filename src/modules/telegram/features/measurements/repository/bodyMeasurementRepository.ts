import {and, asc, desc, eq, gte, isNotNull, lte, sql} from 'drizzle-orm';
import {
    bodyMeasurementLogMapper,
} from '../../../../../infrastructure/persistence/postgres/mappers/bodyMeasurementLogMapper.js';
import {getPostgresDb} from '../../../../../infrastructure/persistence/postgres/postgresDb.js';
import {
    bodyMeasurementLog,
} from '../../../../../infrastructure/persistence/postgres/schema/bodyMeasurementLog.js';
import {tgUser} from '../../../../../infrastructure/persistence/postgres/schema/tgUser.js';
import type {BodyMeasurement, BodyMeasurementCreateInput} from '../bodyMeasurementsModel.js';

export interface BodyMeasurementReminderCandidate {
    chatId: number;
    clientId: number;
    latestMeasurementDate: string | null;
}

export const bodyMeasurementRepository = {
    findForClientSince,
    findLatestForClientOnOrBefore,
    findReminderCandidates,
    createMany,
};

export async function findForClientSince(clientId: number, since: string): Promise<BodyMeasurement[]> {
    const rows = await getPostgresDb()
        .select()
        .from(bodyMeasurementLog)
        .where(and(
            eq(bodyMeasurementLog.client_id, clientId),
            gte(bodyMeasurementLog.created_at, since),
        ))
        .orderBy(asc(bodyMeasurementLog.type), asc(bodyMeasurementLog.created_at));

    return rows.map(bodyMeasurementLogMapper.toAppModel);
}

export async function findLatestForClientOnOrBefore(clientId: number, date: string): Promise<BodyMeasurement | null> {
    const [row] = await getPostgresDb()
        .select()
        .from(bodyMeasurementLog)
        .where(and(
            eq(bodyMeasurementLog.client_id, clientId),
            lte(bodyMeasurementLog.created_at, date),
        ))
        .orderBy(desc(bodyMeasurementLog.created_at), desc(bodyMeasurementLog.id))
        .limit(1);

    return row ? bodyMeasurementLogMapper.toAppModel(row) : null;
}

export async function findReminderCandidates(cutoffDate: string): Promise<BodyMeasurementReminderCandidate[]> {
    const latestMeasurementDate = sql<string | null>`max(${bodyMeasurementLog.created_at})`;
    const rows = await getPostgresDb()
        .select({
            chatId: tgUser.chat_id,
            clientId: tgUser.client_id,
            latestMeasurementDate,
        })
        .from(tgUser)
        .leftJoin(bodyMeasurementLog, eq(bodyMeasurementLog.client_id, tgUser.client_id))
        .where(and(
            eq(tgUser.is_active, true),
            isNotNull(tgUser.client_id),
        ))
        .groupBy(tgUser.chat_id, tgUser.client_id)
        .having(sql`${latestMeasurementDate} is null or ${latestMeasurementDate} < ${cutoffDate}`);

    return rows.flatMap((row) => {
        if (row.clientId == null) {
            return [];
        }

        return [{
            chatId: row.chatId,
            clientId: row.clientId,
            latestMeasurementDate: row.latestMeasurementDate,
        }];
    });
}

export async function createMany(input: BodyMeasurementCreateInput[]): Promise<BodyMeasurement[]> {
    if (!input.length) {
        return [];
    }

    const rows = await getPostgresDb()
        .insert(bodyMeasurementLog)
        .values(input.map(bodyMeasurementLogMapper.toCreateRow))
        .returning();

    return rows.map(bodyMeasurementLogMapper.toAppModel);
}
