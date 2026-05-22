import type {EdamamRecipe, EdamamRecipeIngredient} from '../../../../infrastructure/integrations/edamam/types.js';
import {today} from '../../../../shared/utils/dateUtils.js';
import {
    DAY_TAG,
    GOAL_TAG,
    MEAL_TYPE,
    type DailyMacroTargets,
    type DailyNutritionPlannerRequest,
    type MealType,
    type TelegramMealIngredient,
    type TelegramMealView,
    type TelegramMealViewMeal
} from './nutritionModel';

const DAILY_MEAL_ORDER = [
    MEAL_TYPE.BREAKFAST,
    MEAL_TYPE.LUNCH,
    MEAL_TYPE.DINNER,
] as const;

const MAX_MAIN_INGREDIENTS = 6;
const MIN_MAIN_INGREDIENT_AMOUNT_G = 2;
const SMALL_OIL_AMOUNT_G = 10;
const TELEGRAM_UNIT_GRAMS = 'г';
const ADDITIONAL_INGREDIENTS_LABEL = 'Додатково';

const DAY_TYPE_LABELS = {
    [DAY_TAG.REST_DAY]: 'День відпочинку',
    [DAY_TAG.TRAINING_DAY]: 'Тренувальний день',
} as const;

const GOAL_LABELS = {
    [GOAL_TAG.FAT_LOSS]: 'зниження ваги',
    [GOAL_TAG.MAINTENANCE]: 'підтримка форми',
    [GOAL_TAG.MUSCLE_GAIN]: 'набір мʼязів',
} as const;

const HELPER_INGREDIENT_PATTERNS = [
    'salt',
    'pepper',
    'spice',
    'spices',
    'seasoning',
    'seasonings',
    'herb',
    'herbs',
    'yeast',
    'gum',
    'mustard',
    'lemon juice',
    'lime juice',
    'vinegar',
    'baking powder',
    'baking soda',
    'extract',
];

const WATER_PATTERNS = [
    'water',
    'ice',
];

const SOUP_DRINK_BROTH_PATTERNS = [
    'soup',
    'broth',
    'stock',
    'stew',
    'cioppino',
    'drink',
    'smoothie',
    'juice',
    'tea',
    'coffee',
];

export interface EdamamSelectedRecipe {
    recipeKey: string;
    recipe: EdamamRecipe;
}

interface WeightedIngredient {
    index: number;
    name: string;
    amount: number;
    visible: boolean;
    helper: boolean;
}

export function buildDailyNutritionPlan(request: DailyNutritionPlannerRequest,
                                        recipesByMealType: Map<MealType, EdamamSelectedRecipe>): TelegramMealView {
    const meals = DAILY_MEAL_ORDER
        .map((mealType) => {
            const recipe = recipesByMealType.get(mealType);
            return recipe == null ? null : buildTelegramMeal(mealType, recipe.recipe);
        })
        .filter((meal): meal is TelegramMealViewMeal => meal != null);

    return {
        title: '🍽 Меню на сьогодні',
        subtitle: `${DAY_TYPE_LABELS[request.dayType]} · ${GOAL_LABELS[request.goal ?? GOAL_TAG.MAINTENANCE]}`,
        targetDate: today(),
        totals: calculateTotals(meals.map((meal) => recipesByMealType.get(meal.mealType)?.recipe)),
        meals,
    };
}

function buildTelegramMeal(mealType: MealType, recipe: EdamamRecipe): TelegramMealViewMeal {
    const ingredients = buildWeightedIngredients(recipe);
    const visibleIngredients = ingredients
        .filter((ingredient) => ingredient.visible)
        .sort((left, right) => right.amount - left.amount);
    const mainIngredients = visibleIngredients
        .filter((ingredient) => isMainIngredient(ingredient))
        .slice(0, MAX_MAIN_INGREDIENTS);
    const mainNames = new Set(mainIngredients.map((ingredient) => ingredient.name));
    const additionalIngredients = ingredients
        .filter((ingredient) => ingredient.visible)
        .sort((left, right) => left.index - right.index)
        .filter((ingredient) => !mainNames.has(ingredient.name))
        .map((ingredient) => ingredient.name);

    return {
        mealType,
        title: recipe.label,
        originalTitle: recipe.label,
        mainIngredients: mainIngredients.map((ingredient) => ({
            name: ingredient.name,
            amount: ingredient.amount,
            unit: TELEGRAM_UNIT_GRAMS,
        })),
        additionalIngredients: {
            label: ADDITIONAL_INGREDIENTS_LABEL,
            items: unique(additionalIngredients),
        },
    };
}

function buildWeightedIngredients(recipe: EdamamRecipe): WeightedIngredient[] {
    const showWater = shouldShowWater(recipe);

    return (recipe.ingredients ?? [])
        .map((ingredient, index) => buildWeightedIngredient(recipe, ingredient, index, showWater))
        .filter((ingredient): ingredient is WeightedIngredient => ingredient != null);
}

function buildWeightedIngredient(recipe: EdamamRecipe,
                                 ingredient: EdamamRecipeIngredient,
                                 index: number,
                                 showWater: boolean): WeightedIngredient | null {
    const amount = getIngredientServingWeight(recipe, ingredient);

    if (amount <= 0) {
        return null;
    }

    const name = getIngredientName(ingredient);
    const normalizedName = normalizeText(name);
    const water = isWater(normalizedName);

    return {
        index,
        name,
        amount,
        visible: !water || showWater,
        helper: amount < MIN_MAIN_INGREDIENT_AMOUNT_G || isHelperIngredient(normalizedName, amount),
    };
}

function isMainIngredient(ingredient: WeightedIngredient): boolean {
    return !ingredient.helper && ingredient.amount >= MIN_MAIN_INGREDIENT_AMOUNT_G;
}

function getIngredientName(ingredient: EdamamRecipeIngredient): string {
    return ingredient.food || ingredient.text;
}

function isHelperIngredient(normalizedName: string, amount: number): boolean {
    if (normalizedName.includes('oil') && amount <= SMALL_OIL_AMOUNT_G) {
        return true;
    }

    return HELPER_INGREDIENT_PATTERNS.some((pattern) => normalizedName.includes(pattern));
}

function shouldShowWater(recipe: EdamamRecipe): boolean {
    const text = [
        recipe.label,
        ...(recipe.dishType ?? []),
        ...(recipe.mealType ?? []),
    ].join(' ');
    const normalizedText = normalizeText(text);

    return SOUP_DRINK_BROTH_PATTERNS.some((pattern) => normalizedText.includes(pattern));
}

function isWater(normalizedName: string): boolean {
    return WATER_PATTERNS.includes(normalizedName);
}

function calculateTotals(recipes: Array<EdamamRecipe | undefined>): DailyMacroTargets {
    const totals = recipes.reduce((result, recipe) => {
        if (recipe == null) {
            return result;
        }

        result.calories += getNutrientQuantity(recipe, 'ENERC_KCAL', recipe.calories);
        result.protein += getNutrientQuantity(recipe, 'PROCNT');
        result.fat += getNutrientQuantity(recipe, 'FAT');
        result.carbs += getNutrientQuantity(recipe, 'CHOCDF');

        return result;
    }, {calories: 0, protein: 0, fat: 0, carbs: 0});

    return {
        calories: Math.round(totals.calories),
        protein: Math.round(totals.protein),
        fat: Math.round(totals.fat),
        carbs: Math.round(totals.carbs),
    };
}

function getIngredientServingWeight(recipe: EdamamRecipe, ingredient: EdamamRecipeIngredient): number {
    const weight = ingredient.weight;

    if (Number.isFinite(weight) && weight > 0) {
        return weight / getRecipeYield(recipe);
    }

    return 0;
}

function getNutrientQuantity(recipe: EdamamRecipe, nutrientCode: string, fallback = 0): number {
    const quantity = recipe.totalNutrients?.[nutrientCode]?.quantity ?? fallback;

    return Number.isFinite(quantity) ? quantity / getRecipeYield(recipe) : 0;
}

function getRecipeYield(recipe: EdamamRecipe): number {
    return Number.isFinite(recipe.yield) && recipe.yield > 0 ? recipe.yield : 1;
}

function normalizeText(value: string): string {
    return value.toLowerCase().trim();
}

function unique(items: string[]): string[] {
    return Array.from(new Set(items));
}
