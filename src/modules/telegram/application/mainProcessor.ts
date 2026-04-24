import {commandRegistry} from '../commands/registry.js';
import {BadRequestError, OpenAIError} from '../../../shared/errors';
import {log} from '../../../shared/logging';
import {ProcessorContext} from '../domain/context.js';
import {TelegramWebhookRequest} from '../domain/telegram.js';
import {telegramUserRepository} from '../repository/telegramUserRepository.js';
import {telegramMessagingService} from './telegramMessagingService.js';

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

        log('[telegram.main] Incoming message', {chatId, userId, username, text,});
        const user = await telegramUserRepository.getOrCreateUser(chatId, message);

        const context = new ProcessorContext({chatId, text, user, message});
        const command = commandRegistry.find((item) => item.canHandle(text, context));

        if (!command) {
            log('[telegram.main] No command found', {chatId, text});
            return;
        }

        const commandName = command.constructor?.name ?? 'AnonymousCommand';
        log('[telegram.main] Executing command', {chatId, commandName});

        try {
            await command.execute(context);
        } catch (error) {
            await telegramMessagingService.sendMessage(context, '🧠💥🪄🐞');
            throw error as BadRequestError | OpenAIError;
        }
    },
};
