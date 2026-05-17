import {
    GOAL_TAG,
    MEAL_TYPE,
    type DailyNutritionPlan,
    type DailyNutritionPlanMeal,
    type DailyNutritionPlannerRequest,
    type GoalTag,
    type MealType,
} from './nutritionModel.js';
import {today} from '../../../../shared/utils/dateUtils.js';
import {log} from '../../../../shared/logging';
import {mealTemplatePicker} from './picker/mealTemplatePicker.js';
import {calculateMacroTargets} from "./macroTargetsCalculator";
import {adjust} from "./nutritionAdjuster";
import {calculatePlanTotals} from './planMacroTotals.js';

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
    log('### DAILY_NUTRITION_PLANNER:generate:request', request);

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

function initDraftPlan(request: DailyNutritionPlannerRequest,
                       goal: GoalTag,
                       meals: DailyNutritionPlanMeal[]): DailyNutritionPlan {
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

async function pickDraftMeal(request: DailyNutritionPlannerRequest,
                             mealType: MealType,
                             goal: GoalTag): Promise<DailyNutritionPlanMeal> {
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
