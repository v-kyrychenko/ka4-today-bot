import {and, eq, isNull} from 'drizzle-orm';
import {getPostgresDb} from '../../../../../infrastructure/persistence/postgres/postgresDb.js';
import {
    workoutLogEntryMapper,
} from '../../../../../infrastructure/persistence/postgres/mappers/workoutLogEntryMapper.js';
import {
    workoutLogSessionMapper,
} from '../../../../../infrastructure/persistence/postgres/mappers/workoutLogSessionMapper.js';
import {workoutLogEntry} from '../../../../../infrastructure/persistence/postgres/schema/workoutLogEntry.js';
import {workoutLogSession} from '../../../../../infrastructure/persistence/postgres/schema/workoutLogSession.js';
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
    const [row] = await getPostgresDb()
        .select()
        .from(workoutLogSession)
        .where(and(eq(workoutLogSession.client_id, clientId), isNull(workoutLogSession.ended_at)))
        .limit(1);

    return row ? workoutLogSessionMapper.toAppModel(row) : null;
}

export async function startSession(input: StartSessionInput): Promise<WorkoutLogSession> {
    const [row] = await getPostgresDb()
        .insert(workoutLogSession)
        .values({
            client_id: input.clientId,
            session_day: input.sessionDay,
            started_at: input.startedAt,
        })
        .returning();

    return workoutLogSessionMapper.toAppModel(row);
}

export async function closeSession(id: number, endReason: string): Promise<WorkoutLogSession> {
    const [row] = await getPostgresDb()
        .update(workoutLogSession)
        .set({ended_at: nowIso(), end_reason: endReason})
        .where(eq(workoutLogSession.id, id))
        .returning();

    return workoutLogSessionMapper.toAppModel(row);
}

export async function addEntry(input: AddEntryInput): Promise<WorkoutLogEntry> {
    const [row] = await getPostgresDb()
        .insert(workoutLogEntry)
        .values({
            session_id: input.sessionId,
            dict_exercise_id: input.dictExerciseId,
            raw_description: input.rawDescription,
            reps: input.reps,
            sets: input.sets,
            weight: input.weight === null ? null : String(input.weight),
            created_at: nowIso(),
        })
        .returning();

    return workoutLogEntryMapper.toAppModel(row);
}

export async function countEntries(sessionId: number): Promise<number> {
    return getPostgresDb().$count(workoutLogEntry, eq(workoutLogEntry.session_id, sessionId));
}
