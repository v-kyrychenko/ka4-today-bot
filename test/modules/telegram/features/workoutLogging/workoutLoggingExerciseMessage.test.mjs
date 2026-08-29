import {strict as assert} from 'node:assert';
import {rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

// T8/AC-03/AC-05/AC-14: a well-formed exercise message must be parsed (T6) and matched against
// the catalog (T7), producing a combined exercise+numbers confirmation payload for the client to
// confirm — without ever writing to workout_log_entry before that confirmation happens. The lang
// passed into the parser must be the client's own stored lang, not derived from the message text.
test(
    'handleExerciseMessage() combines a parsed exercise with catalog candidates into a confirmation ' +
        'proposal, using the client\'s stored lang, without writing an entry (AC-03/AC-05/AC-14)',
    async () => {
        const parsedExercise = {name: 'Bench press', reps: 10, sets: 4, weight: 60};
        const candidates = [
            {exerciseId: 1, name: 'Bench press', reps: 10, sets: 4, weight: 60, imageUrl: 'https://img/1'},
        ];
        const harness = await loadWorkoutLoggingService({
            parseResult: parsedExercise,
            matchResult: {outcome: 'matched', candidates},
        });

        const result = await harness.module.workoutLoggingService.handleExerciseMessage({
            sessionId: 5,
            message: 'Bench press, 4 sets of 10 reps, 60kg',
            lang: 'ua',
        });

        assert.equal(
            result.outcome,
            'confirmation-proposed',
            `expected confirmation-proposed outcome, got: ${JSON.stringify(result)}`,
        );
        assert.deepEqual(result.parsedExercise, parsedExercise, 'expected the parsed exercise+numbers to be returned');
        assert.deepEqual(result.candidates, candidates, 'expected the matched catalog candidates to be returned');
        assert.equal(
            harness.calls.parseExerciseMessage[0].lang,
            'ua',
            'expected the client\'s stored lang to be passed to the parser untouched (AC-14), ' +
                `got: ${JSON.stringify(harness.calls.parseExerciseMessage[0])}`,
        );
        assert.equal(harness.calls.addEntry.length, 0, 'expected no workoutLogRepository.addEntry() call before confirmation');
    },
);

// T8/AC-05b: when the catalog search returns no close-matching candidates, the client must still
// be shown a confirmation (of their own described entry, unlinked to the catalog) rather than a
// failure — and, as above, nothing may be written before that confirmation happens.
test(
    'handleExerciseMessage() still proposes a confirmation, with no candidates, when the catalog has ' +
        'no close match (AC-05b)',
    async () => {
        const parsedExercise = {name: 'Some obscure move', reps: 8, sets: 3, weight: null};
        const harness = await loadWorkoutLoggingService({
            parseResult: parsedExercise,
            matchResult: {outcome: 'noMatch'},
        });

        const result = await harness.module.workoutLoggingService.handleExerciseMessage({
            sessionId: 5,
            message: 'some obscure move, 3x8',
            lang: 'en',
        });

        assert.equal(
            result.outcome,
            'confirmation-proposed',
            `expected confirmation-proposed outcome even with no catalog match, got: ${JSON.stringify(result)}`,
        );
        assert.deepEqual(result.parsedExercise, parsedExercise);
        assert.deepEqual(result.candidates, [], 'expected an empty candidate list when the catalog has no match');
        assert.equal(harness.calls.addEntry.length, 0, 'expected no workoutLogRepository.addEntry() call before confirmation');
    },
);

// T8/AC-07: an incomplete or multi-exercise message must produce the unclear reply and flag one
// retry remaining, without ever calling the catalog matcher or writing an entry.
test(
    'handleExerciseMessage() flags one retry remaining for an unclear message and writes nothing (AC-07)',
    async () => {
        const harness = await loadWorkoutLoggingService({
            parseResult: null,
        });

        const result = await harness.module.workoutLoggingService.handleExerciseMessage({
            sessionId: 5,
            message: 'did some stuff at the gym',
            lang: 'en',
        });

        assert.equal(result.outcome, 'unclear', `expected unclear outcome, got: ${JSON.stringify(result)}`);
        assert.equal(result.retryRemaining, true, 'expected exactly one retry to be flagged as remaining (AC-07)');
        assert.equal(harness.calls.matchCandidates.length, 0, 'expected the catalog matcher never to run for an unclear message');
        assert.equal(harness.calls.addEntry.length, 0, 'expected no workoutLogRepository.addEntry() call for an unclear message');
    },
);

async function loadWorkoutLoggingService(options) {
    const calls = {parseExerciseMessage: [], matchCandidates: [], addEntry: []};

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
            async addEntry(input) {
                calls.addEntry.push(input);
                return {id: 1, ...input};
            },
        },
        workoutExerciseParser: {
            async parseExerciseMessage(input) {
                calls.parseExerciseMessage.push(input);
                return options.parseResult;
            },
        },
        workoutCandidateMatcher: {
            async matchCandidates(input) {
                calls.matchCandidates.push(input);
                return options.matchResult;
            },
        },
    };

    const outfile = path.join(
        tmpdir(),
        `workout-logging-exercise-message-${process.pid}-${Date.now()}-${Math.random()}.mjs`,
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
    name: 'workout-logging-exercise-message-mocks',
    setup(buildContext) {
        buildContext.onResolve({filter: /repository\/workoutLogRepository\.js$/}, () => ({
            namespace: 'workout-logging-exercise-message-mock',
            path: 'workoutLogRepository',
        }));
        buildContext.onResolve({filter: /workoutExerciseParser\.js$/}, () => ({
            namespace: 'workout-logging-exercise-message-mock',
            path: 'workoutExerciseParser',
        }));
        buildContext.onResolve({filter: /workoutCandidateMatcher\.js$/}, () => ({
            namespace: 'workout-logging-exercise-message-mock',
            path: 'workoutCandidateMatcher',
        }));

        buildContext.onLoad(
            {filter: /^workoutLogRepository$/, namespace: 'workout-logging-exercise-message-mock'},
            () => ({
                contents:
                    'export const workoutLogRepository = ' +
                    'globalThis.__workoutLoggingServiceMocks.workoutLogRepository;',
                loader: 'js',
            }),
        );
        buildContext.onLoad(
            {filter: /^workoutExerciseParser$/, namespace: 'workout-logging-exercise-message-mock'},
            () => ({
                contents:
                    'export const parseExerciseMessage = ' +
                    'globalThis.__workoutLoggingServiceMocks.workoutExerciseParser.parseExerciseMessage;',
                loader: 'js',
            }),
        );
        buildContext.onLoad(
            {filter: /^workoutCandidateMatcher$/, namespace: 'workout-logging-exercise-message-mock'},
            () => ({
                contents:
                    'export const matchCandidates = ' +
                    'globalThis.__workoutLoggingServiceMocks.workoutCandidateMatcher.matchCandidates;',
                loader: 'js',
            }),
        );
    },
};
