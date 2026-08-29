export class ExerciseItem {
    id = 0;
    name = '';
    key = '';
    level = '';
    category = '';
    force = '';
    mechanic = '';
    equipment?: string | null;
    primaryMuscles: string[] = [];
    secondaryMuscles: string[] = [];
    instructions: string[] = [];
    images: string[] = [];

    constructor(init?: Partial<ExerciseItem>) {
        Object.assign(this, init);
        this.primaryMuscles = init?.primaryMuscles ?? [];
        this.secondaryMuscles = init?.secondaryMuscles ?? [];
        this.instructions = init?.instructions ?? [];
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
