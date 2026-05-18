import {
    CARB_FOOD_CATEGORIES,
    CARB_ITEM_ROLES,
    FAT_FOOD_CATEGORIES,
    FAT_ITEM_ROLES,
    MEAL_ITEM_ROLE,
    PROTEIN_FOOD_CATEGORIES,
    PROTEIN_ITEM_ROLES,
    type DailyMacroTargets,
    type DailyNutritionPlan,
    type DailyNutritionPlanMeal,
} from './nutritionModel.js';
import {calculatePlanTotals, hasValidMacros} from './planMacroTotals.js';

const MACRO_TOLERANCE_G = 2;
const GRAM_PORTION_STEP = 5;
const PIECE_PORTION_STEP = 1;
const MIN_PORTION_AMOUNT = 0;
const NO_DELTA = 0;
const NO_MACRO_DENSITY = 0;

type MealItem = DailyNutritionPlanMeal['template']['items'][number];
type MacroKey = keyof DailyMacroTargets;
type MacroDelta = DailyMacroTargets;

export async function adjust(draftPlan: DailyNutritionPlan, targets: DailyMacroTargets): Promise<DailyNutritionPlan> {
    const adjustedPlan = clonePlan(draftPlan);
    adjustedPlan.totals = calculatePlanTotals(adjustedPlan);

    let delta = calculateMacroDelta(adjustedPlan.totals, targets);
    adjustProtein(adjustedPlan, delta.protein);
    adjustedPlan.totals = calculatePlanTotals(adjustedPlan);

    delta = calculateMacroDelta(adjustedPlan.totals, targets);
    adjustFat(adjustedPlan, delta);
    adjustedPlan.totals = calculatePlanTotals(adjustedPlan);

    delta = calculateMacroDelta(adjustedPlan.totals, targets);
    adjustCarbs(adjustedPlan, delta.carbs);
    adjustedPlan.totals = calculatePlanTotals(adjustedPlan);

    return adjustedPlan;
}

function clonePlan(draftPlan: DailyNutritionPlan): DailyNutritionPlan {
    return JSON.parse(JSON.stringify(draftPlan)) as DailyNutritionPlan;
}

function calculateMacroDelta(currentTotals: DailyMacroTargets, dailyMacroTargets: DailyMacroTargets): MacroDelta {
    return {
        calories: dailyMacroTargets.calories - currentTotals.calories,
        protein: dailyMacroTargets.protein - currentTotals.protein,
        fat: dailyMacroTargets.fat - currentTotals.fat,
        carbs: dailyMacroTargets.carbs - currentTotals.carbs,
    };
}

function adjustProtein(plan: DailyNutritionPlan, deltaProteinG: number): void {
    adjustMacro(plan, getAdjustableProteinItems(plan), 'protein', deltaProteinG);
}

function adjustCarbs(plan: DailyNutritionPlan, deltaCarbsG: number): void {
    adjustMacro(plan, getAdjustableCarbItems(plan), 'carbs', deltaCarbsG);
}

function adjustFat(plan: DailyNutritionPlan, delta: MacroDelta): void {
    if (delta.fat > MACRO_TOLERANCE_G && !isWithinTolerance(delta.protein)) {
        return;
    }

    adjustMacro(plan, getAdjustableFatItems(plan), 'fat', delta.fat);
}

function adjustMacro(plan: DailyNutritionPlan, items: MealItem[], macro: MacroKey, deltaG: number): void {
    if (isWithinTolerance(deltaG)) {
        return;
    }

    const direction = Math.sign(deltaG);
    let remainingG = Math.abs(deltaG);

    for (const item of items) {
        if (remainingG <= MACRO_TOLERANCE_G) {
            return;
        }

        const macroPerAmount = getMacroPerAmount(item, macro);
        if (macroPerAmount <= NO_MACRO_DENSITY) {
            continue;
        }

        const desiredAmountDelta = roundToPortionStep(remainingG / macroPerAmount, item);
        const appliedAmountDelta = applyAmountDelta(item, desiredAmountDelta * direction);
        remainingG -= Math.abs(appliedAmountDelta * macroPerAmount);
    }

    plan.totals = calculatePlanTotals(plan);
}

function getAdjustableProteinItems(plan: DailyNutritionPlan): MealItem[] {
    return getPrioritizedItems(plan, isProteinItem, 'protein');
}

function getAdjustableCarbItems(plan: DailyNutritionPlan): MealItem[] {
    return getPrioritizedItems(plan, isCarbItem, 'carbs');
}

function getAdjustableFatItems(plan: DailyNutritionPlan): MealItem[] {
    return getPrioritizedItems(plan, isFatItem, 'fat');
}

function getPrioritizedItems(plan: DailyNutritionPlan,
                             predicate: (item: MealItem) => boolean,
                             macro: MacroKey): MealItem[] {
    const candidates = getPlanItems(plan)
        .filter((item) => predicate(item) && !isVegetableItem(item));
    const adjustableItems = candidates
        .filter((item) => item.adjustable);
    const sourceItems = adjustableItems.length > NO_DELTA ? adjustableItems : candidates;

    return sourceItems.sort((left, right) =>
        getMacroPerAmount(right, macro) - getMacroPerAmount(left, macro));
}

function getPlanItems(plan: DailyNutritionPlan): MealItem[] {
    return plan.meals.flatMap((meal) => meal.template.items);
}

function isProteinItem(item: MealItem): boolean {
    return PROTEIN_ITEM_ROLES.has(item.role) || PROTEIN_FOOD_CATEGORIES.has(item.foodDict.category);
}

function isCarbItem(item: MealItem): boolean {
    return CARB_ITEM_ROLES.has(item.role) || CARB_FOOD_CATEGORIES.has(item.foodDict.category);
}

function isFatItem(item: MealItem): boolean {
    return FAT_ITEM_ROLES.has(item.role) || FAT_FOOD_CATEGORIES.has(item.foodDict.category);
}

function isVegetableItem(item: MealItem): boolean {
    return item.role === MEAL_ITEM_ROLE.VEGETABLE || item.foodDict.category === 'vegetable';
}

function getMacroPerAmount(item: MealItem, macro: MacroKey): number {
    if (!hasValidMacros(item)) {
        return NO_MACRO_DENSITY;
    }

    return item.foodDict[macro] / item.foodDict.amount;
}

function applyAmountDelta(item: MealItem, amountDelta: number): number {
    const originalAmount = item.amount;
    const nextAmount = clampAmount(item, originalAmount + amountDelta);
    item.amount = nextAmount;

    return nextAmount - originalAmount;
}

function clampAmount(item: MealItem, amount: number): number {
    const minimum = item.minAmount ?? MIN_PORTION_AMOUNT;
    const maximum = item.maxAmount ?? Number.POSITIVE_INFINITY;

    return Math.min(Math.max(amount, minimum), maximum);
}

function roundToPortionStep(amount: number, item: MealItem): number {
    const step = getPortionStep(item);

    return Math.max(step, Math.round(amount / step) * step);
}

function getPortionStep(item: MealItem): number {
    return item.unit === 'pcs' ? PIECE_PORTION_STEP : GRAM_PORTION_STEP;
}

function isWithinTolerance(deltaG: number): boolean {
    return Math.abs(deltaG) <= MACRO_TOLERANCE_G;
}
