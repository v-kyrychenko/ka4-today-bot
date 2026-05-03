import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

test('fetchOpenAiReply renders translated prompts and returns the latest assistant reply', async () => {
    const prompt = createPrompt({
        key: 'coach.reply',
        prompts: {
            en: 'Question from ${user}: ${question}',
            ua: 'Pytannia vid ${user}: ${question}',
        },
        vectorStoreIds: ['vs_1', 'vs_2'],
        systemPrompt: {
            key: 'coach.system',
            prompts: {
                en: 'You coach ${user}. Tags: ${tags}. Profile: ${profile}. Optional: ${missing}.',
                ua: 'Ty trener dlia ${user}. Tegi: ${tags}. Profil: ${profile}. Optional: ${missing}.',
            },
            model: 'gpt-4o-mini',
            temperature: 0.4,
            textFormat: {format: {type: 'json_schema', name: 'coachReply'}},
        },
        model: 'gpt-4.1-mini',
        temperature: 0.9,
        textFormat: {format: {type: 'text'}},
    });
    const harness = await loadPromptReplyService({
        prompt,
        responseDetails: createResponseDetails({
            output: [
                createMessage({
                    role: 'assistant',
                    created_at: 1710000000,
                    content: [{type: 'output_text', text: 'Older reply'}],
                }),
                createMessage({
                    role: 'assistant',
                    created_at: 1710000005,
                    content: [{type: 'output_text', text: 'Latest reply'}],
                }),
            ],
        }),
    });

    const reply = await harness.module.fetchOpenAiReply({
        lang: ' Uk ',
        promptRef: 'coach.reply',
        variables: {
            user: 'Oksana',
            question: 'How many reps?',
            tags: ['legs', null, 'strength'],
            profile: {
                level: 'advanced',
                goals: {
                    primary: 'power',
                },
            },
        },
    });

    assert.equal(reply, 'Latest reply');
    assert.equal(harness.calls.promptRef, 'coach.reply');
    assert.deepEqual(harness.calls.sequence, [
        ['createResponse', 'response_123'],
        ['waitForResponse', 'response_123'],
        ['getResponse', 'response_123'],
    ]);
    assert.deepEqual(harness.calls.createResponseInput, {
        systemPrompt: 'Ty trener dlia Oksana. Tegi: legs, , strength. Profil: level: advanced, goals: {"primary":"power"}. Optional: ${missing}.',
        userPrompt: 'Pytannia vid Oksana: How many reps?',
        vectorStoreIds: ['vs_1', 'vs_2'],
        model: 'gpt-4.1-mini',
        temperature: 0.9,
        textFormat: {format: {type: 'text'}},
    });
});

test('fetchOpenAiReply falls back to DEFAULT_LANG when lang is missing', async () => {
    const harness = await loadPromptReplyService({
        prompt: createPrompt({
            prompts: {ua: 'Povidomlennia ${name}'},
            systemPrompt: {
                key: 'system.default',
                prompts: {ua: 'Systema ${name}'},
            },
        }),
    });

    const reply = await harness.module.fetchOpenAiReply({
        promptRef: 'coach.reply',
        variables: {name: 'Ira'},
    });

    assert.equal(reply, 'assistant reply');
    assert.equal(harness.calls.createResponseInput.systemPrompt, 'Systema Ira');
    assert.equal(harness.calls.createResponseInput.userPrompt, 'Povidomlennia Ira');
});

test('fetchOpenAiReply throws when prompt has no system prompt configuration', async () => {
    const harness = await loadPromptReplyService({
        prompt: createPrompt({
            systemPrompt: null,
        }),
    });

    await assert.rejects(
        () => harness.module.fetchOpenAiReply({promptRef: 'coach.reply'}),
        (error) => {
            assert.equal(error.name, 'BadRequestError');
            assert.equal(error.message, "Prompt 'coach.reply' has no systemPromptRef configuration");
            return true;
        }
    );
});

test('fetchOpenAiReply throws when system prompt translation is missing for the resolved lang', async () => {
    const harness = await loadPromptReplyService({
        prompt: createPrompt({
            prompts: {ua: 'Korystuvach ${name}'},
            systemPrompt: {
                key: 'system.missing.ua',
                prompts: {en: 'System ${name}'},
            },
        }),
    });

    await assert.rejects(
        () => harness.module.fetchOpenAiReply({lang: 'uk', promptRef: 'coach.reply'}),
        (error) => {
            assert.equal(error.name, 'BadRequestError');
            assert.equal(error.message, "Prompt 'system.missing.ua' has no translation for language 'ua'.");
            return true;
        }
    );
});

test('fetchOpenAiReply throws when user prompt translation is missing for the resolved lang', async () => {
    const harness = await loadPromptReplyService({
        prompt: createPrompt({
            prompts: {en: 'User ${name}'},
            systemPrompt: {
                key: 'system.present.ua',
                prompts: {ua: 'System ${name}'},
            },
        }),
    });

    await assert.rejects(
        () => harness.module.fetchOpenAiReply({lang: ' uk ', promptRef: 'coach.reply'}),
        (error) => {
            assert.equal(error.name, 'BadRequestError');
            assert.equal(error.message, "Prompt 'coach.reply' has no translation for language 'ua'.");
            return true;
        }
    );
});

test('fetchOpenAiReply prefers prompt-level OpenAI settings over system prompt settings', async () => {
    const harness = await loadPromptReplyService({
        prompt: createPrompt({
            model: 'gpt-4.1',
            temperature: 0.2,
            textFormat: {format: {type: 'json_schema', name: 'promptLevel'}},
            systemPrompt: {
                key: 'system.settings',
                prompts: {ua: 'System'},
                model: 'gpt-4o-mini',
                temperature: 0.7,
                textFormat: {format: {type: 'text'}},
            },
        }),
    });

    await harness.module.fetchOpenAiReply({promptRef: 'coach.reply'});

    assert.deepEqual(
        {
            model: harness.calls.createResponseInput.model,
            temperature: harness.calls.createResponseInput.temperature,
            textFormat: harness.calls.createResponseInput.textFormat,
        },
        {
            model: 'gpt-4.1',
            temperature: 0.2,
            textFormat: {format: {type: 'json_schema', name: 'promptLevel'}},
        }
    );
});

test('fetchOpenAiReply falls back to system prompt OpenAI settings when prompt-level values are null', async () => {
    const harness = await loadPromptReplyService({
        prompt: createPrompt({
            model: null,
            temperature: null,
            textFormat: null,
            systemPrompt: {
                key: 'system.settings',
                prompts: {ua: 'System'},
                model: 'gpt-4.1-mini',
                temperature: 0.3,
                textFormat: {format: {type: 'json_schema', name: 'systemLevel'}},
            },
        }),
    });

    await harness.module.fetchOpenAiReply({promptRef: 'coach.reply'});

    assert.deepEqual(
        {
            model: harness.calls.createResponseInput.model,
            temperature: harness.calls.createResponseInput.temperature,
            textFormat: harness.calls.createResponseInput.textFormat,
        },
        {
            model: 'gpt-4.1-mini',
            temperature: 0.3,
            textFormat: {format: {type: 'json_schema', name: 'systemLevel'}},
        }
    );
});

test('fetchOpenAiReply sends null OpenAI settings when both prompt and system prompt values are null', async () => {
    const harness = await loadPromptReplyService({
        prompt: createPrompt({
            model: null,
            temperature: null,
            textFormat: null,
            systemPrompt: {
                key: 'system.settings',
                prompts: {ua: 'System'},
                model: null,
                temperature: null,
                textFormat: null,
            },
        }),
    });

    await harness.module.fetchOpenAiReply({promptRef: 'coach.reply'});

    assert.deepEqual(
        {
            model: harness.calls.createResponseInput.model,
            temperature: harness.calls.createResponseInput.temperature,
            textFormat: harness.calls.createResponseInput.textFormat,
        },
        {
            model: null,
            temperature: null,
            textFormat: null,
        }
    );
});

test('fetchOpenAiReply throws when the OpenAI run does not complete', async () => {
    const harness = await loadPromptReplyService({
        waitForResponseResult: false,
    });

    await assert.rejects(
        () => harness.module.fetchOpenAiReply({promptRef: 'coach.reply'}),
        (error) => {
            assert.equal(error.name, 'OpenAIError');
            assert.equal(error.message, 'Run response_123 did not complete successfully');
            return true;
        }
    );
});

test('fetchOpenAiReply throws when OpenAI response output is not an array', async () => {
    const harness = await loadPromptReplyService({
        responseDetails: {id: 'response_123', output: null},
    });

    await assert.rejects(
        () => harness.module.fetchOpenAiReply({promptRef: 'coach.reply'}),
        (error) => {
            assert.equal(error.name, 'OpenAIError');
            assert.equal(error.message, 'Invalid messages format: expected output[] array');
            return true;
        }
    );
});

test('fetchOpenAiReply throws when OpenAI response has no assistant messages', async () => {
    const harness = await loadPromptReplyService({
        responseDetails: createResponseDetails({
            output: [createMessage({role: 'user', created_at: 1710000000, content: []})],
        }),
    });

    await assert.rejects(
        () => harness.module.fetchOpenAiReply({promptRef: 'coach.reply'}),
        (error) => {
            assert.equal(error.name, 'OpenAIError');
            assert.equal(error.message, 'No assistant messages found in thread');
            return true;
        }
    );
});

test('fetchOpenAiReply throws when the newest assistant message has no valid output_text part', async () => {
    const harness = await loadPromptReplyService({
        responseDetails: createResponseDetails({
            output: [
                createMessage({
                    role: 'assistant',
                    created_at: 1710000002,
                    content: [{type: 'tool_call', text: 'not a reply'}],
                }),
            ],
        }),
    });

    await assert.rejects(
        () => harness.module.fetchOpenAiReply({promptRef: 'coach.reply'}),
        (error) => {
            assert.equal(error.name, 'OpenAIError');
            assert.equal(error.message, 'Assistant message does not contain valid text content');
            return true;
        }
    );
});

test('fetchOpenAiReply keeps empty templates empty while replacing nullish and structured variables', async () => {
    const harness = await loadPromptReplyService({
        prompt: createPrompt({
            prompts: {ua: ''},
            systemPrompt: {
                key: 'system.template',
                prompts: {
                    ua: 'A:${nullValue}|B:${undefinedValue}|C:${items}|D:${profile}|E:${unused}',
                },
            },
        }),
    });

    await harness.module.fetchOpenAiReply({
        promptRef: 'coach.reply',
        variables: {
            nullValue: null,
            undefinedValue: undefined,
            items: ['one', 'two'],
            profile: {
                city: 'Kyiv',
                metrics: {
                    prs: 4,
                },
            },
        },
    });

    assert.equal(
        harness.calls.createResponseInput.systemPrompt,
        'A:|B:|C:one, two|D:city: Kyiv, metrics: {"prs":4}|E:${unused}'
    );
    assert.equal(harness.calls.createResponseInput.userPrompt, '');
});

async function loadPromptReplyService(options = {}) {
    const calls = {
        promptRef: null,
        createResponseInput: null,
        sequence: [],
    };
    const prompt = options.prompt ?? createPrompt();
    const createResponseResult = options.createResponseResult ?? {id: 'response_123'};
    const waitForResponseResult = options.waitForResponseResult ?? true;
    const responseDetails = options.responseDetails ?? createResponseDetails();

    globalThis.__promptReplyServiceMocks = {
        dictPromptRepository: {
            async getPromptByKey(promptRef) {
                calls.promptRef = promptRef;
                return prompt;
            },
        },
        openAiClient: {
            async createResponse(input) {
                calls.createResponseInput = input;
                calls.sequence.push(['createResponse', createResponseResult.id]);
                return createResponseResult;
            },
            async waitForResponse(responseId) {
                calls.sequence.push(['waitForResponse', responseId]);
                return waitForResponseResult;
            },
            async getResponse(responseId) {
                calls.sequence.push(['getResponse', responseId]);
                return responseDetails;
            },
        },
    };

    const outfile = path.join(tmpdir(), `prompt-reply-service-${process.pid}-${Date.now()}.mjs`);

    await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/features/prompts/promptReplyService.ts'],
        format: 'esm',
        logLevel: 'silent',
        outfile,
        platform: 'node',
        plugins: [promptReplyServiceMocks],
    });

    try {
        const module = await import(`${pathToFileURL(outfile).href}?cache=${Date.now()}`);
        return {module, calls};
    } finally {
        delete globalThis.__promptReplyServiceMocks;
        await rm(outfile, {force: true});
    }
}

const promptReplyServiceMocks = {
    name: 'prompt-reply-service-mocks',
    setup: (buildContext) => {
        buildContext.onResolve({filter: /dictPromptRepository\.js$/}, () => ({
            namespace: 'prompt-reply-service-mock',
            path: 'dictPromptRepository',
        }));

        buildContext.onResolve({filter: /openAiClient\.js$/}, () => ({
            namespace: 'prompt-reply-service-mock',
            path: 'openAiClient',
        }));

        buildContext.onLoad({filter: /^dictPromptRepository$/, namespace: 'prompt-reply-service-mock'}, () => ({
            contents: 'export const dictPromptRepository = globalThis.__promptReplyServiceMocks.dictPromptRepository;',
            loader: 'js',
        }));

        buildContext.onLoad({filter: /^openAiClient$/, namespace: 'prompt-reply-service-mock'}, () => ({
            contents: 'export const openAiClient = globalThis.__promptReplyServiceMocks.openAiClient;',
            loader: 'js',
        }));
    },
};

function createPrompt(overrides = {}) {
    const basePrompt = {
        id: 1,
        key: 'coach.reply',
        prompts: {ua: 'Zapyt ${name}'},
        vectorStoreIds: [],
        systemPrompt: {
            id: 2,
            key: 'coach.system',
            prompts: {ua: 'System ${name}'},
            model: null,
            temperature: null,
            textFormat: null,
        },
        model: null,
        temperature: null,
        textFormat: null,
    };

    const prompt = {
        ...basePrompt,
        ...overrides,
    };

    prompt.prompts = overrides.prompts ?? basePrompt.prompts;
    prompt.vectorStoreIds = overrides.vectorStoreIds ?? basePrompt.vectorStoreIds;
    prompt.systemPrompt = normalizeSystemPrompt(overrides.systemPrompt);

    return prompt;
}

function normalizeSystemPrompt(systemPrompt) {
    if (systemPrompt === null) {
        return null;
    }

    const baseSystemPrompt = {
        id: 2,
        key: 'coach.system',
        prompts: {ua: 'System ${name}'},
        model: null,
        temperature: null,
        textFormat: null,
    };

    const normalizedSystemPrompt = {
        ...baseSystemPrompt,
        ...(systemPrompt ?? {}),
    };

    normalizedSystemPrompt.prompts = systemPrompt?.prompts ?? baseSystemPrompt.prompts;

    return normalizedSystemPrompt;
}

function createResponseDetails(overrides = {}) {
    return {
        id: 'response_123',
        status: 'completed',
        output: [
            createMessage({
                role: 'assistant',
                created_at: 1710000000,
                content: [{type: 'output_text', text: 'assistant reply'}],
            }),
        ],
        ...overrides,
    };
}

function createMessage(overrides = {}) {
    return {
        role: 'assistant',
        created_at: 1710000000,
        content: [{type: 'output_text', text: 'assistant reply'}],
        ...overrides,
    };
}
