import {
    GOAL_TAG,
    MEAL_TYPE,
    type DailyMacroTargets,
    type DailyNutritionPlan,
    type DailyNutritionPlanMeal,
    type DailyNutritionPlannerRequest,
    type GoalTag,
    type MealType,
} from './nutritionModel.js';
import {today} from '../../../../shared/utils/dateUtils.js';
import {mealTemplatePicker} from './picker/mealTemplatePicker.js';
import {calculateMacroTargets} from "./macroTargetsCalculator";
import {adjust} from "./nutritionAdjuster";

const DAILY_MEAL_ORDER = [
    MEAL_TYPE.BREAKFAST,
    MEAL_TYPE.LUNCH,
    MEAL_TYPE.DINNER,
    MEAL_TYPE.SNACK,
] as const;

export const dailyNutritionPlanner = {
    generate,
};

export async function generate(request: DailyNutritionPlannerRequest): Promise<DailyNutritionPlan> {
    //TODO get history of daily plans and pass it to buildDraftDailyPlan

    const draftPlan = await buildDraftDailyPlan(request);
    const dailyMacroTargets = calculateMacroTargets(request);

    const adjustedPlan = await adjust(draftPlan, dailyMacroTargets);

    return adjustedPlan
}

async function buildDraftDailyPlan(request: DailyNutritionPlannerRequest): Promise<DailyNutritionPlan> {
    const goal = request.goal ?? GOAL_TAG.MAINTENANCE;

    const meals: DailyNutritionPlanMeal[] = [];

    for (const mealType of DAILY_MEAL_ORDER) {
        meals.push(await pickDraftMeal(request, mealType, goal));
    }

    const draftPlan = initDraftPlan(request, goal, meals);

    return {
        ...draftPlan,
        totals: calculatePlanTotals(draftPlan),
    };
}

function initDraftPlan(
    request: DailyNutritionPlannerRequest,
    goal: GoalTag,
    meals: DailyNutritionPlanMeal[]
): DailyNutritionPlan {
    const targetDate = today();
    return {
        clientId: request.clientId,
        goal,
        dayType: request.dayType,
        targetDate,
        totals: {
            calories: 0,
            protein: 0,
            fat: 0,
            carbs: 0,
        },
        meals,
    };
}

async function pickDraftMeal(
    request: DailyNutritionPlannerRequest,
    mealType: MealType,
    goal: GoalTag
): Promise<DailyNutritionPlanMeal> {
    const result = await mealTemplatePicker.pickMealTemplate({
        clientId: request.clientId,
        mealType,
        goal,
        dayType: request.dayType,
    });

    return {
        mealType,
        template: result.template,
        fallbackLevel: result.fallbackLevel,
        reason: result.reason,
        score: result.score,
    };
}

function calculatePlanTotals(plan: DailyNutritionPlan): DailyMacroTargets {
    const totals = {
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
    };

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

function hasValidMacros(item: DailyNutritionPlanMeal['template']['items'][number]): boolean {
    return Number.isFinite(item.amount) &&
        Number.isFinite(item.foodDict.amount) &&
        item.foodDict.amount > 0 &&
        Number.isFinite(item.foodDict.calories) &&
        Number.isFinite(item.foodDict.protein) &&
        Number.isFinite(item.foodDict.fat) &&
        Number.isFinite(item.foodDict.carbs);
}
