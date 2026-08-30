import {exerciseMapper} from '../../../../infrastructure/persistence/postgres/mappers/exerciseMapper.js';
import type {ExerciseSearchRequest, ExerciseSearchResult} from '../domain/exercise.js';
import {exerciseRepository} from '../repository/exerciseRepository.js';

export async function searchExercises(input: ExerciseSearchRequest): Promise<ExerciseSearchResult> {
    const result = await exerciseRepository.search(input);

    return {
        items: result.items.map(exerciseMapper.toAppModel),
        total: result.total,
    };
}
