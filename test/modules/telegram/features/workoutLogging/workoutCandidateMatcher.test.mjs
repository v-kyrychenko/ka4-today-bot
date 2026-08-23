import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

test('matchCandidates pairs up to 3 catalog candidates with the parsed numbers and a signed image URL when available (AC-05)', async () => {
    const harness = await loadWorkoutCandidateMatcher({
        searchResult: {
            items: [
                exerciseItem({id: 1, name: {en: 'Bench Press'}, images: ['bench-press.png']}),
                exerciseItem({id: 2, name: {en: 'Incline Bench Press'}, images: []}),
                exerciseItem({id: 3, name: {en: 'Close-Grip Bench Press'}, images: ['close-grip.png']}),
            ],
            total: 3,
        },
    });

    const result = await harness.module.matchCandidates({
        parsedExercise: {name: 'Bench press', reps: 10, sets: 4, weight: 60},
    });

    assert.equal(result.outcome, 'matched', `expected outcome 'matched', got ${JSON.stringify(result)}`);
    assert.equal(result.candidates.length, 3, `expected 3 candidates, got ${result.candidates.length}`);

    assert.deepEqual(result.candidates[0], {
        exerciseId: 1,
        name: {en: 'Bench Press'},
        reps: 10,
        sets: 4,
        weight: 60,
        imageUrl: 'https://signed.example/bench-press.png',
    });

    assert.deepEqual(result.candidates[1], {
        exerciseId: 2,
        name: {en: 'Incline Bench Press'},
        reps: 10,
        sets: 4,
        weight: 60,
        imageUrl: null,
    });

    assert.equal(harness.calls.searchInput.q, 'Bench press');
});

test('matchCandidates returns a distinct no-match outcome when the catalog search finds zero candidates (AC-05b)', async () => {
    const harness = await loadWorkoutCandidateMatcher({
        searchResult: {items: [], total: 0},
    });

    const result = await harness.module.matchCandidates({
        parsedExercise: {name: 'Some obscure movement', reps: 10, sets: 4, weight: null},
    });

    assert.deepEqual(result, {outcome: 'noMatch'});
});

function exerciseItem({id, name, images}) {
    return {id, name, key: `key-${id}`, level: 'beginner', category: 'strength', force: 'push', mechanic: 'compound',
        equipment: null, primaryMuscles: [], secondaryMuscles: [], instructions: {}, images};
}

async function loadWorkoutCandidateMatcher(options = {}) {
    const searchResult = options.searchResult ?? {items: [], total: 0};
    const calls = {searchInput: null, signedKeys: []};

    globalThis.__workoutCandidateMatcherMocks = {
        exerciseRepository: {
            async search(input) {
                calls.searchInput = input;
                return searchResult;
            },
        },
        getSignedUrl: async (_client, command) => {
            const key = command.input.Key;
            calls.signedKeys.push(key);
            return `https://signed.example/${key.split('/').pop()}`;
        },
    };

    const outfile = path.join(tmpdir(), `workout-candidate-matcher-${process.pid}-${Date.now()}-${Math.random()}.mjs`);

    await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/features/workoutLogging/workoutCandidateMatcher.ts'],
        format: 'esm',
        logLevel: 'silent',
        outfile,
        platform: 'node',
        plugins: [workoutCandidateMatcherMocks],
    });

    try {
        const module = await import(`${pathToFileURL(outfile).href}?cache=${Date.now()}`);
        return {module, calls};
    } finally {
        delete globalThis.__workoutCandidateMatcherMocks;
        await rm(outfile, {force: true});
    }
}

const workoutCandidateMatcherMocks = {
    name: 'workout-candidate-matcher-mocks',
    setup: (buildContext) => {
        buildContext.onResolve({filter: /exerciseRepository\.js$/}, () => ({
            namespace: 'workout-candidate-matcher-mock-repo',
            path: 'exerciseRepository',
        }));

        buildContext.onLoad({filter: /^exerciseRepository$/, namespace: 'workout-candidate-matcher-mock-repo'}, () => ({
            contents: 'export const exerciseRepository = globalThis.__workoutCandidateMatcherMocks.exerciseRepository;',
            loader: 'js',
        }));

        buildContext.onResolve({filter: /^@aws-sdk\/s3-request-presigner$/}, () => ({
            namespace: 'workout-candidate-matcher-mock-presigner',
            path: 'presigner',
        }));

        buildContext.onLoad(
            {filter: /^presigner$/, namespace: 'workout-candidate-matcher-mock-presigner'},
            () => ({
                contents: 'export const getSignedUrl = globalThis.__workoutCandidateMatcherMocks.getSignedUrl;',
                loader: 'js',
            }),
        );

        buildContext.onResolve({filter: /^@aws-sdk\/client-s3$/}, () => ({
            namespace: 'workout-candidate-matcher-mock-s3',
            path: 's3',
        }));

        buildContext.onLoad({filter: /^s3$/, namespace: 'workout-candidate-matcher-mock-s3'}, () => ({
            contents: [
                'export class S3Client {}',
                'export class GetObjectCommand {',
                '    constructor(input) { this.input = input; }',
                '}',
            ].join('\n'),
            loader: 'js',
        }));
    },
};
