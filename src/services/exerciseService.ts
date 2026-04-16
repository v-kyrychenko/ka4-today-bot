import type {ExerciseSearchRequest} from '../models/app.js';
import {exerciseRepository} from '../db/repositories/exerciseRepository.js';

export const exerciseService = {
    searchExercises,
};

export async function searchExercises(input: ExerciseSearchRequest) {
    return exerciseRepository.search(input);
}
