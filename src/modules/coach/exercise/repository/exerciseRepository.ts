import {sql} from 'drizzle-orm';
import {exerciseMapper} from '../../../../infrastructure/persistence/postgres/mappers/exerciseMapper.js';
import type {DictExerciseRow} from '../../../../infrastructure/persistence/postgres/models/exerciseRow.js';
import {getPostgresDb} from '../../../../infrastructure/persistence/postgres/postgresDb.js';
import type {ExerciseSearchRequest} from '../domain/exercise.js';

export const exerciseRepository = {
    search,
};

export async function search(input: ExerciseSearchRequest) {
    const query = sql<DictExerciseRow>`select * from search_dict_exercises(${input.q}, ${0}, ${3})`;

    const result = await getPostgresDb().execute(query);
    const rows = result.rows as unknown as DictExerciseRow[];
    const items = rows.map(exerciseMapper.toAppModel);

    return {
        items,
        total: result.rowCount,
    };
}
