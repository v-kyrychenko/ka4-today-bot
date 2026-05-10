import {
    ACTIVITY_LEVEL,
    ActivityLevel,
    DailyMacroTargets,
    DailyNutritionPlannerRequest, DAY_TAG, DayTag,
    GOAL_TAG,
    GoalTag,
} from './nutritionModel';
import {BodyMeasurement} from '../measurements/bodyMeasurementsModel';
import {CLIENT_GENDERS, ClientGender,} from "../../../coach/client/domain/client";
import {calculateAge} from "../../../../shared/utils/dateUtils";

const DEFAULT_GOAL: GoalTag = GOAL_TAG.MAINTENANCE;

/**
 * Mifflin-St Jeor BMR gender constants.
 *
 * Gender affects estimated energy needs through BMR/TDEE.
 * Protein targets are still calculated from body weight and goal.
 */
const BMR_GENDER_ADJUSTMENT = {
    [CLIENT_GENDERS.MALE]: 5,
    [CLIENT_GENDERS.FEMALE]: -161,
    [CLIENT_GENDERS.UNKNOWN]: -78,
} satisfies Record<ClientGender, number>;

/**
 * Physical activity factors used to estimate TDEE from BMR.
 *
 * These values describe the user's general daily activity level, not only
 * whether a workout exists on a specific day.
 */
const ACTIVITY_FACTOR = {
    [ACTIVITY_LEVEL.INACTIVE]: 1.2,
    [ACTIVITY_LEVEL.LOW_ACTIVE]: 1.375,
    [ACTIVITY_LEVEL.ACTIVE]: 1.55,
    [ACTIVITY_LEVEL.VERY_ACTIVE]: 1.725,
} satisfies Record<ActivityLevel, number>;

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
 * Goal adjustment is applied after maintenance calories are estimated.
 *
 * Maintenance keeps calories unchanged, fat loss uses a moderate deficit,
 * and muscle gain uses a conservative surplus.
 */
const GOAL_CALORIE_ADJUSTMENT = {
    [GOAL_TAG.MAINTENANCE]: 0,
    [GOAL_TAG.FAT_LOSS]: -0.15,
    [GOAL_TAG.MUSCLE_GAIN]: 0.1,
} satisfies Record<GoalTag, number>;

/**
 * Day type is intentionally neutral in calorie calculation for now.
 *
 * Activity level already affects TDEE, so applying an additional training/rest
 * calorie multiplier may double-count exercise. Day type can later be used by
 * the adjuster to redistribute carbohydrates between training and rest days.
 */
const DAY_TYPE_CALORIE_ADJUSTMENT = {
    [DAY_TAG.REST_DAY]: 0,
    [DAY_TAG.TRAINING_DAY]: 0,
} satisfies Record<DayTag, number>;

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

interface BmrParams {
    gender: ClientGender;
    age: number;
    weightKg: number;
    heightCm: number;
}

interface TargetCaloriesParams extends BmrParams {
    activityLevel: ActivityLevel;
    dayType: DayTag;
    goal: GoalTag;
}

export function calculateMacroTargets(request: DailyNutritionPlannerRequest): DailyMacroTargets {
    const goal = request.goal ?? DEFAULT_GOAL;
    const weightKg = getWeightKg(request.weight);
    const age = calculateAge(request.birthday);
    const calories = calculateTargetCalories({
        gender: request.gender,
        age,
        weightKg,
        heightCm: request.height,
        activityLevel: request.activityLevel,
        dayType: request.dayType,
        goal,
    });

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

function calculateTargetCalories(params: TargetCaloriesParams): number {
    const bmr = calculateBmrKcal(params);
    const maintenanceCalories = Math.round(bmr * ACTIVITY_FACTOR[params.activityLevel]);
    const goalMultiplier = 1 + GOAL_CALORIE_ADJUSTMENT[params.goal];
    const dayMultiplier = 1 + DAY_TYPE_CALORIE_ADJUSTMENT[params.dayType];

    return Math.round(maintenanceCalories * goalMultiplier * dayMultiplier);
}

function calculateBmrKcal(params: BmrParams): number {
    const base = 10 * params.weightKg + 6.25 * params.heightCm - 5 * params.age;
    const genderAdjustment = getBmrGenderAdjustment(params.gender);

    return Math.round(base + genderAdjustment);
}

function getBmrGenderAdjustment(gender: ClientGender): number {
    return BMR_GENDER_ADJUSTMENT[gender] ?? BMR_GENDER_ADJUSTMENT[CLIENT_GENDERS.UNKNOWN];
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