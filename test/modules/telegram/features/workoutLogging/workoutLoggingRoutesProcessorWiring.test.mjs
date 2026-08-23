import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const chatId = 42;
const clientId = 777;

// T12/AC-10: any other route, or a cron-enqueued reminder (which reaches routesProcessor as a
// synthetic message per ADR-0003), must end an open workout-logging session early ("pre-empted"),
// discarding any unconfirmed entry, before the other interaction is handled. Per ADR-0003 this is
// a single, unconditional call site inside routesProcessor.execute() itself.
test('routesProcessor pre-empts an open workout-logging session before handling an unrelated route (AC-10)', async () => {
    const processor = await loadRoutesProcessorWithWorkoutLogging({
        calls: [],
        closeExpiredOutcome: 'active',
        preemptOutcome: 'pre-empted',
    });

    await processor.routesProcessor.execute(messageRequest('/progress'));

    assertCalledBefore(processor.calls, 'closeExpiredSession', 'preemptActiveSession');
    assertCalledBefore(processor.calls, 'preemptActiveSession', 'handleText');
    assert.deepEqual(
        processor.calls.find((call) => call[0] === 'preemptActiveSession'),
        ['preemptActiveSession', clientId],
        'expected preemptActiveSession to be called with the message client id',
    );
});

// T12/AC-11: a session idle for more than 2h (from start or its last recorded entry, whichever is
// later) must be lazily closed as "auto-closed" on the very next check, without waiting for the
// client to send a workout-logging-specific message. Since it was already closed as expired,
// pre-emption must not additionally close it again as "pre-empted".
test('routesProcessor lazily auto-closes an idle-expired workout-logging session on the next message, without also pre-empting it (AC-11)', async () => {
    const processor = await loadRoutesProcessorWithWorkoutLogging({
        calls: [],
        closeExpiredOutcome: 'auto-closed',
        preemptOutcome: 'no-active-session',
    });

    await processor.routesProcessor.execute(messageRequest('/progress'));

    const closeCall = processor.calls.find((call) => call[0] === 'closeExpiredSession');
    assert.ok(closeCall, 'expected closeExpiredSession to be called on the next message');
    assert.equal(closeCall[1], clientId, 'expected closeExpiredSession to be called with the message client id');

    const preemptCall = processor.calls.find((call) => call[0] === 'preemptActiveSession');
    assert.equal(
        preemptCall,
        undefined,
        'expected preemptActiveSession NOT to be called once the session was already auto-closed as expired',
    );
});

function assertCalledBefore(calls, earlierName, laterName) {
    const earlierIndex = calls.findIndex((call) => call[0] === earlierName);
    const laterIndex = calls.findIndex((call) => call[0] === laterName);

    assert.ok(earlierIndex !== -1, `expected a "${earlierName}" call, got calls: ${JSON.stringify(calls)}`);
    assert.ok(laterIndex !== -1, `expected a "${laterName}" call, got calls: ${JSON.stringify(calls)}`);
    assert.ok(
        earlierIndex < laterIndex,
        `expected "${earlierName}" to happen before "${laterName}", got calls: ${JSON.stringify(calls)}`,
    );
}

async function loadRoutesProcessorWithWorkoutLogging(options) {
    const calls = options.calls;

    globalThis.__telegramRouteMocks = {
        conversationEngine: {
            async handleText(input) {
                calls.push(['handleText', input.user.chatId, input.text]);
                return null;
            },
            async handleCallback() {
                return null;
            },
            async cancel() {
                return null;
            },
        },
        userRepository: {
            async getOrCreateUser(inputChatId) {
                calls.push(['getOrCreateUser', inputChatId]);
                return {chatId: inputChatId, clientId, lang: 'en'};
            },
        },
        workoutLoggingService: {
            async preemptActiveSession(request) {
                calls.push(['preemptActiveSession', request.clientId]);
                return {outcome: options.preemptOutcome};
            },
            async closeExpiredSession(request) {
                calls.push(['closeExpiredSession', request.clientId]);
                return {outcome: options.closeExpiredOutcome};
            },
        },
        messagingService: {
            async answerCallbackQuery() {},
            async removeReplyMarkup() {},
            async sendMessage(context, text) {
                calls.push(['send', context.chatId, text]);
            },
            async sendErrorMessage(inputChatId, text) {
                calls.push(['error', inputChatId, text]);
            },
        },
        routeRegistry: [
            {
                canHandle() {
                    return true;
                },
                shouldSendProcessingNotice() {
                    return false;
                },
                async execute() {
                    calls.push(['routeExecute']);
                },
            },
        ],
    };

    const outfile = path.join(tmpdir(), `workout-logging-routes-processor-${process.pid}-${Date.now()}-${Math.random()}.mjs`);

    await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/routes/routesProcessor.ts'],
        format: 'esm',
        logLevel: 'silent',
        outfile,
        platform: 'node',
        plugins: [routeMocks],
    });

    try {
        const module = await import(`${pathToFileURL(outfile).href}?cache=${Date.now()}-${Math.random()}`);
        return {routesProcessor: module.routesProcessor, calls};
    } finally {
        delete globalThis.__telegramRouteMocks;
        await rm(outfile, {force: true});
    }
}

const routeMocks = {
    name: 'workout-logging-route-mocks',
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
        mockModule(buildContext, /features\/workoutLogging\/workoutLoggingService\.js$/, [
            'export const workoutLoggingService = globalThis.__telegramRouteMocks.workoutLoggingService;',
        ]);
        mockModule(buildContext, /features\/workoutLogging\/repository\/workoutLogRepository\.js$/, [
            'export const workoutLogRepository = {};',
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
