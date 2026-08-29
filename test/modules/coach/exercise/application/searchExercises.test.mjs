import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

test('searchExercises maps repository rows to ExerciseItem and normalizes the jsonb instructions array', async () => {
    const {searchExercises} = await loadSearchExercises({
        searchResult: {
            items: [rankedRow(1, 'Bench Press', {instructions: ['Sit down', 'Push the handles forward']})],
            total: 1,
        },
    });

    const result = await searchExercises({q: 'bench press', page: 0, limit: 3});

    assert.equal(result.items[0].id, 1);
    assert.equal(result.items[0].name, 'Bench Press');
    assert.deepEqual(result.items[0].instructions, ['Sit down', 'Push the handles forward']);
});

test('searchExercises falls back to an empty instructions array when the raw value is not an array', async () => {
    const {searchExercises} = await loadSearchExercises({
        searchResult: {items: [rankedRow(1, 'Bench Press', {instructions: null})], total: 1},
    });

    const result = await searchExercises({q: 'bench press', page: 0, limit: 3});

    assert.deepEqual(result.items[0].instructions, []);
});

test('searchExercises does not leak the ranking columns onto the returned items', async () => {
    const {searchExercises} = await loadSearchExercises({
        searchResult: {items: [rankedRow(1, 'Bench Press', {score: 412, coreInName: 1, nameInQuery: 1})], total: 1},
    });

    const result = await searchExercises({q: 'bench press', page: 0, limit: 3});

    assert.equal('score' in result.items[0], false);
    assert.equal('coreInName' in result.items[0], false);
    assert.equal('nameInQuery' in result.items[0], false);
});

function rankedRow(id, name, overrides = {}) {
    return {
        id,
        name,
        key: `key-${id}`,
        level: 'beginner',
        category: 'strength',
        force: 'push',
        mechanic: 'compound',
        equipment: 'barbell',
        primary_muscles: ['chest'],
        secondary_muscles: ['triceps'],
        instructions: [],
        images: [],
        score: 0,
        coreInName: 0,
        nameInQuery: 0,
        ...overrides,
    };
}

async function loadSearchExercises(options) {
    globalThis.__searchExercisesMocks = {
        exerciseRepository: {
            async search() {
                return options.searchResult;
            },
        },
    };

    const outfile = path.join(tmpdir(), `search-exercises-${process.pid}-${Date.now()}.mjs`);

    await build({
        bundle: true,
        entryPoints: ['src/modules/coach/exercise/application/searchExercises.ts'],
        format: 'esm',
        logLevel: 'silent',
        outfile,
        platform: 'node',
        plugins: [searchExercisesMocks],
    });

    try {
        const module = await import(`${pathToFileURL(outfile).href}?cache=${Date.now()}`);
        return {searchExercises: module.searchExercises};
    } finally {
        delete globalThis.__searchExercisesMocks;
        await rm(outfile, {force: true});
    }
}

const searchExercisesMocks = {
    name: 'search-exercises-mocks',
    setup: (buildContext) => {
        buildContext.onResolve({filter: /repository\/exerciseRepository\.js$/}, () => ({
            namespace: 'search-exercises-mock-repo',
            path: 'exerciseRepository',
        }));

        buildContext.onLoad({filter: /^exerciseRepository$/, namespace: 'search-exercises-mock-repo'}, () => ({
            contents: 'export const exerciseRepository = globalThis.__searchExercisesMocks.exerciseRepository;',
            loader: 'js',
        }));
    },
};
