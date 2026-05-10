import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {build} from 'esbuild';

test('measurements reminder cron queues /measurements with daily FIFO dedupe metadata', async () => {
    const mocks = {
        users: [
            {chatId: 101, clientId: 1001, latestMeasurementDate: null},
            {chatId: 202, clientId: 2002, latestMeasurementDate: '2025-12-01'},
        ],
        queued: [],
        repositoryCalls: [],
        logs: [],
    };
    const {handler} = await loadHandler(mocks);

    await handler();

    assert.equal(mocks.repositoryCalls.length, 1);
    assert.match(mocks.repositoryCalls[0], /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(mocks.queued.length, 2);

    assertQueuedReminder(mocks.queued[0], 101);
    assertQueuedReminder(mocks.queued[1], 202);
});

test('measurements reminder cron does not queue messages when no users are due', async () => {
    const mocks = {
        users: [],
        queued: [],
        repositoryCalls: [],
        logs: [],
    };
    const {handler} = await loadHandler(mocks);

    await handler();

    assert.equal(mocks.repositoryCalls.length, 1);
    assert.deepEqual(mocks.queued, []);
    assert.deepEqual(mocks.logs.find(([message]) => message === 'Measurements reminder cron found users'), [
        'Measurements reminder cron found users',
        {count: 0},
    ]);
});

async function loadHandler(mocks) {
    globalThis.__cronMeasurementsReminderMocks = mocks;

    const cacheKey = `${Date.now()}`;
    const result = await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/handlers/cronMeasurementsReminder.ts'],
        format: 'esm',
        logLevel: 'silent',
        platform: 'node',
        plugins: [cronMeasurementsReminderMocks],
        write: false,
    });
    const output = result.outputFiles[0];
    const encodedSource = Buffer.from(output.text).toString('base64');

    return await import(`data:text/javascript;base64,${encodedSource}#${cacheKey}`);
}

const cronMeasurementsReminderMocks = {
    name: 'cron-measurements-reminder-mocks',
    setup(buildContext) {
        mockModule(buildContext, /telegramQueueSender\.js$/, [
            'export async function sendTelegramQueueRequest(payload, metadata) {',
            '    globalThis.__cronMeasurementsReminderMocks.queued.push({payload, metadata});',
            '}',
        ]);
        mockModule(buildContext, /withAppInitialization\.js$/, [
            'export function withAppInitialization(handler) { return handler; }',
        ]);
        mockModule(buildContext, /app\/config\/env\.js$/, [
            'export const MAIN_MESSAGE_QUEUE_URL = "queue-url";',
        ]);
        mockModule(buildContext, /shared\/logging$/, [
            'export function log(...args) { globalThis.__cronMeasurementsReminderMocks.logs.push(args); }',
            'export function logError(...args) { globalThis.__cronMeasurementsReminderMocks.logs.push(args); }',
        ]);
        mockModule(buildContext, /bodyMeasurementService\.js$/, [
            'export const MIN_DAYS_BETWEEN_MEASUREMENTS = 30;',
            'export const bodyMeasurementService = {};',
        ]);
        mockModule(buildContext, /bodyMeasurementRepository\.js$/, [
            'export const bodyMeasurementRepository = {',
            '    async findReminderCandidates(cutoffDate) {',
            '        globalThis.__cronMeasurementsReminderMocks.repositoryCalls.push(cutoffDate);',
            '        return globalThis.__cronMeasurementsReminderMocks.users;',
            '    },',
            '};',
        ]);
        mockModule(buildContext, /routes\/constants\.js$/, [
            'export const MEASUREMENTS_ROUTE = "/measurements";',
        ]);
    },
};

function assertQueuedReminder(message, chatId) {
    assert.equal(message.metadata.MessageGroupId, String(chatId));
    assert.match(
        message.metadata.MessageDeduplicationId,
        new RegExp(`^measurements-reminder-${chatId}-\\d{4}-\\d{2}-\\d{2}$`)
    );

    assert.equal(message.payload.request.message.text, '/measurements');
    assert.equal(message.payload.request.message.chat.id, chatId);
    assert.equal(message.payload.request.message.promptRef, undefined);
}

function mockModule(buildContext, filter, contents) {
    const namespace = `mock-${String(filter)}`;
    buildContext.onResolve({filter}, () => ({namespace, path: 'mock'}));
    buildContext.onLoad({filter: /^mock$/, namespace}, () => ({contents: contents.join('\n'), loader: 'js'}));
}
