import {edamamClient} from '../../../../infrastructure/integrations/edamam/edamamClient.js';
import type {EdamamMealPlannerSelectResponse} from '../../../../infrastructure/integrations/edamam/types.js';
import {log} from '../../../../shared/logging';
import {buildMealPlannerRequest} from './edamamRequestBuilder.js';
import {buildDailyNutritionPlan, type EdamamSelectedRecipe} from './edamamResponceMapper.js';
import {calculateMacroTargets} from './macroTargetsCalculator';
import {
    MEAL_TYPE,
    type DailyNutritionPlannerRequest,
    type MealType,
    type TelegramMealView
} from './nutritionModel';

const EDAMAM_SECTION_MEAL_TYPE: Record<string, MealType> = {
    Breakfast: MEAL_TYPE.BREAKFAST,
    Lunch: MEAL_TYPE.LUNCH,
    Dinner: MEAL_TYPE.DINNER,
};

export const edamamDailyPlanner = {
    generate,
};

export async function generate(request: DailyNutritionPlannerRequest): Promise<TelegramMealView> {
    log('### EDAMAM_DAILY_PLANNER:generate:request', request);

    const dailyMacroTargets = calculateMacroTargets(request);
    log('### EDAMAM_DAILY_PLANNER:generate:dailyMacroTargets', dailyMacroTargets);
    const mealPlannerRequest = buildMealPlannerRequest(dailyMacroTargets);
    const mealPlan = await edamamClient.selectMealPlan(mealPlannerRequest);
    const recipesByMealType = await fetchRecipesByMealType(mealPlan);
    log('### EDAMAM_DAILY_PLANNER:generate:recipesByMealType', Array.from(recipesByMealType.keys()));

    const plan = buildDailyNutritionPlan(request, recipesByMealType);
    log('### EDAMAM_DAILY_PLANNER:generate:result', JSON.stringify(plan));
    return plan
}

async function fetchRecipesByMealType(mealPlan: EdamamMealPlannerSelectResponse): Promise<Map<MealType, EdamamSelectedRecipe>> {
    const recipeRequests = buildRecipeRequests(mealPlan);

    const recipes = await Promise.all(recipeRequests
        .map(async (request) => {
            const response = await edamamClient.getRecipe(request.recipeHref);
            return {
                mealType: request.mealType,
                selectedRecipe: {
                    recipeKey: response._links.self.href ?? request.recipeHref,
                    recipe: response.recipe,
                },
            };
        }));

    return new Map(recipes
        .map((item) => [item.mealType, item.selectedRecipe]));
}

interface EdamamRecipeRequest {
    mealType: MealType;
    recipeHref: string;
}

function buildRecipeRequests(mealPlan: EdamamMealPlannerSelectResponse): EdamamRecipeRequest[] {
    return mealPlan.selection
        .flatMap((selection) => {
            return Object
                .entries(selection.sections)
                .map(([sectionName, section]) => {
                    return {
                        mealType: EDAMAM_SECTION_MEAL_TYPE[sectionName],
                        recipeHref: section._links.self.href,
                    };
                });
        })
        .filter((request): request is EdamamRecipeRequest => Boolean(request.mealType));
}
