export class TelegramChat {
    id = 0;
    type?: string;

    constructor(init?: Partial<TelegramChat>) {
        Object.assign(this, init);
    }
}

export class TelegramUserProfile {
    id = 0;
    is_bot = false;
    username?: string;
    first_name?: string;
    last_name?: string;
    language_code?: string;

    constructor(init?: Partial<TelegramUserProfile>) {
        Object.assign(this, init);
    }
}

export class TelegramMessage {
    message_id?: number;
    text?: string;
    promptRef?: string;
    chat = new TelegramChat();
    from?: TelegramUserProfile;

    constructor(init?: Partial<TelegramMessage>) {
        Object.assign(this, init);
        this.chat = new TelegramChat(init?.chat);
        this.from = init?.from ? new TelegramUserProfile(init.from) : undefined;
    }
}

export class TelegramWebhookRequest {
    update_id?: number;
    message?: TelegramMessage;

    constructor(init?: Partial<TelegramWebhookRequest>) {
        Object.assign(this, init);
        this.message = init?.message ? new TelegramMessage(init.message) : undefined;
    }
}

export class TelegramUser {
    chatId = 0;
    clientId?: number | null;
    username = '';
    phone?: string | null;
    lang = '';
    isActive = true;
    isBot = false;

    constructor(init?: Partial<TelegramUser>) {
        Object.assign(this, init);
    }
}

export class ProcessorContext {
    chatId: number | null = null;
    text: string | null = null;
    user = new TelegramUser();
    message = new TelegramMessage();

    constructor(init?: Partial<ProcessorContext>) {
        Object.assign(this, init);
        this.user = new TelegramUser(init?.user);
        this.message = new TelegramMessage(init?.message);
    }
}
