import {ExerciseItem} from '../../../../modules/coach/exercise/domain/exercise.js';
import type {DictExerciseRow, RankedDictExerciseRow} from '../models/exerciseRow.js';

export const exerciseMapper = {
    toAppModel,
    toRankedRow,
    toStringArray,
};

export function toAppModel(row: DictExerciseRow): ExerciseItem {
    return new ExerciseItem({
        id: Number(row.id),
        name: row.name,
        key: row.key,
        level: row.level,
        category: row.category,
        force: row.force,
        mechanic: row.mechanic,
        equipment: row.equipment,
        primaryMuscles: toStringArray(row.primary_muscles),
        secondaryMuscles: toStringArray(row.secondary_muscles),
        instructions: toStringArray(row.instructions),
        images: toStringArray(row.images),
    });
}

export function toRankedRow(row: RankedDictExerciseRow): RankedDictExerciseRow {
    return {
        ...row,
        id: Number(row.id),
        score: Number(row.score),
        coreInName: Number(row.coreInName),
        nameInQuery: Number(row.nameInQuery),
    };
}

export function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
}
