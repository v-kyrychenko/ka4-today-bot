import type {ClientGender} from '../../../coach/client/domain/client.js';
import type {BodyMeasurement} from '../measurements/bodyMeasurementsModel.js';

export type LocalizedText = Record<string, string>;

/**
 * Physical activity level used for estimating daily energy needs.
 *
 * These values describe the user's general daily activity level, not only
 * whether a workout exists on a specific day.
 */
export const ACTIVITY_LEVEL = {
    /**
     * Mostly sedentary day with little planned movement.
     * Example: desk work, minimal walking, no structured exercise.
     */
    INACTIVE: 'inactive',

    /**
     * Light daily movement.
     * Example: desk work with some walking or light household activity.
     */
    LOW_ACTIVE: 'low_active',

    /**
     * Regular daily movement or a typical training day.
     * Example: gym training, regular walking, or moderately active routine.
     */
    ACTIVE: 'active',

    /**
     * High daily movement or physically demanding day.
     * Example: physical job, long cardio/endurance session, or very high step count.
     */
    VERY_ACTIVE: 'very_active',
} as const;
export type ActivityLevel = typeof ACTIVITY_LEVEL[keyof typeof ACTIVITY_LEVEL];

export const MEAL_TYPE = {
    BREAKFAST: 'breakfast',
    LUNCH: 'lunch',
    DINNER: 'dinner',
    SNACK: 'snack',
} as const;
export type MealType = typeof MEAL_TYPE[keyof typeof MEAL_TYPE];

export const GOAL_TAG = {
    FAT_LOSS: 'fat_loss',
    MAINTENANCE: 'maintenance',
    MUSCLE_GAIN: 'muscle_gain',
} as const;
export type GoalTag = typeof GOAL_TAG[keyof typeof GOAL_TAG];

export const DAY_TAG = {
    TRAINING_DAY: 'training_day',
    REST_DAY: 'rest_day',
} as const;
export type DayTag = typeof DAY_TAG[keyof typeof DAY_TAG];

export interface DailyNutritionPlannerRequest {
    clientId: number;
    gender: ClientGender;
    birthday: string;
    goal?: GoalTag | null;
    weight: BodyMeasurement;
    height: number;
    activityLevel: ActivityLevel;
    dayType: DayTag;
}

export interface DailyMacroTargets {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
}

export interface TelegramMealView {
    title: string;
    subtitle: string;
    targetDate: string;
    totals: DailyMacroTargets;
    meals: TelegramMealViewMeal[];
}

export interface TelegramMealViewMeal {
    mealType: MealType;
    title: string;
    originalTitle: string;
    mainIngredients: TelegramMealIngredient[];
    additionalIngredients: TelegramMealAdditionalIngredients;
}

export interface TelegramMealIngredient {
    name: string;
    amount: number;
    unit: 'г';
}

export interface TelegramMealAdditionalIngredients {
    label: string;
    items: string[];
}

export interface DailyNutritionPlan {
    totals: DailyMacroTargets;
    meals: DailyNutritionPlanMeal[];
}

export interface DailyNutritionPlanMeal {
    template: {
        items: Array<{
            amount: number;
            foodDict: {
                amount: number;
                calories: number;
                protein: number;
                fat: number;
                carbs: number;
            };
        }>;
    };
}

export interface BmrParams {
    gender: ClientGender;
    age: number;
    weightKg: number;
    heightCm: number;
}

export interface TargetCaloriesParams extends BmrParams {
    activityLevel: ActivityLevel;
    dayType: DayTag;
    goal: GoalTag;
}
