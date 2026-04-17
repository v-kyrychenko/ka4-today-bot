import {and, asc, eq} from 'drizzle-orm';
import {clientMapper} from '../../../../infrastructure/persistence/postgres/mappers/clientMapper.js';
import {getPostgresDb} from '../../../../infrastructure/persistence/postgres/postgresDb.js';
import {client} from '../../../../infrastructure/persistence/postgres/schema/client.js';
import {NotFoundError} from '../../../../shared/errors';
import type {
    ClientCreateInput,
    ClientListRequest,
    ClientUpdateInput,
} from '../domain/client.js';

export const clientsRepository = {
    findAll,
    findById,
    create,
    update,
};

export async function findAll(input: ClientListRequest) {
    const offset = (input.page - 1) * input.limit;
    const fetchLimit = input.limit + 1;
    const rows = await getPostgresDb()
        .select()
        .from(client)
        .where(eq(client.coach_id, input.coachId))
        .orderBy(asc(client.id))
        .limit(fetchLimit)
        .offset(offset);

    return {
        items: rows.slice(0, input.limit).map(clientMapper.toAppModel),
        total: rows.length,
    };
}

export async function findById(coachId: number, clientId: number) {
    const [row] = await getPostgresDb()
        .select()
        .from(client)
        .where(and(
            eq(client.coach_id, coachId),
            eq(client.id, clientId),
        ))
        .limit(1);

    if (!row) {
        throw new NotFoundError('Client not found');
    }

    return clientMapper.toAppModel(row);
}

export async function create(coachId: number, input: ClientCreateInput) {
    const [row] = await getPostgresDb()
        .insert(client)
        .values(clientMapper.toCreateRow(input, coachId, new Date().toISOString()))
        .returning();

    return clientMapper.toAppModel(row);
}

export async function update(coachId: number, clientId: number, input: ClientUpdateInput) {
    const [row] = await getPostgresDb()
        .update(client)
        .set(clientMapper.toUpdateRow(input))
        .where(and(
            eq(client.coach_id, coachId),
            eq(client.id, clientId),
        ))
        .returning();

    if (!row) {
        throw new NotFoundError('Client not found');
    }

    return clientMapper.toAppModel(row);
}
