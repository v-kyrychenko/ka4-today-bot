import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

test('buildDraftDailyPlan returns four meals in the required order', async () => {
    const harness = await loadDailyPlanner();

    const plan = await harness.module.buildDraftDailyPlan(createRequest());

    assert.equal(plan.clientId, 101);
    assert.equal(plan.goal, 'fat_loss');
    assert.equal(plan.dayType, 'training_day');
    assert.equal(plan.targetDate, '2026-05-10');
    assert.deepEqual(plan.meals.map((meal) => meal.mealType), ['breakfast', 'lunch', 'dinner', 'snack']);
    assert.deepEqual(plan.meals.map((meal) => meal.template.key), [
        'template_breakfast',
        'template_lunch',
        'template_dinner',
        'template_snack',
    ]);
});

test('buildDraftDailyPlan passes shared request context to the picker', async () => {
    const harness = await loadDailyPlanner();
    const random = () => 0.25;
    const request = createRequest({
        targetDate: '2026-05-11',
        exclusions: {
            allergyFoodKeys: ['peanut'],
            excludedFoodKeys: ['oats'],
            dietaryRestrictionFoodKeys: ['pork'],
            excludedFoodFlags: ['lactose'],
        },
        preferences: {
            preferredFoodKeys: ['turkey'],
            preferredBreakfastStyles: ['savory'],
        },
        recentTemplates: [{
            templateId: 7,
            templateKey: 'recent_breakfast',
            mealType: 'breakfast',
            usedAt: '2026-05-09',
            mainProteinFoodKeys: ['egg'],
        }],
        config: {
            minScore: 5,
            recentTemplatePenalty: 15,
        },
        random,
    });

    await harness.module.dailyNutritionPlanner.buildDraftDailyPlan(request);

    assert.equal(harness.calls.length, 4);
    for (const call of harness.calls) {
        assert.equal(call.clientId, 101);
        assert.equal(call.goal, 'fat_loss');
        assert.equal(call.dayType, 'training_day');
        assert.equal(call.targetDate, '2026-05-11');
        assert.equal(call.exclusions, request.exclusions);
        assert.equal(call.preferences, request.preferences);
        assert.equal(call.recentTemplates, request.recentTemplates);
        assert.equal(call.config, request.config);
        assert.equal(call.random, random);
    }
    assert.deepEqual(harness.calls.map((call) => call.mealType), ['breakfast', 'lunch', 'dinner', 'snack']);
});

test('buildDraftDailyPlan maps selected templates directly into the draft plan', async () => {
    const selectedTemplates = {
        breakfast: createTemplate('breakfast_custom'),
        lunch: createTemplate('lunch_custom'),
        dinner: createTemplate('dinner_custom'),
        snack: createTemplate('snack_custom'),
    };
    const harness = await loadDailyPlanner(selectedTemplates);

    const plan = await harness.module.buildDraftDailyPlan(createRequest());

    assert.equal(plan.meals[0].template, selectedTemplates.breakfast);
    assert.equal(plan.meals[1].template, selectedTemplates.lunch);
    assert.equal(plan.meals[2].template, selectedTemplates.dinner);
    assert.equal(plan.meals[3].template, selectedTemplates.snack);
    assert.equal('items' in plan.meals[0], false);
});

async function loadDailyPlanner(templates = {}) {
    const mocks = {
        calls: [],
        templates,
    };
    globalThis.__dailyPlannerMocks = mocks;

    const cacheKey = `${Date.now()}-${Math.random()}`;
    const outfile = path.join(tmpdir(), `daily-planner-${process.pid}-${cacheKey}.mjs`);

    await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/features/nutrition/dailyNutritionPlanner.ts'],
        format: 'esm',
        logLevel: 'silent',
        outfile,
        platform: 'node',
        plugins: [dailyPlannerMocks],
    });

    try {
        const module = await import(`${pathToFileURL(outfile).href}?cache=${cacheKey}`);

        return {
            module,
            calls: mocks.calls,
        };
    } finally {
        await rm(outfile, {force: true});
    }
}

function createRequest(input = {}) {
    return {
        clientId: 101,
        goal: 'fat_loss',
        dayType: 'training_day',
        targetDate: '2026-05-10',
        ...input,
    };
}

function createTemplate(key) {
    return {
        id: Math.floor(Math.random() * 1000),
        key,
        active: true,
        mealType: key.split('_')[0],
        title: {en: key},
        goalTags: ['fat_loss'],
        dayTags: ['training_day'],
        items: [{
            id: 1,
            amount: 100,
            unit: 'g',
            role: 'main_protein',
            adjustable: true,
            minAmount: null,
            maxAmount: null,
            foodDict: {
                id: 1,
                key: `${key}_food`,
                name: {en: key},
                category: 'protein',
                amount: 100,
                unit: 'g',
                calories: 100,
                protein: 10,
                fat: 1,
                carbs: 1,
                mealRoles: [key.split('_')[0]],
                flags: [],
            },
        }],
    };
}

const dailyPlannerMocks = {
    name: 'daily-planner-mocks',
    setup(buildContext) {
        mockModule(buildContext, /picker\/mealTemplatePicker\.js$/, [
            'export const mealTemplatePicker = {',
            '    async pickMealTemplate(request) {',
            '        globalThis.__dailyPlannerMocks.calls.push(request);',
            '        const template = globalThis.__dailyPlannerMocks.templates[request.mealType] ?? {',
            '            id: 1,',
            '            key: `template_${request.mealType}`,',
            '            active: true,',
            '            mealType: request.mealType,',
            '            title: {en: request.mealType},',
            '            goalTags: [request.goal],',
            '            dayTags: [request.dayType],',
            '            items: [],',
            '        };',
            '        return {template, fallbackLevel: "strict", reason: "matched", score: 100, metadata: {}};',
            '    },',
            '};',
        ]);
    },
};

let mockModuleIndex = 0;

function mockModule(buildContext, filter, contents) {
    const namespace = `daily-planner-mock-${mockModuleIndex}`;
    mockModuleIndex += 1;
    buildContext.onResolve({filter}, () => ({namespace, path: 'mock'}));
    buildContext.onLoad({filter: /^mock$/, namespace}, () => ({contents: contents.join('\n'), loader: 'js'}));
}
