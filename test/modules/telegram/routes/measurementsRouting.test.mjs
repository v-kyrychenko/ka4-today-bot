import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const chatId = 42;
const user = {chatId, clientId: 777, lang: 'en'};

test('/measurements route starts the body measurements conversation', async () => {
    const calls = [];
    const {MeasurementsRoute} = await loadModule('src/modules/telegram/routes/MeasurementsRoute.ts', {
        conversationEngine: {
            async start(input) {
                calls.push(['start', input.user.chatId, input.type]);
                return {text: 'initial'};
            },
        },
        messagingService: createMessagingService(calls),
    });

    const route = new MeasurementsRoute();
    assert.equal(route.canHandle('/measurements'), true);

    await route.execute({chatId, text: '/measurements', user, message: {}});

    assert.deepEqual(calls, [
        ['start', chatId, 'BODY_MEASUREMENTS'],
        ['send', chatId, 'initial', undefined],
    ]);
});

test('active conversation receives next text before normal routes', async () => {
    const calls = [];
    const processor = await loadRoutesProcessor({
        calls,
        textResponse: {text: 'conversation reply'},
    });

    await processor.routesProcessor.execute(messageRequest('next measurements'));

    assert.deepEqual(calls, [
        ['getOrCreateUser', chatId],
        ['handleText', chatId, 'next measurements'],
        ['send', chatId, 'conversation reply', undefined],
    ]);
});

test('/cancel and /stop cancel active conversations', async () => {
    for (const command of ['/cancel', '/stop']) {
        const calls = [];
        const processor = await loadRoutesProcessor({
            calls,
            cancelResponse: {text: 'cancelled'},
        });

        await processor.routesProcessor.execute(messageRequest(command));

        assert.deepEqual(calls, [
            ['getOrCreateUser', chatId],
            ['cancel', chatId],
            ['send', chatId, 'cancelled', undefined],
        ]);
    }
});

test('measurement callback reaches the conversation handler', async () => {
    const calls = [];
    const replyMarkup = {inline_keyboard: []};
    const processor = await loadRoutesProcessor({
        calls,
        callbackResponse: {text: 'saved', replyMarkup},
    });

    await processor.routesProcessor.execute(callbackRequest('MEASUREMENTS:SAVE'));

    assert.deepEqual(calls, [
        ['getOrCreateUser', chatId],
        ['handleCallback', chatId, 'MEASUREMENTS:SAVE', 1001],
        ['send', chatId, 'saved', replyMarkup],
    ]);
});

async function loadRoutesProcessor(options) {
    return loadModule('src/modules/telegram/routes/routesProcessor.ts', {
        conversationEngine: {
            async handleText(input) {
                options.calls.push(['handleText', input.user.chatId, input.text]);
                return options.textResponse ?? null;
            },
            async handleCallback(input) {
                options.calls.push(['handleCallback', input.user.chatId, input.callbackData, input.messageId]);
                return options.callbackResponse ?? null;
            },
            async cancel(inputChatId) {
                options.calls.push(['cancel', inputChatId]);
                return options.cancelResponse ?? null;
            },
        },
        userRepository: {
            async getOrCreateUser(inputChatId) {
                options.calls.push(['getOrCreateUser', inputChatId]);
                return {chatId: inputChatId, clientId: 777, lang: 'en'};
            },
        },
        messagingService: createMessagingService(options.calls),
        routeRegistry: [{
            canHandle() {
                return true;
            },
            async execute() {
                options.calls.push(['routeExecute']);
            },
        }],
    });
}

async function loadModule(entryPoint, mocks) {
    globalThis.__telegramRouteMocks = mocks;

    const outfile = path.join(tmpdir(), `telegram-route-${process.pid}-${Date.now()}-${Math.random()}.mjs`);

    await build({
        bundle: true,
        entryPoints: [entryPoint],
        format: 'esm',
        logLevel: 'silent',
        outfile,
        platform: 'node',
        plugins: [routeMocks],
    });

    try {
        return await import(`${pathToFileURL(outfile).href}?cache=${Date.now()}-${Math.random()}`);
    } finally {
        await rm(outfile, {force: true});
    }
}

const routeMocks = {
    name: 'route-mocks',
    setup(buildContext) {
        mockModule(buildContext, /features\/conversations\/engine\.js$/, [
            'export const conversationEngine = globalThis.__telegramRouteMocks.conversationEngine;',
        ]);
        mockModule(buildContext, /features\/messaging\/telegramMessagingService\.js$/, [
            'export const telegramMessagingService = globalThis.__telegramRouteMocks.messagingService;',
        ]);
        mockModule(buildContext, /tgUserRepository\.js$/, [
            'export const tgUserRepository = globalThis.__telegramRouteMocks.userRepository;',
        ]);
        mockModule(buildContext, /\/registry\.js$/, [
            'export const MEASUREMENTS_ROUTE = "/measurements";',
            'export const CANCEL_COMMANDS = new Set(["/cancel", "/stop"]);',
            'export const routeRegistry = globalThis.__telegramRouteMocks.routeRegistry ?? [];',
        ]);
    },
};

function mockModule(buildContext, filter, contents) {
    const namespace = `mock-${String(filter)}`;
    buildContext.onResolve({filter}, () => ({namespace, path: 'mock'}));
    buildContext.onLoad({filter: /^mock$/, namespace}, () => ({contents: contents.join('\n'), loader: 'js'}));
}

function createMessagingService(calls) {
    return {
        async sendMessage(context, text, replyMarkup) {
            calls.push(['send', context.chatId, text, replyMarkup]);
        },
        async sendErrorMessage(chatId, text) {
            calls.push(['error', chatId, text]);
        },
    };
}

function messageRequest(text) {
    return {
        update_id: 1,
        message: {
            message_id: 1001,
            text,
            chat: {id: chatId},
            from: {id: chatId, is_bot: false, first_name: 'Test'},
        },
    };
}

function callbackRequest(data) {
    return {
        update_id: 1,
        callback_query: {
            id: 'callback-id',
            data,
            from: {id: chatId, is_bot: false, first_name: 'Test'},
            message: {
                message_id: 1001,
                chat: {id: chatId},
            },
        },
    };
}
