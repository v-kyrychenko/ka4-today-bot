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

export type FoodCategory =
    | 'protein'
    | 'protein_fat'
    | 'carb'
    | 'fat'
    | 'vegetable'
    | 'carb_protein'
    | 'carb_fat';

export type FoodUnit = 'g' | 'pcs';
export type MealRole = MealType;
export const MEAL_ITEM_ROLE = {
    BREAKFAST_CARB: 'breakfast_carb',
    CARB: 'carb',
    CARB_FAT: 'carb_fat',
    CARB_PROTEIN: 'carb_protein',
    FAT: 'fat',
    FLAVOR_FAT: 'flavor_fat',
    HEALTHY_FAT: 'healthy_fat',
    LIGHT_CARB: 'light_carb',
    MAIN_PROTEIN: 'main_protein',
    PROTEIN_BOOSTER: 'protein_booster',
    PROTEIN_FAT: 'protein_fat',
    QUICK_CARB: 'quick_carb',
    TRAINING_CARB: 'training_carb',
    VEGETABLE: 'vegetable',
} as const;
export type MealItemRole = typeof MEAL_ITEM_ROLE[keyof typeof MEAL_ITEM_ROLE];

export const PROTEIN_ITEM_ROLES: ReadonlySet<string> = new Set([
    MEAL_ITEM_ROLE.MAIN_PROTEIN,
    MEAL_ITEM_ROLE.PROTEIN_BOOSTER,
    MEAL_ITEM_ROLE.PROTEIN_FAT,
    MEAL_ITEM_ROLE.CARB_PROTEIN,
]);
export const PROTEIN_FOOD_CATEGORIES: ReadonlySet<string> = new Set(['protein', 'protein_fat', 'carb_protein']);

export const CARB_ITEM_ROLES: ReadonlySet<string> = new Set([
    MEAL_ITEM_ROLE.BREAKFAST_CARB,
    MEAL_ITEM_ROLE.CARB,
    MEAL_ITEM_ROLE.CARB_FAT,
    MEAL_ITEM_ROLE.CARB_PROTEIN,
    MEAL_ITEM_ROLE.LIGHT_CARB,
    MEAL_ITEM_ROLE.QUICK_CARB,
    MEAL_ITEM_ROLE.TRAINING_CARB,
]);
export const CARB_FOOD_CATEGORIES: ReadonlySet<string> = new Set(['carb', 'carb_protein', 'carb_fat']);

export const FAT_ITEM_ROLES: ReadonlySet<string> = new Set([
    MEAL_ITEM_ROLE.FAT,
    MEAL_ITEM_ROLE.FLAVOR_FAT,
    MEAL_ITEM_ROLE.HEALTHY_FAT,
    MEAL_ITEM_ROLE.PROTEIN_FAT,
    MEAL_ITEM_ROLE.CARB_FAT,
]);
export const FAT_FOOD_CATEGORIES: ReadonlySet<string> = new Set(['fat', 'protein_fat', 'carb_fat']);

export class FoodDict {
    id = 0;
    key = '';
    name: LocalizedText = {};
    category: FoodCategory = 'protein';
    amount = 0;
    unit: FoodUnit = 'g';
    calories = 0;
    protein = 0;
    fat = 0;
    carbs = 0;
    mealRoles: MealRole[] = [];
    flags: string[] = [];

    constructor(init?: Partial<FoodDict>) {
        Object.assign(this, init);
        this.name = init?.name ?? {};
        this.mealRoles = init?.mealRoles ?? [];
        this.flags = init?.flags ?? [];
    }
}

export class MealItem {
    id = 0;
    amount = 0;
    unit: FoodUnit = 'g';
    role: MealItemRole = MEAL_ITEM_ROLE.MAIN_PROTEIN;
    adjustable = true;
    minAmount: number | null = null;
    maxAmount: number | null = null;
    foodDict = new FoodDict();

    constructor(init?: Partial<MealItem>) {
        Object.assign(this, init);
        this.foodDict = init?.foodDict ?? new FoodDict();
    }
}

export class MealTemplate {
    id = 0;
    key = '';
    active = true;
    mealType: MealType = MEAL_TYPE.BREAKFAST;
    title: LocalizedText = {};
    goalTags: GoalTag[] = [];
    dayTags: DayTag[] = [];
    items: MealItem[] = [];

    constructor(init?: Partial<MealTemplate>) {
        Object.assign(this, init);
        this.title = init?.title ?? {};
        this.goalTags = init?.goalTags ?? [];
        this.dayTags = init?.dayTags ?? [];
        this.items = init?.items ?? [];
    }
}

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

export interface DailyNutritionPlan {
    clientId: number;
    goal: GoalTag;
    dayType: DayTag;
    targetDate: string;
    totals: DailyMacroTargets;
    meals: DailyNutritionPlanMeal[];
}

export interface DailyNutritionPlanMeal {
    mealType: MealType;
    template: MealTemplate;
    fallbackLevel: string;
    reason: string;
    score: number;
}

export interface DailyMacroTargets {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
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
