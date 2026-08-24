import {sql} from 'drizzle-orm';
import {getPostgresDb} from '../../../../../infrastructure/persistence/postgres/postgresDb.js';
import type {WorkoutLogEntryRow} from '../../../../../infrastructure/persistence/postgres/models/workoutLogEntryRow.js';
import type {WorkoutLogSessionRow} from '../../../../../infrastructure/persistence/postgres/models/workoutLogSessionRow.js';
import {
    workoutLogEntryMapper,
} from '../../../../../infrastructure/persistence/postgres/mappers/workoutLogEntryMapper.js';
import {
    workoutLogSessionMapper,
} from '../../../../../infrastructure/persistence/postgres/mappers/workoutLogSessionMapper.js';
import {nowIso} from '../../../../../shared/utils/dateUtils.js';
import type {WorkoutLogEntry, WorkoutLogSession} from '../domain/workoutLogEntry.js';

export interface StartSessionInput {
    clientId: number;
    sessionDay: string;
    startedAt: string;
}

export interface AddEntryInput {
    sessionId: number;
    dictExerciseId: number | null;
    rawDescription: string;
    reps: number | null;
    sets: number | null;
    weight: number | null;
}

export const workoutLogRepository = {
    findActiveByClientId,
    startSession,
    closeSession,
    addEntry,
    countEntries,
};

export async function findActiveByClientId(clientId: number): Promise<WorkoutLogSession | null> {
    const query = sql<WorkoutLogSessionRow>`
        select * from workout_log_session
        where client_id = ${clientId} and ended_at is null
        limit 1
    `;

    const result = await getPostgresDb().execute(query);
    const [row] = result.rows as unknown as WorkoutLogSessionRow[];

    return row ? workoutLogSessionMapper.toAppModel(row) : null;
}

export async function startSession(input: StartSessionInput): Promise<WorkoutLogSession> {
    const query = sql<WorkoutLogSessionRow>`
        insert into workout_log_session (client_id, session_day, started_at)
        values (${input.clientId}, ${input.sessionDay}, ${input.startedAt})
        returning *
    `;

    const result = await getPostgresDb().execute(query);
    const [row] = result.rows as unknown as WorkoutLogSessionRow[];

    return workoutLogSessionMapper.toAppModel(row);
}

export async function closeSession(id: number, endReason: string): Promise<WorkoutLogSession> {
    const query = sql<WorkoutLogSessionRow>`
        update workout_log_session
        set ended_at = ${nowIso()}, end_reason = ${endReason}
        where id = ${id}
        returning *
    `;

    const result = await getPostgresDb().execute(query);
    const [row] = result.rows as unknown as WorkoutLogSessionRow[];

    return workoutLogSessionMapper.toAppModel(row);
}

export async function addEntry(input: AddEntryInput): Promise<WorkoutLogEntry> {
    const query = sql<WorkoutLogEntryRow>`
        insert into workout_log_entry
            (session_id, dict_exercise_id, raw_description, reps, sets, weight, created_at)
        values
            (${input.sessionId}, ${input.dictExerciseId}, ${input.rawDescription}, ${input.reps}, ${input.sets},
             ${input.weight}, ${nowIso()})
        returning *
    `;

    const result = await getPostgresDb().execute(query);
    const [row] = result.rows as unknown as WorkoutLogEntryRow[];

    return workoutLogEntryMapper.toAppModel(row);
}

export async function countEntries(sessionId: number): Promise<number> {
    const query = sql<{count: string}>`
        select count(*) as count from workout_log_entry
        where session_id = ${sessionId}
    `;

    const result = await getPostgresDb().execute(query);
    const [row] = result.rows as unknown as Array<{count: string}>;

    return row ? Number(row.count) : 0;
}
