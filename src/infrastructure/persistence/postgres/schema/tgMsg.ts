import {bigint, bigserial, pgTable, text, timestamp} from 'drizzle-orm/pg-core';

export const tgMsg = pgTable('tg_msg', {
    id: bigserial('id', {mode: 'number'}).primaryKey(),
    chat_id: bigint('chat_id', {mode: 'number'}).notNull(),
    dict_prompt_id: bigint('dict_prompt_id', {mode: 'number'}),
    created_at: timestamp('created_at', {mode: 'string'}).notNull(),
    msg: text('msg').notNull(),
});
