import {bigserial, jsonb, pgTable, text, varchar} from 'drizzle-orm/pg-core';

export const dictExercise = pgTable('dict_exercise', {
    id: bigserial('id', {mode: 'number'}).primaryKey(),
    name: jsonb('name').notNull(),
    key: varchar('key', {length: 60}).notNull(),
    level: varchar('level', {length: 20}).notNull(),
    category: varchar('category', {length: 60}).notNull(),
    force: varchar('force', {length: 20}).notNull(),
    mechanic: varchar('mechanic', {length: 20}).notNull(),
    equipment: varchar('equipment', {length: 60}),
    primaryMuscles: jsonb('primary_muscles').notNull(),
    secondaryMuscles: jsonb('secondary_muscles'),
    instructions: jsonb('instructions').notNull(),
    images: jsonb('images').notNull(),
    searchText: text('search_text').notNull(),
});
