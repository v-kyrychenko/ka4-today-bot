import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const chatId = 42;

test('WorkoutLoggingRoute.canHandle only matches /log_workout', async () => {
    const {route} = await loadRoute();

    assert.equal(route.canHandle('/log_workout'), true);
    assert.equal(route.canHandle('/log_workout extra'), false);
    assert.equal(route.canHandle('bench press 4x10'), false);
});

test('WorkoutLoggingRoute declares its conversationType for cross-context pre-emption', async () => {
    const {route} = await loadRoute();

    assert.equal(route.conversationType, 'WORKOUT_LOGGING');
});

// The route is a thin pass-through: eligibility/duplicate checks and session creation now live in
// workoutLoggingConversation's onStart, exercised in workoutLoggingConversation.test.mjs.
test('execute() delegates to the conversation engine and sends its response', async () => {
    const {route, calls} = await loadRoute();

    await route.execute(context({clientId: 777}));

    assert.equal(calls.conversationStart.length, 1);
    assert.equal(calls.conversationStart[0].type, 'WORKOUT_LOGGING');
    assert.equal(calls.sent[0].text, 'started');
});

async function loadRoute() {
    const calls = {conversationStart: [], sent: []};

    globalThis.__workoutLoggingRouteMocks = {
        conversationEngine: {
            async start(input) {
                calls.conversationStart.push(input);
                return {text: 'started'};
            },
        },
        messagingService: {
            async sendMessage(inputContext, text, replyMarkup) {
                calls.sent.push({text, replyMarkup});
            },
        },
    };

    const outfile = path.join(tmpdir(), `workout-logging-route-${process.pid}-${Date.now()}-${Math.random()}.mjs`);

    await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/routes/WorkoutLoggingRoute.ts'],
        format: 'esm',
        logLevel: 'silent',
        outfile,
        platform: 'node',
        plugins: [workoutLoggingRouteMocks],
    });

    try {
        const module = await import(`${pathToFileURL(outfile).href}?cache=${Date.now()}-${Math.random()}`);
        return {route: new module.WorkoutLoggingRoute(), calls};
    } finally {
        delete globalThis.__workoutLoggingRouteMocks;
        await rm(outfile, {force: true});
    }
}

const workoutLoggingRouteMocks = {
    name: 'workout-logging-route-mocks',
    setup(buildContext) {
        mockModule(buildContext, /workoutLogging\/workoutLoggingConversation\.js$/, [
            "export const CONVERSATION_TYPE_WORKOUT_LOGGING = 'WORKOUT_LOGGING';",
        ]);
        mockModule(buildContext, /features\/conversations\/engine\.js$/, [
            'export const conversationEngine = globalThis.__workoutLoggingRouteMocks.conversationEngine;',
        ]);
        mockModule(buildContext, /features\/messaging\/telegramMessagingService\.js$/, [
            'export const telegramMessagingService = globalThis.__workoutLoggingRouteMocks.messagingService;',
        ]);
    },
};

function mockModule(buildContext, filter, contents) {
    const namespace = `mock-${String(filter)}`;
    buildContext.onResolve({filter}, () => ({namespace, path: 'mock'}));
    buildContext.onLoad({filter: /^mock$/, namespace}, () => ({contents: contents.join('\n'), loader: 'js'}));
}

function context({clientId}) {
    return {chatId, text: '/log_workout', user: {chatId, clientId, lang: 'en'}, message: {}};
}
