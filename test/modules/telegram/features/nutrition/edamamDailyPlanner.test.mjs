import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {build} from 'esbuild';

test('generate calls Edamam meal planner with macro and meal calorie ranges', async () => {
    const calls = [];
    const module = await loadEdamamDailyPlanner(calls);

    const result = await module.generate(createRequest());

    assert.deepEqual(JSON.parse(JSON.stringify(result)), {
        title: '🍽 Меню на сьогодні',
        subtitle: 'Тренувальний день · підтримка форми',
        targetDate: '2026-05-10',
        totals: {
            calories: 1020,
            protein: 69,
            fat: 35,
            carbs: 109,
        },
        meals: [
            createExpectedMeal('breakfast', 'breakfast-recipe-id', 77.5),
            createExpectedMeal('lunch', 'lunch-recipe-id', 105),
            createExpectedMeal('dinner', 'dinner-recipe-id', 90),
        ],
    });
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
                        accept: {
                            all: [{
                                dish: [
                                    'egg',
                                    'cereals',
                                ],
                            }, {
                                meal: [
                                    'breakfast',
                                ],
                            }],
                        },
                    },
                    Lunch: {
                        fit: {
                            ENERC_KCAL: {min: 786, max: 898},
                        },
                        accept: {
                            all: [{
                                dish: [
                                    'main course',
                                    'pasta',
                                    'egg',
                                    'salad',
                                    'soup',
                                    'sandwiches',
                                    'pizza',
                                    'seafood',
                                ],
                            }, {
                                meal: [
                                    'lunch/dinner',
                                ],
                            }],
                        },
                    },
                    Dinner: {
                        fit: {
                            ENERC_KCAL: {min: 674, max: 786},
                        },
                        accept: {
                            all: [{
                                dish: [
                                    'seafood',
                                    'egg',
                                    'salad',
                                    'pizza',
                                    'pasta',
                                    'main course',
                                ],
                            }, {
                                meal: [
                                    'lunch/dinner',
                                ],
                            }],
                        },
                    },
                },
            },
        },
    ], [
        'getRecipe',
        'https://api.edamam.com/api/recipes/v2/breakfast-recipe-id',
    ], [
        'getRecipe',
        'https://api.edamam.com/api/recipes/v2/lunch-recipe-id',
    ], [
        'getRecipe',
        'https://api.edamam.com/api/recipes/v2/dinner-recipe-id',
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

function createExpectedMeal(mealType, recipeId, mainAmount) {
    return {
        mealType,
        title: recipeId,
        originalTitle: recipeId,
        mainIngredients: [{
            name: `${recipeId} ingredient 1`,
            amount: mainAmount,
            unit: 'г',
        }, {
            name: `${recipeId} ingredient 2`,
            amount: mainAmount,
            unit: 'г',
        }],
        additionalIngredients: {
            label: 'Додатково',
            items: ['salt', 'olive oil'],
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
            '        return {',
            '            selection: [{',
            '                sections: {',
            '                    Breakfast: createSection("breakfast-recipe-id"),',
            '                    Lunch: createSection("lunch-recipe-id"),',
            '                    Dinner: createSection("dinner-recipe-id"),',
            '                },',
            '            }],',
            '            status: "OK",',
            '        };',
            '    },',
            '    async getRecipe(recipeId) {',
            '        globalThis.__edamamDailyPlannerMocks.calls.push(["getRecipe", recipeId]);',
            '        return {',
            '            recipe: createRecipe(recipeId),',
            '            _links: {self: {href: recipeId, title: "Self"}},',
            '        };',
            '    },',
            '};',
            'function createSection(recipeId) {',
            '    return {',
            '        assigned: `http://www.edamam.com/ontologies/edamam.owl#recipe_${recipeId}`,',
            '        _links: {self: {href: `https://api.edamam.com/api/recipes/v2/${recipeId}`, title: "Recipe details"}},',
            '    };',
            '}',
            'function createRecipe(recipeId) {',
            '    const nutrients = {',
            '        "https://api.edamam.com/api/recipes/v2/breakfast-recipe-id": [640, 42, 18, 68, 310],',
            '        "https://api.edamam.com/api/recipes/v2/lunch-recipe-id": [820, 55, 24, 86, 420],',
            '        "https://api.edamam.com/api/recipes/v2/dinner-recipe-id": [580, 40, 28, 64, 360],',
            '    };',
            '    const [calories, protein, fat, carbs, weight] = nutrients[recipeId];',
            '    return {',
            '        uri: `recipe:${recipeId}`,',
            '        label: recipeId.split("/").pop(),',
            '        yield: 2,',
            '        calories,',
            '        totalWeight: weight,',
            '        ingredients: [',
            '            {food: `${recipeId.split("/").pop()} ingredient 1`, weight: weight / 2},',
            '            {food: `${recipeId.split("/").pop()} ingredient 2`, weight: weight / 2},',
            '            {food: "salt", weight: 1},',
            '            {food: "water", weight: 100},',
            '            {food: "olive oil", weight: 8},',
            '        ],',
            '        totalNutrients: {',
            '            ENERC_KCAL: {label: "Energy", quantity: calories, unit: "kcal"},',
            '            PROCNT: {label: "Protein", quantity: protein, unit: "g"},',
            '            FAT: {label: "Fat", quantity: fat, unit: "g"},',
            '            CHOCDF: {label: "Carbs", quantity: carbs, unit: "g"},',
            '        },',
            '    };',
            '}',
        ]);
        mockModule(buildContext, /macroTargetsCalculator$/, [
            'export function calculateMacroTargets() {',
            '    return {calories: 2245, protein: 138, fat: 73, carbs: 259};',
            '}',
        ]);
        mockModule(buildContext, /dateUtils\.js$/, [
            'export function today() { return "2026-05-10"; }',
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
