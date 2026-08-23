import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

test('parseExerciseMessage extracts name/reps/sets/weight from an English message (AC-03/AC-14)', async () => {
    const harness = await loadWorkoutExerciseParser({
        assistantReplyText: JSON.stringify({
            exerciseName: 'Bench press',
            reps: 10,
            sets: 4,
            weight: 60,
            weightRequired: true,
            multipleExercises: false,
        }),
    });

    const result = await harness.module.parseExerciseMessage({
        message: 'Bench press, 4 sets of 10 reps, 60kg',
        lang: 'en',
    });

    assert.deepEqual(result, {
        outcome: 'parsed',
        exercise: {name: 'Bench press', reps: 10, sets: 4, weight: 60},
    });
});

test('parseExerciseMessage extracts the same details from a Ukrainian message without per-message language detection (AC-14)', async () => {
    const harness = await loadWorkoutExerciseParser({
        assistantReplyText: JSON.stringify({
            exerciseName: 'Zhym lezhachy',
            reps: 10,
            sets: 4,
            weight: 60,
            weightRequired: true,
            multipleExercises: false,
        }),
    });

    const result = await harness.module.parseExerciseMessage({
        message: 'жим лежачи, 4 підходи по 10 разів, 60кг',
        lang: 'ua',
    });

    assert.equal(result.outcome, 'parsed');
    assert.deepEqual(result.exercise, {name: 'Zhym lezhachy', reps: 10, sets: 4, weight: 60});
    assert.equal(harness.calls.createResponseInput.systemPrompt.includes('${'), false);
});

test('parseExerciseMessage returns unclear when reps/sets are missing (AC-07)', async () => {
    const harness = await loadWorkoutExerciseParser({
        assistantReplyText: JSON.stringify({
            exerciseName: 'Squat',
            reps: null,
            sets: null,
            weight: null,
            weightRequired: false,
            multipleExercises: false,
        }),
    });

    const result = await harness.module.parseExerciseMessage({message: 'I did some squats today', lang: 'en'});

    assert.deepEqual(result, {outcome: 'unclear', exercise: null});
});

test('parseExerciseMessage returns unclear when weight is missing for a weighted exercise (AC-07)', async () => {
    const harness = await loadWorkoutExerciseParser({
        assistantReplyText: JSON.stringify({
            exerciseName: 'Deadlift',
            reps: 5,
            sets: 3,
            weight: null,
            weightRequired: true,
            multipleExercises: false,
        }),
    });

    const result = await harness.module.parseExerciseMessage({message: 'Deadlift 3 sets of 5', lang: 'en'});

    assert.deepEqual(result, {outcome: 'unclear', exercise: null});
});

test('parseExerciseMessage returns unclear when more than one exercise is described (AC-07/AC-08 upstream)', async () => {
    const harness = await loadWorkoutExerciseParser({
        assistantReplyText: JSON.stringify({
            exerciseName: 'Bench press and squats',
            reps: 10,
            sets: 4,
            weight: 60,
            weightRequired: true,
            multipleExercises: true,
        }),
    });

    const result = await harness.module.parseExerciseMessage({
        message: 'Bench press 4x10 60kg and then squats 3x8',
        lang: 'en',
    });

    assert.deepEqual(result, {outcome: 'unclear', exercise: null});
});

async function loadWorkoutExerciseParser(options = {}) {
    const calls = {createResponseInput: null};
    const assistantReplyText = options.assistantReplyText ?? '{}';

    globalThis.__workoutExerciseParserMocks = {
        openAiClient: {
            async createResponse(input) {
                calls.createResponseInput = input;
                return {
                    id: 'response_123',
                    status: 'completed',
                    background: false,
                    output: [
                        {
                            role: 'assistant',
                            created_at: 1710000000,
                            content: [{type: 'output_text', text: assistantReplyText}],
                        },
                    ],
                };
            },
        },
    };

    const outfile = path.join(tmpdir(), `workout-exercise-parser-${process.pid}-${Date.now()}-${Math.random()}.mjs`);

    await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/features/workoutLogging/workoutExerciseParser.ts'],
        format: 'esm',
        logLevel: 'silent',
        outfile,
        platform: 'node',
        plugins: [workoutExerciseParserMocks],
    });

    try {
        const module = await import(`${pathToFileURL(outfile).href}?cache=${Date.now()}`);
        return {module, calls};
    } finally {
        delete globalThis.__workoutExerciseParserMocks;
        await rm(outfile, {force: true});
    }
}

const workoutExerciseParserMocks = {
    name: 'workout-exercise-parser-mocks',
    setup: (buildContext) => {
        buildContext.onResolve({filter: /openAiClient\.js$/}, () => ({
            namespace: 'workout-exercise-parser-mock',
            path: 'openAiClient',
        }));

        buildContext.onLoad({filter: /^openAiClient$/, namespace: 'workout-exercise-parser-mock'}, () => ({
            contents: 'export const openAiClient = globalThis.__workoutExerciseParserMocks.openAiClient;',
            loader: 'js',
        }));
    },
};
