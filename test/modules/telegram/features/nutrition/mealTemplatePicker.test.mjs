import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

test('pickMealTemplate returns a strict matching active template', async () => {
    const harness = await loadMealTemplatePicker([
        createTemplate({key: 'breakfast_match', foods: [{key: 'egg_large'}]}),
        createTemplate({key: 'breakfast_rest', dayTags: ['rest_day'], foods: [{key: 'quark_low_fat'}]}),
        createTemplate({key: 'breakfast_inactive', active: false, foods: [{key: 'oats_dry'}]}),
    ]);

    const result = await harness.module.pickMealTemplate(createRequest());

    assert.equal(result.template.key, 'breakfast_match');
    assert.equal(result.fallbackLevel, 'strict');
    assert.equal(result.metadata.selectedTemplateKey, 'breakfast_match');
    assert.deepEqual(harness.logs.map((args) => args[0]).slice(0, 4), [
        '### MEAL_TEMPLATE_PICK:start',
        '### MEAL_TEMPLATE_PICK:filtered',
        '### MEAL_TEMPLATE_PICK:selected',
        '### MEAL_TEMPLATE_PICK:stop',
    ]);
});

test('pickMealTemplate avoids a template used yesterday when another strict candidate exists', async () => {
    const harness = await loadMealTemplatePicker([
        createTemplate({id: 1, key: 'breakfast_a', foods: [{key: 'egg_large'}]}),
        createTemplate({id: 2, key: 'breakfast_b', foods: [{key: 'turkey_breast_cooked'}]}),
    ]);

    const result = await harness.module.pickMealTemplate(createRequest({
        recentTemplates: [{
            templateKey: 'breakfast_a',
            mealType: 'breakfast',
            usedAt: '2026-05-09',
            mainProteinFoodKeys: ['egg_large'],
        }],
    }));

    assert.equal(result.template.key, 'breakfast_b');
    assert.equal(result.fallbackLevel, 'strict');
});

test('pickMealTemplate never selects a template with a hard excluded food', async () => {
    const harness = await loadMealTemplatePicker([
        createTemplate({key: 'breakfast_oats', foods: [{key: 'oats_dry'}]}),
        createTemplate({key: 'breakfast_eggs', foods: [{key: 'egg_large'}]}),
    ]);

    const result = await harness.module.pickMealTemplate(createRequest({
        exclusions: {
            excludedFoodKeys: ['oats_dry'],
        },
    }));

    assert.equal(result.template.key, 'breakfast_eggs');
});

test('pickMealTemplate falls back by relaxing day type after strict matching fails', async () => {
    const harness = await loadMealTemplatePicker([
        createTemplate({key: 'breakfast_rest', dayTags: ['rest_day'], foods: [{key: 'egg_large'}]}),
    ]);

    const result = await harness.module.pickMealTemplate(createRequest());

    assert.equal(result.template.key, 'breakfast_rest');
    assert.equal(result.fallbackLevel, 'relax_day_type');
    assert.equal(result.reason, 'matched_meal_type_goal_and_exclusions');
});

test('pickMealTemplate throws a domain error when every template contains excluded foods', async () => {
    const harness = await loadMealTemplatePicker([
        createTemplate({key: 'breakfast_oats', foods: [{key: 'oats_dry'}]}),
    ]);

    await assert.rejects(
        () => harness.module.pickMealTemplate(createRequest({
            exclusions: {
                allergyFoodKeys: ['oats_dry'],
            },
        })),
        (error) => {
            assert.equal(error.name, 'MealTemplateNotFoundError');
            assert.equal(error.message, 'No valid meal template found for breakfast');
            return true;
        }
    );

    assert.equal(harness.logs.at(-1)[0], '### MEAL_TEMPLATE_PICK:stop');
});

async function loadMealTemplatePicker(templates) {
    const mocks = {
        templates,
        logs: [],
    };
    globalThis.__mealTemplatePickerMocks = mocks;

    const cacheKey = `${Date.now()}-${Math.random()}`;
    const outfile = path.join(tmpdir(), `meal-template-picker-${process.pid}-${cacheKey}.mjs`);

    await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/features/nutrition/picker/mealTemplatePicker.ts'],
        format: 'esm',
        logLevel: 'silent',
        outfile,
        platform: 'node',
        plugins: [mealTemplatePickerMocks],
    });

    try {
        const module = await import(`${pathToFileURL(outfile).href}?cache=${cacheKey}`);

        return {
            module,
            logs: mocks.logs,
        };
    } finally {
        await rm(outfile, {force: true});
    }
}

function createRequest(input = {}) {
    return {
        clientId: 101,
        mealType: 'breakfast',
        goal: 'fat_loss',
        dayType: 'training_day',
        targetDate: '2026-05-10',
        random: () => 0,
        ...input,
    };
}

function createTemplate(input) {
    return {
        id: input.id ?? 1,
        key: input.key,
        active: input.active ?? true,
        mealType: input.mealType ?? 'breakfast',
        title: {en: input.key},
        goalTags: input.goalTags ?? ['fat_loss'],
        dayTags: input.dayTags ?? ['training_day'],
        items: input.foods.map((food, index) => ({
            id: index + 1,
            amount: 100,
            unit: 'g',
            role: food.role ?? (index === 0 ? 'main_protein' : 'side'),
            adjustable: true,
            minAmount: null,
            maxAmount: null,
            foodDict: {
                id: index + 1,
                key: food.key,
                name: {en: food.key},
                category: 'protein',
                amount: 100,
                unit: 'g',
                calories: 100,
                protein: 10,
                fat: 1,
                carbs: 1,
                mealRoles: ['breakfast'],
                flags: food.flags ?? [],
            },
        })),
    };
}

const mealTemplatePickerMocks = {
    name: 'meal-template-picker-mocks',
    setup(buildContext) {
        mockModule(buildContext, /nutritionRepository\.js$/, [
            'export const nutritionRepository = {',
            '    async findMealTemplatesByMealType() {',
            '        return globalThis.__mealTemplatePickerMocks.templates;',
            '    },',
            '};',
        ]);
        mockModule(buildContext, /shared\/logging$/, [
            'export function log(...args) { globalThis.__mealTemplatePickerMocks.logs.push(args); }',
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
