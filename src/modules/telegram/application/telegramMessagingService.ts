import {telegramClient} from '../../../infrastructure/integrations/telegram/telegramClient.js';
import {dynamoDbService} from '../../../infrastructure/persistence/dynamodb/legacy/dynamoDbService.js';
import {telegramMessageLogRepository} from '../repository/telegramMessageLogRepository.js';
import {TelegramError} from '../../../shared/errors';
import {log, logError} from '../../../shared/logging';
import type {ProcessorContext} from '../domain/context.js';
import type {TelegramSentMessageLogInput} from '../../../infrastructure/persistence/postgres/mappers/telegramSentMessageLogMapper.js';

type TelegramContext = Pick<ProcessorContext, 'chatId' | 'message'>;

export async function sendMessage(context: TelegramContext, message: string): Promise<void> {
    const chatId = context.chatId;
    if (chatId == null) {
        throw new TelegramError('chatId is mandatory');
    }

    try {
        await telegramClient.sendMessage(chatId, message);
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (err.message.includes('Forbidden') || err.message.includes('user is deactivated')) {
            await dynamoDbService.markUserInactive(chatId);
            log(`Removed user ${chatId} (no longer reachable)`);
        } else {
            logError(`Failed to send message to ${chatId}`, err);
        }
    } finally {
        await logSentMessage({
            chatId,
            promptRef: context.message?.promptRef ?? null,
            messageText: message,
        });
    }
}

export async function sendWithMedia(
    context: Pick<ProcessorContext, 'chatId'>,
    imageUrls: string[] = [],
    caption = ''
): Promise<void> {
    const chatId = context.chatId;
    if (chatId == null) {
        throw new TelegramError('chatId is mandatory');
    }
    if (!imageUrls.length) {
        throw new TelegramError('imageUrls is mandatory');
    }

    try {
        if (imageUrls.length === 1) {
            await telegramClient.sendPhoto(chatId, imageUrls[0], caption);
        } else {
            await telegramClient.sendMediaGroup(chatId, imageUrls, caption);
        }
    } catch (error) {
        logError(`Failed to send media to ${chatId}`, error);
    }
}

export const telegramMessagingService = {
    sendMessage,
    sendWithMedia,
};

export const telegramService = telegramMessagingService;

async function logSentMessage(input: TelegramSentMessageLogInput): Promise<void> {
    try {
        await telegramMessageLogRepository.logSentMessage(input);
    } catch (error) {
        logError(`Failed to log sent Telegram message for ${input.chatId}`, error);
        throw error;
    }
}
