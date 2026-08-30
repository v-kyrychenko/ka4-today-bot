export class WorkoutLogSession {
    id = 0;
    clientId = 0;
    sessionDay = '';
    startedAt = '';
    endedAt: string | null = null;
    endReason: string | null = null;

    constructor(init?: Partial<WorkoutLogSession>) {
        Object.assign(this, init);
        this.endedAt = init?.endedAt ?? null;
        this.endReason = init?.endReason ?? null;
    }
}

export class WorkoutLogEntry {
    id = 0;
    sessionId = 0;
    dictExerciseId: number | null = null;
    rawDescription = '';
    reps: number | null = null;
    sets: number | null = null;
    weight: number | null = null;

    constructor(init?: Partial<WorkoutLogEntry>) {
        Object.assign(this, init);
        this.dictExerciseId = init?.dictExerciseId ?? null;
        this.reps = init?.reps ?? null;
        this.sets = init?.sets ?? null;
        this.weight = init?.weight ?? null;
    }
}
