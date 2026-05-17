import {
    ACTIVITY_LEVEL,
    ActivityLevel, BmrParams,
    DailyMacroTargets,
    DailyNutritionPlannerRequest, DAY_TAG, DayTag,
    GOAL_TAG,
    GoalTag, TargetCaloriesParams,
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
    [ACTIVITY_LEVEL.LOW_ACTIVE]: 1.3,
    [ACTIVITY_LEVEL.ACTIVE]: 1.45,
    [ACTIVITY_LEVEL.VERY_ACTIVE]: 1.7,
} satisfies Record<ActivityLevel, number>;

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
    [GOAL_TAG.MAINTENANCE]: 1.7,
    [GOAL_TAG.FAT_LOSS]: 1.8,
    [GOAL_TAG.MUSCLE_GAIN]: 1.6,
} satisfies Record<GoalTag, number>;

const FAT_PER_KG_BY_GOAL = {
    [GOAL_TAG.MAINTENANCE]: 0.9,
    [GOAL_TAG.FAT_LOSS]: 0.8,
    [GOAL_TAG.MUSCLE_GAIN]: 1.0,
} satisfies Record<GoalTag, number>;

const CARBS_PER_KG_LIMIT_BY_GOAL_AND_DAY = {
    [GOAL_TAG.MAINTENANCE]: {
        [DAY_TAG.REST_DAY]: {
            min: 1.8,
            max: 2.6,
        },
        [DAY_TAG.TRAINING_DAY]: {
            min: 2.2,
            max: 3.2,
        },
    },
    [GOAL_TAG.FAT_LOSS]: {
        [DAY_TAG.REST_DAY]: {
            min: 1.4,
            max: 2.2,
        },
        [DAY_TAG.TRAINING_DAY]: {
            min: 1.8,
            max: 2.8,
        },
    },
    [GOAL_TAG.MUSCLE_GAIN]: {
        [DAY_TAG.REST_DAY]: {
            min: 2.8,
            max: 3.8,
        },
        [DAY_TAG.TRAINING_DAY]: {
            min: 3.4,
            max: 4.6,
        },
    },
} satisfies Record<GoalTag, Record<DayTag, { min: number; max: number }>>;

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

export function calculateMacroTargets(request: DailyNutritionPlannerRequest): DailyMacroTargets {
    const goal = request.goal ?? DEFAULT_GOAL;
    const weightKg = getWeightKg(request.weight);
    const age = calculateAge(request.birthday);
    const activity = request.activityLevel;
    const dayType = request.dayType;
    const targetCalories = calculateTargetCalories({
        gender: request.gender,
        age,
        weightKg,
        heightCm: request.height,
        activityLevel: activity,
        dayType: dayType,
        goal,
    });

    const protein = calculateProteinTarget(weightKg, goal);
    const fat = calculateFatTarget(weightKg, goal);
    const carbs = calculateCarbsTarget(targetCalories, protein, fat, weightKg, goal, dayType, activity);
    const calories = calculateCaloriesFromMacros(protein, fat, carbs);

    return {
        calories,
        protein,
        fat,
        carbs,
    };
}

function calculateCaloriesFromMacros(protein: number, fat: number, carbs: number): number {
    const proteinKcal = protein * NUTRITION_ENERGY.kcalPerGram.protein;
    const fatKcal = fat * NUTRITION_ENERGY.kcalPerGram.fat;
    const carbsKcal = carbs * NUTRITION_ENERGY.kcalPerGram.carbs;

    return proteinKcal + fatKcal + carbsKcal;
}

function calculateCarbsTarget(
    targetCalories: number,
    protein: number,
    fat: number,
    weightKg: number,
    goal: GoalTag,
    dayType: DayTag,
    activityLevel: ActivityLevel,
): number {
    const remainingCarbs = calculateRemainingCarbs(targetCalories, protein, fat);
    const limits = CARBS_PER_KG_LIMIT_BY_GOAL_AND_DAY[goal][dayType];
    const minCarbs = Math.round(weightKg * limits.min);
    const maxCarbs = calculateMaxCarbs(weightKg, limits.max, activityLevel);

    return clamp(remainingCarbs, minCarbs, maxCarbs);
}

function calculateMaxCarbs(weightKg: number, baseMaxPerKg: number, activityLevel: ActivityLevel): number {
    const adjustment = calculateActivityCarbLimitAdjustment(activityLevel);
    const adjustedMaxPerKg = baseMaxPerKg + adjustment;

    return Math.round(weightKg * adjustedMaxPerKg);
}

function calculateActivityCarbLimitAdjustment(activityLevel: ActivityLevel): number {
    const baselineActivityFactor = ACTIVITY_FACTOR[ACTIVITY_LEVEL.LOW_ACTIVE];
    const activityFactor = ACTIVITY_FACTOR[activityLevel];

    return Math.max(0, activityFactor - baselineActivityFactor) * 2;
}

function calculateRemainingCarbs(targetCalories: number, protein: number, fat: number): number {
    const proteinKcal = protein * NUTRITION_ENERGY.kcalPerGram.protein;
    const fatKcal = fat * NUTRITION_ENERGY.kcalPerGram.fat;
    const remainingCalories = targetCalories - proteinKcal - fatKcal;

    return Math.max(0, Math.round(remainingCalories / NUTRITION_ENERGY.kcalPerGram.carbs));
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function calculateTargetCalories(params: TargetCaloriesParams): number {
    const bmr = calculateBmrKcal(params);
    const maintenanceCalories = Math.round(bmr * ACTIVITY_FACTOR[params.activityLevel]);
    const goalMultiplier = 1 + GOAL_CALORIE_ADJUSTMENT[params.goal];
    const dayMultiplier = 1 + DAY_TYPE_CALORIE_ADJUSTMENT[params.dayType];

    return Math.round(maintenanceCalories * goalMultiplier * dayMultiplier);
}

function calculateBmrKcal(params: BmrParams): number {
    // Mifflin-St Jeor weight coefficient: 10 kcal per kg.
    const weightKcalPerKg = 10;
    // Mifflin-St Jeor height coefficient: 6.25 kcal per cm.
    const heightKcalPerCm = 6.25;
    // Mifflin-St Jeor age coefficient: subtract 5 kcal per year.
    const ageKcalPerYear = 5;

    const base =
        weightKcalPerKg * params.weightKg +
        heightKcalPerCm * params.heightCm -
        ageKcalPerYear * params.age;

    const genderAdjustment = getBmrGenderAdjustment(params.gender);

    return Math.round(base + genderAdjustment);
}

function getBmrGenderAdjustment(gender: ClientGender): number {
    return BMR_GENDER_ADJUSTMENT[gender] ?? BMR_GENDER_ADJUSTMENT[CLIENT_GENDERS.UNKNOWN];
}

function calculateProteinTarget(weightKg: number, goal: GoalTag): number {
    return Math.round(weightKg * PROTEIN_PER_KG_BY_GOAL[goal]);
}

function calculateFatTarget(weightKg: number, goal: GoalTag): number {
    return Math.round(weightKg * FAT_PER_KG_BY_GOAL[goal]);
}

function getWeightKg(weight: BodyMeasurement): number {
    if (weight.unitKey !== 'kg') {
        throw new Error(`Unsupported weight unit: ${weight.unitKey}`);
    }

    return weight.amount;
}
