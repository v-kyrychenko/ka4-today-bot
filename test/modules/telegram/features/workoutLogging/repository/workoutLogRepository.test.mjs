import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {getTableName} from 'drizzle-orm';
import {PgDialect} from 'drizzle-orm/pg-core';

const dialect = new PgDialect();

// AC-01/AC-12: finding the client's currently-open session is how the caller decides whether
// a new session may be opened (AC-01) or must be refused as already-open (AC-12).
test('findActiveByClientId() filters by client_id and ended_at IS NULL, and maps the row to a domain session', async () => {
    const rows = [sessionRow({id: 1, client_id: 777, ended_at: null, end_reason: null})];
    const {repository, db} = await loadRepository({rows});

    const session = await repository.findActiveByClientId(777);

    assert.equal(db.calls.length, 1, 'expected exactly one query call');
    const [call] = db.calls;
    assert.equal(call.kind, 'select');
    assert.equal(getTableName(call.table), 'workout_log_session', `expected a query against workout_log_session, got: ${getTableName(call.table)}`);
    assert.equal(call.limit, 1);

    const {sql, params} = dialect.sqlToQuery(call.where);
    const normalized = sql.replace(/\s+/g, ' ').trim();
    assert.match(normalized, /ended_at"?\s+is\s+null/i, `expected an ended_at IS NULL filter, got: ${sql}`);
    assert.ok(params.includes(777), `expected client_id 777 among the filter params, got: ${JSON.stringify(params)}`);

    assert.equal(session.id, 1);
    assert.equal(session.clientId, 777);
    assert.equal(session.endedAt, null);
    assert.equal(session.endReason, null);
    assert.equal(session.session_id, undefined, 'domain session must not leak snake_case row keys');
});

test('findActiveByClientId() returns null when the client has no open session', async () => {
    const {repository} = await loadRepository({rows: []});

    const session = await repository.findActiveByClientId(777);

    assert.equal(session, null);
});

// AC-01: starting a session persists client_id/session_day/started_at and returns it open
// (ended_at/end_reason null) as a mapped domain session.
test('startSession() inserts a new open session and returns the mapped domain session', async () => {
    const insertedRow = sessionRow({
        id: 2,
        client_id: 777,
        session_day: '2026-08-23',
        started_at: '2026-08-23T10:00:00.000Z',
        ended_at: null,
        end_reason: null,
    });
    const {repository, db} = await loadRepository({rows: [insertedRow]});

    const session = await repository.startSession({
        clientId: 777,
        sessionDay: '2026-08-23',
        startedAt: '2026-08-23T10:00:00.000Z',
    });

    assert.equal(db.calls.length, 1, 'expected exactly one query call');
    const [call] = db.calls;
    assert.equal(call.kind, 'insert');
    assert.equal(getTableName(call.table), 'workout_log_session', `expected an insert into workout_log_session, got: ${getTableName(call.table)}`);
    assert.equal(call.returning, true);
    assert.deepEqual(call.values, {
        client_id: 777,
        session_day: '2026-08-23',
        started_at: '2026-08-23T10:00:00.000Z',
    });

    assert.equal(session.id, 2);
    assert.equal(session.clientId, 777);
    assert.equal(session.sessionDay, '2026-08-23');
    assert.equal(session.endedAt, null);
    assert.equal(session.endReason, null);
});

// AC-09/AC-09b/AC-10/AC-11: every closing path (explicit end, auto-close, pre-emption) goes
// through the same primitive, distinguished only by the end_reason value it is given.
test('closeSession() sets ended_at and end_reason, and returns the mapped closed session', async () => {
    const closedRow = sessionRow({
        id: 1,
        client_id: 777,
        ended_at: '2026-08-23T12:00:00.000Z',
        end_reason: 'client-ended',
    });
    const {repository, db} = await loadRepository({rows: [closedRow]});

    const session = await repository.closeSession(1, 'client-ended');

    assert.equal(db.calls.length, 1, 'expected exactly one query call');
    const [call] = db.calls;
    assert.equal(call.kind, 'update');
    assert.equal(getTableName(call.table), 'workout_log_session', `expected an update of workout_log_session, got: ${getTableName(call.table)}`);
    assert.equal(call.returning, true);
    assert.equal(call.set.end_reason, 'client-ended');
    assert.ok(call.set.ended_at, 'expected ended_at to be set');

    const {sql, params} = dialect.sqlToQuery(call.where);
    assert.ok(params.includes(1), `expected session id 1 among the filter params, got: ${JSON.stringify(params)}`);
    assert.match(sql, /\bid\b/i, `expected the update to filter by id, got: ${sql}`);

    assert.equal(session.endReason, 'client-ended');
    assert.equal(session.endedAt, '2026-08-23T12:00:00.000Z');
});

// AC-03/AC-05b/AC-06/AC-08: saving a recorded exercise, linked or not, round-trips through the
// row <-> domain boundary with no persistence-only leakage.
test('addEntry() inserts a workout_log_entry row and returns the mapped domain entry', async () => {
    const insertedRow = entryRow({
        id: 10,
        session_id: 1,
        dict_exercise_id: null,
        raw_description: 'weird stretch thing',
        reps: null,
        sets: null,
        weight: null,
    });
    const {repository, db} = await loadRepository({rows: [insertedRow]});

    const entry = await repository.addEntry({
        sessionId: 1,
        dictExerciseId: null,
        rawDescription: 'weird stretch thing',
        reps: null,
        sets: null,
        weight: null,
    });

    assert.equal(db.calls.length, 1, 'expected exactly one query call');
    const [call] = db.calls;
    assert.equal(call.kind, 'insert');
    assert.equal(getTableName(call.table), 'workout_log_entry', `expected an insert into workout_log_entry, got: ${getTableName(call.table)}`);
    assert.equal(call.returning, true);
    assert.equal(call.values.session_id, 1);
    assert.equal(call.values.raw_description, 'weird stretch thing');
    assert.equal(call.values.weight, null);

    assert.equal(entry.id, 10);
    assert.equal(entry.sessionId, 1);
    assert.equal(entry.dictExerciseId, null);
    assert.equal(entry.rawDescription, 'weird stretch thing');
    assert.equal(entry.reps, null);
});

test('addEntry() stringifies a numeric weight for the numeric(5,1) column', async () => {
    const {repository, db} = await loadRepository({rows: [entryRow({weight: '60.0'})]});

    await repository.addEntry({
        sessionId: 1,
        dictExerciseId: null,
        rawDescription: 'bench press 4x10 60kg',
        reps: 10,
        sets: 4,
        weight: 60,
    });

    assert.equal(db.calls[0].values.weight, '60');
});

// AC-09/AC-09b: closing a session decides "empty vs recorded" by counting its entries.
test('countEntries() counts workout_log_entry rows filtered by session_id', async () => {
    const {repository, db} = await loadRepository({countResult: 3});

    const count = await repository.countEntries(1);

    assert.equal(db.calls.length, 1, 'expected exactly one query call');
    const [call] = db.calls;
    assert.equal(call.kind, 'count');
    assert.equal(getTableName(call.table), 'workout_log_entry', `expected a count against workout_log_entry, got: ${getTableName(call.table)}`);

    const {sql, params} = dialect.sqlToQuery(call.where);
    assert.match(sql, /session_id/i, `expected the count to filter by session_id, got: ${sql}`);
    assert.ok(params.includes(1), `expected session_id 1 among the filter params, got: ${JSON.stringify(params)}`);

    assert.equal(count, 3, `expected countEntries to return the numeric count, got: ${JSON.stringify(count)}`);
});

test('countEntries() returns 0 for a session with no recorded exercises (AC-09b)', async () => {
    const {repository} = await loadRepository({countResult: 0});

    const count = await repository.countEntries(1);

    assert.equal(count, 0);
});

function sessionRow(overrides) {
    return {
        id: 1,
        client_id: 777,
        session_day: '2026-08-23',
        started_at: '2026-08-23T10:00:00.000Z',
        ended_at: null,
        end_reason: null,
        ...overrides,
    };
}

function entryRow(overrides) {
    return {
        id: 1,
        session_id: 1,
        dict_exercise_id: null,
        raw_description: 'bench press 4x10 60kg',
        reps: 10,
        sets: 4,
        weight: '60.0',
        created_at: '2026-08-23T10:05:00.000Z',
        ...overrides,
    };
}

async function loadRepository(options) {
    const db = createFakeDb(options);

    globalThis.__workoutLogRepositoryMocks = {getPostgresDb: () => db};

    const outfile = path.join(tmpdir(), `workout-log-repository-${process.pid}-${Date.now()}-${Math.random()}.mjs`);

    await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/features/workoutLogging/repository/workoutLogRepository.ts'],
        format: 'esm',
        logLevel: 'silent',
        outfile,
        platform: 'node',
        plugins: [workoutLogRepositoryMocks],
    });

    try {
        const module = await import(`${pathToFileURL(outfile).href}?cache=${Date.now()}-${Math.random()}`);
        return {repository: module.workoutLogRepository, db};
    } finally {
        await rm(outfile, {force: true});
    }
}

// A purpose-built fluent test double for Drizzle's query builder -- there is no real DB, and no
// existing pattern in this repo for unit-testing a Drizzle-builder-based repository (every other
// builder-based repository has zero unit tests). It records each chain's shape (table/where/
// values/limit) for direct assertions, rather than compiling to raw SQL, since `.values()`/
// `.set()` take plain objects (not SQL fragments) -- only `where` conditions are real Drizzle
// `SQL` objects, so those alone are inspected via `PgDialect.sqlToQuery()`.
function createFakeDb(options) {
    const calls = [];

    function chain(entry, resolveValue) {
        const builder = {
            from(table) {
                entry.table = table;
                return builder;
            },
            where(condition) {
                entry.where = condition;
                return builder;
            },
            limit(n) {
                entry.limit = n;
                return builder;
            },
            values(values) {
                entry.values = values;
                return builder;
            },
            set(values) {
                entry.set = values;
                return builder;
            },
            returning() {
                entry.returning = true;
                return builder;
            },
            then(onFulfilled, onRejected) {
                return Promise.resolve(resolveValue()).then(onFulfilled, onRejected);
            },
            catch(onRejected) {
                return builder.then(undefined, onRejected);
            },
        };

        return builder;
    }

    return {
        calls,
        select() {
            const entry = {kind: 'select'};
            calls.push(entry);
            return chain(entry, () => options.rows ?? []);
        },
        insert(table) {
            const entry = {kind: 'insert', table};
            calls.push(entry);
            return chain(entry, () => options.rows ?? []);
        },
        update(table) {
            const entry = {kind: 'update', table};
            calls.push(entry);
            return chain(entry, () => options.rows ?? []);
        },
        $count(table, where) {
            calls.push({kind: 'count', table, where});
            return Promise.resolve(options.countResult ?? 0);
        },
    };
}

const workoutLogRepositoryMocks = {
    name: 'workout-log-repository-mocks',
    setup(buildContext) {
        mockModule(buildContext, /postgresDb\.js$/, [
            'export const getPostgresDb = globalThis.__workoutLogRepositoryMocks.getPostgresDb;',
        ]);
    },
};

function mockModule(buildContext, filter, contents) {
    const namespace = `mock-${String(filter)}`;
    buildContext.onResolve({filter}, () => ({namespace, path: 'mock'}));
    buildContext.onLoad({filter: /^mock$/, namespace}, () => ({contents: contents.join('\n'), loader: 'js'}));
}
