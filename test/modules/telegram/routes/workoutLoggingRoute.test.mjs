import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const chatId = 42;

test('WorkoutLoggingRoute.canHandle only matches /log_workout', async () => {
    const {route} = await loadRoute({});

    assert.equal(route.canHandle('/log_workout'), true);
    assert.equal(route.canHandle('/log_workout extra'), false);
    assert.equal(route.canHandle('bench press 4x10'), false);
});

test('WorkoutLoggingRoute declares its conversationType for cross-context pre-emption', async () => {
    const {route} = await loadRoute({});

    assert.equal(route.conversationType, 'WORKOUT_LOGGING');
});

// AC-02: an unregistered client is denied without ever starting the conversation.
test('execute() denies a non-client without starting the conversation (AC-02)', async () => {
    const {route, calls} = await loadRoute({startOutcome: 'not-a-client'});

    await route.execute(context({clientId: null}));

    assert.equal(calls.conversationStart.length, 0);
    assert.match(calls.sent[0].text, /isn.t available for you yet/);
});

// AC-12: a repeat start while already open is rejected, no new conversation/session starts.
test('execute() rejects a repeat start while a session is already open (AC-12)', async () => {
    const {route, calls} = await loadRoute({startOutcome: 'already-open'});

    await route.execute(context({clientId: 777}));

    assert.equal(calls.conversationStart.length, 0);
    assert.match(calls.sent[0].text, /already have a workout-logging session open/);
});

test('execute() starts the session and the conversation, seeding session/client ids (AC-01)', async () => {
    const {route, calls} = await loadRoute({startOutcome: 'started', sessionId: 555});

    await route.execute(context({clientId: 777}));

    assert.equal(calls.startSession[0].clientId, 777);
    assert.equal(calls.conversationStart.length, 1);
    assert.deepEqual(calls.conversationStart[0].data, {sessionId: 555, clientId: 777});
    assert.equal(calls.sent[0].text, 'started');
});

async function loadRoute(options) {
    const calls = {startSession: [], conversationStart: [], sent: []};

    globalThis.__workoutLoggingRouteMocks = {
        workoutLoggingService: {
            async startSession(input) {
                calls.startSession.push(input);
                return {outcome: options.startOutcome ?? 'started', sessionId: options.sessionId};
            },
        },
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
        mockModule(buildContext, /workoutLogging\/workoutLoggingService\.js$/, [
            'export const workoutLoggingService = globalThis.__workoutLoggingRouteMocks.workoutLoggingService;',
        ]);
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
