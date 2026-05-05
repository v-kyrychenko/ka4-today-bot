import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const chatId = 42;
const user = {chatId, clientId: 777, lang: 'en'};

test('conversation engine can drive a multi-step conversation', async () => {
    const repository = createConversationRepository();
    const engine = await loadConversationEngine(repository, createConversationDefinitions(repository));

    assert.deepEqual(await engine.start({type: 'TEST_MULTI_STEP', user}), {text: 'What is your name?'});
    assert.equal(repository.activeState()?.current_step, 'ASK_NAME');

    assert.deepEqual(await engine.handleText({text: 'Alice', user}), {text: 'How old are you, Alice?'});
    assert.deepEqual(repository.activeState()?.data, {name: 'Alice'});
    assert.equal(repository.activeState()?.current_step, 'ASK_AGE');

    assert.deepEqual(await engine.handleText({text: '34', user}), {
        text: 'Confirm: Alice, 34?',
        replyMarkup: {inline_keyboard: [[{text: 'Yes', callback_data: 'yes'}]]},
    });
    assert.deepEqual(repository.activeState()?.data, {name: 'Alice', age: 34});
    assert.equal(repository.activeState()?.current_step, 'CONFIRM');

    assert.deepEqual(await engine.handleCallback({callbackData: 'yes', messageId: 1001, user}), {text: 'Done, Alice.'});
    assert.equal(repository.activeState(), null);
    assert.equal(repository.lastState()?.current_step, 'COMPLETED');
    assert.equal(await engine.handleText({text: 'ignored', user}), null);
});

async function loadConversationEngine(repository, definitions) {
    globalThis.__conversationRepository = repository;
    globalThis.__conversationDefinitions = definitions;

    const outfile = path.join(tmpdir(), `conversation-engine-${process.pid}-${Date.now()}.mjs`);

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
        return await import(`${pathToFileURL(outfile).href}?cache=${Date.now()}`);
    } finally {
        await rm(outfile, {force: true});
    }
}

const conversationEngineMocks = {
    name: 'conversation-engine-mocks',
    setup(buildContext) {
        buildContext.onResolve({filter: /tgConversationStateRepository\.js$/}, () => ({
            namespace: 'conversation-mock',
            path: 'repository',
        }));

        buildContext.onResolve({filter: /\/registry\.js$/}, () => ({
            namespace: 'conversation-mock',
            path: 'registry',
        }));

        buildContext.onLoad({filter: /^repository$/, namespace: 'conversation-mock'}, () => ({
            contents: 'export const tgConversationStateRepository = globalThis.__conversationRepository;',
            loader: 'js',
        }));

        buildContext.onLoad({filter: /^registry$/, namespace: 'conversation-mock'}, () => ({
            contents: [
                'export function getConversationDefinition(type) {',
                '    return globalThis.__conversationDefinitions[type] ?? null;',
                '}',
            ].join('\n'),
            loader: 'js',
        }));
    },
};

function createConversationDefinitions(repository) {
    return {
        TEST_MULTI_STEP: {
            type: 'TEST_MULTI_STEP',
            initialStep: 'ASK_NAME',
            steps: {
                ASK_NAME: {
                    async onText({state, text}) {
                        await repository.updateConversation({
                            id: state.id,
                            currentStep: 'ASK_AGE',
                            data: {name: text},
                        });

                        return {text: `How old are you, ${text}?`};
                    },
                },
                ASK_AGE: {
                    async onText({state, text}) {
                        const data = {...state.data, age: Number(text)};
                        await repository.updateConversation({
                            id: state.id,
                            currentStep: 'CONFIRM',
                            data,
                        });

                        return {
                            text: `Confirm: ${data.name}, ${data.age}?`,
                            replyMarkup: {inline_keyboard: [[{text: 'Yes', callback_data: 'yes'}]]},
                        };
                    },
                },
                CONFIRM: {
                    async onCallback({state, callbackData}) {
                        assert.equal(callbackData, 'yes');
                        await repository.deactivateConversation({
                            id: state.id,
                            finalStep: 'COMPLETED',
                        });

                        return {text: `Done, ${state.data.name}.`};
                    },
                },
            },
            getInitialMessage: () => ({text: 'What is your name?'}),
        },
    };
}

function createConversationRepository() {
    let nextId = 1;
    const states = [];

    return {
        activeState: () => states.find((item) => item.chat_id === chatId && item.is_active) ?? null,
        lastState: () => states[states.length - 1] ?? null,
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
                last_bot_msg_id: input.lastBotMsgId ?? null,
                is_active: true,
                expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            states.push(state);
            return state;
        },
        async findActiveByChatId(inputChatId) {
            return states.find((item) => item.chat_id === inputChatId && item.is_active) ?? null;
        },
        async updateConversation(input) {
            const state = states.find((item) => item.id === input.id && item.is_active);
            if (!state) {
                return null;
            }

            state.current_step = input.currentStep ?? state.current_step;
            state.data = input.data ?? state.data;
            state.last_bot_msg_id = input.lastBotMsgId ?? state.last_bot_msg_id;
            state.updated_at = new Date().toISOString();

            return state;
        },
        async deactivateConversation(input) {
            const state = states.find((item) => item.id === input.id && item.is_active);
            if (!state) {
                return null;
            }

            state.is_active = false;
            state.current_step = input.finalStep;
            state.updated_at = new Date().toISOString();

            return state;
        },
        async deactivateActiveByChatId(inputChatId, finalStep = 'CANCELLED') {
            const state = states.find((item) => item.chat_id === inputChatId && item.is_active);
            if (!state) {
                return null;
            }

            state.is_active = false;
            state.current_step = finalStep;
            state.updated_at = new Date().toISOString();

            return state;
        },
    };
}
