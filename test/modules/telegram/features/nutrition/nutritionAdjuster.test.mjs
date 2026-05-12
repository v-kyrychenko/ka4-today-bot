import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {build} from 'esbuild';

test('adjust increases protein on a deep copy and recalculates totals', async () => {
    const module = await loadNutritionAdjuster();
    const draftPlan = createPlan([
        createMeal([
            createItem({
                key: 'chicken_breast_cooked',
                amount: 100,
                role: 'main_protein',
                category: 'protein',
                maxAmount: 150,
                calories: 120,
                protein: 20,
                fat: 3,
                carbs: 0,
            }),
        ]),
    ]);
    draftPlan.totals = {calories: 120, protein: 20, fat: 3, carbs: 0};

    const result = await module.adjust(draftPlan, {calories: 180, protein: 30, fat: 5, carbs: 0});

    assert.equal(result.meals[0].template.items[0].amount, 150);
    assert.deepEqual(result.totals, {calories: 180, protein: 30, fat: 5, carbs: 0});
    assert.equal(draftPlan.meals[0].template.items[0].amount, 100);
    assert.deepEqual(draftPlan.totals, {calories: 120, protein: 20, fat: 3, carbs: 0});
});

test('adjust changes carbs as the flexible energy lever within min and max limits', async () => {
    const module = await loadNutritionAdjuster();
    const draftPlan = createPlan([
        createMeal([
            createItem({
                key: 'rice_cooked',
                amount: 200,
                role: 'training_carb',
                category: 'carb',
                minAmount: 120,
                calories: 130,
                protein: 3,
                fat: 0,
                carbs: 28,
            }),
        ]),
    ]);

    const result = await module.adjust(draftPlan, {calories: 156, protein: 6, fat: 0, carbs: 34});

    assert.equal(result.meals[0].template.items[0].amount, 120);
    assert.deepEqual(result.totals, {calories: 156, protein: 4, fat: 0, carbs: 34});
});

test('adjust reduces fat guardrail items without reducing vegetables', async () => {
    const module = await loadNutritionAdjuster();
    const draftPlan = createPlan([
        createMeal([
            createItem({
                key: 'olive_oil',
                amount: 20,
                role: 'fat',
                category: 'fat',
                minAmount: 5,
                calories: 884,
                protein: 0,
                fat: 100,
                carbs: 0,
            }),
            createItem({
                key: 'broccoli',
                amount: 200,
                role: 'vegetable',
                category: 'vegetable',
                calories: 35,
                protein: 2,
                fat: 0,
                carbs: 7,
            }),
        ]),
    ]);

    const result = await module.adjust(draftPlan, {calories: 160, protein: 4, fat: 10, carbs: 14});

    assert.equal(result.meals[0].template.items[0].amount, 10);
    assert.equal(result.meals[0].template.items[1].amount, 200);
    assert.deepEqual(result.totals, {calories: 158, protein: 4, fat: 10, carbs: 14});
});

test('adjust does not reduce vegetables when carbs are above target', async () => {
    const module = await loadNutritionAdjuster();
    const draftPlan = createPlan([
        createMeal([
            createItem({
                key: 'carrot',
                amount: 200,
                role: 'vegetable',
                category: 'vegetable',
                adjustable: true,
                calories: 40,
                protein: 1,
                fat: 0,
                carbs: 10,
            }),
        ]),
    ]);

    const result = await module.adjust(draftPlan, {calories: 20, protein: 2, fat: 0, carbs: 5});

    assert.equal(result.meals[0].template.items[0].amount, 200);
    assert.deepEqual(result.totals, {calories: 80, protein: 2, fat: 0, carbs: 20});
});

test('adjust does not increase fat while protein is still outside tolerance', async () => {
    const module = await loadNutritionAdjuster();
    const draftPlan = createPlan([
        createMeal([
            createItem({
                key: 'chicken_breast_cooked',
                amount: 100,
                role: 'main_protein',
                category: 'protein',
                maxAmount: 100,
                calories: 120,
                protein: 20,
                fat: 3,
                carbs: 0,
            }),
            createItem({
                key: 'olive_oil',
                amount: 5,
                role: 'fat',
                category: 'fat',
                maxAmount: 20,
                calories: 884,
                protein: 0,
                fat: 100,
                carbs: 0,
            }),
        ]),
    ]);

    const result = await module.adjust(draftPlan, {calories: 300, protein: 40, fat: 15, carbs: 0});

    assert.equal(result.meals[0].template.items[0].amount, 100);
    assert.equal(result.meals[0].template.items[1].amount, 5);
    assert.deepEqual(result.totals, {calories: 164, protein: 20, fat: 8, carbs: 0});
});

async function loadNutritionAdjuster() {
    const cacheKey = `${Date.now()}-${Math.random()}`;
    const result = await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/features/nutrition/nutritionAdjuster.ts'],
        format: 'esm',
        logLevel: 'silent',
        platform: 'node',
        write: false,
    });
    const output = result.outputFiles[0];
    const encodedSource = Buffer.from(output.text).toString('base64');

    return await import(`data:text/javascript;base64,${encodedSource}#${cacheKey}`);
}

function createPlan(meals) {
    return {
        clientId: 101,
        goal: 'maintenance',
        dayType: 'training_day',
        targetDate: '2026-05-10',
        totals: {calories: 0, protein: 0, fat: 0, carbs: 0},
        meals,
    };
}

function createMeal(items) {
    return {
        mealType: 'lunch',
        fallbackLevel: 'strict',
        reason: 'matched',
        score: 100,
        template: {
            id: 1,
            key: 'test_template',
            active: true,
            mealType: 'lunch',
            title: {en: 'Test template'},
            goalTags: ['maintenance'],
            dayTags: ['training_day'],
            items,
        },
    };
}

function createItem(input) {
    return {
        id: input.id ?? 1,
        amount: input.amount,
        unit: input.unit ?? 'g',
        role: input.role,
        adjustable: input.adjustable ?? true,
        minAmount: input.minAmount ?? null,
        maxAmount: input.maxAmount ?? null,
        foodDict: {
            id: input.id ?? 1,
            key: input.key,
            name: {en: input.key},
            category: input.category,
            amount: input.foodAmount ?? 100,
            unit: input.unit ?? 'g',
            calories: input.calories,
            protein: input.protein,
            fat: input.fat,
            carbs: input.carbs,
            mealRoles: ['lunch'],
            flags: [],
        },
    };
}
