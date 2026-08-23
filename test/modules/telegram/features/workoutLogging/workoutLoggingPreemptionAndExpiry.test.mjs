import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

// T12/AC-10: another route (or a cron-enqueued reminder, which reaches routesProcessor as a
// synthetic message per ADR-0003) must end an open workout-logging session early, discarding
// any unconfirmed entry, before the other interaction is handled. This is the pre-emption
// primitive that routesProcessor.ts (per ADR-0003's single call site) is expected to invoke.
test('preemptActiveSession() closes an open session as pre-empted (AC-10)', async () => {
    const activeSession = {
        id: 5,
        clientId: 777,
        sessionDay: '2026-08-23',
        startedAt: '2026-08-23T09:00:00.000Z',
        endedAt: null,
        endReason: null,
    };
    const harness = await loadWorkoutLoggingService({activeSession});

    const result = await harness.module.workoutLoggingService.preemptActiveSession({clientId: 777});

    assert.equal(result.outcome, 'pre-empted', `expected pre-empted outcome, got: ${JSON.stringify(result)}`);
    assert.equal(harness.calls.closeSession.length, 1, 'expected exactly one closeSession() repository call');
    assert.deepEqual(harness.calls.closeSession[0], {id: 5, endReason: 'pre-empted'});
});

test('preemptActiveSession() is a no-op when the client has no open session (AC-10)', async () => {
    const harness = await loadWorkoutLoggingService({activeSession: null});

    const result = await harness.module.workoutLoggingService.preemptActiveSession({clientId: 777});

    assert.equal(
        result.outcome,
        'no-active-session',
        `expected no-active-session outcome, got: ${JSON.stringify(result)}`,
    );
    assert.equal(harness.calls.closeSession.length, 0, 'expected no closeSession() call when nothing is open');
});

// T12/AC-11: a session idle for more than 2h from its start or its most recently recorded
// exercise (whichever is later) must be lazily closed as auto-closed on the next check, with
// no client message required.
test('closeExpiredSession() auto-closes a session idle >2h since its last recorded entry (AC-11)', async () => {
    const activeSession = {
        id: 5,
        clientId: 777,
        sessionDay: '2026-08-23',
        startedAt: '2026-08-23T09:00:00.000Z',
        endedAt: null,
        endReason: null,
    };
    const harness = await loadWorkoutLoggingService({activeSession, lastEntryAt: '2026-08-23T10:00:00.000Z'});

    // last entry at 10:00, now is 12:01 -> 2h01m idle since last entry, past the 2h threshold.
    const result = await harness.module.workoutLoggingService.closeExpiredSession({
        clientId: 777,
        now: new Date('2026-08-23T12:01:00.000Z'),
    });

    assert.equal(result.outcome, 'auto-closed', `expected auto-closed outcome, got: ${JSON.stringify(result)}`);
    assert.equal(harness.calls.closeSession.length, 1, 'expected exactly one closeSession() repository call');
    assert.deepEqual(harness.calls.closeSession[0], {id: 5, endReason: 'auto-closed'});
});

test('closeExpiredSession() leaves a session untouched while idle time is under 2h (AC-11)', async () => {
    const activeSession = {
        id: 5,
        clientId: 777,
        sessionDay: '2026-08-23',
        startedAt: '2026-08-23T09:00:00.000Z',
        endedAt: null,
        endReason: null,
    };
    const harness = await loadWorkoutLoggingService({activeSession, lastEntryAt: '2026-08-23T11:00:00.000Z'});

    // last entry at 11:00, now is 12:30 -> only 1h30m idle, under the 2h threshold.
    const result = await harness.module.workoutLoggingService.closeExpiredSession({
        clientId: 777,
        now: new Date('2026-08-23T12:30:00.000Z'),
    });

    assert.equal(result.outcome, 'active', `expected active outcome, got: ${JSON.stringify(result)}`);
    assert.equal(harness.calls.closeSession.length, 0, 'expected no closeSession() call while still within the TTL');
});

test('closeExpiredSession() measures idle time from session start when no entry was ever recorded (AC-11)', async () => {
    const activeSession = {
        id: 5,
        clientId: 777,
        sessionDay: '2026-08-23',
        startedAt: '2026-08-23T09:00:00.000Z',
        endedAt: null,
        endReason: null,
    };
    const harness = await loadWorkoutLoggingService({activeSession, lastEntryAt: null});

    // no recorded entries -> idle measured from session start (09:00); now is 11:31 -> 2h31m idle.
    const result = await harness.module.workoutLoggingService.closeExpiredSession({
        clientId: 777,
        now: new Date('2026-08-23T11:31:00.000Z'),
    });

    assert.equal(result.outcome, 'auto-closed', `expected auto-closed outcome, got: ${JSON.stringify(result)}`);
    assert.deepEqual(harness.calls.closeSession[0], {id: 5, endReason: 'auto-closed'});
});

async function loadWorkoutLoggingService(options) {
    const calls = {startSession: [], closeSession: []};

    globalThis.__workoutLoggingServiceMocks = {
        workoutLogRepository: {
            async findActiveByClientId() {
                return options.activeSession ?? null;
            },
            async startSession(input) {
                calls.startSession.push(input);
                return {id: 99, ...input, endedAt: null, endReason: null};
            },
            async closeSession(id, endReason) {
                calls.closeSession.push({id, endReason});
                return {id, endedAt: '2026-08-23T12:00:00.000Z', endReason};
            },
            async countEntries() {
                return options.entryCount ?? 0;
            },
            async findLastEntryAt() {
                return options.lastEntryAt ?? null;
            },
        },
    };

    const outfile = path.join(tmpdir(), `workout-logging-preemption-expiry-${process.pid}-${Date.now()}-${Math.random()}.mjs`);

    await build({
        bundle: true,
        entryPoints: ['src/modules/telegram/features/workoutLogging/workoutLoggingService.ts'],
        format: 'esm',
        logLevel: 'silent',
        outfile,
        platform: 'node',
        plugins: [workoutLoggingServiceMocks],
    });

    try {
        const module = await import(`${pathToFileURL(outfile).href}?cache=${Date.now()}`);
        return {module, calls};
    } finally {
        delete globalThis.__workoutLoggingServiceMocks;
        await rm(outfile, {force: true});
    }
}

const workoutLoggingServiceMocks = {
    name: 'workout-logging-service-mocks',
    setup(buildContext) {
        buildContext.onResolve({filter: /repository\/workoutLogRepository\.js$/}, () => ({
            namespace: 'workout-logging-service-mock',
            path: 'workoutLogRepository',
        }));

        buildContext.onLoad({filter: /^workoutLogRepository$/, namespace: 'workout-logging-service-mock'}, () => ({
            contents:
                'export const workoutLogRepository = globalThis.__workoutLoggingServiceMocks.workoutLogRepository;',
            loader: 'js',
        }));

        buildContext.onResolve({filter: /workoutExerciseParser\.js$/}, () => ({
            namespace: 'workout-logging-service-mock-parser',
            path: 'parser',
        }));

        buildContext.onLoad({filter: /^parser$/, namespace: 'workout-logging-service-mock-parser'}, () => ({
            contents: 'export async function parseExerciseMessage() { return {outcome: "unclear", exercise: null}; }',
            loader: 'js',
        }));

        buildContext.onResolve({filter: /workoutCandidateMatcher\.js$/}, () => ({
            namespace: 'workout-logging-service-mock-matcher',
            path: 'matcher',
        }));

        buildContext.onLoad({filter: /^matcher$/, namespace: 'workout-logging-service-mock-matcher'}, () => ({
            contents: 'export async function matchCandidates() { return {outcome: "noMatch"}; }',
            loader: 'js',
        }));
    },
};
