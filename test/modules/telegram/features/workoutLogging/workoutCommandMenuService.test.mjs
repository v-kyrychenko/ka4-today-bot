import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

test('showWorkoutActiveMenu replaces log_workout, preserves other commands, and localizes the description', async () => {
    const {service, telegram, errors} = await loadService({
        commandResults: [[
            {command: 'progress', description: 'Прогрес'},
            {command: 'log_workout', description: 'Почати тренування'},
            {command: 'measurements', description: 'Заміри'},
        ]],
    });

    await service.showWorkoutActiveMenu({chatId: 42, lang: 'uk'});

    assert.deepEqual(telegram.getCalls, [{scope: {type: 'default'}, languageCode: 'uk'}]);
    assert.deepEqual(telegram.setCalls, [{
        commands: [
            {command: 'progress', description: 'Прогрес'},
            {command: 'end_workout', description: '✅ Завершити тренування'},
            {command: 'measurements', description: 'Заміри'},
        ],
        scope: {type: 'chat', chat_id: 42},
        languageCode: undefined,
    }]);
    assert.equal(errors.length, 0);
});

test('showWorkoutActiveMenu falls back to default commands, appends end_workout, and removes duplicates', async () => {
    const {service, telegram} = await loadService({
        commandResults: [[], [
            {command: 'progress', description: 'Progress'},
            {command: 'end_workout', description: 'Old description'},
            {command: 'log_workout', description: 'Start workout'},
        ]],
    });

    await service.showWorkoutActiveMenu({chatId: 42, lang: 'en'});

    assert.deepEqual(telegram.getCalls, [
        {scope: {type: 'default'}, languageCode: 'en'},
        {scope: {type: 'default'}, languageCode: undefined},
    ]);
    assert.deepEqual(telegram.setCalls[0].commands, [
        {command: 'progress', description: 'Progress'},
        {command: 'end_workout', description: '✅ End workout'},
    ]);
});

test('restoreDefaultMenu deletes the chat override and Telegram failures remain non-fatal', async () => {
    const {service, telegram, errors} = await loadService({failDelete: true});

    await service.restoreDefaultMenu(42);

    assert.deepEqual(telegram.deleteCalls, [{scope: {type: 'chat', chat_id: 42}, languageCode: undefined}]);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /Failed to restore default commands for chat 42/);
});

async function loadService(options = {}) {
    const telegram = createTelegramClient(options);
    const errors = [];
    globalThis.__workoutCommandMenuMocks = {telegram, errors};
    const outfile = path.join(tmpdir(), `workout-command-menu-${process.pid}-${Date.now()}-${Math.random()}.mjs`);

    await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/features/workoutLogging/workoutCommandMenuService.ts'],
        format: 'esm',
        logLevel: 'silent',
        outfile,
        platform: 'node',
        plugins: [workoutCommandMenuMocks],
    });

    try {
        const module = await import(`${pathToFileURL(outfile).href}?cache=${Date.now()}-${Math.random()}`);
        return {service: module.workoutCommandMenuService, telegram, errors};
    } finally {
        delete globalThis.__workoutCommandMenuMocks;
        await rm(outfile, {force: true});
    }
}

function createTelegramClient(options) {
    const commandResults = [...(options.commandResults ?? [])];
    const client = {getCalls: [], setCalls: [], deleteCalls: []};

    client.getMyCommands = async (scope, languageCode) => {
        client.getCalls.push({scope, languageCode});
        return commandResults.shift() ?? [];
    };
    client.setMyCommands = async (commands, scope, languageCode) => {
        client.setCalls.push({commands, scope, languageCode});
    };
    client.deleteMyCommands = async (scope, languageCode) => {
        client.deleteCalls.push({scope, languageCode});
        if (options.failDelete) throw new Error('Telegram unavailable');
    };

    return client;
}

const workoutCommandMenuMocks = {
    name: 'workout-command-menu-mocks',
    setup(buildContext) {
        mockModule(buildContext, /telegramClient\.js$/, [
            'export const telegramClient = globalThis.__workoutCommandMenuMocks.telegram;',
        ]);
        mockModule(buildContext, /shared\/logging$/, [
            'const errors = globalThis.__workoutCommandMenuMocks.errors;',
            'export function logError(message) { errors.push(message); }',
        ]);
    },
};

function mockModule(buildContext, filter, contents) {
    const namespace = `mock-${String(filter)}`;
    buildContext.onResolve({filter}, () => ({namespace, path: 'mock'}));
    buildContext.onLoad({filter: /^mock$/, namespace}, () => ({contents: contents.join('\n'), loader: 'js'}));
}
