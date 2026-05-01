import {TelegramMessage} from './telegram.js';
import {TelegramUser} from './user.js';

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
