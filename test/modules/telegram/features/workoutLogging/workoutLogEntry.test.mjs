import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

// AC-01: starting a session opens it with a session day/start instant and no end yet.
// AC-13: session_day is fixed once at start, on the session, not recomputed per entry.
test('WorkoutLogSession captures session_day/started_at/ended_at/end_reason as an open session', async () => {
    const {WorkoutLogSession} = await loadDomainModule();

    const session = new WorkoutLogSession({
        id: 1,
        clientId: 777,
        sessionDay: '2026-08-23',
        startedAt: '2026-08-23T23:50:00.000Z',
    });

    assert.equal(session.clientId, 777);
    assert.equal(session.sessionDay, '2026-08-23');
    assert.equal(session.startedAt, '2026-08-23T23:50:00.000Z');
    assert.equal(session.endedAt, null);
    assert.equal(session.endReason, null);
    assert.deepEqual(Object.keys(session).sort(), ['clientId', 'endReason', 'endedAt', 'id', 'sessionDay', 'startedAt']);
});

// AC-13: a session that started before midnight and closes after midnight still keeps its
// original session_day; entries never carry their own day, they inherit the session's.
test('WorkoutLogSession keeps its original session_day after closing past midnight', async () => {
    const {WorkoutLogSession} = await loadDomainModule();

    const session = new WorkoutLogSession({
        id: 2,
        clientId: 777,
        sessionDay: '2026-08-23',
        startedAt: '2026-08-23T23:50:00.000Z',
        endedAt: '2026-08-24T00:20:00.000Z',
        endReason: 'client-ended',
    });

    assert.equal(session.sessionDay, '2026-08-23');
    assert.equal(session.endedAt, '2026-08-24T00:20:00.000Z');
    assert.equal(session.endReason, 'client-ended');
});

// AC-03: a described exercise captures reps/sets/weight and, when a catalog match exists,
// the linking dict_exercise_id, alongside the client's raw wording.
test('WorkoutLogEntry captures reps/sets/weight/dict_exercise_id for a linked exercise', async () => {
    const {WorkoutLogEntry} = await loadDomainModule();

    const entry = new WorkoutLogEntry({
        id: 10,
        sessionId: 1,
        dictExerciseId: 55,
        rawDescription: 'bench press 4x10 60kg',
        reps: 10,
        sets: 4,
        weight: 60,
    });

    assert.equal(entry.sessionId, 1);
    assert.equal(entry.dictExerciseId, 55);
    assert.equal(entry.rawDescription, 'bench press 4x10 60kg');
    assert.equal(entry.reps, 10);
    assert.equal(entry.sets, 4);
    assert.equal(entry.weight, 60);
});

// AC-05b/AC-06/AC-08: an unlinked entry (no catalog match, kept own description, or the
// unparsed fallback) has a null dict_exercise_id and no persistence-only field leaking in
// (no session_id-shaped "row" keys, no raw SQL types).
test('WorkoutLogEntry defaults dict_exercise_id to null for an unlinked entry with no persistence leakage', async () => {
    const {WorkoutLogEntry} = await loadDomainModule();

    const entry = new WorkoutLogEntry({
        id: 11,
        sessionId: 1,
        rawDescription: 'weird stretch thing',
    });

    assert.equal(entry.dictExerciseId, null);
    assert.equal(entry.reps, null);
    assert.equal(entry.sets, null);
    assert.equal(entry.weight, null);
    assert.deepEqual(
        Object.keys(entry).sort(),
        ['dictExerciseId', 'id', 'rawDescription', 'reps', 'sessionId', 'sets', 'weight'],
    );
});

async function loadDomainModule() {
    const outfile = path.join(tmpdir(), `workout-log-entry-domain-${process.pid}-${Date.now()}.mjs`);

    await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/features/workoutLogging/domain/workoutLogEntry.ts'],
        format: 'esm',
        logLevel: 'silent',
        outfile,
        platform: 'node',
    });

    try {
        return await import(`${pathToFileURL(outfile).href}?cache=${Date.now()}`);
    } finally {
        await rm(outfile, {force: true});
    }
}
