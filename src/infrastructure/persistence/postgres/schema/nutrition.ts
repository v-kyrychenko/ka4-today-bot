import {bigint, bigserial, boolean, integer, jsonb, numeric, pgTable, text, varchar} from 'drizzle-orm/pg-core';

export const nFoodDict = pgTable('n_food_dict', {
    id: bigserial('id', {mode: 'number'}).primaryKey(),
    key: varchar('key', {length: 80}).notNull(),
    name: jsonb('name').notNull(),
    category: varchar('category', {length: 60}).notNull(),
    amount: numeric('amount', {precision: 5, scale: 1}).notNull(),
    unit: varchar('unit', {length: 10}).notNull(),
    calories: numeric('calories', {precision: 5, scale: 1}).notNull(),
    protein: numeric('protein', {precision: 5, scale: 1}).notNull(),
    fat: numeric('fat', {precision: 5, scale: 1}).notNull(),
    carbs: numeric('carbs', {precision: 5, scale: 1}).notNull(),
    meal_roles: text('meal_roles').array().notNull(),
    flags: text('flags').array().notNull(),
});

export const nMealTemplate = pgTable('n_meal_template', {
    id: bigserial('id', {mode: 'number'}).primaryKey(),
    key: varchar('key', {length: 80}).notNull(),
    meal_type: varchar('meal_type', {length: 60}).notNull(),
    title: jsonb('title').notNull(),
    goal_tags: text('goal_tags').array().notNull(),
    day_tags: text('day_tags').array().notNull(),
});

export const nMealItem = pgTable('n_meal_item', {
    id: bigserial('id', {mode: 'number'}).primaryKey(),
    n_meal_template_id: bigint('n_meal_template_id', {mode: 'number'}).notNull().references(() => nMealTemplate.id),
    n_food_dict_id: bigint('n_food_dict_id', {mode: 'number'}).notNull().references(() => nFoodDict.id),
    amount: numeric('amount', {precision: 5, scale: 1}).notNull(),
    unit: varchar('unit', {length: 10}).notNull(),
    role: varchar('role', {length: 60}).notNull(),
    adjustable: boolean('adjustable').notNull().default(true),
    min_amount: integer('min_amount'),
    max_amount: integer('max_amount'),
});
