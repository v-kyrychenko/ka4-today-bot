import type {JsonObject} from '../../../../shared/types/app.js';

export class ExerciseItem {
    id = 0;
    name: JsonObject = {};
    key = '';
    level = '';
    category = '';
    force = '';
    mechanic = '';
    equipment?: string | null;
    primaryMuscles: string[] = [];
    secondaryMuscles: string[] = [];
    instructions: JsonObject = {};
    images: string[] = [];

    constructor(init?: Partial<ExerciseItem>) {
        Object.assign(this, init);
        this.name = init?.name ?? {};
        this.primaryMuscles = init?.primaryMuscles ?? [];
        this.secondaryMuscles = init?.secondaryMuscles ?? [];
        this.instructions = init?.instructions ?? {};
        this.images = init?.images ?? [];
    }
}

export interface ExerciseSearchRequest {
    q: string;
    page: number;
    limit: number;
}

export interface ExerciseSearchResult {
    items: ExerciseItem[];
    total: number | null;
}
