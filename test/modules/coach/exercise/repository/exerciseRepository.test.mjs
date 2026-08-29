import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {PgDialect} from 'drizzle-orm/pg-core';

const dialect = new PgDialect();

test('search() passes the caller\'s page/limit through to search_dict_exercises and returns the ranked rows', async () => {
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
        ['bench press', 2, 5],
        `expected params (query, page, limit) to pass the request through untouched, got: ${JSON.stringify(params)}`,
    );

    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].id, 1);
    assert.deepEqual(result.items[0].name, {en: 'Bench Press'});
});

test('search() returns zero rows when search_dict_exercises finds no match (AC-05b)', async () => {
    const {repository} = await loadRepository({rows: []});

    const result = await repository.search({q: 'nonexistent exercise', page: 1, limit: 3});

    assert.equal(result.items.length, 0);
});

test('search() parses a JSON-encoded name string returned by search_dict_exercises instead of dropping it', async () => {
    const {repository} = await loadRepository({
        rows: [{...row(1, 'Bench Press'), name: JSON.stringify({en: 'Bench Press'})}],
    });

    const result = await repository.search({q: 'bench press', page: 0, limit: 3});

    assert.deepEqual(result.items[0].name, {en: 'Bench Press'});
});

test('search() falls back to an empty name object when the raw value is not valid JSON', async () => {
    const {repository} = await loadRepository({
        rows: [{...row(1, 'Bench Press'), name: 'not json'}],
    });

    const result = await repository.search({q: 'bench press', page: 0, limit: 3});

    assert.deepEqual(result.items[0].name, {});
});

function row(id, name) {
    return {
        id,
        name: {en: name},
        key: `key-${id}`,
        level: 'beginner',
        category: 'strength',
        force: 'push',
        mechanic: 'compound',
        equipment: 'barbell',
        primary_muscles: ['chest'],
        secondary_muscles: ['triceps'],
        instructions: {},
        images: [],
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
