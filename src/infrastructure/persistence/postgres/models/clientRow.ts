export interface ClientRow {
    id: number;
    coach_id: number;
    first_name: string;
    last_name: string;
    status: string;
    lang: string;
    birthday: string;
    created_at: string;
    last_activity: string | null;
    goals: string | null;
    notes: string | null;
}
