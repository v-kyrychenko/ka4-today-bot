import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {build} from 'esbuild';

test('generate calls Edamam meal planner with macro and meal calorie ranges', async () => {
    const calls = [];
    const module = await loadEdamamDailyPlanner(calls);

    const result = await module.generate(createRequest());

    assert.equal(result, null);
    assert.deepEqual(calls, [[
        'selectMealPlan',
        {
            size: 1,
            plan: {
                fit: {
                    ENERC_KCAL: {min: 2065, max: 2245},
                    PROCNT: {min: 117, max: 138},
                    FAT: {min: 55, max: 73},
                    CHOCDF: {min: 207, max: 259},
                },
                sections: {
                    Breakfast: {
                        fit: {
                            ENERC_KCAL: {min: 561, max: 674},
                        },
                    },
                    Lunch: {
                        fit: {
                            ENERC_KCAL: {min: 786, max: 898},
                        },
                    },
                    Dinner: {
                        fit: {
                            ENERC_KCAL: {min: 674, max: 786},
                        },
                    },
                },
            },
        },
    ]]);
});

async function loadEdamamDailyPlanner(calls) {
    globalThis.__edamamDailyPlannerMocks = {
        calls,
    };

    const cacheKey = `${Date.now()}-${Math.random()}`;
    const result = await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/features/nutrition/edamamDailyPlanner.ts'],
        format: 'esm',
        logLevel: 'silent',
        platform: 'node',
        plugins: [edamamDailyPlannerMocks],
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

const edamamDailyPlannerMocks = {
    name: 'edamam-daily-planner-mocks',
    setup(buildContext) {
        mockModule(buildContext, /edamamClient\.js$/, [
            'export const edamamClient = {',
            '    async selectMealPlan(request) {',
            '        globalThis.__edamamDailyPlannerMocks.calls.push(["selectMealPlan", request]);',
            '        return {selection: [], status: "OK"};',
            '    },',
            '};',
        ]);
        mockModule(buildContext, /macroTargetsCalculator$/, [
            'export function calculateMacroTargets() {',
            '    return {calories: 2245, protein: 138, fat: 73, carbs: 259};',
            '}',
        ]);
        mockModule(buildContext, /shared\/logging$/, [
            'export function log() {}',
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
