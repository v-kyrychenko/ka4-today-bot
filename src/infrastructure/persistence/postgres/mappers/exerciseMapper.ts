import {ExerciseItem, type JsonObject} from '../../../../modules/coach/exercise/domain/exercise.js';
import type {DictExerciseRow} from '../models/exerciseRow.js';

export const exerciseMapper = {
    toAppModel,
};

export function toAppModel(row: DictExerciseRow): ExerciseItem {
    return new ExerciseItem({
        id: row.id,
        name: toJsonObject(row.name),
        key: row.key,
        level: row.level,
        category: row.category,
        force: row.force,
        mechanic: row.mechanic,
        equipment: row.equipment,
        primaryMuscles: toStringArray(row.primary_muscles),
        secondaryMuscles: toStringArray(row.secondary_muscles),
        instructions: toJsonObject(row.instructions),
        images: toStringArray(row.images),
    });
}

function toJsonObject(value: unknown): JsonObject {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return value as JsonObject;
}

function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
}
