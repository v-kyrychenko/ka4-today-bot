import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {build} from 'esbuild';

test('generate calculates totals from meal template item amounts', async () => {
    const module = await loadDailyNutritionPlanner([
        createTemplate({
            key: 'breakfast',
            mealType: 'breakfast',
            items: [
                createItem({amount: 150, foodAmount: 100, calories: 120, protein: 20, fat: 3, carbs: 4}),
                createItem({amount: 50, foodAmount: 100, calories: 370, protein: 13, fat: 7, carbs: 60}),
            ],
        }),
        createTemplate({
            key: 'lunch',
            mealType: 'lunch',
            items: [
                createItem({amount: 200, foodAmount: 100, calories: 110, protein: 23, fat: 1, carbs: 0}),
            ],
        }),
        createTemplate({
            key: 'dinner',
            mealType: 'dinner',
            items: [
                createItem({amount: 75, foodAmount: 50, calories: 86, protein: 2, fat: 0, carbs: 20}),
            ],
        }),
        createTemplate({
            key: 'snack',
            mealType: 'snack',
            items: [
                createItem({amount: 30, foodAmount: 100, calories: 607, protein: 20, fat: 54, carbs: 21}),
                createItem({amount: 100, foodAmount: 0, calories: 999, protein: 999, fat: 999, carbs: 999}),
                createItem({amount: 100, foodAmount: 100, calories: Number.NaN, protein: 999, fat: 999, carbs: 999}),
            ],
        }),
    ]);

    const result = await module.generate(createRequest());

    assert.deepEqual(result.totals, {
        calories: 896,
        protein: 92,
        fat: 26,
        carbs: 72,
    });
});

async function loadDailyNutritionPlanner(templates) {
    globalThis.__dailyNutritionPlannerMocks = {
        templates,
    };

    const cacheKey = `${Date.now()}-${Math.random()}`;
    const result = await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/features/nutrition/dailyNutritionPlanner.ts'],
        format: 'esm',
        logLevel: 'silent',
        platform: 'node',
        plugins: [dailyNutritionPlannerMocks],
        write: false,
    });
    const output = result.outputFiles[0];
    const encodedSource = Buffer.from(output.text).toString('base64');

    return await import(`data:text/javascript;base64,${encodedSource}#${cacheKey}`);
}

function createRequest() {
    return {
        clientId: 101,
        gender: 'M',
        birthday: '1989-01-15',
        goal: 'maintenance',
        height: 182,
        activityLevel: 'active',
        dayType: 'training_day',
        weight: {
            id: 1,
            clientId: 101,
            createdAt: '2026-05-10T00:00:00.000Z',
            amount: 81,
            type: 'WEIGHT',
            unitKey: 'kg',
        },
    };
}

function createTemplate(input) {
    return {
        id: input.id ?? 1,
        key: input.key,
        active: true,
        mealType: input.mealType,
        title: {en: input.key},
        goalTags: ['maintenance'],
        dayTags: ['training_day'],
        items: input.items,
    };
}

function createItem(input) {
    return {
        id: input.id ?? 1,
        amount: input.amount,
        unit: 'g',
        role: 'main_protein',
        adjustable: true,
        minAmount: null,
        maxAmount: null,
        foodDict: {
            id: input.id ?? 1,
            key: `food_${input.id ?? 1}`,
            name: {en: `food_${input.id ?? 1}`},
            category: 'protein',
            amount: input.foodAmount,
            unit: 'g',
            calories: input.calories,
            protein: input.protein,
            fat: input.fat,
            carbs: input.carbs,
            mealRoles: ['breakfast'],
            flags: [],
        },
    };
}

const dailyNutritionPlannerMocks = {
    name: 'daily-nutrition-planner-mocks',
    setup(buildContext) {
        mockModule(buildContext, /mealTemplatePicker\.js$/, [
            'export const mealTemplatePicker = {',
            '    async pickMealTemplate(request) {',
            '        const template = globalThis.__dailyNutritionPlannerMocks.templates.find((item) => item.mealType === request.mealType);',
            '        return {template, fallbackLevel: "strict", reason: "matched", score: 100};',
            '    },',
            '};',
        ]);
        mockModule(buildContext, /dateUtils\.js$/, [
            'export function today() { return "2026-05-10"; }',
            'export function calculateAge() { return 37; }',
        ]);
        mockModule(buildContext, /nutritionAdjuster$/, [
            'export async function adjust(draftPlan) {',
            '    return draftPlan;',
            '}',
        ]);
    },
};

let mockModuleIndex = 0;

function mockModule(buildContext, filter, contents) {
    const namespace = `mock-${mockModuleIndex}`;
    mockModuleIndex += 1;
    buildContext.onResolve({filter}, () => ({namespace, path: 'mock'}));
    buildContext.onLoad({filter: /^mock$/, namespace}, () => ({contents: contents.join('\n'), loader: 'js'}));
}
