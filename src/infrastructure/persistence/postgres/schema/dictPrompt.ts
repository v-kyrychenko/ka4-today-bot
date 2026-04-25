import {bigint, bigserial, jsonb, pgTable, text, varchar} from 'drizzle-orm/pg-core';

export const dictPrompt = pgTable('dict_prompt', {
    id: bigserial('id', {mode: 'number'}).primaryKey(),
    key: varchar('key', {length: 60}).notNull(),
    sys_prompt_id: bigint('sys_prompt_id', {mode: 'number'}),
    prompt: jsonb('prompt').notNull(),
    vector_store_ids: text('vector_store_ids').notNull(),
});
