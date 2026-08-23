import {WorkoutLogSession} from '../../../../modules/telegram/features/workoutLogging/domain/workoutLogEntry.js';
import type {WorkoutLogSessionRow} from '../models/workoutLogSessionRow.js';

export const workoutLogSessionMapper = {
    toAppModel,
};

export function toAppModel(row: WorkoutLogSessionRow): WorkoutLogSession {
    return new WorkoutLogSession({
        id: row.id,
        clientId: row.client_id,
        sessionDay: row.session_day,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        endReason: row.end_reason,
    });
}
