import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const chatId = 42;

// Generic engine mechanism: a conversation type can declare onPreempt/onExpire hooks on its
// ConversationDefinition, invoked by the engine itself -- no feature-specific knowledge needed
// in routesProcessor.ts or engine.ts beyond "look up the type's definition and call its hook".
test('preemptActiveConversation() deactivates a still-active conversation as PREEMPTED and calls its onPreempt hook', async () => {
    const {repository, hookCalls, engine} = await setup({expired: false});

    await engine.conversationEngine.preemptActiveConversation(chatId);

    assert.equal(repository.activeState(), null, 'expected the conversation to be deactivated');
    assert.equal(repository.lastState()?.current_step, 'PREEMPTED');
    assert.equal(hookCalls.onPreempt.length, 1, 'expected onPreempt to be called exactly once');
    assert.equal(hookCalls.onExpire.length, 0, 'expected onExpire NOT to be called for a still-active session');
});

test('preemptActiveConversation() is a no-op when the chat has no active conversation', async () => {
    const {hookCalls, engine} = await setup({noActiveState: true});

    await engine.conversationEngine.preemptActiveConversation(chatId);

    assert.equal(hookCalls.onPreempt.length, 0);
    assert.equal(hookCalls.onExpire.length, 0);
});

// AC-11-style lazy expiry: when the TTL already lapsed, preemptActiveConversation must treat it
// as an expiry (onExpire, final step EXPIRED), not a pre-emption -- it must not double-close it.
test('preemptActiveConversation() treats an already-expired conversation as an expiry, not a pre-emption', async () => {
    const {repository, hookCalls, engine} = await setup({expired: true});

    await engine.conversationEngine.preemptActiveConversation(chatId);

    assert.equal(repository.lastState()?.current_step, 'EXPIRED');
    assert.equal(hookCalls.onExpire.length, 1, 'expected onExpire to be called for the expired session');
    assert.equal(hookCalls.onPreempt.length, 0, 'expected onPreempt NOT to also fire for an expired session');
});

// The same lazy-expiry + onExpire hook must fire from the ordinary handleText path too, not only
// from the explicit preemptActiveConversation call -- "on the next check" covers any check.
test('handleText() lazily expires an idle-past-TTL conversation and calls its onExpire hook before returning null', async () => {
    const {hookCalls, engine} = await setup({expired: true});

    const result = await engine.handleText({text: 'hello', user: {chatId, clientId: 777, lang: 'en'}});

    assert.equal(result, null, 'expected handleText to fall through, letting routesProcessor handle it');
    assert.equal(hookCalls.onExpire.length, 1);
});

async function setup({expired = false, noActiveState = false} = {}) {
    const hookCalls = {onPreempt: [], onExpire: []};
    const repository = createConversationRepository({expired, noActiveState});
    const definitions = {
        WORKOUT_LOGGING: {
            type: 'WORKOUT_LOGGING',
            initialStep: 'WAITING_INPUT',
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

    const outfile = path.join(tmpdir(), `conversation-engine-lifecycle-${process.pid}-${Date.now()}-${Math.random()}.mjs`);

    await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/features/conversations/engine.ts'],
        format: 'esm',
        logLevel: 'silent',
        outfile,
        platform: 'node',
        plugins: [conversationEngineMocks],
    });

    try {
        const engine = await import(`${pathToFileURL(outfile).href}?cache=${Date.now()}-${Math.random()}`);
        return {repository, hookCalls, engine};
    } finally {
        await rm(outfile, {force: true});
    }
}

const conversationEngineMocks = {
    name: 'conversation-engine-lifecycle-mocks',
    setup(buildContext) {
        buildContext.onResolve({filter: /tgConversationStateRepository\.js$/}, () => ({
            namespace: 'conversation-lifecycle-mock',
            path: 'repository',
        }));

        buildContext.onResolve({filter: /\/registry\.js$/}, () => ({
            namespace: 'conversation-lifecycle-mock',
            path: 'registry',
        }));

        buildContext.onLoad({filter: /^repository$/, namespace: 'conversation-lifecycle-mock'}, () => ({
            contents: 'export const tgConversationStateRepository = globalThis.__conversationRepository;',
            loader: 'js',
        }));

        buildContext.onLoad({filter: /^registry$/, namespace: 'conversation-lifecycle-mock'}, () => ({
            contents: [
                'export function getConversationDefinition(type) {',
                '    return globalThis.__conversationDefinitions[type] ?? null;',
                '}',
            ].join('\n'),
            loader: 'js',
        }));
    },
};

function createConversationRepository({expired, noActiveState}) {
    const expiresAt = expired
        ? new Date(Date.now() - 60 * 1000).toISOString()
        : new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const state = noActiveState
        ? null
        : {
              id: 1,
              chat_id: chatId,
              type: 'WORKOUT_LOGGING',
              current_step: 'WAITING_INPUT',
              data: {},
              last_bot_msg_id: null,
              is_active: true,
              expires_at: expiresAt,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
          };

    const states = state ? [state] : [];

    return {
        activeState: () => states.find((item) => item.is_active) ?? null,
        lastState: () => states[states.length - 1] ?? null,
        async findRawActiveByChatId(inputChatId) {
            return states.find((item) => item.chat_id === inputChatId && item.is_active) ?? null;
        },
        isConversationExpired(row) {
            return new Date(row.expires_at).getTime() <= Date.now();
        },
        async deactivateConversation(input) {
            const row = states.find((item) => item.id === input.id && item.is_active);
            if (!row) {
                return null;
            }

            row.is_active = false;
            row.current_step = input.finalStep;
            row.updated_at = new Date().toISOString();

            return row;
        },
    };
}
