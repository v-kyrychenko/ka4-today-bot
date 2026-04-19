import {bigint, bigserial, pgTable, varchar} from 'drizzle-orm/pg-core';

export const workoutSchedule = pgTable('workout_schedule', {
    id: bigserial('id', {mode: 'number'}).primaryKey(),
    client_id: bigint('client_id', {mode: 'number'}).notNull(),
    day_of_week: varchar('day_of_week', {length: 3}).notNull(),
    dict_prompt_id: bigint('dict_prompt_id', {mode: 'number'}).notNull(),
});
