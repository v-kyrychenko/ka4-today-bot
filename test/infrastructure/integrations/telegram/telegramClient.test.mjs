import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const TELEGRAM_BOT_TOKEN = 'bot-secret-token';

test('telegram client routes all methods through httpRequest with masked logUrl', async () => {
    const module = await loadTelegramClientWithHttpMock();
    const calls = [];

    globalThis.__telegramClientHttpMock = {
        calls,
        async httpRequest(params) {
            calls.push(params);
            return {ok: true};
        },
    };

    await module.sendMessage(7, 'hello');
    await module.sendPhoto(7, 'https://example.com/photo.jpg', 'caption');
    await module.sendPhoto(7, {data: Buffer.from('image-bytes'), filename: 'photo.png'}, 'caption');
    await module.sendMediaGroup(7, ['https://example.com/1.jpg', 'https://example.com/2.jpg'], 'group');

    assert.equal(calls.length, 4);
    assert.deepEqual(
        calls.map((call) => call.path),
        [`/${TELEGRAM_BOT_TOKEN}/sendMessage`, `/${TELEGRAM_BOT_TOKEN}/sendPhoto`, `/${TELEGRAM_BOT_TOKEN}/sendPhoto`, `/${TELEGRAM_BOT_TOKEN}/sendMediaGroup`]
    );
    assert.deepEqual(
        calls.map((call) => call.logUrl),
        [
            'https://api.telegram.org/****/sendMessage',
            'https://api.telegram.org/****/sendPhoto',
            'https://api.telegram.org/****/sendPhoto',
            'https://api.telegram.org/****/sendMediaGroup',
        ]
    );
    assert.equal(calls[2].body instanceof FormData, true);
    assert.equal(calls[2].headers, undefined);
});

test('telegram client logs and errors never expose the real bot token', async () => {
    const module = await loadTelegramClientWithRealHttpClient();
    const logs = [];
    const errors = [];

    globalThis.__telegramClientLogs = {logs, errors};
    globalThis.fetch = async (url) => {
        assert.equal(url, `https://api.telegram.org/${TELEGRAM_BOT_TOKEN}/sendPhoto`);

        return new Response(JSON.stringify({description: 'bad request'}), {
            status: 400,
            headers: {'Content-Type': 'application/json'},
        });
    };

    await assert.rejects(
        module.sendPhoto(7, {data: Buffer.from('image-bytes'), filename: 'photo.png'}, 'caption'),
        (error) => {
            assert.equal(error.name, 'TelegramError');
            assert.doesNotMatch(error.message, new RegExp(TELEGRAM_BOT_TOKEN, 'g'));
            assert.match(error.message, /https:\/\/api\.telegram\.org\/\*\*\*\*\/sendPhoto/);
            return true;
        }
    );

    assert.equal(logs.length, 1);
    assert.match(logs[0], /#form-data/);
    assert.doesNotMatch(logs[0], new RegExp(TELEGRAM_BOT_TOKEN, 'g'));
    assert.equal(errors.length, 1);
    assert.match(errors[0], /https:\/\/api\.telegram\.org\/\*\*\*\*\/sendPhoto/);
    assert.doesNotMatch(errors[0], new RegExp(TELEGRAM_BOT_TOKEN, 'g'));
});

async function loadTelegramClientWithHttpMock() {
    return loadTelegramClient([telegramHttpRequestMockPlugin]);
}

async function loadTelegramClientWithRealHttpClient() {
    return loadTelegramClient([telegramLoggingPlugin]);
}

async function loadTelegramClient(extraPlugins) {
    const outfile = path.join(tmpdir(), `telegram-client-${process.pid}-${Date.now()}-${Math.random()}.mjs`);

    await build({
        bundle: true,
        entryPoints: ['src/infrastructure/integrations/telegram/telegramClient.ts'],
        format: 'esm',
        logLevel: 'silent',
        outfile,
        platform: 'node',
        plugins: [telegramEnvPlugin, telegramErrorsPlugin, ...extraPlugins],
    });

    try {
        return await import(`${pathToFileURL(outfile).href}?cache=${Date.now()}`);
    } finally {
        await rm(outfile, {force: true});
    }
}

const telegramEnvPlugin = {
    name: 'telegram-env-plugin',
    setup(buildContext) {
        buildContext.onResolve({filter: /app\/config\/env\.js$/}, () => ({
            namespace: 'telegram-env-mock',
            path: 'env',
        }));

        buildContext.onLoad({filter: /^env$/, namespace: 'telegram-env-mock'}, () => ({
            contents: `export const TELEGRAM_BOT_TOKEN = '${TELEGRAM_BOT_TOKEN}';`,
            loader: 'js',
        }));
    },
};

const telegramErrorsPlugin = {
    name: 'telegram-errors-plugin',
    setup(buildContext) {
        buildContext.onResolve({filter: /shared\/errors$/}, () => ({
            namespace: 'telegram-errors-mock',
            path: 'errors',
        }));

        buildContext.onLoad({filter: /^errors$/, namespace: 'telegram-errors-mock'}, () => ({
            contents: [
                'export class TelegramError extends Error {',
                '    constructor(message = "Telegram API error", statusCode = 500) {',
                '        super(message);',
                '        this.name = "TelegramError";',
                '        this.statusCode = statusCode;',
                '    }',
                '}',
            ].join('\n'),
            loader: 'js',
        }));
    },
};

const telegramHttpRequestMockPlugin = {
    name: 'telegram-http-request-mock',
    setup(buildContext) {
        buildContext.onResolve({filter: /shared\/http\/httpClient\.js$/}, () => ({
            namespace: 'telegram-http-request-mock',
            path: 'http-client',
        }));

        buildContext.onLoad({filter: /^http-client$/, namespace: 'telegram-http-request-mock'}, () => ({
            contents: [
                'export async function httpRequest(params) {',
                '    return globalThis.__telegramClientHttpMock.httpRequest(params);',
                '}',
            ].join('\n'),
            loader: 'js',
        }));
    },
};

const telegramLoggingPlugin = {
    name: 'telegram-logging-plugin',
    setup(buildContext) {
        buildContext.onResolve({filter: /^\.\.\/logging$/}, (args) => {
            if (!args.importer.includes('/src/shared/http/httpClient.ts')) {
                return null;
            }

            return {
                namespace: 'telegram-logging-mock',
                path: 'logging',
            };
        });

        buildContext.onLoad({filter: /^logging$/, namespace: 'telegram-logging-mock'}, () => ({
            contents: [
                'export function log(message) {',
                '    globalThis.__telegramClientLogs.logs.push(message);',
                '}',
                'export function logError(message) {',
                '    globalThis.__telegramClientLogs.errors.push(message);',
                '}',
            ].join('\n'),
            loader: 'js',
        }));
    },
};
