import type {DailyMacroTargets, DailyNutritionPlan, DailyNutritionPlanMeal} from './nutritionModel.js';

const EMPTY_MACRO_VALUE = 0;

type MealItem = DailyNutritionPlanMeal['template']['items'][number];

export function calculatePlanTotals(plan: DailyNutritionPlan): DailyMacroTargets {
    const totals = createEmptyTotals();

    for (const meal of plan.meals) {
        for (const item of meal.template.items) {
            if (!hasValidMacros(item)) {
                continue;
            }

            const amountRatio = item.amount / item.foodDict.amount;
            totals.calories += item.foodDict.calories * amountRatio;
            totals.protein += item.foodDict.protein * amountRatio;
            totals.fat += item.foodDict.fat * amountRatio;
            totals.carbs += item.foodDict.carbs * amountRatio;
        }
    }

    return {
        calories: Math.round(totals.calories),
        protein: Math.round(totals.protein),
        fat: Math.round(totals.fat),
        carbs: Math.round(totals.carbs),
    };
}

export function hasValidMacros(item: MealItem): boolean {
    return Number.isFinite(item.amount) &&
        Number.isFinite(item.foodDict.amount) &&
        item.foodDict.amount > EMPTY_MACRO_VALUE &&
        Number.isFinite(item.foodDict.calories) &&
        Number.isFinite(item.foodDict.protein) &&
        Number.isFinite(item.foodDict.fat) &&
        Number.isFinite(item.foodDict.carbs);
}

function createEmptyTotals(): DailyMacroTargets {
    return {
        calories: EMPTY_MACRO_VALUE,
        protein: EMPTY_MACRO_VALUE,
        fat: EMPTY_MACRO_VALUE,
        carbs: EMPTY_MACRO_VALUE,
    };
}
