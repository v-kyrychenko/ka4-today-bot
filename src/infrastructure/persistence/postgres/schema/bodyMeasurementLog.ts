import {bigint, bigserial, date, numeric, pgTable, varchar} from 'drizzle-orm/pg-core';
import {client} from './client.js';

export const bodyMeasurementLog = pgTable('body_measurement_log', {
    id: bigserial('id', {mode: 'number'}).primaryKey(),
    client_id: bigint('client_id', {mode: 'number'}).notNull().references(() => client.id),
    created_at: date('created_at', {mode: 'string'}).notNull(),
    amount: numeric('amount', {precision: 5, scale: 1}).notNull(),
    type: varchar('type', {length: 50}).notNull(),
    unit_key: varchar('unit_key', {length: 5}).notNull(),
});

