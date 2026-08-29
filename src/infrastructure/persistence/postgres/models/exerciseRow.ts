export interface DictExerciseRow {
    id: number;
    name: string;
    key: string;
    level: string;
    category: string;
    force: string;
    mechanic: string;
    equipment: string | null;
    primary_muscles: unknown;
    secondary_muscles: unknown;
    instructions: unknown;
    images: unknown;
}

export interface RankedDictExerciseRow extends DictExerciseRow {
    score: number;
    coreInName: number;
    nameInQuery: number;
}
