import {and, asc, eq, gte} from 'drizzle-orm';
import {
    bodyMeasurementLogMapper,
} from '../../../../../infrastructure/persistence/postgres/mappers/bodyMeasurementLogMapper.js';
import {getPostgresDb} from '../../../../../infrastructure/persistence/postgres/postgresDb.js';
import {
    bodyMeasurementLog,
} from '../../../../../infrastructure/persistence/postgres/schema/bodyMeasurementLog.js';
import type {BodyMeasurement} from '../bodyMeasurementsModel.js';

export const bodyMeasurementRepository = {
    findForClientSince,
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

