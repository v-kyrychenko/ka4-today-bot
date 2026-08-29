import {sql} from 'drizzle-orm';
import {exerciseMapper} from '../../../../infrastructure/persistence/postgres/mappers/exerciseMapper.js';
import type {RankedDictExerciseRow} from '../../../../infrastructure/persistence/postgres/models/exerciseRow.js';
import {getPostgresDb} from '../../../../infrastructure/persistence/postgres/postgresDb.js';
import type {ExerciseSearchRequest} from '../domain/exercise.js';

export const exerciseRepository = {
    search,
};

export async function search(input: ExerciseSearchRequest) {
    const query =
        sql<RankedDictExerciseRow>`select * from search_dict_exercises(${input.q}, ${input.page}, ${input.limit})`;

    const result = await getPostgresDb().execute(query);
    const rows = result.rows as unknown as RankedDictExerciseRow[];
    const items = rows.map(exerciseMapper.toRankedRow);

    return {
        items,
        total: result.rowCount,
    };
}
