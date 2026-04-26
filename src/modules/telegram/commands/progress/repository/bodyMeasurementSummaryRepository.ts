import {eq} from 'drizzle-orm';
import {
    bodyMeasurementSummaryMapper,
} from '../../../../../infrastructure/persistence/postgres/mappers/bodyMeasurementSummaryMapper.js';
import {getPostgresDb} from '../../../../../infrastructure/persistence/postgres/postgresDb.js';
import {
    bodyMeasurementSummary,
} from '../../../../../infrastructure/persistence/postgres/schema/bodyMeasurementSummary.js';
import type {
    BodyMeasurementSummary,
    BodyMeasurementSummaryCreateInput,
} from '../bodyMeasurementsModel.js';

export const bodyMeasurementSummaryRepository = {
    findByDataHash,
    create,
};

export async function findByDataHash(dataHash: string): Promise<BodyMeasurementSummary | null> {
    const [row] = await getPostgresDb()
        .select()
        .from(bodyMeasurementSummary)
        .where(eq(bodyMeasurementSummary.data_hash, dataHash))
        .limit(1);

    return row ? bodyMeasurementSummaryMapper.toAppModel(row) : null;
}

export async function create(input: BodyMeasurementSummaryCreateInput): Promise<BodyMeasurementSummary> {
    const [row] = await getPostgresDb()
        .insert(bodyMeasurementSummary)
        .values(bodyMeasurementSummaryMapper.toCreateRow(input, new Date().toISOString().slice(0, 10)))
        .onConflictDoNothing({
            target: [
                bodyMeasurementSummary.client_id,
                bodyMeasurementSummary.period_start,
                bodyMeasurementSummary.period_end,
                bodyMeasurementSummary.data_hash,
            ],
        })
        .returning();

    return row ? bodyMeasurementSummaryMapper.toAppModel(row) : findExisting(input.dataHash);
}

async function findExisting(dataHash: string): Promise<BodyMeasurementSummary> {
    const existing = await findByDataHash(dataHash);

    if (!existing) {
        throw new Error(`Body measurement summary cache not found for data hash ${dataHash}`);
    }

    return existing;
}

