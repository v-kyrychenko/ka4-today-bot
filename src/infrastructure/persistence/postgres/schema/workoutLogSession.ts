import {bigint, bigserial, date, pgTable, timestamp, varchar} from 'drizzle-orm/pg-core';
import {client} from './client.js';

export const workoutLogSession = pgTable('workout_log_session', {
    id: bigserial('id', {mode: 'number'}).primaryKey(),
    client_id: bigint('client_id', {mode: 'number'})
        .notNull()
        .references(() => client.id),
    session_day: date('session_day', {mode: 'string'}).notNull(),
    started_at: timestamp('started_at', {mode: 'string'}).notNull(),
    ended_at: timestamp('ended_at', {mode: 'string'}),
    end_reason: varchar('end_reason', {length: 20}),
});
