export type PromptVariableValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | Record<string, unknown>
    | Array<unknown>;

export type JsonObject = Record<string, unknown>;

export class ScheduleUser {
    chat_id = 0;
    username?: string | null;
    language_code?: string | null;
    is_active?: number;

    constructor(init?: Partial<ScheduleUser>) {
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
    user?: ScheduleUser;

    constructor(init?: Partial<TrainingScheduleItem>) {
        Object.assign(this, init);
        this.user = init?.user ? new ScheduleUser(init.user) : undefined;
    }
}
