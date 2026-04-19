import {bigserial, jsonb, pgTable} from 'drizzle-orm/pg-core';

export const workout = pgTable('workout', {
    id: bigserial('id', {mode: 'number'}).primaryKey(),
    plan: jsonb('plan').notNull(),
});
