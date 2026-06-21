import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {build} from 'esbuild';

const chatId = 42;
const clientId = 777;

test('/food_targets route calculates and sends localized macro targets', async () => {
    const calls = [];
    const {FoodTargetsRoute} = await loadRoute({
        calls,
        client: createClient({goals: 'fat_loss', height: 181.5}),
        weight: createWeight({amount: 80}),
        scheduled: {id: 1},
    });

    const route = new FoodTargetsRoute();
    assert.equal(route.canHandle('/food_targets'), true);

    await route.execute(createContext({lang: 'uk'}));

    assert.deepEqual(calls, [
        ['findByClientId', clientId],
        ['findLatestForClientByType', clientId, 'WEIGHT'],
        ['getUserScheduledForDay', chatId],
        ['send', chatId, [
            '🎯 Цілі по макросах на день',
            '',
            'Тренувальний день · зниження ваги',
            '',
            '2144 ккал · Б 144 г · Ж 64 г · В 248 г',
        ].join('\n')],
    ]);
});

test('/food_targets route defaults missing goal to maintenance and unscheduled day to rest day', async () => {
    const calls = [];
    const {FoodTargetsRoute} = await loadRoute({
        calls,
        client: createClient({goals: null, height: 170}),
        weight: createWeight({amount: 75}),
        scheduled: null,
    });

    await new FoodTargetsRoute().execute(createContext({lang: 'en'}));

    assert.deepEqual(calls, [
        ['findByClientId', clientId],
        ['findLatestForClientByType', clientId, 'WEIGHT'],
        ['getUserScheduledForDay', chatId],
        ['send', chatId, [
            '🎯 Daily macro targets',
            '',
            'Rest day · maintenance',
            '',
            '1904 kcal · Protein 128 g · Fat 68 g · Carbs 195 g',
        ].join('\n')],
    ]);
});

test('/food_targets route blocks when height is missing', async () => {
    const calls = [];
    const {FoodTargetsRoute} = await loadRoute({
        calls,
        client: createClient({height: null}),
        weight: createWeight(),
    });

    await new FoodTargetsRoute().execute(createContext());

    assert.deepEqual(calls, [
        ['findByClientId', clientId],
        ['send', chatId, 'Щоб скласти меню, мені потрібен твій зріст. Додай зріст у профіль, і я одразу згенерую план харчування.'],
    ]);
});

test('/food_targets route blocks when weight is missing', async () => {
    const calls = [];
    const {FoodTargetsRoute} = await loadRoute({
        calls,
        client: createClient({height: 170}),
        weight: null,
    });

    await new FoodTargetsRoute().execute(createContext());

    assert.deepEqual(calls, [
        ['findByClientId', clientId],
        ['findLatestForClientByType', clientId, 'WEIGHT'],
        ['send', chatId, 'Щоб скласти меню, мені потрібна актуальна вага. Надішли заміри, і я одразу згенерую план харчування.'],
    ]);
});

test('/food_targets route blocks when client is not linked', async () => {
    const calls = [];
    const {FoodTargetsRoute} = await loadRoute({
        calls,
        client: createClient(),
        weight: createWeight(),
    });

    await new FoodTargetsRoute().execute(createContext({clientId: null, lang: 'en'}));

    assert.deepEqual(calls, [
        ['send', chatId, 'I do not see a linked client profile yet. Ask your coach to check the profile settings.'],
    ]);
});

async function loadRoute(options) {
    globalThis.__foodTargetsRouteMocks = options;

    const cacheKey = `${Date.now()}-${Math.random()}`;
    const result = await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/routes/FoodTargetsRoute.ts'],
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
    name: 'food-targets-route-mocks',
    setup(buildContext) {
        mockModule(buildContext, /clientsRepository\.js$/, [
            'export const clientsRepository = {',
            '    async findByClientId(clientId) {',
            '        globalThis.__foodTargetsRouteMocks.calls.push(["findByClientId", clientId]);',
            '        return globalThis.__foodTargetsRouteMocks.client;',
            '    },',
            '};',
        ]);
        mockModule(buildContext, /bodyMeasurementRepository\.js$/, [
            'export const bodyMeasurementRepository = {',
            '    async findLatestForClientByType(clientId, type) {',
            '        globalThis.__foodTargetsRouteMocks.calls.push(["findLatestForClientByType", clientId, type]);',
            '        return globalThis.__foodTargetsRouteMocks.weight ?? null;',
            '    },',
            '};',
        ]);
        mockModule(buildContext, /telegramMessagingService\.js$/, [
            'export const telegramMessagingService = {',
            '    async sendMessage(context, text) {',
            '        globalThis.__foodTargetsRouteMocks.calls.push(["send", context.chatId, text]);',
            '    },',
            '};',
        ]);
        mockModule(buildContext, /tgUserRepository\.js$/, [
            'export const tgUserRepository = {',
            '    async getUserScheduledForDay(chatId) {',
            '        globalThis.__foodTargetsRouteMocks.calls.push(["getUserScheduledForDay", chatId]);',
            '        return globalThis.__foodTargetsRouteMocks.scheduled ?? null;',
            '    },',
            '};',
        ]);
        mockModule(buildContext, /mealTemplatePicker\.js$/, [
            'export const mealTemplatePicker = { async pickMealTemplate() { return null; } };',
        ]);
        mockModule(buildContext, /nutritionAdjuster$/, [
            'export async function adjust(plan) { return plan; }',
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
        text: '/food_targets',
        user: {chatId, clientId: input.clientId === undefined ? clientId : input.clientId, lang: input.lang ?? 'uk'},
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
    return {
        id: 1,
        clientId,
        createdAt: '2026-05-10',
        amount: 81,
        type: 'WEIGHT',
        unitKey: 'kg',
        ...input,
    };
}
