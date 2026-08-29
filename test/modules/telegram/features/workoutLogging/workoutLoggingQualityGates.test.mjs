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
const candidates = [{exerciseId: 1, name: 'Bench Press', reps: 10, sets: 4, weight: 60, imageUrl: null}];

// sad.md §10 QG-1: nothing is written to workout_log_entry until a confirmation action is
// processed -- true for confirm-candidate, confirm-own AND reject alike -- with the one named
// exception being the AC-08 fallback after a second unparseable message in a row.
test('QG-1: the entry-persist call is never made before a confirmation action, for confirm/keep-own/reject', async () => {
    const {definition, service} = await loadConversation({parseResult: {outcome: 'parsed', exercise: parsedExercise}, matchResult: candidates});
    const initial = createState({sessionId: 5, clientId: 777});

    const proposal = await definition.steps.WAITING_INPUT.onText({
        text: 'bench press 4x10 60kg',
        user,
        state: initial,
    });
    assert.equal(service.calls.addEntry.length, 0, 'expected no persist call from the initial parse+proposal step');

    const pendingState = createState({
        sessionId: 5,
        clientId: 777,
        pending: {rawDescription: 'bench press 4x10 60kg', parsedExercise, candidates},
    });

    await definition.steps.WAITING_CONFIRMATION.onCallback({callbackData: 'WORKOUT:REJECT', messageId: 1, user, state: pendingState});
    assert.equal(service.calls.addEntry.length, 0, 'expected no persist call on reject');

    await definition.steps.WAITING_CONFIRMATION.onCallback({callbackData: 'WORKOUT:KEEP_OWN', messageId: 1, user, state: pendingState});
    assert.equal(service.calls.addEntry.length, 1, 'expected exactly one persist call after confirm-own is processed');

    await definition.steps.WAITING_CONFIRMATION.onCallback({callbackData: 'WORKOUT:PICK:1', messageId: 1, user, state: pendingState});
    assert.equal(service.calls.addEntry.length, 2, 'expected exactly one more persist call after confirm-candidate is processed');

    assert.ok(proposal.text, 'sanity: the proposal step did produce a response');
});

// The one named QG-1 exception: AC-08's raw-wording save happens WITHOUT any confirmation
// action, once a restated message also fails to parse.
test('QG-1 exception: the AC-08 fallback saves without any confirmation action', async () => {
    const {definition, service} = await loadConversation({parseResult: {outcome: 'unclear', exercise: null}});
    const retriedState = createState({sessionId: 5, clientId: 777, retryUsed: true});

    await definition.steps.WAITING_INPUT.onText({text: 'still unclear', user, state: retriedState});

    assert.equal(service.calls.addEntry.length, 1, 'expected the AC-08 fallback to persist without a confirmation callback');
});

// sad.md §10 QG-3: a client never has more than one open logging session -- pre-emption and
// lazy expiry must always leave at most one active tg_conversation_state row per chat_id.
test('QG-3: pre-emption always leaves at most one active conversation for the chat', async () => {
    const engine = await loadEngine();
    const repository = engine.repository;

    await engine.conversationEngine.start({type: 'WORKOUT_LOGGING', user});
    assert.equal(activeCount(repository, chatId), 1, 'expected exactly one active conversation after start');

    await engine.conversationEngine.preemptActiveConversation(chatId);
    assert.equal(activeCount(repository, chatId), 0, 'expected zero active conversations after pre-emption -- never two');
});

test('QG-3: lazy expiry always leaves at most one active conversation for the chat', async () => {
    const engine = await loadEngine();
    const repository = engine.repository;

    await engine.conversationEngine.start({type: 'WORKOUT_LOGGING', user});
    repository.expireActiveState(chatId);

    await engine.conversationEngine.handleText({text: 'anything', user});
    assert.equal(activeCount(repository, chatId), 0, 'expected zero active conversations once the TTL lapsed -- never two');
});

// QG-3's "second startConversation of the same type is blocked" guarantee is enforced at the
// workoutLoggingService/Route layer (AC-12), verified end to end in workoutLoggingRoute.test.mjs
// and workoutLoggingService.test.mjs -- restated here as the cardinality invariant those tests
// exist to protect: this repo's generic tg_conversation_state mechanism replaces (not stacks) any
// previous active row on a new start, so even a same-type restart that reached the engine could
// never produce two simultaneously active rows for one chat_id.
test('QG-3: the generic engine never allows two simultaneously active conversations for one chat_id', async () => {
    const engine = await loadEngine();
    const repository = engine.repository;

    await engine.conversationEngine.start({type: 'WORKOUT_LOGGING', user});
    await engine.conversationEngine.start({type: 'WORKOUT_LOGGING', user});

    assert.equal(activeCount(repository, chatId), 1, 'expected the second start to replace, never add to, the active set');
});

function activeCount(repository, forChatId) {
    return repository.states.filter((item) => item.chat_id === forChatId && item.is_active).length;
}

async function loadConversation(options) {
    const service = createWorkoutLoggingService(options);
    globalThis.__workoutLoggingConversationMocks = {repository: createNoopRepository(), service};

    const outfile = path.join(tmpdir(), `workout-logging-qg-${process.pid}-${Date.now()}-${Math.random()}.mjs`);

    await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/features/workoutLogging/workoutLoggingConversation.ts'],
        format: 'esm',
        logLevel: 'silent',
        outfile,
        platform: 'node',
        plugins: [conversationMocks],
    });

    try {
        const module = await import(`${pathToFileURL(outfile).href}?cache=${Date.now()}-${Math.random()}`);
        return {definition: module.workoutLoggingConversation, service};
    } finally {
        delete globalThis.__workoutLoggingConversationMocks;
        await rm(outfile, {force: true});
    }
}

async function loadEngine() {
    const repository = createFakeConversationStateRepository();
    const hookCalls = {onPreempt: [], onExpire: []};
    const definitions = {
        WORKOUT_LOGGING: {
            type: 'WORKOUT_LOGGING',
            initialStep: 'WAITING_INPUT',
            ttlMinutes: 120,
            steps: {},
            onStart: async () => ({outcome: 'started', response: {text: 'start'}}),
            async onPreempt(state) {
                hookCalls.onPreempt.push(state);
            },
            async onExpire(state) {
                hookCalls.onExpire.push(state);
            },
        },
    };

    globalThis.__conversationRepository = repository;
    globalThis.__conversationDefinitions = definitions;

    const outfile = path.join(tmpdir(), `workout-logging-qg-engine-${process.pid}-${Date.now()}-${Math.random()}.mjs`);

    await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/features/conversations/engine.ts'],
        format: 'esm',
        logLevel: 'silent',
        outfile,
        platform: 'node',
        plugins: [engineMocks],
    });

    try {
        const engineModule = await import(`${pathToFileURL(outfile).href}?cache=${Date.now()}-${Math.random()}`);
        return {conversationEngine: engineModule.conversationEngine, repository, hookCalls};
    } finally {
        await rm(outfile, {force: true});
    }
}

function createWorkoutLoggingService(options) {
    const calls = {addEntry: []};

    return {
        calls,
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
            calls.addEntry.push({sessionId: input.sessionId, dictExerciseId});
            return {outcome: dictExerciseId != null ? 'saved-linked' : 'saved-unlinked'};
        },
        async saveUnconfirmedEntry(input) {
            calls.addEntry.push({sessionId: input.sessionId, dictExerciseId: null});
            return {outcome: 'saved-unconfirmed'};
        },
        async endSession() {
            return {outcome: 'ended-empty'};
        },
        async preemptActiveSession() {
            return {outcome: 'pre-empted'};
        },
        async closeExpiredSession() {
            return {outcome: 'auto-closed'};
        },
    };
}

function createNoopRepository() {
    return {
        async updateConversation(input) {
            return input;
        },
        async deactivateConversation(input) {
            return input;
        },
    };
}

const conversationMocks = {
    name: 'workout-logging-qg-conversation-mocks',
    setup(buildContext) {
        mockModule(buildContext, /repository\/tgConversationStateRepository\.js$/, [
            'export const tgConversationStateRepository = globalThis.__workoutLoggingConversationMocks.repository;',
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

const engineMocks = {
    name: 'workout-logging-qg-engine-mocks',
    setup(buildContext) {
        mockModule(buildContext, /tgConversationStateRepository\.js$/, [
            'export const tgConversationStateRepository = globalThis.__conversationRepository;',
        ]);
        mockModule(buildContext, /\/registry\.js$/, [
            'export function getConversationDefinition(type) {',
            '    return globalThis.__conversationDefinitions[type] ?? null;',
            '}',
        ]);
    },
};

function mockModule(buildContext, filter, contents) {
    const namespace = `mock-${String(filter)}`;
    buildContext.onResolve({filter}, () => ({namespace, path: 'mock'}));
    buildContext.onLoad({filter: /^mock$/, namespace}, () => ({contents: contents.join('\n'), loader: 'js'}));
}

function createFakeConversationStateRepository() {
    let nextId = 1;
    const states = [];

    return {
        states,
        async startConversation(input) {
            states
                .filter((item) => item.chat_id === input.chatId && item.is_active)
                .forEach((item) => {
                    item.is_active = false;
                    item.current_step = 'REPLACED';
                });

            const state = {
                id: nextId++,
                chat_id: input.chatId,
                type: input.type,
                current_step: input.currentStep,
                data: input.data ?? {},
                last_bot_msg_id: null,
                is_active: true,
                expires_at: new Date(Date.now() + (input.ttlMinutes ?? 30) * 60 * 1000).toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            states.push(state);
            return state;
        },
        async findRawActiveByChatId(inputChatId) {
            return states.find((item) => item.chat_id === inputChatId && item.is_active) ?? null;
        },
        isConversationExpired(row) {
            return new Date(row.expires_at).getTime() <= Date.now();
        },
        async deactivateConversation(input) {
            const state = states.find((item) => item.id === input.id && item.is_active);
            if (!state) return null;
            state.is_active = false;
            state.current_step = input.finalStep;
            return state;
        },
        async deactivateActiveByChatId(inputChatId, finalStep = 'CANCELLED') {
            const state = states.find((item) => item.chat_id === inputChatId && item.is_active);
            if (!state) return null;
            state.is_active = false;
            state.current_step = finalStep;
            return state;
        },
        expireActiveState(inputChatId) {
            const state = states.find((item) => item.chat_id === inputChatId && item.is_active);
            if (state) {
                state.expires_at = new Date(Date.now() - 1000).toISOString();
            }
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
