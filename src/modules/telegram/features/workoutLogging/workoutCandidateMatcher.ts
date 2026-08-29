import {exerciseMapper} from '../../../../infrastructure/persistence/postgres/mappers/exerciseMapper.js';
import type {RankedDictExerciseRow} from '../../../../infrastructure/persistence/postgres/models/exerciseRow.js';
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

export interface MatchCandidatesRequest {
    parsedExercise: ParsedWorkoutExercise;
}

const EXERCISE_SEARCH_FIRST_PAGE = 0;
const EXERCISE_CANDIDATE_LIMIT = 3;
const HIGH_CONFIDENCE_SCORE_THRESHOLD = 300;

export async function matchCandidates(request: MatchCandidatesRequest): Promise<WorkoutCandidate[] | null> {
    const {parsedExercise} = request;
    const searchResult = await exerciseRepository.search({
        q: parsedExercise.name,
        page: EXERCISE_SEARCH_FIRST_PAGE,
        limit: EXERCISE_CANDIDATE_LIMIT,
    });

    if (!searchResult.items.length) {
        log(`No catalog candidates matched for "${parsedExercise.name}"`);
        return null;
    }

    const items = searchResult.items[0].score >= HIGH_CONFIDENCE_SCORE_THRESHOLD ?
        searchResult.items.slice(0, 1) :
        searchResult.items;

    const candidates = await Promise.all(items.map((item) => toCandidate(item, parsedExercise)));

    log(
        `Matched ${candidates.length} catalog candidates for "${parsedExercise.name}": ` +
            JSON.stringify(candidates.map((candidate) => ({exerciseId: candidate.exerciseId, name: candidate.name}))),
    );

    return candidates;
}

async function toCandidate(
    item: RankedDictExerciseRow,
    parsedExercise: ParsedWorkoutExercise,
): Promise<WorkoutCandidate> {
    return {
        exerciseId: item.id,
        name: item.name,
        reps: parsedExercise.reps,
        sets: parsedExercise.sets,
        weight: parsedExercise.weight,
        imageUrl: await signFirstImageUrl(exerciseMapper.toStringArray(item.images)),
    };
}

async function signFirstImageUrl(images: string[]): Promise<string | null> {
    const [key] = images;

    if (!key) {
        return null;
    }

    return exerciseImageSigning.signExerciseImageUrl(key);
}
