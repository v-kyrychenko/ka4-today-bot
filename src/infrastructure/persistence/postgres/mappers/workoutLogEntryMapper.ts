import {WorkoutLogEntry} from '../../../../modules/telegram/features/workoutLogging/domain/workoutLogEntry.js';
import type {WorkoutLogEntryRow} from '../models/workoutLogEntryRow.js';

export const workoutLogEntryMapper = {
    toAppModel,
};

export function toAppModel(row: WorkoutLogEntryRow): WorkoutLogEntry {
    return new WorkoutLogEntry({
        id: row.id,
        sessionId: row.session_id,
        dictExerciseId: row.dict_exercise_id,
        rawDescription: row.raw_description,
        reps: row.reps,
        sets: row.sets,
        weight: row.weight === null ? null : Number(row.weight),
    });
}
