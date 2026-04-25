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
