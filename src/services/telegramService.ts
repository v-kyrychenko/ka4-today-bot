import {TELEGRAM_BOT_TOKEN} from '../config/env.js';
import {httpRequest} from './httpClient.js';
import {TelegramError} from '../utils/errors.js';
import {dynamoDbService} from './dynamoDbService.js';
import {log, logError} from '../utils/logger.js';
import type {ProcessorContext} from '../models/app.js';

const TELEGRAM_API_LABEL = 'TELEGRAM';
const TELEGRAM_BASE_URL = 'https://api.telegram.org';
const TELEGRAM_HEADERS = {
    'Content-Type': 'application/json',
};

interface TelegramApiResponse {
    ok: boolean;
}

interface TelegramMediaItem {
    type: 'photo';
    media: string;
    caption?: string;
}

type TelegramContext = Pick<ProcessorContext, 'chatId' | 'message'>;

export async function sendMessage(context: TelegramContext, message: string): Promise<void> {
    const chatId = context.chatId;
    if (chatId == null) {
        throw new TelegramError('chatId is mandatory');
    }

    try {
        await httpRequest<TelegramApiResponse, {chat_id: number; text: string}>({
            method: 'POST',
            path: `/${TELEGRAM_BOT_TOKEN}/sendMessage`,
            endpointUrl: TELEGRAM_BASE_URL,
            headers: TELEGRAM_HEADERS,
            body: {
                chat_id: chatId,
                text: message,
            },
            label: TELEGRAM_API_LABEL,
            errorClass: TelegramError,
        });
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (err.message.includes('Forbidden') || err.message.includes('user is deactivated')) {
            await dynamoDbService.markUserInactive(chatId);
            log(`Removed user ${chatId} (no longer reachable)`);
        } else {
            logError(`Failed to send message to ${chatId}`, err);
        }
    } finally {
        await dynamoDbService.logSentMessage({
            chatId,
            promptRef: context.message?.promptRef ?? null,
            text: message,
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
            await httpRequest<TelegramApiResponse, {chat_id: number; photo: string; caption: string}>({
                method: 'POST',
                path: `/${TELEGRAM_BOT_TOKEN}/sendPhoto`,
                endpointUrl: TELEGRAM_BASE_URL,
                headers: TELEGRAM_HEADERS,
                body: {
                    chat_id: chatId,
                    photo: imageUrls[0],
                    caption,
                },
                label: TELEGRAM_API_LABEL,
                errorClass: TelegramError,
            });
        } else {
            const mediaGroup: TelegramMediaItem[] = imageUrls.map((url, index) => ({
                type: 'photo',
                media: url,
                ...(index === 0 && caption ? {caption} : {}),
            }));

            await httpRequest<TelegramApiResponse, {chat_id: number; media: TelegramMediaItem[]}>({
                method: 'POST',
                path: `/${TELEGRAM_BOT_TOKEN}/sendMediaGroup`,
                endpointUrl: TELEGRAM_BASE_URL,
                headers: TELEGRAM_HEADERS,
                body: {
                    chat_id: chatId,
                    media: mediaGroup,
                },
                label: TELEGRAM_API_LABEL,
                errorClass: TelegramError,
            });
        }
    } catch (error) {
        logError(`Failed to send media to ${chatId}`, error);
    }
}

export const telegramService = {
    sendMessage,
    sendWithMedia,
};
