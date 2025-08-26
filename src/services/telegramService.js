import {TELEGRAM_BOT_TOKEN} from '../config/env.js';
import {httpRequest} from "./httpClient.js";
import {TelegramError} from "../utils/errors.js";
import {dynamoDbService} from "./dynamoDbService.js";
import {log, logError} from "../utils/logger.js";

const TELEGRAM_API_LABEL = 'TELEGRAM';
const TELEGRAM_BASE_URL = 'https://api.telegram.org';
const TELEGRAM_HEADERS = {
    'Content-Type': 'application/json',
};

/**
 * Send a message to a Telegram chat.
 * @param {object} context - context with the Telegram chat ID.
 * @param {string} message - The message to send.
 * @returns {Promise<void>}
 */
export async function sendMessage(context, message) {
    const chatId = context.chatId
    try {
        await httpRequest({
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
    } catch (e) {
        if (e.message.includes('Forbidden') || e.message.includes('user is deactivated')) {
            await dynamoDbService.markUserInactive(chatId);
            log(`🗑️ Removed user ${chatId} (no longer reachable)`);
        } else {
            logError(`❌ Failed to send message to ${chatId}`, e);
        }
    } finally {
        await dynamoDbService.logSentMessage({
            chatId,
            promptRef: context?.message?.promptRef ?? null,
            text: message,
        });
    }
}

/**
 * Send one or multiple images to a Telegram chat.
 * @param {object} context - context with chatId
 * @param {string[]} imageUrls - array of image URLs
 * @param {string} caption - optional caption (only used for first image)
 */
export async function sendWithMedia(context, imageUrls = [], caption = '') {
    const chatId = context.chatId;
    if (!imageUrls.length) throw new TelegramError("imageUrls is mandatory");

    try {
        if (imageUrls.length === 1) {
            await httpRequest({
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
            const mediaGroup = imageUrls.map((url, i) => ({
                type: 'photo',
                media: url,
                ...(i === 0 && caption ? {caption} : {})
            }));

            await httpRequest({
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
    } catch (e) {
        logError(`❌ Failed to send media to ${chatId}`, e);
    }
}


export const telegramService = {
    sendMessage, sendWithMedia
};
