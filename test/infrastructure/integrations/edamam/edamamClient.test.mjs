import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {build} from 'esbuild';

const EDAMAM_API_ID = 'edamam-app-id';
const EDAMAM_API_KEY = 'edamam-secret-key';
const EDAMAM_API_USER = 'telegram-user';

test('edamam client posts meal planner select request with configured headers', async () => {
    const module = await loadEdamamClient();
    const calls = [];
    const request = {
        size: 1,
        plan: {
            fit: {
                ENERC_KCAL: {min: 2150, max: 2245},
                PROCNT: {min: 130, max: 150},
                FAT: {min: 60, max: 80},
                CHOCDF: {min: 230, max: 280},
            },
            sections: {
                Breakfast: {fit: {ENERC_KCAL: {min: 100, max: 600}}},
                Lunch: {fit: {ENERC_KCAL: {min: 300, max: 900}}},
                Dinner: {fit: {ENERC_KCAL: {min: 200, max: 900}}},
            },
        },
    };
    const response = {
        selection: [{
            sections: {
                Breakfast: {
                    assigned: 'http://www.edamam.com/ontologies/edamam.owl#recipe_breakfast',
                    _links: {self: {href: 'https://api.edamam.com/api/recipes/v2/breakfast', title: 'Recipe details'}},
                },
            },
        }],
        status: 'OK',
    };

    globalThis.__edamamClientHttpMock = {
        calls,
        async httpRequest(params) {
            calls.push(params);
            return response;
        },
    };

    assert.deepEqual(await module.selectMealPlan(request), response);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].endpointUrl, 'https://api.edamam.com');
    assert.equal(calls[0].path, `/api/meal-planner/v1/${EDAMAM_API_ID}/select?type=public`);
    assert.deepEqual(calls[0].body, request);
    assert.equal(calls[0].headers.Authorization, `Basic ${btoa(`${EDAMAM_API_ID}:${EDAMAM_API_KEY}`)}`);
    assert.equal(calls[0].headers['Content-Type'], 'application/json');
    assert.equal(calls[0].headers['Edamam-Account-User'], EDAMAM_API_USER);
    assert.equal(calls[0].label, 'EDAMAM:meal-planner-select');
    assert.equal(new calls[0].errorClass().name, 'EdamamError');
});

test('edamam client gets recipe details by recipe id', async () => {
    const module = await loadEdamamClient();
    const calls = [];
    const recipeId = '5fe5340d10e364f4eba25a11189a474c';
    const response = {
        recipe: {
            uri: `http://www.edamam.com/ontologies/edamam.owl#recipe_${recipeId}`,
            label: 'Lower Carb Pancakes for One',
            image: 'https://example.com/recipe.jpg',
            images: {
                THUMBNAIL: {url: 'https://example.com/recipe-s.jpg', width: 100, height: 100},
                REGULAR: {url: 'https://example.com/recipe.jpg', width: 300, height: 300},
            },
            source: 'food.com',
            url: 'http://www.food.com/recipe/lower-carb-pancakes-for-one-89493',
            shareAs: `http://www.edamam.com/recipe/lower-carb-pancakes-for-one-${recipeId}/-`,
            yield: 1,
            dietLabels: ['High-Fiber'],
            healthLabels: ['Sugar-Conscious', 'Vegetarian'],
            cautions: ['Gluten'],
            ingredientLines: ['1/2 cup oats'],
            ingredients: [{
                text: '1/2 cup oats',
                quantity: 0.5,
                measure: 'cup',
                food: 'oats',
                weight: 78,
                foodCategory: 'grains',
                foodId: 'food_bbx4dfgbzjecp8bkewhz5b1lp5ky',
                image: 'https://example.com/oats.jpg',
            }],
            calories: 594.0738077491203,
            totalCO2Emissions: 3201.4136481985693,
            co2EmissionsClass: 'G',
            totalWeight: 292.9692999997552,
            totalTime: 6,
            cuisineType: ['american'],
            mealType: ['breakfast'],
            dishType: ['pancake'],
            totalNutrients: {
                ENERC_KCAL: {label: 'Energy', quantity: 594.0738077491203, unit: 'kcal'},
                PROCNT: {label: 'Protein', quantity: 39.87605074244359, unit: 'g'},
            },
            totalDaily: {
                ENERC_KCAL: {label: 'Energy', quantity: 25.352557676266738, unit: '%'},
            },
            digest: [{
                label: 'Fat',
                tag: 'FAT',
                schemaOrgTag: 'fatContent',
                total: 19.806903554976373,
                hasRDI: true,
                daily: 25.358246309582466,
                unit: 'g',
                sub: [{
                    label: 'Trans',
                    tag: 'FATRN',
                    schemaOrgTag: 'transFatContent',
                    total: 0.03268,
                    hasRDI: false,
                    daily: 0,
                    unit: 'g',
                }],
            }],
        },
        _links: {
            self: {
                href: `https://api.edamam.com/api/recipes/v2/${recipeId}`,
                title: 'Self',
            },
        },
    };

    globalThis.__edamamClientHttpMock = {
        calls,
        async httpRequest(params) {
            calls.push(params);
            return response;
        },
    };

    assert.deepEqual(await module.getRecipe(recipeId), response);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'GET');
    assert.equal(calls[0].endpointUrl, 'https://api.edamam.com');
    assert.equal(calls[0].path, `/api/recipes/v2/${recipeId}`);
    assert.equal(calls[0].body, undefined);
    assert.equal(calls[0].headers.Authorization, `Basic ${btoa(`${EDAMAM_API_ID}:${EDAMAM_API_KEY}`)}`);
    assert.equal(calls[0].headers['Content-Type'], 'application/json');
    assert.equal(calls[0].headers['Edamam-Account-User'], EDAMAM_API_USER);
    assert.equal(calls[0].label, 'EDAMAM:recipe-details');
    assert.equal(new calls[0].errorClass().name, 'EdamamError');
});

test('edamam client gets recipe details by recipe href', async () => {
    const module = await loadEdamamClient();
    const calls = [];
    const recipeId = '5fe5340d10e364f4eba25a11189a474c';
    const href = `https://api.edamam.com/api/recipes/v2/${recipeId}`;

    globalThis.__edamamClientHttpMock = {
        calls,
        async httpRequest(params) {
            calls.push(params);
            return {recipe: {uri: `recipe:${recipeId}`}, _links: {self: {href, title: 'Self'}}};
        },
    };

    await module.getRecipe(href);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'GET');
    assert.equal(calls[0].endpointUrl, 'https://api.edamam.com');
    assert.equal(calls[0].path, `/api/recipes/v2/${recipeId}`);
});

async function loadEdamamClient() {
    const cacheKey = `${Date.now()}-${Math.random()}`;
    const result = await build({
        bundle: true,
        entryPoints: ['src/infrastructure/integrations/edamam/edamamClient.ts'],
        format: 'esm',
        logLevel: 'silent',
        platform: 'node',
        plugins: [edamamEnvPlugin, edamamErrorsPlugin, edamamHttpRequestMockPlugin],
        write: false,
    });
    const output = result.outputFiles[0];
    const encodedSource = Buffer.from(output.text).toString('base64');

    return await import(`data:text/javascript;base64,${encodedSource}#${cacheKey}`);
}

const edamamEnvPlugin = {
    name: 'edamam-env-plugin',
    setup(buildContext) {
        buildContext.onResolve({filter: /app\/config\/env\.js$/}, () => ({
            namespace: 'edamam-env-mock',
            path: 'env',
        }));

        buildContext.onLoad({filter: /^env$/, namespace: 'edamam-env-mock'}, () => ({
            contents: [
                `export const EDAMAM_API_ID = '${EDAMAM_API_ID}';`,
                `export const EDAMAM_API_KEY = '${EDAMAM_API_KEY}';`,
                `export const EDAMAM_API_USER = '${EDAMAM_API_USER}';`,
            ].join('\n'),
            loader: 'js',
        }));
    },
};

const edamamErrorsPlugin = {
    name: 'edamam-errors-plugin',
    setup(buildContext) {
        buildContext.onResolve({filter: /shared\/errors$/}, () => ({
            namespace: 'edamam-errors-mock',
            path: 'errors',
        }));

        buildContext.onLoad({filter: /^errors$/, namespace: 'edamam-errors-mock'}, () => ({
            contents: [
                'export class EdamamError extends Error {',
                '    constructor(message = "Edamam API error", statusCode = 500) {',
                '        super(message);',
                '        this.name = "EdamamError";',
                '        this.statusCode = statusCode;',
                '    }',
                '}',
            ].join('\n'),
            loader: 'js',
        }));
    },
};

const edamamHttpRequestMockPlugin = {
    name: 'edamam-http-request-mock',
    setup(buildContext) {
        buildContext.onResolve({filter: /shared\/http\/httpClient\.js$/}, () => ({
            namespace: 'edamam-http-request-mock',
            path: 'http-client',
        }));

        buildContext.onLoad({filter: /^http-client$/, namespace: 'edamam-http-request-mock'}, () => ({
            contents: [
                'export async function httpRequest(params) {',
                '    return globalThis.__edamamClientHttpMock.httpRequest(params);',
                '}',
            ].join('\n'),
            loader: 'js',
        }));
    },
};
