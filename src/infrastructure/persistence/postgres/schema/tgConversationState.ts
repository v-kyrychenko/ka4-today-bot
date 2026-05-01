import {bigint, bigserial, boolean, jsonb, pgTable, timestamp, varchar} from 'drizzle-orm/pg-core';
import {tgUser} from './tgUser.js';

export const tgConversationState = pgTable('tg_conversation_state', {
    id: bigserial('id', {mode: 'number'}).primaryKey(),
    chat_id: bigint('chat_id', {mode: 'number'}).notNull().references(() => tgUser.chat_id),
    type: varchar('type', {length: 60}).notNull(),
    current_step: varchar('current_step', {length: 60}).notNull(),
    data: jsonb('data').notNull(),
    last_bot_msg_id: bigint('last_bot_msg_id', {mode: 'number'}),
    is_active: boolean('is_active').notNull(),
    expires_at: timestamp('expires_at', {mode: 'string'}).notNull(),
    created_at: timestamp('created_at', {mode: 'string'}).notNull(),
    updated_at: timestamp('updated_at', {mode: 'string'}).notNull(),
});
