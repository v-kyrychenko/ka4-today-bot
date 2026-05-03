import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const chatId = 42;
const fullMeasurements = [
    {type: 'WEIGHT', value: 78.4, unit: 'kg'},
    {type: 'WAIST', value: 84, unit: 'cm'},
    {type: 'CHEST', value: 101, unit: 'cm'},
    {type: 'HIPS', value: 97, unit: 'cm'},
    {type: 'THIGH', value: 56, unit: 'cm'},
    {type: 'CALF', value: 38, unit: 'cm'},
    {type: 'BICEPS', value: 34, unit: 'cm'},
];

test('full all-seven input moves to confirmation', async () => {
    const {definition, repository} = await loadConversation({promptReply: {measurements: fullMeasurements}});
    const state = createState();

    const response = await definition.steps.WAITING_INPUT.onText({chatId, text: 'all measurements', state});

    assert.equal(repository.updated.currentStep, 'WAITING_CONFIRMATION');
    assert.deepEqual(repository.updated.data.measurements, fullMeasurements);
    assert.match(response.text, /Please check these measurements/);
    assert.equal(response.replyMarkup.inline_keyboard[0][0].callback_data, 'MEASUREMENTS:SAVE');
});

test('partial input asks only for missing fields', async () => {
    const partial = fullMeasurements.slice(0, 2);
    const {definition, repository} = await loadConversation({promptReply: partial});
    const state = createState();

    const response = await definition.steps.WAITING_INPUT.onText({chatId, text: 'weight and waist', state});

    assert.equal(repository.updated.currentStep, 'WAITING_MISSING_FIELDS');
    assert.deepEqual(repository.updated.data.measurements, partial);
    assert.match(response.text, /Chest, Hips, Thigh, Calf, Biceps/);
});

test('missing-field input merges with existing data', async () => {
    const existing = fullMeasurements.slice(0, 2);
    const incoming = fullMeasurements.slice(2);
    const {definition, repository} = await loadConversation({promptReply: {measurements: incoming}});
    const state = createState({measurements: existing}, 'WAITING_MISSING_FIELDS');

    const response = await definition.steps.WAITING_MISSING_FIELDS.onText({chatId, text: 'remaining', state});

    assert.equal(repository.updated.currentStep, 'WAITING_CONFIRMATION');
    assert.deepEqual(repository.updated.data.measurements, fullMeasurements);
    assert.match(response.text, /Please check these measurements/);
});

test('save stores measurements and completes', async () => {
    const service = createBodyMeasurementService();
    const {definition, repository} = await loadConversation({bodyMeasurementService: service});
    const state = createState({measurements: fullMeasurements}, 'WAITING_CONFIRMATION');

    const response = await definition.steps.WAITING_CONFIRMATION.onCallback({
        chatId,
        callbackData: 'MEASUREMENTS:SAVE',
        messageId: 1001,
        state,
    });

    assert.equal(service.stored.length, 7);
    assert.equal(service.stored[0].clientId, 777);
    assert.equal(repository.deactivated.finalStep, 'COMPLETED');
    assert.equal(response.text, 'Measurements saved.');
});

test('edit returns to input and keeps data', async () => {
    const {definition, repository} = await loadConversation({});
    const data = {measurements: fullMeasurements};
    const state = createState(data, 'WAITING_CONFIRMATION');

    const response = await definition.steps.WAITING_CONFIRMATION.onCallback({
        chatId,
        callbackData: 'MEASUREMENTS:EDIT',
        messageId: 1001,
        state,
    });

    assert.equal(repository.updated.currentStep, 'WAITING_INPUT');
    assert.equal(repository.updated.data, data);
    assert.equal(response.text, 'Send the corrected measurements in one message.');
});

test('cancel deactivates conversation', async () => {
    const {definition, repository} = await loadConversation({});
    const state = createState({measurements: fullMeasurements}, 'WAITING_CONFIRMATION');

    const response = await definition.steps.WAITING_CONFIRMATION.onCallback({
        chatId,
        callbackData: 'MEASUREMENTS:CANCEL',
        messageId: 1001,
        state,
    });

    assert.equal(repository.deactivated.finalStep, 'CANCELLED');
    assert.equal(response.text, 'Measurement input cancelled.');
});

async function loadConversation(options) {
    const repository = createConversationRepository();
    const userRepository = {
        async findActiveByChatId() {
            return {chatId, clientId: 777, lang: 'en'};
        },
    };
    const promptService = {
        async fetchOpenAiReply() {
            return JSON.stringify(options.promptReply ?? []);
        },
    };
    const bodyMeasurementService = options.bodyMeasurementService ?? createBodyMeasurementService();

    globalThis.__measurementConversationMocks = {
        repository,
        userRepository,
        promptService,
        bodyMeasurementService,
    };

    const outfile = path.join(tmpdir(), `measurements-conversation-${process.pid}-${Date.now()}.mjs`);

    await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/features/measurements/bodyMeasurementsConversation.ts'],
        format: 'esm',
        logLevel: 'silent',
        outfile,
        platform: 'node',
        plugins: [measurementConversationMocks],
    });

    try {
        const module = await import(`${pathToFileURL(outfile).href}?cache=${Date.now()}`);
        return {definition: module.bodyMeasurementsConversation, repository, bodyMeasurementService};
    } finally {
        await rm(outfile, {force: true});
    }
}

const measurementConversationMocks = {
    name: 'measurement-conversation-mocks',
    setup(buildContext) {
        mockModule(buildContext, /tgConversationStateRepository\.js$/, [
            'export const tgConversationStateRepository = globalThis.__measurementConversationMocks.repository;',
        ]);
        mockModule(buildContext, /tgUserRepository\.js$/, [
            'export const tgUserRepository = globalThis.__measurementConversationMocks.userRepository;',
        ]);
        mockModule(buildContext, /promptReplyService\.js$/, [
            'export const promptReplyService = globalThis.__measurementConversationMocks.promptService;',
        ]);
        mockModule(buildContext, /bodyMeasurementService\.js$/, [
            'export const bodyMeasurementService = globalThis.__measurementConversationMocks.bodyMeasurementService;',
        ]);
    },
};

function mockModule(buildContext, filter, contents) {
    const namespace = `mock-${String(filter)}`;
    buildContext.onResolve({filter}, () => ({namespace, path: 'mock'}));
    buildContext.onLoad({filter: /^mock$/, namespace}, () => ({contents: contents.join('\n'), loader: 'js'}));
}

function createConversationRepository() {
    return {
        updated: null,
        deactivated: null,
        async updateConversation(input) {
            this.updated = input;
            return input;
        },
        async deactivateConversation(input) {
            this.deactivated = input;
            return input;
        },
    };
}

function createBodyMeasurementService() {
    return {
        stored: [],
        async store(input) {
            this.stored = input;
        },
    };
}

function createState(data = {}, currentStep = 'WAITING_INPUT') {
    return {
        id: 1,
        chat_id: chatId,
        type: 'BODY_MEASUREMENTS',
        current_step: currentStep,
        data,
        last_bot_msg_id: null,
        is_active: true,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
}
