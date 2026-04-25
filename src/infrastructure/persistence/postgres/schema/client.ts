import {bigint, bigserial, date, pgTable, text, timestamp, varchar} from 'drizzle-orm/pg-core';

export const client = pgTable('client', {
    id: bigserial('id', {mode: 'number'}).primaryKey(),
    coach_id: bigint('coach_id', {mode: 'number'}).notNull(),
    first_name: varchar('first_name', {length: 60}).notNull(),
    last_name: varchar('last_name', {length: 60}).notNull(),
    status: varchar('status', {length: 20}).notNull(),
    lang: varchar('lang', {length: 10}).notNull(),
    birthday: date('birthday', {mode: 'string'}).notNull(),
    created_at: timestamp('created_at', {mode: 'string'}).notNull(),
    last_activity: timestamp('last_activity', {mode: 'string'}),
    goals: text('goals'),
    notes: text('notes'),
});
