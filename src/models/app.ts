import {TelegramMessage, TelegramWebhookRequest} from './telegram.js';

export type PromptVariableValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | Record<string, unknown>
    | Array<unknown>;

export class AppUser {
    chat_id = 0;
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    language_code?: string | null;
    chat_type?: string | null;
    is_bot = false;
    created_at?: string;
    is_active = 1;

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

export class ProcessorContext {
    chatId: number | null = null;
    text: string | null = null;
    user = new AppUser();
    message = new TelegramMessage();

    constructor(init?: Partial<ProcessorContext>) {
        Object.assign(this, init);
        this.user = new AppUser(init?.user);
        this.message = new TelegramMessage(init?.message);
    }
}

export class QueueRequestEnvelope {
    request = new TelegramWebhookRequest();

    constructor(init?: Partial<QueueRequestEnvelope>) {
        Object.assign(this, init);
        this.request = new TelegramWebhookRequest(init?.request);
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

export class Exercise {
    name = '';
    instructions = '';
    images: string[] = [];

    constructor(init?: Partial<Exercise>) {
        Object.assign(this, init);
        this.images = init?.images ?? [];
    }
}

export class ExerciseWithSignedImages extends Exercise {
    signedImages: string[] = [];

    constructor(init?: Partial<ExerciseWithSignedImages>) {
        super(init);
        this.signedImages = init?.signedImages ?? [];
    }
}
