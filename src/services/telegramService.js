import {TELEGRAM_BOT_TOKEN} from '../config/env.js';
import {httpRequest} from "./httpClient.js";
import {TelegramError} from "../utils/errors.js";

const TELEGRAM_API_LABEL = 'TELEGRAM';
const TELEGRAM_BASE_URL = 'https://api.telegram.org';
const TELEGRAM_HEADERS = {
    'Content-Type': 'application/json',
};

export const telegramService = {
    sendMessage: async (chatId, message) => {
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
    },
};
