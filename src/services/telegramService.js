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
 * @param {string|number} chatId - The Telegram chat ID.
 * @param {string} message - The message to send.
 * @returns {Promise<void>}
 */
export async function sendMessage(chatId, message) {
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
    }
}

export const telegramService = {
    sendMessage,
};
