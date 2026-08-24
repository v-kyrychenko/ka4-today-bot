import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const parsedExercise = {name: 'Bench press', reps: 10, sets: 4, weight: 60};

// T9/AC-03/AC-05: confirming one of the shown candidates links the saved entry to the catalog.
test('handleConfirmationResponse() saves a linked entry when the client confirms a candidate (AC-03/AC-05)', async () => {
    const harness = await loadWorkoutLoggingService();

    const result = await harness.module.workoutLoggingService.handleConfirmationResponse({
        sessionId: 5,
        action: 'confirm-candidate',
        rawDescription: 'bench press 4x10 60kg',
        parsedExercise,
        candidateExerciseId: 42,
    });

    assert.equal(result.outcome, 'saved-linked', `expected saved-linked, got: ${JSON.stringify(result)}`);
    assert.equal(harness.calls.addEntry.length, 1);
    assert.deepEqual(harness.calls.addEntry[0], {
        sessionId: 5,
        dictExerciseId: 42,
        rawDescription: 'bench press 4x10 60kg',
        reps: 10,
        sets: 4,
        weight: 60,
    });
});

// T9/AC-06: the client keeps their own description over the suggested candidates -> unlinked save.
test('handleConfirmationResponse() saves an unlinked entry when the client keeps their own description (AC-06)', async () => {
    const harness = await loadWorkoutLoggingService();

    const result = await harness.module.workoutLoggingService.handleConfirmationResponse({
        sessionId: 5,
        action: 'confirm-own',
        rawDescription: 'bench press 4x10 60kg',
        parsedExercise,
    });

    assert.equal(result.outcome, 'saved-unlinked', `expected saved-unlinked, got: ${JSON.stringify(result)}`);
    assert.equal(harness.calls.addEntry.length, 1);
    assert.deepEqual(harness.calls.addEntry[0], {
        sessionId: 5,
        dictExerciseId: null,
        rawDescription: 'bench press 4x10 60kg',
        reps: 10,
        sets: 4,
        weight: 60,
    });
});

// T9/AC-05b: the same 'confirm-own' action also covers the zero-candidate case, where there was
// never a candidate to pick from in the first place.
test('handleConfirmationResponse() saves an unlinked entry confirming the description when there were no candidates (AC-05b)', async () => {
    const harness = await loadWorkoutLoggingService();

    const result = await harness.module.workoutLoggingService.handleConfirmationResponse({
        sessionId: 5,
        action: 'confirm-own',
        rawDescription: 'some obscure move, 3x8',
        parsedExercise: {name: 'Some obscure move', reps: 8, sets: 3, weight: null},
    });

    assert.equal(result.outcome, 'saved-unlinked');
    assert.equal(harness.calls.addEntry[0].dictExerciseId, null);
});

// T9/AC-07b: rejecting the confirmed proposal (the whole entry is wrong, not just the candidate
// pick) re-enters the same one-retry unclear flow as AC-07 -- it must NOT save anything yet.
test('handleConfirmationResponse() triggers a retry instead of saving when the client rejects the proposal (AC-07b)', async () => {
    const harness = await loadWorkoutLoggingService();

    const result = await harness.module.workoutLoggingService.handleConfirmationResponse({
        sessionId: 5,
        action: 'reject',
        rawDescription: 'bench press 4x10 60kg',
        parsedExercise,
    });

    assert.equal(result.outcome, 'retry', `expected retry, got: ${JSON.stringify(result)}`);
    assert.equal(harness.calls.addEntry.length, 0, 'expected no addEntry call before a retry is resolved');
});

// T9/AC-08: once the AC-07b retry itself fails to parse, the original wording is saved raw and
// unconfirmed -- unlinked, with reps/sets/weight all null.
test('saveUnconfirmedEntry() saves the client\'s original wording raw, unlinked, with null numbers (AC-08)', async () => {
    const harness = await loadWorkoutLoggingService();

    const result = await harness.module.workoutLoggingService.saveUnconfirmedEntry({
        sessionId: 5,
        rawDescription: 'did some stuff at the gym, still not sure how much',
    });

    assert.equal(result.outcome, 'saved-unconfirmed', `expected saved-unconfirmed, got: ${JSON.stringify(result)}`);
    assert.equal(harness.calls.addEntry.length, 1);
    assert.deepEqual(harness.calls.addEntry[0], {
        sessionId: 5,
        dictExerciseId: null,
        rawDescription: 'did some stuff at the gym, still not sure how much',
        reps: null,
        sets: null,
        weight: null,
    });
});

async function loadWorkoutLoggingService() {
    const calls = {addEntry: []};

    globalThis.__workoutLoggingServiceMocks = {
        workoutLogRepository: {
            async findActiveByClientId() {
                return null;
            },
            async startSession() {
                throw new Error('startSession() should not be called in this test');
            },
            async closeSession() {
                throw new Error('closeSession() should not be called in this test');
            },
            async countEntries() {
                return 0;
            },
            async findLastEntryAt() {
                return null;
            },
            async addEntry(input) {
                calls.addEntry.push(input);
                return {id: 1, ...input};
            },
        },
        workoutExerciseParser: {
            async parseExerciseMessage() {
                throw new Error('parseExerciseMessage() should not be called in this test');
            },
        },
        workoutCandidateMatcher: {
            async matchCandidates() {
                throw new Error('matchCandidates() should not be called in this test');
            },
        },
    };

    const outfile = path.join(
        tmpdir(),
        `workout-logging-confirmation-response-${process.pid}-${Date.now()}-${Math.random()}.mjs`,
    );

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
    name: 'workout-logging-confirmation-response-mocks',
    setup(buildContext) {
        buildContext.onResolve({filter: /repository\/workoutLogRepository\.js$/}, () => ({
            namespace: 'workout-logging-confirmation-response-mock',
            path: 'workoutLogRepository',
        }));
        buildContext.onResolve({filter: /workoutExerciseParser\.js$/}, () => ({
            namespace: 'workout-logging-confirmation-response-mock',
            path: 'workoutExerciseParser',
        }));
        buildContext.onResolve({filter: /workoutCandidateMatcher\.js$/}, () => ({
            namespace: 'workout-logging-confirmation-response-mock',
            path: 'workoutCandidateMatcher',
        }));

        buildContext.onLoad(
            {filter: /^workoutLogRepository$/, namespace: 'workout-logging-confirmation-response-mock'},
            () => ({
                contents:
                    'export const workoutLogRepository = ' +
                    'globalThis.__workoutLoggingServiceMocks.workoutLogRepository;',
                loader: 'js',
            }),
        );
        buildContext.onLoad(
            {filter: /^workoutExerciseParser$/, namespace: 'workout-logging-confirmation-response-mock'},
            () => ({
                contents:
                    'export const parseExerciseMessage = ' +
                    'globalThis.__workoutLoggingServiceMocks.workoutExerciseParser.parseExerciseMessage;',
                loader: 'js',
            }),
        );
        buildContext.onLoad(
            {filter: /^workoutCandidateMatcher$/, namespace: 'workout-logging-confirmation-response-mock'},
            () => ({
                contents:
                    'export const matchCandidates = ' +
                    'globalThis.__workoutLoggingServiceMocks.workoutCandidateMatcher.matchCandidates;',
                loader: 'js',
            }),
        );
    },
};
