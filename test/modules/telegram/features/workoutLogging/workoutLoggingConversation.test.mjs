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
    {exerciseId: 1, name: 'Bench Press', reps: 10, sets: 4, weight: 60, imageUrl: null},
    {exerciseId: 2, name: 'Incline Bench Press', reps: 10, sets: 4, weight: 60, imageUrl: null},
];

// AC-02: an unregistered client is denied without ever starting the conversation.
test('onStart denies a non-client without starting the conversation (AC-02)', async () => {
    const {definition, menu} = await loadConversation({startSessionResult: {outcome: 'not-a-client'}});

    const result = await definition.onStart({...user, clientId: null});

    assert.equal(result.outcome, 'aborted');
    assert.match(result.response.text, /isn.t available for you yet/);
    assert.equal(menu.calls.showWorkoutActiveMenu.length, 0);
});

// Defensive fallback when onStart is invoked without the normal matched-route pre-emption.
test('onStart rejects a start while a workout session row is already open', async () => {
    const {definition} = await loadConversation({startSessionResult: {outcome: 'already-open'}});

    const result = await definition.onStart(user);

    assert.equal(result.outcome, 'aborted');
    assert.match(result.response.text, /already have a workout-logging session open/);
});

// AC-01/AC-14: a started session seeds session/client ids and replies in the client stored lang.
test('onStart seeds session/client ids and replies in the client stored lang (AC-01/AC-14)', async () => {
    const {definition, menu, service} = await loadConversation({startSessionResult: {outcome: 'started', sessionId: 555}});

    const resultEn = await definition.onStart({...user, lang: 'en'});
    assert.equal(resultEn.outcome, 'started');
    assert.deepEqual(resultEn.data, {sessionId: 555, clientId: 777});
    assert.match(resultEn.response.text, /Workout logging started/);
    assert.equal(service.calls.startSession[0].clientId, 777);
    assert.equal(service.calls.startSession[0].timezone, 'Europe/Kyiv');
    assert.deepEqual(menu.calls.showWorkoutActiveMenu[0], {...user, lang: 'en'});

    const resultUk = await definition.onStart({...user, lang: 'uk'});
    assert.match(resultUk.response.text, /Тренування розпочато/);
    assert.deepEqual(menu.calls.showWorkoutActiveMenu[1], {...user, lang: 'uk'});
});

// T8/AC-03/AC-05: a well-formed message moves to WAITING_CONFIRMATION with a combined
// exercise+numbers confirmation and one button per catalog candidate, no entry saved yet.
test('WAITING_INPUT.onText with a well-formed message proposes confirmation with candidate buttons (AC-03/AC-05)', async () => {
    const {definition, repository, service} = await loadConversation({
        parseResult: {outcome: 'parsed', exercise: parsedExercise},
        matchResult: candidates,
    });
    const state = createState({sessionId: 5, clientId: 777});

    const response = await definition.steps.WAITING_INPUT.onText({
        text: 'Bench press, 4 sets of 10 reps, 60kg',
        user,
        state,
    });

    assert.match(response.text, /Bench press/);
    assert.equal(response.replyMarkup.inline_keyboard.length, 3, 'expected 2 candidate rows + 1 keep-own/reject row');
    assert.equal(response.replyMarkup.inline_keyboard[0][0].text, '1. Bench Press');
    assert.equal(response.replyMarkup.inline_keyboard[0][0].callback_data, 'WORKOUT:PICK:1');
    assert.equal(response.media, undefined, 'expected no media group when no candidate has a catalog image');
    assert.equal(repository.updated.currentStep, 'WAITING_CONFIRMATION');
    assert.deepEqual(repository.updated.data.pending.parsedExercise, parsedExercise);
    assert.equal(service.calls.addEntry.length, 0, 'expected no entry saved before confirmation (QG-1)');
});

// AC-05: candidates with a signed catalog image are sent as a media group ahead of the
// confirmation text/buttons; a candidate with no image just contributes no photo.
test('WAITING_INPUT.onText includes a media group with the signed image URLs of candidates that have one (AC-05)', async () => {
    const candidatesWithImages = [
        {exerciseId: 1, name: 'Bench Press', reps: 10, sets: 4, weight: 60, imageUrl: 'https://img/1'},
        {exerciseId: 2, name: 'Incline Bench Press', reps: 10, sets: 4, weight: 60, imageUrl: null},
        {exerciseId: 3, name: 'Close-Grip Bench Press', reps: 10, sets: 4, weight: 60, imageUrl: 'https://img/3'},
    ];
    const {definition} = await loadConversation({
        parseResult: {outcome: 'parsed', exercise: parsedExercise},
        matchResult: candidatesWithImages,
    });
    const state = createState({sessionId: 5, clientId: 777});

    const response = await definition.steps.WAITING_INPUT.onText({
        text: 'Bench press, 4 sets of 10 reps, 60kg',
        user,
        state,
    });

    assert.deepEqual(response.media, [
        {url: 'https://img/1', caption: '1. Bench Press'},
        {url: 'https://img/3', caption: '3. Close-Grip Bench Press'},
    ]);
    assert.equal(
        response.replyMarkup.inline_keyboard[1][0].text,
        '2. Incline Bench Press',
        'expected the imageless middle candidate to keep its own number',
    );
});

// T8/AC-05b: zero catalog candidates still proposes a confirmation (of the description itself).
test('WAITING_INPUT.onText with no catalog match still proposes confirmation with zero candidate buttons (AC-05b)', async () => {
    const {definition} = await loadConversation({
        parseResult: {outcome: 'parsed', exercise: {name: 'Obscure move', reps: 8, sets: 3, weight: null}},
        matchResult: null,
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
    const {definition, menu, repository, service} = await loadConversation({endSessionOutcome: 'ended-recorded'});
    const state = createState({sessionId: 5, clientId: 777});

    const response = await definition.steps.WAITING_INPUT.onText({text: '/end_workout', user, state});

    assert.match(response.text, /Workout complete/);
    assert.equal(service.calls.endSession[0].clientId, 777);
    assert.equal(repository.deactivated.finalStep, 'COMPLETED');
    assert.deepEqual(menu.calls.restoreDefaultMenu, [chatId]);
});

test('WAITING_CONFIRMATION.onText with /end_workout ends the session and restores the menu', async () => {
    const {definition, menu, repository, service} = await loadConversation({endSessionOutcome: 'ended-recorded'});
    const state = createState({sessionId: 5, clientId: 777, pending: {rawDescription: 'bench', parsedExercise, candidates}});

    const response = await definition.steps.WAITING_CONFIRMATION.onText({text: '/end_workout', user, state});

    assert.match(response.text, /Workout complete/);
    assert.equal(service.calls.endSession[0].clientId, 777);
    assert.equal(repository.deactivated.finalStep, 'COMPLETED');
    assert.deepEqual(menu.calls.restoreDefaultMenu, [chatId]);
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
    const {definition, menu, service} = await loadConversation({});
    const state = createState({sessionId: 5, clientId: 777});

    await definition.onPreempt(state);

    assert.equal(service.calls.preemptActiveSession[0].clientId, 777);
    assert.deepEqual(menu.calls.restoreDefaultMenu, [chatId]);
});

test('onCancel closes the client\'s active workout_log_session as pre-empted and restores the menu', async () => {
    const {definition, menu, service} = await loadConversation({});
    const state = createState({sessionId: 5, clientId: 777});

    await definition.onCancel(state);

    assert.equal(service.calls.preemptActiveSession[0].clientId, 777);
    assert.deepEqual(menu.calls.restoreDefaultMenu, [chatId]);
});

test('onExpire closes the client\'s active workout_log_session as auto-closed (AC-11)', async () => {
    const {definition, menu, service} = await loadConversation({});
    const state = createState({sessionId: 5, clientId: 777});

    await definition.onExpire(state);

    assert.equal(service.calls.closeExpiredSession[0].clientId, 777);
    assert.deepEqual(menu.calls.restoreDefaultMenu, [chatId]);
});

async function loadConversation(options) {
    const repository = createConversationRepository();
    const service = createWorkoutLoggingService(options);
    const menu = createCommandMenuService();

    globalThis.__workoutLoggingConversationMocks = {menu, repository, service};

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
        return {definition: module.workoutLoggingConversation, menu, repository, service};
    } finally {
        delete globalThis.__workoutLoggingConversationMocks;
        await rm(outfile, {force: true});
    }
}

function createWorkoutLoggingService(options) {
    const calls = {addEntry: [], startSession: [], endSession: [], preemptActiveSession: [], closeExpiredSession: []};

    return {
        calls,
        async startSession(input) {
            calls.startSession.push(input);
            return options.startSessionResult ?? {outcome: 'started', sessionId: 5};
        },
        async handleExerciseMessage() {
            const result = options.parseResult ?? {outcome: 'unclear', exercise: null};
            if (result.outcome === 'unclear') {
                return null;
            }

            const matchResult = options.matchResult ?? null;
            return {
                parsedExercise: result.exercise,
                candidates: matchResult ?? [],
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
        mockModule(buildContext, /workoutCommandMenuService\.js$/, [
            'export const workoutCommandMenuService = globalThis.__workoutLoggingConversationMocks.menu;',
        ]);
        mockModule(buildContext, /workoutLoggingService\.js$/, [
            'export const workoutLoggingService = globalThis.__workoutLoggingConversationMocks.service;',
            'export const StartSessionOutcome = ' +
                '{NotAClient: "not-a-client", AlreadyOpen: "already-open", Started: "started"};',
            'export const EndSessionOutcome = ' +
                '{NoActiveSession: "no-active-session", EndedEmpty: "ended-empty", EndedRecorded: "ended-recorded"};',
            'export const HandleConfirmationResponseOutcome = ' +
                '{Retry: "retry", SavedLinked: "saved-linked", SavedUnlinked: "saved-unlinked"};',
        ]);
    },
};

function createCommandMenuService() {
    const calls = {restoreDefaultMenu: [], showWorkoutActiveMenu: []};

    return {
        calls,
        async restoreDefaultMenu(inputChatId) {
            calls.restoreDefaultMenu.push(inputChatId);
        },
        async showWorkoutActiveMenu(inputUser) {
            calls.showWorkoutActiveMenu.push(inputUser);
        },
    };
}

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
