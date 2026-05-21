import {edamamClient} from '../../../../infrastructure/integrations/edamam/edamamClient.js';
import type {
    EdamamMealPlannerSelectRequest,
    EdamamNutrientRange
} from '../../../../infrastructure/integrations/edamam/types.js';
import {log} from '../../../../shared/logging';
import {calculateMacroTargets} from './macroTargetsCalculator';
import type {DailyMacroTargets, DailyNutritionPlannerRequest} from './nutritionModel';

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

export const edamamDailyPlanner = {
    generate,
};

export async function generate(request: DailyNutritionPlannerRequest): Promise<null> {
    log('### EDAMAM_DAILY_PLANNER:generate:request', request);

    const dailyMacroTargets = calculateMacroTargets(request);
    log('### EDAMAM_DAILY_PLANNER:generate:dailyMacroTargets', dailyMacroTargets);
    const mealPlannerRequest = buildMealPlannerRequest(dailyMacroTargets);
    await edamamClient.selectMealPlan(mealPlannerRequest);

    return null;
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
