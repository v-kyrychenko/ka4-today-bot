export interface WorkoutLogSessionRow {
    id: number;
    client_id: number;
    session_day: string;
    started_at: string;
    ended_at: string | null;
    end_reason: string | null;
}
