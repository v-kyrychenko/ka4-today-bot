import {commandRegistry} from '../commands/registry.js';
import {BadRequestError, OpenAIError} from '../../../shared/errors';
import {log} from '../../../shared/logging';
import {ProcessorContext} from '../domain/context.js';
import {TelegramWebhookRequest} from '../domain/telegram.js';
import {telegramUserRepository} from '../repository/telegramUserRepository.js';
import {errorHandler} from './errorHandler';

export const mainProcessor = {
    execute: async (inputRequest: TelegramWebhookRequest): Promise<void> => {
        const request = new TelegramWebhookRequest(inputRequest);
        const message = request.message;
        const chatId = message?.chat?.id ?? null;
        const text = message?.text ?? null;

        if (!message || chatId == null) {
            throw new BadRequestError('Telegram request message.chat.id is mandatory');
        }

        try {
            const user = await telegramUserRepository.getOrCreateUser(chatId, message);
            const context = new ProcessorContext({chatId, text, user, message});
            const command = commandRegistry.find((item) => item.canHandle(text, context));

            if (!command) {
                log('[telegram.main] No command found', {chatId, text});
                return;
            }

            const commandName = command.constructor?.name ?? 'AnonymousCommand';
            log('[telegram.main] Executing command', {chatId, commandName});
            await command.execute(context);
        } catch (error) {
            await errorHandler(chatId, error);
            throw error as BadRequestError | OpenAIError;
        }
    },
};
