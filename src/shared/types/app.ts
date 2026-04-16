export type PromptVariableValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | Record<string, unknown>
    | Array<unknown>;

export type JsonObject = Record<string, unknown>;

export class AppUser {
    chat_id = 0;
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    language_code?: string | null;
    chat_type?: string | null;
    created_at?: string;
    is_active?: number;

    constructor(init?: Partial<AppUser>) {
        Object.assign(this, init);
    }
}

export class PromptConfig {
    prompt_id = '';
    version = '1';
    prompts: Record<string, string> = {};
    systemPromptRef?: string;
    vectorStoreIds: string[] = [];

    constructor(init?: Partial<PromptConfig>) {
        Object.assign(this, init);
        this.prompts = init?.prompts ?? {};
        this.vectorStoreIds = init?.vectorStoreIds ?? [];
    }
}

export class TrainingScheduleItem {
    chat_id = 0;
    day_of_week = '';
    prompt_ref?: string;
    plan?: PromptVariableValue;
    user?: AppUser;

    constructor(init?: Partial<TrainingScheduleItem>) {
        Object.assign(this, init);
        this.user = init?.user ? new AppUser(init.user) : undefined;
    }
}

export class SentMessageLog {
    chatId = 0;
    text = '';
    promptRef?: string | null;

    constructor(init?: Partial<SentMessageLog>) {
        Object.assign(this, init);
    }
}
