import type {ExerciseItem} from '../../../coach/exercise/domain/exercise.js';
import {exerciseRepository} from '../../../coach/exercise/repository/exerciseRepository.js';
import {log} from '../../../../shared/logging';
import {exerciseImageSigning} from '../workouts/exerciseImageSigning.js';
import type {ParsedWorkoutExercise} from './workoutExerciseParser.js';

export interface WorkoutCandidate {
    exerciseId: number;
    name: string;
    reps: number;
    sets: number;
    weight: number | null;
    imageUrl: string | null;
}

export type MatchCandidatesResult =
    | {outcome: 'matched'; candidates: WorkoutCandidate[]}
    | {outcome: 'noMatch'};

export interface MatchCandidatesRequest {
    parsedExercise: ParsedWorkoutExercise;
}

const EXERCISE_SEARCH_FIRST_PAGE = 0;
const EXERCISE_CANDIDATE_LIMIT = 3;

export async function matchCandidates(request: MatchCandidatesRequest): Promise<MatchCandidatesResult> {
    const {parsedExercise} = request;
    const searchResult = await exerciseRepository.search({
        q: parsedExercise.name,
        page: EXERCISE_SEARCH_FIRST_PAGE,
        limit: EXERCISE_CANDIDATE_LIMIT,
    });

    if (!searchResult.items.length) {
        log(`No catalog candidates matched for "${parsedExercise.name}"`);
        return {outcome: 'noMatch'};
    }

    const candidates = await Promise.all(
        searchResult.items.map((item) => toCandidate(item, parsedExercise)),
    );

    log(
        `Matched ${candidates.length} catalog candidates for "${parsedExercise.name}": ` +
            JSON.stringify(candidates.map((candidate) => ({exerciseId: candidate.exerciseId, name: candidate.name}))),
    );

    return {outcome: 'matched', candidates};
}

async function toCandidate(item: ExerciseItem, parsedExercise: ParsedWorkoutExercise): Promise<WorkoutCandidate> {
    return {
        exerciseId: item.id,
        name: item.name,
        reps: parsedExercise.reps,
        sets: parsedExercise.sets,
        weight: parsedExercise.weight,
        imageUrl: await signFirstImageUrl(item.images),
    };
}

async function signFirstImageUrl(images: string[]): Promise<string | null> {
    const [key] = images;

    if (!key) {
        return null;
    }

    return exerciseImageSigning.signExerciseImageUrl(key);
}
