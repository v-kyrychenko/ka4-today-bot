export type LocalizedText = Record<string, string>;

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type GoalTag = 'fat_loss' | 'maintenance';
export type DayTag = 'training_day' | 'rest_day';

export type FoodCategory =
    | 'protein'
    | 'protein_fat'
    | 'carb'
    | 'fat'
    | 'vegetable'
    | 'carb_protein'
    | 'carb_fat';

export type FoodUnit = 'g' | 'pcs';
export type MealRole = 'breakfast' | 'lunch' | 'dinner' | 'snack';

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
    role = '';
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
    mealType: MealType = 'breakfast';
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
