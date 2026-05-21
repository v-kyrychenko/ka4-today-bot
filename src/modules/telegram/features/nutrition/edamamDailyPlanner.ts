import {edamamClient} from '../../../../infrastructure/integrations/edamam/edamamClient.js';
import type {
    EdamamMealPlannerSelectRequest,
    EdamamMealPlannerSelectResponse,
    EdamamNutrientRange,
    EdamamRecipe
} from '../../../../infrastructure/integrations/edamam/types.js';
import {log} from '../../../../shared/logging';
import {calculateMacroTargets} from './macroTargetsCalculator';
import {MEAL_TYPE, type DailyMacroTargets, type DailyNutritionPlannerRequest, type MealType} from './nutritionModel';

const MACRO_TOLERANCE = {
    CALORIES: 0.08,
    PROTEIN: 0.15,
    FAT: 0.25,
    CARBS: 0.20,
} as const;

const MEAL_CALORIE_SPLIT = {
    BREAKFAST: {
        min: 0.25,
        max: 0.30,
    },
    LUNCH: {
        min: 0.35,
        max: 0.40,
    },
    DINNER: {
        min: 0.30,
        max: 0.35,
    },
} as const;

const EDAMAM_SECTION_MEAL_TYPE: Record<string, MealType> = {
    Breakfast: MEAL_TYPE.BREAKFAST,
    Lunch: MEAL_TYPE.LUNCH,
    Dinner: MEAL_TYPE.DINNER,
};

export const edamamDailyPlanner = {
    generate,
};

export async function generate(request: DailyNutritionPlannerRequest): Promise<null> {
    log('### EDAMAM_DAILY_PLANNER:generate:request', request);

    const dailyMacroTargets = calculateMacroTargets(request);
    log('### EDAMAM_DAILY_PLANNER:generate:dailyMacroTargets', dailyMacroTargets);
    const mealPlannerRequest = buildMealPlannerRequest(dailyMacroTargets);
    const mealPlan = await edamamClient.selectMealPlan(mealPlannerRequest);
    const recipesByMealType = await fetchRecipesByMealType(mealPlan);
    log('### EDAMAM_DAILY_PLANNER:generate:recipesByMealType', Array.from(recipesByMealType.keys()));

    return null;
}

async function fetchRecipesByMealType(mealPlan: EdamamMealPlannerSelectResponse): Promise<Map<MealType, EdamamRecipe>> {
    const recipeRequests = buildRecipeRequests(mealPlan);

    const recipes = await Promise.all(recipeRequests
        .map(async (request) => {
            const response = await edamamClient.getRecipe(request.recipeHref);
            return {
                mealType: request.mealType,
                recipe: response.recipe,
            };
        }));

    return new Map(recipes
        .map((item) => [item.mealType, item.recipe]));
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

function buildMealPlannerRequest(dailyMacroTargets: DailyMacroTargets): EdamamMealPlannerSelectRequest {
    return {
        size: 1,
        plan: {
            fit: buildDailyFit(dailyMacroTargets),
            sections: buildSections(dailyMacroTargets.calories),
        },
    };
}

type EdamamMealPlannerFit = EdamamMealPlannerSelectRequest['plan']['fit'];

function buildDailyFit(dailyMacroTargets: DailyMacroTargets): EdamamMealPlannerFit {
    return {
        ENERC_KCAL: buildMacroRange(dailyMacroTargets.calories, MACRO_TOLERANCE.CALORIES),
        PROCNT: buildMacroRange(dailyMacroTargets.protein, MACRO_TOLERANCE.PROTEIN),
        FAT: buildMacroRange(dailyMacroTargets.fat, MACRO_TOLERANCE.FAT),
        CHOCDF: buildMacroRange(dailyMacroTargets.carbs, MACRO_TOLERANCE.CARBS),
    };
}

function buildMacroRange(max: number, tolerance: number): EdamamNutrientRange {
    return {
        min: Math.round(max * (1 - tolerance)),
        max,
    };
}

type EdamamMealPlannerSections = EdamamMealPlannerSelectRequest['plan']['sections'];

function buildSections(calories: number): EdamamMealPlannerSections {
    return {
        Breakfast: {
            fit: {
                ENERC_KCAL: buildMealCaloriesRange(calories, MEAL_CALORIE_SPLIT.BREAKFAST),
            },
        },
        Lunch: {
            fit: {
                ENERC_KCAL: buildMealCaloriesRange(calories, MEAL_CALORIE_SPLIT.LUNCH),
            },
        },
        Dinner: {
            fit: {
                ENERC_KCAL: buildMealCaloriesRange(calories, MEAL_CALORIE_SPLIT.DINNER),
            },
        },
    };
}

function buildMealCaloriesRange(calories: number, split: EdamamNutrientRange): EdamamNutrientRange {
    return {
        min: Math.round(calories * split.min),
        max: Math.round(calories * split.max),
    };
}
