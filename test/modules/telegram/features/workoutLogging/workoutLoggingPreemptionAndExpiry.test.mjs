import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const activeSession = {
    id: 5,
    clientId: 777,
    sessionDay: '2026-08-23',
    startedAt: '2026-08-23T09:00:00.000Z',
    endedAt: null,
    endReason: null,
};

// AC-10: another route (or a cron-enqueued reminder) must end an open workout-logging session
// early, discarding any unconfirmed entry, before the other interaction is handled. This is the
// primitive workoutLoggingConversation's onPreempt hook (wired via the generic conversation
// engine's preemptActiveConversation, see conversationEngine.lifecycleHooks.test.mjs) calls.
test('preemptActiveSession() closes an open session as pre-empted (AC-10)', async () => {
    const harness = await loadWorkoutLoggingService({activeSession});

    await harness.module.workoutLoggingService.preemptActiveSession({clientId: 777});

    assert.equal(harness.calls.closeSession.length, 1, 'expected exactly one closeSession() repository call');
    assert.deepEqual(harness.calls.closeSession[0], {id: 5, endReason: 'pre-empted'});
});

test('preemptActiveSession() is a no-op when the client has no open session (AC-10)', async () => {
    const harness = await loadWorkoutLoggingService({activeSession: null});

    await harness.module.workoutLoggingService.preemptActiveSession({clientId: 777});

    assert.equal(harness.calls.closeSession.length, 0, 'expected no closeSession() call when nothing is open');
});

// AC-11: a session idle for more than 2h (from start or its last recorded entry, whichever is
// later) auto-closes on the next check. The 2h idle window itself is enforced by the generic
// conversation engine's TTL (tg_conversation_state.expires_at, refreshed on every recorded
// exercise) -- by the time this onExpire hook fires, the engine has already decided the
// conversation expired, so this just closes the matching workout_log_session as auto-closed.
test('closeExpiredSession() closes the open session as auto-closed (AC-11)', async () => {
    const harness = await loadWorkoutLoggingService({activeSession});

    await harness.module.workoutLoggingService.closeExpiredSession({clientId: 777});

    assert.deepEqual(harness.calls.closeSession[0], {id: 5, endReason: 'auto-closed'});
});

test('closeExpiredSession() is a no-op when the client has no open session (AC-11)', async () => {
    const harness = await loadWorkoutLoggingService({activeSession: null});

    await harness.module.workoutLoggingService.closeExpiredSession({clientId: 777});

    assert.equal(harness.calls.closeSession.length, 0, 'expected no closeSession() call when nothing is open');
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
