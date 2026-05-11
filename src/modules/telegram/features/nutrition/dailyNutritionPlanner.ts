import {
    GOAL_TAG,
    MEAL_TYPE,
    type DailyNutritionPlan,
    type DailyNutritionPlanMeal,
    type DailyNutritionPlannerRequest,
    type GoalTag,
    type MealType, DailyMacroTargets,
} from './nutritionModel.js';
import {today} from '../../../../shared/utils/dateUtils.js';
import {mealTemplatePicker} from './picker/mealTemplatePicker.js';
import {calculateMacroTargets} from "./macroTargetsCalculator";

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

    const adjustedPlan = draftPlan

    return adjustedPlan
}

async function buildDraftDailyPlan(request: DailyNutritionPlannerRequest): Promise<DailyNutritionPlan> {
    const goal = request.goal ?? GOAL_TAG.MAINTENANCE;
    const targetDate = today();
    const meals: DailyNutritionPlanMeal[] = [];

    for (const mealType of DAILY_MEAL_ORDER) {
        meals.push(await pickDraftMeal(request, mealType, goal));
    }

    return {
        clientId: request.clientId,
        goal,
        dayType: request.dayType,
        targetDate,
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
