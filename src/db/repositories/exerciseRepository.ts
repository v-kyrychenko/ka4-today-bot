import {sql} from 'drizzle-orm';
import type {ExerciseSearchRequest} from '../../models/app.js';
import {exerciseMapper} from '../mappers/exerciseMapper.js';
import type {DictExerciseRow} from '../models/exercise.js';
import {getPostgresDb} from '../postgres.js';

export const exerciseRepository = {
    search,
};

export async function search(input: ExerciseSearchRequest) {
    const offset = (input.page - 1) * input.limit;
    const fetchLimit = input.limit + 1;
    const query = sql<DictExerciseRow>`
        with q as (
            select lower(unaccent(trim(${input.q}))) as query
        )
        select
            d.id,
            d.name,
            d.key,
            d.level,
            d.category,
            d.force,
            d.mechanic,
            d.equipment,
            d.primary_muscles,
            d.secondary_muscles,
            d.instructions,
            d.images
        from dict_exercise d, q
        where d.search_text like '%' || q.query || '%'
           or d.search_text % q.query
        order by
            case
                when d.search_text like q.query || '%' then 300
                when d.search_text like '% ' || q.query || '%' then 200
                when d.search_text like '%' || q.query || '%' then 100
                else 0
            end + similarity(d.search_text, q.query) desc,
            d.id
        limit ${fetchLimit}
        offset ${offset}
    `;

    const result = await getPostgresDb().execute(query);
    const rows = result.rows as unknown as DictExerciseRow[];
    const total = result.rowCount;
    const items = rows.slice(0, input.limit).map(exerciseMapper.toAppModel);

    return {
        items,
        total,
    };
}
