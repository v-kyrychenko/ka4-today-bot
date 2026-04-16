import type {ExerciseSearchRequest} from '../domain/exercise.js';
import {exerciseRepository} from '../repository/exerciseRepository.js';

export const exerciseService = {
    searchExercises,
};

export async function searchExercises(input: ExerciseSearchRequest) {
    return exerciseRepository.search(input);
}
