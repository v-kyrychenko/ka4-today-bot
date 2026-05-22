import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {build} from 'esbuild';

const chatId = 42;
const clientId = 777;

test('/meals route generates a daily nutrition plan and sends a daily menu template', async () => {
    const calls = [];
    const {DailyMealsRoute} = await loadRoute({
        calls,
        client: createClient({goals: 'fat_loss', height: 181.5}),
        weight: createWeight({amount: 80}),
        scheduled: {id: 1},
    });

    const route = new DailyMealsRoute();
    assert.equal(route.canHandle('/meals'), true);

    await route.execute(createContext());

    const message = calls.find((item) => item[0] === 'send')[2];
    console.log(message);
    assert.deepEqual(calls.map((item) => item[0]), [
        'findByClientId',
        'findLatestForClientByType',
        'selectMealPlan',
        'getRecipe',
        'getRecipe',
        'getRecipe',
        'send',
    ]);
    assert.deepEqual(calls.filter((item) => item[0] === 'getRecipe'), [
        ['getRecipe', 'https://api.edamam.com/api/recipes/v2/breakfast-recipe-id'],
        ['getRecipe', 'https://api.edamam.com/api/recipes/v2/lunch-recipe-id'],
        ['getRecipe', 'https://api.edamam.com/api/recipes/v2/dinner-recipe-id'],
    ]);
    assert.equal(message, [
        '🍽 Меню на сьогодні',
        '',
        'Тренувальний день · зниження ваги',
        '',
        '📊 Разом за день:',
        '1020 ккал · Б 69 г · Ж 35 г · В 109 г',
        '',
        '🥣 Сніданок',
        'Oat protein pancakes',
        '',
        '• Oats — 77.5 г',
        '• Whey protein — 77.5 г',
        '',
        '🍽 Обід',
        'Chicken rice bowl',
        '',
        '• Chicken breast — 105 г',
        '• Rice — 105 г',
        '',
        '🌙 Вечеря',
        'Salmon potato plate',
        '',
        '• Salmon — 90 г',
        '• Potato — 90 г',
    ].join('\n'));
});

test('/meals route defaults missing goal to maintenance', async () => {
    const calls = [];
    const {DailyMealsRoute} = await loadRoute({
        calls,
        client: createClient({goals: null, height: 170}),
        weight: createWeight({amount: 75}),
        scheduled: null,
    });

    await new DailyMealsRoute().execute(createContext());

    assert.equal(calls.find((item) => item[0] === 'selectMealPlan')[1].plan.fit.PROCNT.max, 128);
    assert.match(calls.find((item) => item[0] === 'send')[2], /Тренувальний день · підтримка форми/);
});

test('/meals route blocks when height is missing', async () => {
    const calls = [];
    const {DailyMealsRoute} = await loadRoute({
        calls,
        client: createClient({height: null}),
        weight: createWeight(),
    });

    await new DailyMealsRoute().execute(createContext());

    assert.deepEqual(calls, [
        ['findByClientId', clientId],
        ['send', chatId, 'Щоб скласти меню, мені потрібен твій зріст. Додай зріст у профіль, і я одразу згенерую план харчування.'],
    ]);
});

test('/meals route localizes blocking messages', async () => {
    const calls = [];
    const {DailyMealsRoute} = await loadRoute({
        calls,
        client: createClient({height: null}),
        weight: createWeight(),
    });

    await new DailyMealsRoute().execute(createContext({lang: 'en'}));

    assert.deepEqual(calls, [
        ['findByClientId', clientId],
        ['send', chatId, 'To build your menu, I need your height. Add it to your profile, and I will generate the nutrition plan right away.'],
    ]);
});

test('/meals route blocks when weight is missing', async () => {
    const calls = [];
    const {DailyMealsRoute} = await loadRoute({
        calls,
        client: createClient({height: 170}),
        weight: null,
    });

    await new DailyMealsRoute().execute(createContext());

    assert.deepEqual(calls, [
        ['findByClientId', clientId],
        ['findLatestForClientByType', clientId, 'WEIGHT'],
        ['send', chatId, 'Щоб скласти меню, мені потрібна актуальна вага. Надішли заміри, і я одразу згенерую план харчування.'],
    ]);
});

async function loadRoute(options) {
    globalThis.__dailyMealsRouteMocks = options;

    const cacheKey = `${Date.now()}-${Math.random()}`;
    const result = await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/routes/DailyMealsRoute.ts'],
        format: 'esm',
        logLevel: 'silent',
        platform: 'node',
        plugins: [routeMocks],
        write: false,
    });
    const output = result.outputFiles[0];
    const encodedSource = Buffer.from(output.text).toString('base64');

    return await import(`data:text/javascript;base64,${encodedSource}#${cacheKey}`);
}

const routeMocks = {
    name: 'daily-meals-route-mocks',
    setup(buildContext) {
        mockModule(buildContext, /clientsRepository\.js$/, [
            'export const clientsRepository = {',
            '    async findByClientId(clientId) {',
            '        globalThis.__dailyMealsRouteMocks.calls.push(["findByClientId", clientId]);',
            '        if (globalThis.__dailyMealsRouteMocks.clientError) throw globalThis.__dailyMealsRouteMocks.clientError;',
            '        return globalThis.__dailyMealsRouteMocks.client;',
            '    },',
            '};',
        ]);
        mockModule(buildContext, /bodyMeasurementRepository\.js$/, [
            'export const bodyMeasurementRepository = {',
            '    async findLatestForClientByType(clientId, type) {',
            '        globalThis.__dailyMealsRouteMocks.calls.push(["findLatestForClientByType", clientId, type]);',
            '        return globalThis.__dailyMealsRouteMocks.weight ?? null;',
            '    },',
            '};',
        ]);
        mockModule(buildContext, /telegramMessagingService\.js$/, [
            'export const telegramMessagingService = {',
            '    async sendMessage(context, text) {',
            '        globalThis.__dailyMealsRouteMocks.calls.push(["send", context.chatId, text]);',
            '    },',
            '};',
        ]);
        mockModule(buildContext, /shared\/logging$/, [
            'export function log() {}',
            'export function logError() {}',
        ]);
        mockModule(buildContext, /edamamClient\.js$/, [
            'export const edamamClient = {',
            '    async selectMealPlan(request) {',
            '        globalThis.__dailyMealsRouteMocks.calls.push(["selectMealPlan", request]);',
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
            '    async getRecipe(recipeHref) {',
            '        globalThis.__dailyMealsRouteMocks.calls.push(["getRecipe", recipeHref]);',
            '        return {',
            '            recipe: createRecipe(recipeHref),',
            '            _links: {self: {href: recipeHref, title: "Self"}},',
            '        };',
            '    },',
            '};',
            'function createSection(recipeId) {',
            '    return {',
            '        assigned: `http://www.edamam.com/ontologies/edamam.owl#recipe_${recipeId}`,',
            '        _links: {self: {href: `https://api.edamam.com/api/recipes/v2/${recipeId}`, title: "Recipe details"}},',
            '    };',
            '}',
            'function createRecipe(recipeHref) {',
            '    const recipes = {',
            '        "https://api.edamam.com/api/recipes/v2/breakfast-recipe-id": createRecipeData("Oat protein pancakes", 640, 42, 18, 68, 310, ["Oats", "Whey protein"]),',
            '        "https://api.edamam.com/api/recipes/v2/lunch-recipe-id": createRecipeData("Chicken rice bowl", 820, 55, 24, 86, 420, ["Chicken breast", "Rice"]),',
            '        "https://api.edamam.com/api/recipes/v2/dinner-recipe-id": createRecipeData("Salmon potato plate", 580, 40, 28, 64, 360, ["Salmon", "Potato"]),',
            '    };',
            '    return recipes[recipeHref];',
            '}',
            'function createRecipeData(label, calories, protein, fat, carbs, totalWeight, ingredientNames) {',
            '    return {',
            '        uri: `recipe:${label.toLowerCase().replaceAll(" ", "-")}`,',
            '        label,',
            '        yield: 2,',
            '        calories,',
            '        totalWeight,',
            '        ingredients: ingredientNames.map((food) => ({food, text: food, weight: totalWeight / ingredientNames.length})),',
            '        totalNutrients: {',
            '            ENERC_KCAL: {label: "Energy", quantity: calories, unit: "kcal"},',
            '            PROCNT: {label: "Protein", quantity: protein, unit: "g"},',
            '            FAT: {label: "Fat", quantity: fat, unit: "g"},',
            '            CHOCDF: {label: "Carbs", quantity: carbs, unit: "g"},',
            '        },',
            '    };',
            '}',
        ]);
        mockModule(buildContext, /tgUserRepository\.js$/, [
            'export const tgUserRepository = {',
            '    async getUserScheduledForDay(chatId) {',
            '        globalThis.__dailyMealsRouteMocks.calls.push(["getUserScheduledForDay", chatId]);',
            '        return globalThis.__dailyMealsRouteMocks.scheduled ?? null;',
            '    },',
            '};',
        ]);
    },
};

function mockModule(buildContext, filter, contents) {
    const namespace = `mock-${String(filter)}`;
    buildContext.onResolve({filter}, () => ({namespace, path: 'mock'}));
    buildContext.onLoad({filter: /^mock$/, namespace}, () => ({contents: contents.join('\n'), loader: 'js'}));
}

function createContext(input = {}) {
    return {
        chatId,
        text: '/meals',
        user: {chatId, clientId, lang: input.lang ?? 'uk'},
        message: {},
    };
}

function createClient(input = {}) {
    return {
        id: clientId,
        gender: 'M',
        birthday: '1989-01-15',
        goals: 'maintenance',
        height: 180,
        ...input,
    };
}

function createWeight(input = {}) {
    return createMeasurement({
        type: 'WEIGHT',
        amount: 81,
        unitKey: 'kg',
        ...input,
    });
}

function createMeasurement(input = {}) {
    return {
        id: input.id ?? 1,
        clientId,
        createdAt: input.createdAt ?? '2026-05-10',
        amount: input.amount ?? 90,
        type: input.type ?? 'WAIST',
        unitKey: input.unitKey ?? 'cm',
    };
}

function createPlan(input = {}) {
    return {
        clientId,
        goal: input.goal ?? 'fat_loss',
        dayType: input.dayType ?? 'training_day',
        targetDate: '2026-05-15',
        totals: {
            calories: 1406,
            protein: 157,
            fat: 25,
            carbs: 145,
        },
        meals: [
            createMeal({
                mealType: 'breakfast',
                title: 'Яєчні білки з моцарелою та грибами',
                items: [
                    createMealItem('Яєчні білки', 150),
                    createMealItem('Моцарела light', 40),
                ],
            }),
            createMeal({
                mealType: 'lunch',
                title: 'Біла риба з картоплею та салатом',
                items: [
                    createMealItem('Біла риба', 180),
                    createMealItem('Картопля варена', 340),
                ],
            }),
        ],
    };
}

function createMeal(input) {
    return {
        mealType: input.mealType,
        template: {
            title: {uk: input.title},
            items: input.items,
        },
        fallbackLevel: 'exact',
        reason: 'test',
        score: 1,
    };
}

function createMealItem(name, amount) {
    return {
        amount,
        unit: 'g',
        foodDict: {
            name: {uk: name},
        },
    };
}
