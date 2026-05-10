import {
    MEAL_TYPE,
    type DailyNutritionPlan,
    type DailyNutritionPlanMeal,
    type DailyNutritionPlannerRequest,
    type MealType,
} from './nutritionModel.js';
import {today} from '../../../../shared/utils/dateUtils.js';
import {mealTemplatePicker} from './picker/mealTemplatePicker.js';

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
    return buildDraftDailyPlan(request);
}

async function buildDraftDailyPlan(request: DailyNutritionPlannerRequest): Promise<DailyNutritionPlan> {
    const targetDate = request.targetDate ?? today();
    const meals = await pickDraftMeals(request, targetDate);

    return {
        clientId: request.clientId,
        goal: request.goal,
        dayType: request.dayType,
        targetDate,
        meals,
    };
}

async function pickDraftMeals(
    request: DailyNutritionPlannerRequest,
    targetDate: string
): Promise<DailyNutritionPlanMeal[]> {
    const meals: DailyNutritionPlanMeal[] = [];

    for (const mealType of DAILY_MEAL_ORDER) {
        meals.push(await pickDraftMeal(request, mealType, targetDate));
    }

    return meals;
}

async function pickDraftMeal(
    request: DailyNutritionPlannerRequest,
    mealType: MealType,
    targetDate: string
): Promise<DailyNutritionPlanMeal> {
    const result = await mealTemplatePicker.pickMealTemplate({
        clientId: request.clientId,
        mealType,
        goal: request.goal,
        dayType: request.dayType,
        targetDate,
        exclusions: request.exclusions,
        preferences: request.preferences,
        recentTemplates: request.recentTemplates,
        config: request.config,
        random: request.random,
    });

    return {
        mealType,
        template: result.template,
        fallbackLevel: result.fallbackLevel,
        reason: result.reason,
        score: result.score,
    };
}

// TODO: Decide whether goal/dayType should always be passed by callers or derived here from client goals/training schedule.
// TODO: Add calorie and macro targets when the product rules for age, gender, weight, and activity are confirmed.
// TODO: Expand selected templates into concrete food portions after portion-scaling rules are clear.
// TODO: Persist the accepted daily plan once the storage model for generated nutrition plans exists.
