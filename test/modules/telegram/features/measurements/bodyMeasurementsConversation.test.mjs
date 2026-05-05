import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const chatId = 42;
const user = {chatId, clientId: 777, lang: 'en'};

class TestHttpApiError extends Error {
    constructor(statusCode, code, message = 'HTTP API error') {
        super(message);
        this.name = 'HttpApiError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

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
    assert.match(response.text, /Please check if everything looks right/);
    assert.equal(response.replyMarkup.inline_keyboard[0][0].callback_data, 'MEASUREMENTS:SAVE');
});

test('partial input moves to confirmation with parsed fields', async () => {
    const partial = fullMeasurements.slice(0, 2);
    const {definition, repository} = await loadConversation({promptReply: partial});
    const state = createState();

    const response = await definition.steps.WAITING_INPUT.onText({text: 'weight and waist', user, state});

    assert.equal(repository.updated.currentStep, 'WAITING_CONFIRMATION');
    assert.deepEqual(repository.updated.data.measurements, partial);
    assert.match(response.text, /Weight: 78.4 kg/);
    assert.match(response.text, /Waist: 84 cm/);
});

test('input stores parsed data when state already has measurements', async () => {
    const existing = fullMeasurements.slice(0, 2);
    const incoming = fullMeasurements.slice(2);
    const {definition, repository} = await loadConversation({promptReply: {measurements: incoming}});
    const state = createState({measurements: existing}, 'WAITING_INPUT');

    const response = await definition.steps.WAITING_INPUT.onText({text: 'remaining', user, state});

    assert.equal(repository.updated.currentStep, 'WAITING_CONFIRMATION');
    assert.deepEqual(repository.updated.data.measurements, incoming);
    assert.match(response.text, /Please check if everything looks right/);
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
    assert.equal(response.text, '✅ Done, body measurements saved.');
    assert.equal(response.removeReplyMarkup, true);
});

test('save deactivates conversation when measurements are too soon', async () => {
    const service = createTooSoonBodyMeasurementService();
    const {definition, repository} = await loadConversation({bodyMeasurementService: service});
    const state = createState({measurements: fullMeasurements}, 'WAITING_CONFIRMATION');

    const response = await definition.steps.WAITING_CONFIRMATION.onCallback({
        callbackData: 'MEASUREMENTS:SAVE',
        messageId: 1001,
        user,
        state,
    });

    assert.equal(service.stored.length, 0);
    assert.equal(service.storeAttempts, 1);
    assert.equal(repository.deactivated.id, state.id);
    assert.equal(repository.deactivated.finalStep, 'CANCELLED');
    assert.equal(response.removeReplyMarkup, true);
    assert.equal(
        response.text,
        '⏳ Body measurements can be saved once every 30 days.\n\nYour previous measurements are still too recent, so I didn’t save this update.'
    );
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
    assert.equal(response.text, '✏️ Send the corrected body measurements in one message — I’ll parse them.');
    assert.equal(response.removeReplyMarkup, undefined);
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
    assert.equal(response.text, '👌 Body measurement entry cancelled.');
    assert.equal(response.removeReplyMarkup, true);
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
    assert.equal(
        invalidResponse.text,
        '❌ Не вдалося розпізнати заміри тіла.\n\nНадішли їх ще раз одним повідомленням у вільному форматі — я розберу.'
    );

    const partial = await loadConversation({promptReply: fullMeasurements.slice(0, 2)});
    const missingResponse = await partial.definition.steps.WAITING_INPUT.onText({
        text: 'weight and waist',
        user: ukUser,
        state: createState(),
    });
    assert.match(missingResponse.text, /^✅ Ось що я розібрав із повідомлення\./);
    assert.match(missingResponse.text, /Вага: 78.4 kg/);
    assert.match(missingResponse.text, /Талія: 84 cm/);

    const complete = await loadConversation({promptReply: {measurements: fullMeasurements}});
    const confirmationResponse = await complete.definition.steps.WAITING_INPUT.onText({
        text: 'all measurements',
        user: ukUser,
        state: createState(),
    });
    assert.match(confirmationResponse.text, /^✅ Ось що я розібрав із повідомлення\./);
    assert.equal(confirmationResponse.replyMarkup.inline_keyboard[0][0].text, '✅ Зберегти');
    assert.equal(confirmationResponse.replyMarkup.inline_keyboard[0][1].text, '✏️ Змінити');
    assert.equal(confirmationResponse.replyMarkup.inline_keyboard[0][2].text, '❌ Скасувати');

    const editResponse = await complete.definition.steps.WAITING_CONFIRMATION.onCallback({
        callbackData: 'MEASUREMENTS:EDIT',
        messageId: 1001,
        user: ukUser,
        state,
    });
    assert.equal(editResponse.text, '✏️ Надішли виправлені заміри тіла одним повідомленням — я розберу.');

    const cancelResponse = await complete.definition.steps.WAITING_CONFIRMATION.onCallback({
        callbackData: 'MEASUREMENTS:CANCEL',
        messageId: 1001,
        user: ukUser,
        state,
    });
    assert.equal(cancelResponse.text, '👌 Введення замірів тіла скасовано.');

    const save = await loadConversation({bodyMeasurementService: createBodyMeasurementService()});
    const saveResponse = await save.definition.steps.WAITING_CONFIRMATION.onCallback({
        callbackData: 'MEASUREMENTS:SAVE',
        messageId: 1001,
        user: ukUser,
        state,
    });
    assert.equal(saveResponse.text, '✅ Готово, заміри тіла збережено.');

    const unsupportedResponse = await complete.definition.steps.WAITING_CONFIRMATION.onCallback({
        callbackData: 'MEASUREMENTS:UNKNOWN',
        messageId: 1001,
        user: ukUser,
        state,
    });
    assert.equal(unsupportedResponse.text, 'Ця дія поки недоступна для замірів тіла.');
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
        HttpApiError: TestHttpApiError,
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
        mockModule(buildContext, /shared\/errors(?:\/index)?(?:\.js)?$/, [
            'export const HttpApiError = globalThis.__measurementConversationMocks.HttpApiError;',
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

function createTooSoonBodyMeasurementService() {
    return {
        stored: [],
        storeAttempts: 0,
        async store() {
            this.storeAttempts += 1;
            throw new TestHttpApiError(409, 'BODY_MEASUREMENT_TOO_SOON', 'Body measurements can be submitted once every 30 days');
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
