import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const chatId = 42;
const user = {chatId, clientId: 777, lang: 'en'};
const fullMeasurements = [
    {type: 'WEIGHT', value: 78.4, unit: 'kg'},
    {type: 'WAIST', value: 84, unit: 'cm'},
    {type: 'CHEST', value: 101, unit: 'cm'},
    {type: 'HIPS', value: 97, unit: 'cm'},
    {type: 'THIGH', value: 56, unit: 'cm'},
    //{type: 'CALF', value: 38, unit: 'cm'},
    {type: 'BICEPS', value: 34, unit: 'cm'},
];

test('full input moves to confirmation', async () => {
    const {definition, repository} = await loadConversation({promptReply: {measurements: fullMeasurements}});
    const state = createState();

    const response = await definition.steps.WAITING_INPUT.onText({text: 'all measurements', user, state});

    assert.equal(repository.updated.currentStep, 'WAITING_CONFIRMATION');
    assert.deepEqual(repository.updated.data.measurements, fullMeasurements);
    assert.match(response.text, /Please check these measurements/);
    assert.equal(response.replyMarkup.inline_keyboard[0][0].callback_data, 'MEASUREMENTS:SAVE');
});

test('partial input asks only for missing fields', async () => {
    const partial = fullMeasurements.slice(0, 2);
    const {definition, repository} = await loadConversation({promptReply: partial});
    const state = createState();

    const response = await definition.steps.WAITING_INPUT.onText({text: 'weight and waist', user, state});

    assert.equal(repository.updated.currentStep, 'WAITING_MISSING_FIELDS');
    assert.deepEqual(repository.updated.data.measurements, partial);
    // CALF is intentionally disabled for now.
    assert.match(response.text, /Chest, Hips, Thigh, Biceps/);
});

test('missing-field input merges with existing data', async () => {
    const existing = fullMeasurements.slice(0, 2);
    const incoming = fullMeasurements.slice(2);
    const {definition, repository} = await loadConversation({promptReply: {measurements: incoming}});
    const state = createState({measurements: existing}, 'WAITING_MISSING_FIELDS');

    const response = await definition.steps.WAITING_MISSING_FIELDS.onText({text: 'remaining', user, state});

    assert.equal(repository.updated.currentStep, 'WAITING_CONFIRMATION');
    assert.deepEqual(repository.updated.data.measurements, fullMeasurements);
    assert.match(response.text, /Please check these measurements/);
});

test('save stores measurements and completes', async () => {
    const service = createBodyMeasurementService();
    const {definition, repository} = await loadConversation({bodyMeasurementService: service});
    const state = createState({measurements: fullMeasurements}, 'WAITING_CONFIRMATION');

    const response = await definition.steps.WAITING_CONFIRMATION.onCallback({
        callbackData: 'MEASUREMENTS:SAVE',
        messageId: 1001,
        user,
        state,
    });

    // CALF is intentionally disabled for now.
    assert.equal(service.stored.length, 6);
    assert.equal(service.stored[0].clientId, 777);
    assert.equal(repository.deactivated.finalStep, 'COMPLETED');
    assert.equal(response.text, 'Measurements saved.');
});

test('edit returns to input and keeps data', async () => {
    const {definition, repository} = await loadConversation({});
    const data = {measurements: fullMeasurements};
    const state = createState(data, 'WAITING_CONFIRMATION');

    const response = await definition.steps.WAITING_CONFIRMATION.onCallback({
        callbackData: 'MEASUREMENTS:EDIT',
        messageId: 1001,
        user,
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
        callbackData: 'MEASUREMENTS:CANCEL',
        messageId: 1001,
        user,
        state,
    });

    assert.equal(repository.deactivated.finalStep, 'CANCELLED');
    assert.equal(response.text, 'Measurement input cancelled.');
});

test('body measurements conversation uses user language for each response path', async () => {
    const ukUser = {...user, lang: 'uk'};
    const state = createState({measurements: fullMeasurements}, 'WAITING_CONFIRMATION');

    const initial = await loadConversation({});
    assert.match(initial.definition.getInitialMessage(ukUser).text, /^📏 Надішли заміри/);

    const invalid = await loadConversation({promptReply: []});
    const invalidResponse = await invalid.definition.steps.WAITING_INPUT.onText({
        text: 'not measurements',
        user: ukUser,
        state: createState(),
    });
    assert.equal(invalidResponse.text, 'Я не зміг розпізнати заміри. Надішли їх ще раз у вільному форматі.');

    const partial = await loadConversation({promptReply: fullMeasurements.slice(0, 2)});
    const missingResponse = await partial.definition.steps.WAITING_INPUT.onText({
        text: 'weight and waist',
        user: ukUser,
        state: createState(),
    });
    // CALF is intentionally disabled for now.
    assert.equal(missingResponse.text, 'Прийняв. Надішли лише відсутні заміри: Груди, Таз, Стегно, Біцепс.');

    const complete = await loadConversation({promptReply: {measurements: fullMeasurements}});
    const confirmationResponse = await complete.definition.steps.WAITING_INPUT.onText({
        text: 'all measurements',
        user: ukUser,
        state: createState(),
    });
    assert.match(confirmationResponse.text, /^Перевір, будь ласка, ці заміри:/);
    assert.equal(confirmationResponse.replyMarkup.inline_keyboard[0][0].text, '✅ Зберегти');
    assert.equal(confirmationResponse.replyMarkup.inline_keyboard[0][1].text, '✏️ Змінити');
    assert.equal(confirmationResponse.replyMarkup.inline_keyboard[0][2].text, '❌ Скасувати');

    const editResponse = await complete.definition.steps.WAITING_CONFIRMATION.onCallback({
        callbackData: 'MEASUREMENTS:EDIT',
        messageId: 1001,
        user: ukUser,
        state,
    });
    assert.equal(editResponse.text, 'Надішли виправлені заміри одним повідомленням.');

    const cancelResponse = await complete.definition.steps.WAITING_CONFIRMATION.onCallback({
        callbackData: 'MEASUREMENTS:CANCEL',
        messageId: 1001,
        user: ukUser,
        state,
    });
    assert.equal(cancelResponse.text, 'Введення замірів скасовано.');

    const save = await loadConversation({bodyMeasurementService: createBodyMeasurementService()});
    const saveResponse = await save.definition.steps.WAITING_CONFIRMATION.onCallback({
        callbackData: 'MEASUREMENTS:SAVE',
        messageId: 1001,
        user: ukUser,
        state,
    });
    assert.equal(saveResponse.text, 'Заміри збережено.');

    const unsupportedResponse = await complete.definition.steps.WAITING_CONFIRMATION.onCallback({
        callbackData: 'MEASUREMENTS:UNKNOWN',
        messageId: 1001,
        user: ukUser,
        state,
    });
    assert.equal(unsupportedResponse.text, 'Ця дія поки недоступна в цьому чекіні.');
});

async function loadConversation(options) {
    const repository = createConversationRepository();
    const promptService = {
        async fetchOpenAiReply() {
            return JSON.stringify(options.promptReply ?? []);
        },
    };
    const bodyMeasurementService = options.bodyMeasurementService ?? createBodyMeasurementService();

    globalThis.__measurementConversationMocks = {
        repository,
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
