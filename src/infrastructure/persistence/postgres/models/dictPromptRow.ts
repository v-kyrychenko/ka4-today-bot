export interface DictPromptRow {
    id: number;
    key: string;
    sys_prompt_id: number | null;
    prompt: unknown;
    vector_store_ids: string;
    model: string | null;
    temperature: string | null;
    text_format: unknown;
}
