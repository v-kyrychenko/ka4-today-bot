import {routeRegistry} from '../routes/registry.js';
import {BadRequestError, OpenAIError} from '../../../shared/errors';
import {log} from '../../../shared/logging';
import {ProcessorContext} from '../domain/context.js';
import {TelegramWebhookRequest} from '../domain/telegram.js';
import {tgUserRepository} from '../repository/tgUserRepository.js';
import {errorHandler} from './errorHandler.js';

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
            const user = await tgUserRepository.getOrCreateUser(chatId, message);
            const context = new ProcessorContext({chatId, text, user, message});
            const route = routeRegistry.find((item) => item.canHandle(text, context));

            if (!route) {
                log('[telegram.main] No route found', {chatId, text});
                return;
            }

            const routeName = route.constructor?.name ?? 'AnonymousRoute';
            log('[telegram.main] Executing route', {chatId, routeName});
            await route.execute(context);
        } catch (error) {
            await errorHandler(chatId, error);
            throw error as BadRequestError | OpenAIError;
        }
    },
};
