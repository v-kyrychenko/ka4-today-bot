import {
    DailyMacroTargets,
    DailyNutritionPlannerRequest,
    GOAL_TAG,
    GoalTag,
} from './nutritionModel';
import {BodyMeasurement} from '../measurements/bodyMeasurementsModel';

const DEFAULT_GOAL: GoalTag = GOAL_TAG.MAINTENANCE;

/**
 * V1 uses weight-based calorie estimates instead of BMR/TDEE.
 *
 * This keeps Adaptive Daily Nutrition Planning simple and deterministic while
 * height, activity level, and detailed expenditure tracking are not available.
 *
 * These values are planning defaults, not clinical maintenance calculations.
 * They should be adjusted later by observed progress signals such as weight,
 * waist trend, training day energy, and user feedback.
 */
const CALORIES_PER_KG_BY_GOAL = {
    [GOAL_TAG.MAINTENANCE]: 32,
    [GOAL_TAG.FAT_LOSS]: 28,
    [GOAL_TAG.MUSCLE_GAIN]: 36,
} satisfies Record<GoalTag, number>;

/**
 * Protein is calculated from body weight because it is the primary stable
 * training nutrition target.
 *
 * Gender is intentionally not used here. It affects estimated energy needs
 * mostly through BMR/TDEE, but protein targets are commonly expressed as
 * grams per kilogram of body weight for active people.
 */
const PROTEIN_PER_KG_BY_GOAL = {
    [GOAL_TAG.MAINTENANCE]: 1.6,
    [GOAL_TAG.FAT_LOSS]: 1.8,
    [GOAL_TAG.MUSCLE_GAIN]: 1.6,
} satisfies Record<GoalTag, number>;

/**
 * Fat is set as a moderate share of planning calories.
 *
 * In V1, fat is treated as a guardrail for dietary balance, while carbohydrates
 * absorb the remaining calories and become the main adjustment lever.
 */
const FAT_TARGET_PERCENT = 0.25;

/**
 * Standard Atwater factors used to estimate metabolizable energy.
 */
const NUTRITION_ENERGY = {
    kcalPerGram: {
        protein: 4,
        carbs: 4,
        fat: 9,
    },
} as const;

export function calculateDailyNutritionPlan(request: DailyNutritionPlannerRequest): DailyMacroTargets {
    const goal = request.goal ?? DEFAULT_GOAL;
    const weightKg = getWeightKg(request.weight);
    const calories = calculatePlanningCalories(weightKg, goal);
    const protein = calculateProteinTargetG(weightKg, goal);
    const fat = calculateFatTargetG(calories);
    const carbs = calculateRemainingCarbsG(calories, protein, fat);

    return {
        calories,
        protein,
        fat,
        carbs,
    };
}

function calculatePlanningCalories(weightKg: number, goal: GoalTag): number {
    return Math.round(weightKg * CALORIES_PER_KG_BY_GOAL[goal]);
}

function calculateProteinTargetG(weightKg: number, goal: GoalTag): number {
    return Math.round(weightKg * PROTEIN_PER_KG_BY_GOAL[goal]);
}

function calculateFatTargetG(calories: number): number {
    return Math.round((calories * FAT_TARGET_PERCENT) / NUTRITION_ENERGY.kcalPerGram.fat);
}

function calculateRemainingCarbsG(calories: number, proteinG: number, fatG: number): number {
    const proteinKcal = proteinG * NUTRITION_ENERGY.kcalPerGram.protein;
    const fatKcal = fatG * NUTRITION_ENERGY.kcalPerGram.fat;
    const remainingCalories = calories - proteinKcal - fatKcal;

    // Carbohydrates are the flexible energy lever after protein and fat targets are fixed.
    return Math.max(0, Math.round(remainingCalories / NUTRITION_ENERGY.kcalPerGram.carbs));
}

function getWeightKg(weight: BodyMeasurement): number {
    if (weight.unitKey !== 'kg') {
        throw new Error(`Unsupported weight unit: ${weight.unitKey}`);
    }

    return weight.amount;
}
