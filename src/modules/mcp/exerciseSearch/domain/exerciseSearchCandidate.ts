export interface ExerciseSearchCandidate {
    exerciseId: number;
    id: string;
    name: string;
    score: number;
    imageKey: string | null;
}

export interface ExerciseSearchCandidatesResult {
    items: ExerciseSearchCandidate[];
}
