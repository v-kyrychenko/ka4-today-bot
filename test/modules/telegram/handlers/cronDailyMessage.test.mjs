import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {build} from 'esbuild';

test('daily cron queues daily greeting with scheduled job FIFO metadata', async () => {
    const mocks = {
        scheduledUsers: [
            {client: {chatId: 303}, dictPrompt: {key: 'daily.prompt'}},
        ],
        queued: [],
        repositoryCalls: 0,
        logs: [],
    };
    const {handler} = await loadHandler(mocks);

    await handler();

    assert.equal(mocks.repositoryCalls, 1);
    assert.equal(mocks.queued.length, 1);

    const [message] = mocks.queued;
    assert.equal(message.metadata.MessageGroupId, '303');
    assert.match(message.metadata.MessageDeduplicationId, /^daily-message-daily\.prompt-303-\d{4}-\d{2}-\d{2}$/);

    assert.equal(message.payload.request.message.text, '/daily_greeting');
    assert.equal(message.payload.request.message.promptRef, 'daily.prompt');
    assert.equal(message.payload.request.message.chat.id, 303);
});

async function loadHandler(mocks) {
    globalThis.__cronDailyMessageMocks = mocks;

    const cacheKey = `${Date.now()}`;
    const result = await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/handlers/cronDailyMessage.ts'],
        format: 'esm',
        logLevel: 'silent',
        platform: 'node',
        plugins: [cronDailyMessageMocks],
        write: false,
    });
    const output = result.outputFiles[0];
    const encodedSource = Buffer.from(output.text).toString('base64');

    return await import(`data:text/javascript;base64,${encodedSource}#${cacheKey}`);
}

const cronDailyMessageMocks = {
    name: 'cron-daily-message-mocks',
    setup(buildContext) {
        mockModule(buildContext, /telegramQueueSender\.js$/, [
            'export async function sendTelegramQueueRequest(payload, metadata) {',
            '    globalThis.__cronDailyMessageMocks.queued.push({payload, metadata});',
            '}',
        ]);
        mockModule(buildContext, /withAppInitialization\.js$/, [
            'export function withAppInitialization(handler) { return handler; }',
        ]);
        mockModule(buildContext, /app\/config\/env\.js$/, [
            'export const MAIN_MESSAGE_QUEUE_URL = "queue-url";',
        ]);
        mockModule(buildContext, /shared\/logging$/, [
            'export function log(...args) { globalThis.__cronDailyMessageMocks.logs.push(args); }',
            'export function logError(...args) { globalThis.__cronDailyMessageMocks.logs.push(args); }',
        ]);
        mockModule(buildContext, /tgUserRepository\.js$/, [
            'export const tgUserRepository = {',
            '    async getUsersScheduledForDay() {',
            '        globalThis.__cronDailyMessageMocks.repositoryCalls += 1;',
            '        return globalThis.__cronDailyMessageMocks.scheduledUsers;',
            '    },',
            '};',
        ]);
        mockModule(buildContext, /routes\/constants\.js$/, [
            'export const DAILY_GREETING_ROUTE = "/daily_greeting";',
        ]);
    },
};

function mockModule(buildContext, filter, contents) {
    const namespace = `mock-${String(filter)}`;
    buildContext.onResolve({filter}, () => ({namespace, path: 'mock'}));
    buildContext.onLoad({filter: /^mock$/, namespace}, () => ({contents: contents.join('\n'), loader: 'js'}));
}
