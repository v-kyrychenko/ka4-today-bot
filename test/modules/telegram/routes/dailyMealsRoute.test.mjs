import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {build} from 'esbuild';

const chatId = 42;
const clientId = 777;

test('/meals route generates a daily nutrition plan and sends a daily menu template', async () => {
    const calls = [];
    const plan = createPlan();
    const {DailyMealsRoute} = await loadRoute({
        calls,
        client: createClient({goals: 'fat_loss', height: 181.5}),
        weight: createWeight({amount: 80}),
        scheduled: {id: 1},
        plan,
    });

    const route = new DailyMealsRoute();
    assert.equal(route.canHandle('/meals'), true);

    await route.execute(createContext());

    assert.deepEqual(calls, [
        ['findByClientId', clientId],
        ['findLatestForClientByType', clientId, 'WEIGHT'],
        ['getUserScheduledForDay', chatId],
        ['generate', {
            clientId,
            gender: 'M',
            birthday: '1989-01-15',
            goal: 'fat_loss',
            weight: createWeight({amount: 80}),
            height: 181.5,
            activityLevel: 'active',
            dayType: 'training_day',
        }],
        ['send', chatId, [
            '🍽 Меню на сьогодні',
            '',
            'Тренувальний день · зниження ваги',
            '',
            '📊 Разом за день:',
            '1406 ккал · Б 157 г · Ж 25 г · В 145 г',
            '',
            '🥣 Сніданок',
            'Яєчні білки з моцарелою та грибами',
            '',
            '• Яєчні білки — 150 г',
            '• Моцарела light — 40 г',
            '',
            '🍽 Обід',
            'Біла риба з картоплею та салатом',
            '',
            '• Біла риба — 180 г',
            '• Картопля варена — 340 г',
        ].join('\n')],
    ]);
});

test('/meals route defaults missing goal to maintenance and unscheduled day to rest day', async () => {
    const calls = [];
    const {DailyMealsRoute} = await loadRoute({
        calls,
        client: createClient({goals: null, height: 170}),
        weight: createWeight({amount: 75}),
        scheduled: null,
        plan: createPlan({goal: 'maintenance', dayType: 'rest_day'}),
    });

    await new DailyMealsRoute().execute(createContext());

    assert.deepEqual(calls.find((item) => item[0] === 'generate')[1], {
        clientId,
        gender: 'M',
        birthday: '1989-01-15',
        goal: 'maintenance',
        weight: createWeight({amount: 75}),
        height: 170,
        activityLevel: 'active',
        dayType: 'rest_day',
    });
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
        mockModule(buildContext, /dailyNutritionPlanner\.js$/, [
            'export const dailyNutritionPlanner = {',
            '    async generate(request) {',
            '        globalThis.__dailyMealsRouteMocks.calls.push(["generate", request]);',
            '        return globalThis.__dailyMealsRouteMocks.plan ?? {ok: true};',
            '    },',
            '};',
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
