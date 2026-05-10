import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {build} from 'esbuild';

test('telegram queue sender serializes payload and sends FIFO metadata to the main queue', async () => {
    const mocks = {
        sent: [],
        logs: [],
    };
    const {sendTelegramQueueRequest} = await loadModule(mocks);
    const payload = {request: {message: {text: '/measurements', chat: {id: 101}}}};
    const metadata = {
        MessageGroupId: '101',
        MessageDeduplicationId: 'measurements-reminder-101-2026-05-06',
    };

    await sendTelegramQueueRequest(payload, metadata);

    assert.deepEqual(mocks.sent, [{
        QueueUrl: 'queue-url',
        MessageBody: JSON.stringify(payload),
        MessageGroupId: '101',
        MessageDeduplicationId: 'measurements-reminder-101-2026-05-06',
    }]);
    assert.deepEqual(mocks.logs, [[
        `Sending to queue:queue-url payload:${JSON.stringify(payload)}`,
    ]]);
});

async function loadModule(mocks) {
    globalThis.__telegramQueueSenderMocks = mocks;

    const cacheKey = `${Date.now()}-${Math.random()}`;
    const result = await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/features/sqs/telegramQueueSender.ts'],
        format: 'esm',
        logLevel: 'silent',
        platform: 'node',
        plugins: [telegramQueueSenderMocks],
        write: false,
    });
    const output = result.outputFiles[0];
    const encodedSource = Buffer.from(output.text).toString('base64');

    return await import(`data:text/javascript;base64,${encodedSource}#${cacheKey}`);
}

const telegramQueueSenderMocks = {
    name: 'telegram-queue-sender-mocks',
    setup(buildContext) {
        mockModule(buildContext, /^@aws-sdk\/client-sqs$/, [
            'export class SendMessageCommand { constructor(input) { this.input = input; } }',
            'export class SQSClient {',
            '    async send(command) { globalThis.__telegramQueueSenderMocks.sent.push(command.input); }',
            '}',
        ]);
        mockModule(buildContext, /app\/config\/env\.js$/, [
            'export const MAIN_MESSAGE_QUEUE_URL = "queue-url";',
        ]);
        mockModule(buildContext, /shared\/logging$/, [
            'export function log(...args) { globalThis.__telegramQueueSenderMocks.logs.push(args); }',
        ]);
    },
};

let mockModuleIndex = 0;

function mockModule(buildContext, filter, contents) {
    const namespace = `mock-${mockModuleIndex}`;
    mockModuleIndex += 1;
    buildContext.onResolve({filter}, () => ({namespace, path: 'mock'}));
    buildContext.onLoad({filter: /^mock$/, namespace}, () => ({contents: contents.join('\n'), loader: 'js'}));
}
