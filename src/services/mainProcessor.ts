import {BadRequestError, OpenAIError} from '../utils/errors.js';
import {telegramService} from './telegramService.js';
import {commandRegistry} from '../commands/registry.js';
import {dynamoDbService} from './dynamoDbService.js';
import {log} from '../utils/logger.js';
import {ProcessorContext} from '../models/app.js';
import {TelegramWebhookRequest} from '../models/telegram.js';

export const mainProcessor = {
    execute: async (inputRequest: TelegramWebhookRequest): Promise<void> => {
        const request = new TelegramWebhookRequest(inputRequest);
        const message = request.message;
        const chatId = message?.chat?.id ?? null;
        const text = message?.text ?? null;
        const userId = message?.from?.id ?? null;
        const username = message?.from?.username ?? null;

        if (!message || chatId == null) {
            throw new BadRequestError('Telegram request message.chat.id is mandatory');
        }

        log(`Incoming message from ${username || userId}: ${text}`);
        const user = await dynamoDbService.getOrCreateUser(chatId, message);

        const context = new ProcessorContext({chatId, text, user, message});
        const command = commandRegistry.find((item) => item.canHandle(text, context));

        if (!command) {
            log(`Skipped. No command found for: ${text}`);
            return;
        }

        const commandName = command.constructor?.name ?? 'AnonymousCommand';
        log(`Executing: ${commandName}`);

        try {
            await command.execute(context);
        } catch (error) {
            await telegramService.sendMessage(context, '🧠💥🪄🐞');
            throw error as BadRequestError | OpenAIError;
        }
    },
};
