import {TELEGRAM_BOT_TOKEN} from '../../../app/config/env.js';
import {TelegramError} from '../../../shared/errors';
import {httpRequest} from '../../../shared/http/httpClient.js';

const TELEGRAM_API_LABEL = 'TELEGRAM';
const TELEGRAM_BASE_URL = 'https://api.telegram.org';
const TELEGRAM_HEADERS = {
    'Content-Type': 'application/json',
};
const REDACTED_TELEGRAM_TOKEN = '****';

export const telegramClient = {
    sendMessage,
    sendPhoto,
    sendMediaGroup,
};

interface TelegramPhotoInput {
    data: Buffer;
    filename: string;
}

interface TelegramApiResponse {
    ok: boolean;
}

interface TelegramMediaItem {
    type: 'photo';
    media: string;
    caption?: string;
}

export async function sendMessage(chatId: number, message: string, replyMarkup?: unknown): Promise<void> {
    const telegramRequest = buildTelegramRequest('sendMessage');
    const body: { chat_id: number; text: string; reply_markup?: unknown } = {
        chat_id: chatId,
        text: message,
    };

    if (replyMarkup !== undefined) {
        body.reply_markup = replyMarkup;
    }

    await httpRequest<TelegramApiResponse, typeof body>({
        method: 'POST',
        path: telegramRequest.path,
        endpointUrl: TELEGRAM_BASE_URL,
        logUrl: telegramRequest.logUrl,
        headers: TELEGRAM_HEADERS,
        body,
        label: TELEGRAM_API_LABEL,
        errorClass: TelegramError,
    });
}

export async function sendPhoto(chatId: number, photo: string | TelegramPhotoInput, caption = ''): Promise<void> {
    const telegramRequest = buildTelegramRequest('sendPhoto');

    if (typeof photo === 'string') {
        await httpRequest<TelegramApiResponse, { chat_id: number; photo: string; caption: string }>({
            method: 'POST',
            path: telegramRequest.path,
            endpointUrl: TELEGRAM_BASE_URL,
            logUrl: telegramRequest.logUrl,
            headers: TELEGRAM_HEADERS,
            body: {
                chat_id: chatId,
                photo,
                caption,
            },
            label: TELEGRAM_API_LABEL,
            errorClass: TelegramError,
        });
        return;
    }

    const formData = new FormData();
    formData.set('chat_id', String(chatId));
    formData.set('caption', caption);
    formData.set('photo', new Blob([new Uint8Array(photo.data)]), photo.filename);

    await httpRequest<TelegramApiResponse, FormData>({
        method: 'POST',
        path: telegramRequest.path,
        endpointUrl: TELEGRAM_BASE_URL,
        logUrl: telegramRequest.logUrl,
        body: formData,
        label: TELEGRAM_API_LABEL,
        errorClass: TelegramError,
    });
}

export async function sendMediaGroup(chatId: number, imageUrls: string[], caption = ''): Promise<void> {
    const telegramRequest = buildTelegramRequest('sendMediaGroup');
    const media: TelegramMediaItem[] = imageUrls.map((url, index) => ({
        type: 'photo',
        media: url,
        ...(index === 0 && caption ? {caption} : {}),
    }));

    await httpRequest<TelegramApiResponse, { chat_id: number; media: TelegramMediaItem[] }>({
        method: 'POST',
        path: telegramRequest.path,
        endpointUrl: TELEGRAM_BASE_URL,
        logUrl: telegramRequest.logUrl,
        headers: TELEGRAM_HEADERS,
        body: {
            chat_id: chatId,
            media,
        },
        label: TELEGRAM_API_LABEL,
        errorClass: TelegramError,
    });
}

function buildTelegramRequest(methodName: string): {path: string; logUrl: string} {
    return {
        path: `/${TELEGRAM_BOT_TOKEN}/${methodName}`,
        logUrl: `${TELEGRAM_BASE_URL}/${REDACTED_TELEGRAM_TOKEN}/${methodName}`,
    };
}
