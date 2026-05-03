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
    const body: { chat_id: number; text: string; reply_markup?: unknown } = {
        chat_id: chatId,
        text: message,
    };

    if (replyMarkup !== undefined) {
        body.reply_markup = replyMarkup;
    }

    await httpRequest<TelegramApiResponse, typeof body>({
        method: 'POST',
        path: `/${TELEGRAM_BOT_TOKEN}/sendMessage`,
        endpointUrl: TELEGRAM_BASE_URL,
        headers: TELEGRAM_HEADERS,
        body,
        label: TELEGRAM_API_LABEL,
        errorClass: TelegramError,
    });
}

export async function sendPhoto(chatId: number, photo: string | TelegramPhotoInput, caption = ''): Promise<void> {
    if (typeof photo === 'string') {
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
        return;
    }

    const formData = new FormData();
    formData.set('chat_id', String(chatId));
    formData.set('caption', caption);
    formData.set('photo', new Blob([new Uint8Array(photo.data)]), photo.filename);

    const response = await fetch(`${TELEGRAM_BASE_URL}/${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        body: formData,
    });
    const responseBody = (await response.json()) as TelegramApiResponse;

    if (!response.ok) {
        throw new TelegramError(`Failed TELEGRAM request to /${TELEGRAM_BOT_TOKEN}/sendPhoto: ${JSON.stringify(responseBody)}`);
    }
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
