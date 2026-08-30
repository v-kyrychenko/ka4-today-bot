export interface WorkoutLogEntryRow {
    id: number;
    session_id: number;
    dict_exercise_id: number | null;
    raw_description: string;
    reps: number | null;
    sets: number | null;
    weight: string | null;
    created_at: string;
}
