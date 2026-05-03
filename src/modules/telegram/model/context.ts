import {TelegramMessage, TelegramUserAccount} from './telegram.js';

export class ProcessorContext {
    chatId: number | null = null;
    text: string | null = null;
    user = new TelegramUserAccount();
    message = new TelegramMessage();

    constructor(init?: Partial<ProcessorContext>) {
        Object.assign(this, init);
        this.user = new TelegramUserAccount(init?.user);
        this.message = new TelegramMessage(init?.message);
    }
}
