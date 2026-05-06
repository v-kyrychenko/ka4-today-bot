import {BadRequestError} from '../../../../shared/errors';
import {toIsoDate} from '../../../../shared/utils/dateUtils.js';
import {TelegramWebhookUpdate} from '../../model/telegram.js';

export interface SqsFifoMessageMetadata {
    MessageGroupId: string;
    MessageDeduplicationId: string;
}

export class QueueRequestEnvelope {
    request = new TelegramWebhookUpdate();

    constructor(init?: Partial<QueueRequestEnvelope>) {
        Object.assign(this, init);
        this.request = new TelegramWebhookUpdate(init?.request);
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

export function buildScheduledJobFifoMessageMetadata(
    payload: QueueRequestEnvelope,
    jobName: string,
    date = new Date()
): SqsFifoMessageMetadata {
    const chatId = extractChatId(payload);
    const normalizedJobName = jobName.trim();

    if (!normalizedJobName) {
        throw new BadRequestError('Scheduled job name is mandatory for FIFO deduplication');
    }

    return {
        MessageGroupId: String(chatId),
        MessageDeduplicationId: `${normalizedJobName}-${chatId}-${toIsoDate(date)}`,
    };
}

function extractChatId(payload: QueueRequestEnvelope): number {
    const message = payload.request.message ?? payload.request.callback_query?.message;
    const chatId = message?.chat.id;

    if (!isValidId(chatId)) {
        throw new BadRequestError('Telegram request message.chat.id is mandatory for FIFO grouping');
    }

    return chatId;
}

function isValidId(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value !== 0;
}
