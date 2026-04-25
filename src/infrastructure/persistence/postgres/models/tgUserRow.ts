export interface TgUserRow {
    chat_id: number;
    client_id: number | null;
    username: string;
    phone: string | null;
    lang: string;
    is_active: boolean;
    is_bot: boolean;
}
