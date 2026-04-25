import {TELEGRAM_BOT_TOKEN} from '../../../app/config/env.js';
import {TelegramError} from '../../../shared/errors';
import {httpRequest} from '../../../shared/http/httpClient.js';

const TELEGRAM_API_LABEL = 'TELEGRAM';
const TELEGRAM_BASE_URL = 'https://api.telegram.org';
const TELEGRAM_HEADERS = {
    'Content-Type': 'application/json',
};

export const telegramClient = {
    sendMessage,
    sendPhoto,
    sendMediaGroup,
};

interface TelegramApiResponse {
    ok: boolean;
}

interface TelegramMediaItem {
    type: 'photo';
    media: string;
    caption?: string;
}

export async function sendMessage(chatId: number, message: string): Promise<void> {
    await httpRequest<TelegramApiResponse, { chat_id: number; text: string }>({
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
}

export async function sendPhoto(chatId: number, photo: string, caption = ''): Promise<void> {
    await httpRequest<TelegramApiResponse, { chat_id: number; photo: string; caption: string }>({
        method: 'POST',
        path: `/${TELEGRAM_BOT_TOKEN}/sendPhoto`,
        endpointUrl: TELEGRAM_BASE_URL,
        headers: TELEGRAM_HEADERS,
        body: {
            chat_id: chatId,
            photo,
            caption,
        },
        label: TELEGRAM_API_LABEL,
        errorClass: TelegramError,
    });
}

export async function sendMediaGroup(chatId: number, imageUrls: string[], caption = ''): Promise<void> {
    const media: TelegramMediaItem[] = imageUrls.map((url, index) => ({
        type: 'photo',
        media: url,
        ...(index === 0 && caption ? {caption} : {}),
    }));

    await httpRequest<TelegramApiResponse, { chat_id: number; media: TelegramMediaItem[] }>({
        method: 'POST',
        path: `/${TELEGRAM_BOT_TOKEN}/sendMediaGroup`,
        endpointUrl: TELEGRAM_BASE_URL,
        headers: TELEGRAM_HEADERS,
        body: {
            chat_id: chatId,
            media,
        },
        label: TELEGRAM_API_LABEL,
        errorClass: TelegramError,
    });
}
