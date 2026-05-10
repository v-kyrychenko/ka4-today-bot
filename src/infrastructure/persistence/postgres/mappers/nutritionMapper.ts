import {
    FoodDict,
    MealItem,
    MealTemplate,
    type DayTag,
    type FoodCategory,
    type MealItemRole,
    type FoodUnit,
    type GoalTag,
    type LocalizedText,
    type MealRole,
    type MealType,
} from '../../../../modules/telegram/features/nutrition/nutritionModel.js';
import type {MealTemplateWithItemRow} from '../models/nutritionRow.js';

export const nutritionMapper = {
    toMealTemplates,
};

export function toMealTemplates(rows: MealTemplateWithItemRow[]): MealTemplate[] {
    const templates = new Map<number, MealTemplate>();

    for (const row of rows) {
        const template = getOrCreateTemplate(templates, row);
        template.items.push(toMealItem(row));
    }

    return Array.from(templates.values());
}

function getOrCreateTemplate(templates: Map<number, MealTemplate>, row: MealTemplateWithItemRow): MealTemplate {
    const existing = templates.get(row.template_id);

    if (existing) {
        return existing;
    }

    const template = new MealTemplate({
        id: row.template_id,
        key: row.template_key,
        active: row.is_active,
        mealType: row.meal_type as MealType,
        title: toLocalizedText(row.title),
        goalTags: toStringArray(row.goal_tags) as GoalTag[],
        dayTags: toStringArray(row.day_tags) as DayTag[],
        items: [],
    });
    templates.set(template.id, template);

    return template;
}

function toMealItem(row: MealTemplateWithItemRow): MealItem {
    return new MealItem({
        id: row.item_id,
        amount: toNumber(row.item_amount),
        unit: row.item_unit as FoodUnit,
        role: row.item_role as MealItemRole,
        adjustable: row.adjustable,
        minAmount: row.min_amount,
        maxAmount: row.max_amount,
        foodDict: toFoodDict(row),
    });
}

function toFoodDict(row: MealTemplateWithItemRow): FoodDict {
    return new FoodDict({
        id: row.food_id,
        key: row.food_key,
        name: toLocalizedText(row.food_name),
        category: row.category as FoodCategory,
        amount: toNumber(row.food_amount),
        unit: row.food_unit as FoodUnit,
        calories: toNumber(row.calories),
        protein: toNumber(row.protein),
        fat: toNumber(row.fat),
        carbs: toNumber(row.carbs),
        mealRoles: toStringArray(row.meal_roles) as MealRole[],
        flags: toStringArray(row.flags),
    });
}

function toLocalizedText(value: unknown): LocalizedText {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return Object.entries(value).reduce<LocalizedText>((localized, [key, text]) => {
        if (typeof text === 'string') {
            localized[key] = text;
        }

        return localized;
    }, {});
}

function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
}

function toNumber(value: string | number): number {
    if (typeof value === 'number') {
        return value;
    }

    return Number(value);
}
