import {
    bigint,
    bigserial,
    customType,
    date,
    pgTable,
    text,
    unique,
    varchar,
} from 'drizzle-orm/pg-core';
import {client} from './client.js';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
    dataType() {
        return 'bytea';
    },
});

export const bodyMeasurementSummary = pgTable('body_measurement_summary', {
    id: bigserial('id', {mode: 'number'}).primaryKey(),
    client_id: bigint('client_id', {mode: 'number'}).notNull().references(() => client.id),
    created_at: date('created_at', {mode: 'string'}).notNull(),
    period_start: date('period_start', {mode: 'string'}).notNull(),
    period_end: date('period_end', {mode: 'string'}).notNull(),
    data_hash: varchar('data_hash', {length: 64}).notNull(),
    summary_text: text('summary_text').notNull(),
    summary_png: bytea('summary_png').notNull(),
}, (table) => [
    unique('body_measurement_summary_client_id_period_start_period_end__key')
        .on(table.client_id, table.period_start, table.period_end, table.data_hash),
]);

