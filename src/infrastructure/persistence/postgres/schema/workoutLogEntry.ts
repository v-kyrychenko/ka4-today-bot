import {bigint, bigserial, integer, numeric, pgTable, text, timestamp} from 'drizzle-orm/pg-core';
import {dictExercise} from './dictExercise.js';
import {workoutLogSession} from './workoutLogSession.js';

export const workoutLogEntry = pgTable('workout_log_entry', {
    id: bigserial('id', {mode: 'number'}).primaryKey(),
    session_id: bigint('session_id', {mode: 'number'})
        .notNull()
        .references(() => workoutLogSession.id),
    dict_exercise_id: bigint('dict_exercise_id', {mode: 'number'}).references(() => dictExercise.id),
    raw_description: text('raw_description').notNull(),
    reps: integer('reps'),
    sets: integer('sets'),
    weight: numeric('weight', {precision: 5, scale: 1}),
    created_at: timestamp('created_at', {mode: 'string'}).notNull(),
});
