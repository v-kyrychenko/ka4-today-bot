export interface ClientRow {
    id: number;
    coach_id: number;
    first_name: string;
    last_name: string;
    status: string;
    gender: string;
    lang: string;
    birthday: string;
    height: string | null;
    created_at: string;
    last_activity: string | null;
    goals: string | null;
    notes: string | null;
}
