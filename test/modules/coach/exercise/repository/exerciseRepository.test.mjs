import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {PgDialect} from 'drizzle-orm/pg-core';

const dialect = new PgDialect();

test('search() converts the caller\'s one-based page to the stored function\'s zero-based page', async () => {
    const rows = [
        row(1, 'Bench Press'),
        row(2, 'Incline Bench Press'),
    ];
    const {repository, db} = await loadRepository({rows});

    const result = await repository.search({q: 'bench press', page: 2, limit: 5});

    assert.equal(db.calls.length, 1, 'expected exactly one db.execute call');
    const {sql, params} = dialect.sqlToQuery(db.calls[0]);

    assert.match(
        sql.replace(/\s+/g, ' ').trim(),
        /from\s+search_dict_exercises\s*\(/i,
        `expected query to call search_dict_exercises, got: ${sql}`,
    );
    assert.deepEqual(
        params,
        ['bench press', 1, 5],
        `expected params (query, zero-based page, limit), got: ${JSON.stringify(params)}`,
    );

    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].id, 1);
    assert.equal(result.items[0].name, 'Bench Press');
});

test('search() requests stored-function page zero for API page one', async () => {
    const {repository, db} = await loadRepository({rows: []});

    await repository.search({q: 'bench press', page: 1, limit: 5});

    const {params} = dialect.sqlToQuery(db.calls[0]);
    assert.deepEqual(params, ['bench press', 0, 5]);
});

test('search() coerces the ranking columns returned by search_dict_exercises to numbers', async () => {
    const {repository} = await loadRepository({
        rows: [{...row(1, 'Bench Press'), score: '412.5', coreInName: '1', nameInQuery: '0'}],
    });

    const result = await repository.search({q: 'bench press', page: 1, limit: 3});

    assert.equal(result.items[0].score, 412.5);
    assert.equal(result.items[0].coreInName, 1);
    assert.equal(result.items[0].nameInQuery, 0);
});

test('search() returns zero rows when search_dict_exercises finds no match (AC-05b)', async () => {
    const {repository} = await loadRepository({rows: []});

    const result = await repository.search({q: 'nonexistent exercise', page: 1, limit: 3});

    assert.equal(result.items.length, 0);
});

test('search() passes the raw jsonb instructions column through untouched (normalization happens in searchExercises)', async () => {
    const {repository} = await loadRepository({
        rows: [{...row(1, 'Bench Press'), instructions: ['Sit down', 'Push the handles forward']}],
    });

    const result = await repository.search({q: 'bench press', page: 1, limit: 3});

    assert.deepEqual(result.items[0].instructions, ['Sit down', 'Push the handles forward']);
});

function row(id, name) {
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
    };
}

async function loadRepository(options) {
    const db = {
        calls: [],
        async execute(query) {
            this.calls.push(query);
            return {rows: options.rows, rowCount: options.rows.length};
        },
    };

    globalThis.__exerciseRepositoryMocks = {getPostgresDb: () => db};

    const outfile = path.join(tmpdir(), `exercise-repository-${process.pid}-${Date.now()}.mjs`);

    await build({
        bundle: true,
        entryPoints: ['src/modules/coach/exercise/repository/exerciseRepository.ts'],
        format: 'esm',
        logLevel: 'silent',
        outfile,
        platform: 'node',
        plugins: [exerciseRepositoryMocks],
    });

    try {
        const module = await import(`${pathToFileURL(outfile).href}?cache=${Date.now()}`);
        return {repository: module.exerciseRepository, db};
    } finally {
        await rm(outfile, {force: true});
    }
}

const exerciseRepositoryMocks = {
    name: 'exercise-repository-mocks',
    setup(buildContext) {
        mockModule(buildContext, /postgresDb\.js$/, [
            'export const getPostgresDb = globalThis.__exerciseRepositoryMocks.getPostgresDb;',
        ]);
    },
};

function mockModule(buildContext, filter, contents) {
    const namespace = `mock-${String(filter)}`;
    buildContext.onResolve({filter}, () => ({namespace, path: 'mock'}));
    buildContext.onLoad({filter: /^mock$/, namespace}, () => ({contents: contents.join('\n'), loader: 'js'}));
}
