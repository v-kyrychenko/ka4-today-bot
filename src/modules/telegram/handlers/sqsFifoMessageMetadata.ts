import {BadRequestError} from '../../../shared/errors';
import {toIsoDate} from '../../../shared/utils/dateUtils.js';
import {TelegramWebhookRequest} from '../domain/telegram.js';

export interface SqsFifoMessageMetadata {
    MessageGroupId: string;
    MessageDeduplicationId: string;
}

export class QueueRequestEnvelope {
    request = new TelegramWebhookRequest();

    constructor(init?: Partial<QueueRequestEnvelope>) {
        Object.assign(this, init);
        this.request = new TelegramWebhookRequest(init?.request);
    }
}

export function buildWebhookFifoMessageMetadata(payload: QueueRequestEnvelope): SqsFifoMessageMetadata {
    const chatId = extractChatId(payload);
    const updateId = payload.request.update_id;

    if (!isValidId(updateId)) {
        throw new BadRequestError('Telegram request update_id is mandatory for FIFO deduplication');
    }

    return {
        MessageGroupId: String(chatId),
        MessageDeduplicationId: `telegram-update-${updateId}`,
    };
}

export function buildDailyFifoMessageMetadata(
    payload: QueueRequestEnvelope,
    date = new Date()
): SqsFifoMessageMetadata {
    const chatId = extractChatId(payload);
    const promptRef = payload.request.message?.promptRef?.trim();

    if (!promptRef) {
        throw new BadRequestError('Telegram daily request message.promptRef is mandatory for FIFO deduplication');
    }

    return {
        MessageGroupId: String(chatId),
        MessageDeduplicationId: `daily-${chatId}-${promptRef}-${toIsoDate(date)}`,
    };
}

function extractChatId(payload: QueueRequestEnvelope): number {
    const chatId = payload.request.message?.chat.id;

    if (!isValidId(chatId)) {
        throw new BadRequestError('Telegram request message.chat.id is mandatory for FIFO grouping');
    }

    return chatId;
}

function isValidId(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value !== 0;
}
