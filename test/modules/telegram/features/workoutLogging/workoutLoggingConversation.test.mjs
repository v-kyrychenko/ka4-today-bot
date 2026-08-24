import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const chatId = 42;
const user = {chatId, clientId: 777, lang: 'en'};
const parsedExercise = {name: 'Bench press', reps: 10, sets: 4, weight: 60};
const candidates = [
    {exerciseId: 1, name: {en: 'Bench Press'}, reps: 10, sets: 4, weight: 60, imageUrl: null},
    {exerciseId: 2, name: {en: 'Incline Bench Press'}, reps: 10, sets: 4, weight: 60, imageUrl: null},
];

test('AC-01/AC-14: getInitialMessage replies in the client stored lang', async () => {
    const {definition} = await loadConversation({});

    assert.match(definition.getInitialMessage({...user, lang: 'en'}).text, /Workout logging started/);
    assert.match(definition.getInitialMessage({...user, lang: 'uk'}).text, /Тренування розпочато/);
});

// T8/AC-03/AC-05: a well-formed message moves to WAITING_CONFIRMATION with a combined
// exercise+numbers confirmation and one button per catalog candidate, no entry saved yet.
test('WAITING_INPUT.onText with a well-formed message proposes confirmation with candidate buttons (AC-03/AC-05)', async () => {
    const {definition, repository, service} = await loadConversation({
        parseResult: {outcome: 'parsed', exercise: parsedExercise},
        matchResult: {outcome: 'matched', candidates},
    });
    const state = createState({sessionId: 5, clientId: 777});

    const response = await definition.steps.WAITING_INPUT.onText({
        text: 'Bench press, 4 sets of 10 reps, 60kg',
        user,
        state,
    });

    assert.match(response.text, /Bench press/);
    assert.equal(response.replyMarkup.inline_keyboard.length, 3, 'expected 2 candidate rows + 1 keep-own/reject row');
    assert.equal(response.replyMarkup.inline_keyboard[0][0].text, 'Bench Press');
    assert.equal(response.replyMarkup.inline_keyboard[0][0].callback_data, 'WORKOUT:PICK:1');
    assert.equal(repository.updated.currentStep, 'WAITING_CONFIRMATION');
    assert.deepEqual(repository.updated.data.pending.parsedExercise, parsedExercise);
    assert.equal(service.calls.addEntry.length, 0, 'expected no entry saved before confirmation (QG-1)');
});

// T8/AC-05b: zero catalog candidates still proposes a confirmation (of the description itself).
test('WAITING_INPUT.onText with no catalog match still proposes confirmation with zero candidate buttons (AC-05b)', async () => {
    const {definition} = await loadConversation({
        parseResult: {outcome: 'parsed', exercise: {name: 'Obscure move', reps: 8, sets: 3, weight: null}},
        matchResult: {outcome: 'noMatch'},
    });
    const state = createState({sessionId: 5, clientId: 777});

    const response = await definition.steps.WAITING_INPUT.onText({text: 'obscure move, 3x8', user, state});

    assert.equal(response.replyMarkup.inline_keyboard.length, 1, 'expected only the keep-own/reject row');
});

// T8/AC-07: an unclear message flags one retry remaining, no entry write.
test('WAITING_INPUT.onText with an unclear message asks to restate, flags one retry (AC-07)', async () => {
    const {definition, repository, service} = await loadConversation({parseResult: {outcome: 'unclear', exercise: null}});
    const state = createState({sessionId: 5, clientId: 777});

    const response = await definition.steps.WAITING_INPUT.onText({text: 'did some stuff', user, state});

    assert.match(response.text, /couldn.t quite catch/);
    assert.equal(repository.updated.currentStep, undefined, 'expected the step to stay WAITING_INPUT (not advanced)');
    assert.equal(repository.updated.data.retryUsed, true);
    assert.equal(service.calls.addEntry.length, 0);
});

// T9/AC-08: a second unclear message in a row (retry already used) saves the raw wording,
// unconfirmed and unlinked, instead of asking a third time.
test('WAITING_INPUT.onText with a second unclear message saves the raw wording unconfirmed (AC-08)', async () => {
    const {definition, repository, service} = await loadConversation({parseResult: {outcome: 'unclear', exercise: null}});
    const state = createState({sessionId: 5, clientId: 777, retryUsed: true});

    const response = await definition.steps.WAITING_INPUT.onText({
        text: 'still not sure what I did',
        user,
        state,
    });

    assert.match(response.text, /Saved as you wrote it/);
    assert.equal(service.calls.addEntry.length, 1);
    assert.deepEqual(service.calls.addEntry[0], {
        sessionId: 5,
        dictExerciseId: null,
        rawDescription: 'still not sure what I did',
        reps: null,
        sets: null,
        weight: null,
    });
    assert.equal(repository.updated.data.retryUsed, false);
});

// T9/AC-03/AC-05: confirming a candidate saves a linked entry and returns to WAITING_INPUT,
// refreshing the session TTL (ADR-0005) so it stays alive for the next exercise.
test('WAITING_CONFIRMATION.onCallback confirming a candidate saves a linked entry (AC-03/AC-05)', async () => {
    const {definition, repository, service} = await loadConversation({});
    const state = createState({
        sessionId: 5,
        clientId: 777,
        pending: {rawDescription: 'bench press 4x10 60kg', parsedExercise, candidates},
    });

    const response = await definition.steps.WAITING_CONFIRMATION.onCallback({
        callbackData: 'WORKOUT:PICK:1',
        messageId: 1001,
        user,
        state,
    });

    assert.match(response.text, /Logged: Bench press/);
    assert.equal(service.calls.addEntry.length, 1);
    assert.deepEqual(service.calls.addEntry[0], {
        sessionId: 5,
        dictExerciseId: 1,
        rawDescription: 'bench press 4x10 60kg',
        reps: 10,
        sets: 4,
        weight: 60,
    });
    assert.equal(repository.updated.currentStep, 'WAITING_INPUT');
    assert.equal(repository.updated.data.pending, null);
    assert.equal(repository.updated.ttlMinutes, 120, 'expected the session TTL to be refreshed on a recorded exercise');
});

// T9/AC-06: keeping the client's own description over the candidates saves unlinked.
test('WAITING_CONFIRMATION.onCallback keeping own description saves an unlinked entry (AC-06)', async () => {
    const {definition, service} = await loadConversation({});
    const state = createState({
        sessionId: 5,
        clientId: 777,
        pending: {rawDescription: 'bench press 4x10 60kg', parsedExercise, candidates},
    });

    const response = await definition.steps.WAITING_CONFIRMATION.onCallback({
        callbackData: 'WORKOUT:KEEP_OWN',
        messageId: 1001,
        user,
        state,
    });

    assert.match(response.text, /Logged as described/);
    assert.equal(service.calls.addEntry[0].dictExerciseId, null);
});

// T9/AC-07b: rejecting the whole proposal re-enters the same one-retry unclear flow, no save.
test('WAITING_CONFIRMATION.onCallback rejecting the proposal triggers a retry, not a save (AC-07b)', async () => {
    const {definition, repository, service} = await loadConversation({});
    const state = createState({
        sessionId: 5,
        clientId: 777,
        pending: {rawDescription: 'bench press 4x10 60kg', parsedExercise, candidates},
    });

    const response = await definition.steps.WAITING_CONFIRMATION.onCallback({
        callbackData: 'WORKOUT:REJECT',
        messageId: 1001,
        user,
        state,
    });

    assert.match(response.text, /couldn.t quite catch/);
    assert.equal(repository.updated.currentStep, 'WAITING_INPUT');
    assert.equal(repository.updated.data.pending, null);
    assert.equal(repository.updated.data.retryUsed, true);
    assert.equal(service.calls.addEntry.length, 0);
});

// AC-09/AC-09b: explicit /end_workout closes the session, confirming completion when at least
// one exercise was recorded, or a distinct "nothing logged" reply for an empty session.
test('WAITING_INPUT.onText with /end_workout ends a recorded session with a completion reply (AC-09)', async () => {
    const {definition, repository, service} = await loadConversation({endSessionOutcome: 'ended-recorded'});
    const state = createState({sessionId: 5, clientId: 777});

    const response = await definition.steps.WAITING_INPUT.onText({text: '/end_workout', user, state});

    assert.match(response.text, /Workout complete/);
    assert.equal(service.calls.endSession[0].clientId, 777);
    assert.equal(repository.deactivated.finalStep, 'COMPLETED');
});

test('WAITING_INPUT.onText with /end_workout on an empty session replies with a distinct nothing-logged message (AC-09b)', async () => {
    const {definition, repository} = await loadConversation({endSessionOutcome: 'ended-empty'});
    const state = createState({sessionId: 5, clientId: 777});

    const response = await definition.steps.WAITING_INPUT.onText({text: '/end_workout', user, state});

    assert.match(response.text, /nothing was logged/);
    assert.equal(repository.deactivated.finalStep, 'COMPLETED');
});

// AC-10/AC-11: the generic engine calls these hooks; they must close the matching domain session.
test('onPreempt closes the client\'s active workout_log_session as pre-empted (AC-10)', async () => {
    const {definition, service} = await loadConversation({});
    const state = createState({sessionId: 5, clientId: 777});

    await definition.onPreempt(state);

    assert.equal(service.calls.preemptActiveSession[0].clientId, 777);
});

test('onExpire closes the client\'s active workout_log_session as auto-closed (AC-11)', async () => {
    const {definition, service} = await loadConversation({});
    const state = createState({sessionId: 5, clientId: 777});

    await definition.onExpire(state);

    assert.equal(service.calls.closeExpiredSession[0].clientId, 777);
});

async function loadConversation(options) {
    const repository = createConversationRepository();
    const service = createWorkoutLoggingService(options);

    globalThis.__workoutLoggingConversationMocks = {repository, service};

    const outfile = path.join(
        tmpdir(),
        `workout-logging-conversation-${process.pid}-${Date.now()}-${Math.random()}.mjs`,
    );

    await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/features/workoutLogging/workoutLoggingConversation.ts'],
        format: 'esm',
        logLevel: 'silent',
        outfile,
        platform: 'node',
        plugins: [workoutLoggingConversationMocks],
    });

    try {
        const module = await import(`${pathToFileURL(outfile).href}?cache=${Date.now()}-${Math.random()}`);
        return {definition: module.workoutLoggingConversation, repository, service};
    } finally {
        delete globalThis.__workoutLoggingConversationMocks;
        await rm(outfile, {force: true});
    }
}

function createWorkoutLoggingService(options) {
    const calls = {addEntry: [], endSession: [], preemptActiveSession: [], closeExpiredSession: []};

    return {
        calls,
        async handleExerciseMessage() {
            const result = options.parseResult ?? {outcome: 'unclear', exercise: null};
            if (result.outcome === 'unclear') {
                return {outcome: 'unclear', retryRemaining: true};
            }

            const matchResult = options.matchResult ?? {outcome: 'noMatch'};
            return {
                outcome: 'confirmation-proposed',
                parsedExercise: result.exercise,
                candidates: matchResult.outcome === 'matched' ? matchResult.candidates : [],
            };
        },
        async handleConfirmationResponse(input) {
            if (input.action === 'reject') {
                return {outcome: 'retry'};
            }

            const dictExerciseId = input.action === 'confirm-candidate' ? (input.candidateExerciseId ?? null) : null;
            calls.addEntry.push({
                sessionId: input.sessionId,
                dictExerciseId,
                rawDescription: input.rawDescription,
                reps: input.parsedExercise.reps,
                sets: input.parsedExercise.sets,
                weight: input.parsedExercise.weight,
            });

            return {outcome: dictExerciseId != null ? 'saved-linked' : 'saved-unlinked'};
        },
        async saveUnconfirmedEntry(input) {
            calls.addEntry.push({
                sessionId: input.sessionId,
                dictExerciseId: null,
                rawDescription: input.rawDescription,
                reps: null,
                sets: null,
                weight: null,
            });

            return {outcome: 'saved-unconfirmed'};
        },
        async endSession(input) {
            calls.endSession.push(input);
            return {outcome: options.endSessionOutcome ?? 'ended-empty'};
        },
        async preemptActiveSession(input) {
            calls.preemptActiveSession.push(input);
            return {outcome: 'pre-empted'};
        },
        async closeExpiredSession(input) {
            calls.closeExpiredSession.push(input);
            return {outcome: 'auto-closed'};
        },
    };
}

const workoutLoggingConversationMocks = {
    name: 'workout-logging-conversation-mocks',
    setup(buildContext) {
        mockModule(buildContext, /repository\/tgConversationStateRepository\.js$/, [
            'export const tgConversationStateRepository = globalThis.__workoutLoggingConversationMocks.repository;',
        ]);
        mockModule(buildContext, /workoutLoggingService\.js$/, [
            'export const workoutLoggingService = globalThis.__workoutLoggingConversationMocks.service;',
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

function createState(data, currentStep = 'WAITING_INPUT') {
    return {
        id: 1,
        chat_id: chatId,
        type: 'WORKOUT_LOGGING',
        current_step: currentStep,
        data,
        last_bot_msg_id: null,
        is_active: true,
        expires_at: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
}
