import {bigint, boolean, pgTable, varchar} from 'drizzle-orm/pg-core';

export const tgUser = pgTable('tg_user', {
    chat_id: bigint('chat_id', {mode: 'number'}).primaryKey(),
    client_id: bigint('client_id', {mode: 'number'}),
    username: varchar('username', {length: 60}).notNull(),
    phone: varchar('phone', {length: 20}),
    lang: varchar('lang', {length: 10}).notNull(),
    is_active: boolean('is_active').notNull(),
    is_bot: boolean('is_bot').notNull(),
});
