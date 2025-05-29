import {telegramService} from './telegramService.js';
import {BadRequestError, OpenAIError} from '../utils/errors.js';
import {log} from "../utils/logger.js";
import {commandRegistry} from "../commands/registry.js";

/**
 * Telegram webhook handler.
 * @param {{ chat?: { id: number }, message?: { text?: string } }} request - object received from Telegram webhook.
 * @returns {Promise<void>}
 * @throws {BadRequestError|OpenAIError}
 */
export const mainProcessor = {
    execute: async (inRequest) => {
        const text = inRequest?.message?.text ?? null;
        const chatId = inRequest?.message?.chat?.id ?? null;
        const userId = inRequest?.message?.from?.id ?? null;
        const username = inRequest?.message?.from?.username ?? null;

        log(`Incoming message from ${username || userId}: ${text}`);
        const context = {chatId, text, userId, username, message: inRequest.message};

        const command = commandRegistry.find(cmd => cmd.canHandle(text, context));

        if (!command) {
            log(`Skipped. No command found for: ${text}`);
            return;
        }

        const commandName = command.constructor?.name ?? "AnonymousCommand";
        log(`Executing: ${commandName}`);

        try {
            await command.execute(context);
        } catch (e) {
            await telegramService.sendMessage(chatId, "🧠💥🪄🐞");
            throw e;
        }
    },
}

