import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

// AC-02: a Telegram user who is not a registered client must be denied without ever
// opening a workout_log_session row.
test('startSession() denies a non-client and does not open a session (AC-02)', async () => {
    const harness = await loadWorkoutLoggingService({activeSession: null});

    const result = await harness.module.workoutLoggingService.startSession({
        clientId: null,
        now: new Date('2026-08-23T10:00:00.000Z'),
        timezoneOffsetMinutes: 0,
    });

    assert.equal(result.outcome, 'not-a-client', `expected not-a-client outcome, got: ${JSON.stringify(result)}`);
    assert.equal(harness.calls.startSession.length, 0, 'expected startSession() to never be called for a non-client');
});

// AC-12: starting again while a session is already open must be rejected and must not
// touch (close/pre-empt) the existing session.
test('startSession() rejects a repeat start while one session is already open, leaving it untouched (AC-12)', async () => {
    const activeSession = {
        id: 5,
        clientId: 777,
        sessionDay: '2026-08-22',
        startedAt: '2026-08-22T09:00:00.000Z',
        endedAt: null,
        endReason: null,
    };
    const harness = await loadWorkoutLoggingService({activeSession});

    const result = await harness.module.workoutLoggingService.startSession({
        clientId: 777,
        now: new Date('2026-08-23T10:00:00.000Z'),
        timezoneOffsetMinutes: 0,
    });

    assert.equal(result.outcome, 'already-open', `expected already-open outcome, got: ${JSON.stringify(result)}`);
    assert.equal(harness.calls.startSession.length, 0, 'expected no new session to be opened');
    assert.equal(harness.calls.closeSession.length, 0, 'expected the existing session to be left untouched');
});

// AC-13: sessionDay must be derived from the client's local start time, not the UTC
// calendar day the instant falls on.
test('startSession() derives sessionDay from the client\'s local start time, not UTC (AC-13)', async () => {
    const harness = await loadWorkoutLoggingService({activeSession: null});

    // 23:30 UTC on 2026-08-23, but the client is UTC+3 -> local time is 02:30 on 2026-08-24.
    const result = await harness.module.workoutLoggingService.startSession({
        clientId: 777,
        now: new Date('2026-08-23T23:30:00.000Z'),
        timezoneOffsetMinutes: 180,
    });

    assert.equal(result.outcome, 'started', `expected started outcome, got: ${JSON.stringify(result)}`);
    assert.equal(result.sessionId, 99, 'expected the created session id to be returned to the caller');
    assert.equal(harness.calls.startSession.length, 1, 'expected exactly one startSession() repository call');
    assert.equal(
        harness.calls.startSession[0].sessionDay,
        '2026-08-24',
        `expected sessionDay derived from client-local time (2026-08-24), got: ${harness.calls.startSession[0].sessionDay}`,
    );
});

// AC-09b: ending a session with no recorded exercises must close it with
// end_reason='client-ended' and must not confirm a workout as completed.
test('endSession() closes an empty session as client-ended with no workout-record confirmation (AC-09b)', async () => {
    const activeSession = {
        id: 5,
        clientId: 777,
        sessionDay: '2026-08-23',
        startedAt: '2026-08-23T09:00:00.000Z',
        endedAt: null,
        endReason: null,
    };
    const harness = await loadWorkoutLoggingService({activeSession, entryCount: 0});

    const result = await harness.module.workoutLoggingService.endSession({clientId: 777});

    assert.equal(result.outcome, 'ended-empty', `expected ended-empty outcome, got: ${JSON.stringify(result)}`);
    assert.equal(harness.calls.closeSession.length, 1, 'expected exactly one closeSession() repository call');
    assert.deepEqual(harness.calls.closeSession[0], {id: 5, endReason: 'client-ended'});
});

// AC-09: ending a session with at least one recorded exercise must close it as
// client-ended and confirm the workout as complete.
test('endSession() closes a recorded session as client-ended and confirms completion (AC-09)', async () => {
    const activeSession = {
        id: 5,
        clientId: 777,
        sessionDay: '2026-08-23',
        startedAt: '2026-08-23T09:00:00.000Z',
        endedAt: null,
        endReason: null,
    };
    const harness = await loadWorkoutLoggingService({activeSession, entryCount: 3});

    const result = await harness.module.workoutLoggingService.endSession({clientId: 777});

    assert.equal(result.outcome, 'ended-recorded', `expected ended-recorded outcome, got: ${JSON.stringify(result)}`);
    assert.equal(harness.calls.closeSession.length, 1, 'expected exactly one closeSession() repository call');
    assert.deepEqual(harness.calls.closeSession[0], {id: 5, endReason: 'client-ended'});
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
        },
    };

    const outfile = path.join(tmpdir(), `workout-logging-service-${process.pid}-${Date.now()}-${Math.random()}.mjs`);

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
            contents: 'export async function parseExerciseMessage() { return null; }',
            loader: 'js',
        }));

        buildContext.onResolve({filter: /workoutCandidateMatcher\.js$/}, () => ({
            namespace: 'workout-logging-service-mock-matcher',
            path: 'matcher',
        }));

        buildContext.onLoad({filter: /^matcher$/, namespace: 'workout-logging-service-mock-matcher'}, () => ({
            contents: 'export async function matchCandidates() { return null; }',
            loader: 'js',
        }));
    },
};
