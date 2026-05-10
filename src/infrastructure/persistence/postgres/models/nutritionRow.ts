import type {MealItemRole} from '../../../../modules/telegram/features/nutrition/nutritionModel.js';

export interface MealTemplateWithItemRow {
    template_id: number;
    template_key: string;
    is_active: boolean;
    meal_type: string;
    title: unknown;
    goal_tags: unknown;
    day_tags: unknown;
    item_id: number;
    item_amount: string | number;
    item_unit: string;
    item_role: MealItemRole;
    adjustable: boolean;
    min_amount: number | null;
    max_amount: number | null;
    food_id: number;
    food_key: string;
    food_name: unknown;
    category: string;
    food_amount: string | number;
    food_unit: string;
    calories: string | number;
    protein: string | number;
    fat: string | number;
    carbs: string | number;
    meal_roles: unknown;
    flags: unknown;
}
