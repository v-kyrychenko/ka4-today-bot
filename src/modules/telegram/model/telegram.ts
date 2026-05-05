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

    //FIXME should be reviewd and removed
    promptRef?: string;
    chat = new TelegramChat();
    from?: TelegramUserProfile;

    constructor(init?: Partial<TelegramMessage>) {
        Object.assign(this, init);
        this.chat = new TelegramChat(init?.chat);
        this.from = init?.from ? new TelegramUserProfile(init.from) : undefined;
    }
}

export class TelegramCallbackQuery {
    id = '';
    data?: string;
    from?: TelegramUserProfile;
    message?: TelegramMessage;

    constructor(init?: Partial<TelegramCallbackQuery>) {
        Object.assign(this, init);
        this.from = init?.from ? new TelegramUserProfile(init.from) : undefined;
        this.message = init?.message ? new TelegramMessage(init.message) : undefined;
    }
}

export class TelegramWebhookUpdate {
    update_id?: number;
    message?: TelegramMessage;
    callback_query?: TelegramCallbackQuery;

    constructor(init?: Partial<TelegramWebhookUpdate>) {
        Object.assign(this, init);
        this.message = init?.message ? new TelegramMessage(init.message) : undefined;
        this.callback_query = init?.callback_query ? new TelegramCallbackQuery(init.callback_query) : undefined;
    }
}

export class TelegramUserAccount {
    chatId = 0;
    clientId?: number | null;
    username = '';
    phone?: string | null;
    lang = '';
    isActive = true;
    isBot = false;

    constructor(init?: Partial<TelegramUserAccount>) {
        Object.assign(this, init);
    }
}
