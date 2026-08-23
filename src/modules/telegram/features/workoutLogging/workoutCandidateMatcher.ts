import {GetObjectCommand, S3Client} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import type {ExerciseItem} from '../../../coach/exercise/domain/exercise.js';
import {exerciseRepository} from '../../../coach/exercise/repository/exerciseRepository.js';
import type {ParsedWorkoutExercise} from './workoutExerciseParser.js';

export interface WorkoutCandidate {
    exerciseId: number;
    name: Record<string, unknown>;
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

const EXERCISE_IMAGES_BUCKET = 'ka4-today-exercises';
const IMAGE_URL_EXPIRES_IN_SECONDS = 3600;

const s3 = new S3Client();

export async function matchCandidates(request: MatchCandidatesRequest): Promise<MatchCandidatesResult> {
    const {parsedExercise} = request;
    const searchResult = await exerciseRepository.search({q: parsedExercise.name, page: 0, limit: 3});

    if (!searchResult.items.length) {
        return {outcome: 'noMatch'};
    }

    const candidates = await Promise.all(
        searchResult.items.map((item) => toCandidate(item, parsedExercise)),
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

    const command = new GetObjectCommand({Bucket: EXERCISE_IMAGES_BUCKET, Key: `exercises/${key}`});
    return getSignedUrl(s3, command, {expiresIn: IMAGE_URL_EXPIRES_IN_SECONDS});
}
