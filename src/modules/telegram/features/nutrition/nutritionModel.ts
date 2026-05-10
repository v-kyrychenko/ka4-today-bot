import type {ClientGender} from '../../../coach/client/domain/client.js';
import type {BodyMeasurement} from '../measurements/bodyMeasurementsModel.js';
import type {
    MealTemplateExclusions,
    MealTemplatePickerConfig,
    MealTemplatePreferences,
    MealTemplatePickMetadata,
    RecentMealTemplate,
} from './picker/types.js';

export type LocalizedText = Record<string, string>;

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
    goal: GoalTag;
    dayType: DayTag;
    targetDate?: string;
    gender?: ClientGender;
    birthday?: string;
    goals?: string | null;
    weight?: BodyMeasurement;
    exclusions?: MealTemplateExclusions;
    preferences?: MealTemplatePreferences;
    recentTemplates?: RecentMealTemplate[];
    config?: Partial<MealTemplatePickerConfig>;
    random?: () => number;
}

export interface DailyNutritionPlan {
    clientId: number;
    goal: GoalTag;
    dayType: DayTag;
    targetDate: string;
    meals: DailyNutritionPlanMeal[];
}

export interface DailyNutritionPlanMeal {
    mealType: MealType;
    template: MealTemplate;
    fallbackLevel: string;
    reason: string;
    score: number;
}
