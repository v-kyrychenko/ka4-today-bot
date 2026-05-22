import type {EdamamRecipe} from '../../../../infrastructure/integrations/edamam/types.js';
import {today} from '../../../../shared/utils/dateUtils.js';
import {calculatePlanTotals} from './planMacroTotals.js';
import {
    GOAL_TAG,
    MEAL_ITEM_ROLE,
    MEAL_TYPE,
    type DailyNutritionPlan,
    type DailyNutritionPlanMeal,
    type DailyNutritionPlannerRequest,
    FoodDict,
    MealItem,
    MealTemplate,
    type MealType
} from './nutritionModel';

const DAILY_MEAL_ORDER = [
    MEAL_TYPE.BREAKFAST,
    MEAL_TYPE.LUNCH,
    MEAL_TYPE.DINNER,
] as const;

export interface EdamamSelectedRecipe {
    recipeKey: string;
    recipe: EdamamRecipe;
}

export function buildDailyNutritionPlan(request: DailyNutritionPlannerRequest,
                                        recipesByMealType: Map<MealType, EdamamSelectedRecipe>): DailyNutritionPlan {
    const goal = request.goal ?? GOAL_TAG.MAINTENANCE;
    const meals = DAILY_MEAL_ORDER
        .map((mealType) => {
            const recipe = recipesByMealType.get(mealType);
            return recipe == null ? null : buildDailyNutritionPlanMeal(request, mealType, recipe);
        })
        .filter((meal): meal is DailyNutritionPlanMeal => meal != null);
    const plan = {
        clientId: request.clientId,
        goal,
        dayType: request.dayType,
        targetDate: today(),
        totals: {
            calories: 0,
            protein: 0,
            fat: 0,
            carbs: 0,
        },
        meals,
    };

    return {
        ...plan,
        totals: calculatePlanTotals(plan),
    };
}

function buildDailyNutritionPlanMeal(request: DailyNutritionPlannerRequest,
                                     mealType: MealType,
                                     selectedRecipe: EdamamSelectedRecipe): DailyNutritionPlanMeal {
    const goal = request.goal ?? GOAL_TAG.MAINTENANCE;

    return {
        mealType,
        template: new MealTemplate({
            key: selectedRecipe.recipeKey,
            active: true,
            mealType,
            title: {en: selectedRecipe.recipe.label},
            goalTags: [goal],
            dayTags: [request.dayType],
            items: buildRecipeMealItems(mealType, selectedRecipe),
        }),
        fallbackLevel: 'edamam',
        reason: 'edamam_recipe_selected',
        score: 100,
    };
}

function buildRecipeMealItem(mealType: MealType, selectedRecipe: EdamamSelectedRecipe): MealItem {
    const recipe = selectedRecipe.recipe;
    const amount = getRecipeWeight(recipe);

    return new MealItem({
        amount,
        unit: 'g',
        role: MEAL_ITEM_ROLE.MAIN_PROTEIN,
        adjustable: false,
        foodDict: new FoodDict({
            key: selectedRecipe.recipeKey,
            name: {en: recipe.label},
            category: 'protein',
            amount,
            unit: 'g',
            calories: getNutrientQuantity(recipe, 'ENERC_KCAL', recipe.calories),
            protein: getNutrientQuantity(recipe, 'PROCNT'),
            fat: getNutrientQuantity(recipe, 'FAT'),
            carbs: getNutrientQuantity(recipe, 'CHOCDF'),
            mealRoles: [mealType],
        }),
    });
}

function buildRecipeMealItems(mealType: MealType, selectedRecipe: EdamamSelectedRecipe): MealItem[] {
    const ingredients = selectedRecipe.recipe.ingredients ?? [];
    const weightedIngredients = ingredients
        .map((ingredient, index) => ({
            ingredient,
            index,
            servingWeight: getIngredientServingWeight(selectedRecipe.recipe, index),
        }))
        .filter((item) => item.servingWeight > 0);

    if (weightedIngredients.length === 0) {
        return [buildRecipeMealItem(mealType, selectedRecipe)];
    }

    const servingWeight = weightedIngredients.reduce((total, item) => total + item.servingWeight, 0);

    return weightedIngredients.map((item) => {
        const macroShare = item.servingWeight / servingWeight;
        const foodName = item.ingredient.food || item.ingredient.text;
        return buildIngredientMealItem(mealType, selectedRecipe, item.index, foodName, item.servingWeight, macroShare);
    });
}

function buildIngredientMealItem(mealType: MealType,
                                 selectedRecipe: EdamamSelectedRecipe,
                                 index: number,
                                 foodName: string,
                                 amount: number,
                                 macroShare: number): MealItem {
    const recipe = selectedRecipe.recipe;

    return new MealItem({
        amount,
        unit: 'g',
        role: MEAL_ITEM_ROLE.MAIN_PROTEIN,
        adjustable: false,
        foodDict: new FoodDict({
            key: `${selectedRecipe.recipeKey}#ingredient_${index + 1}`,
            name: {en: foodName},
            category: 'protein',
            amount,
            unit: 'g',
            calories: getNutrientQuantity(recipe, 'ENERC_KCAL', recipe.calories) * macroShare,
            protein: getNutrientQuantity(recipe, 'PROCNT') * macroShare,
            fat: getNutrientQuantity(recipe, 'FAT') * macroShare,
            carbs: getNutrientQuantity(recipe, 'CHOCDF') * macroShare,
            mealRoles: [mealType],
        }),
    });
}

function getRecipeWeight(recipe: EdamamRecipe): number {
    if (Number.isFinite(recipe.totalWeight) && recipe.totalWeight > 0) {
        return Math.round(recipe.totalWeight / getRecipeYield(recipe));
    }

    return 1;
}

function getIngredientServingWeight(recipe: EdamamRecipe, ingredientIndex: number): number {
    const weight = recipe.ingredients?.[ingredientIndex]?.weight;

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
