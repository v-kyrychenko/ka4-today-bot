import {
    TG_ERROR_POSTGRES_UNAVAILABLE,
    TG_ERROR_DEFAULT,
} from '../../../app/config/constants.js';
import {isPostgresUnavailableError} from '../../../infrastructure/persistence/postgres/postgresErrors.js';
import {BadRequestError, OpenAIError} from '../../../shared/errors';
import {log} from '../../../shared/logging';
import {telegramMessagingService} from '../features/messaging/telegramMessagingService.js';
import {tgUserRepository} from '../repository/tgUserRepository.js';
import {ProcessorContext, TelegramWebhookRequest} from './context.js';
import {routeRegistry} from './registry.js';

export const routesProcessor = {
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
                log('[telegram.routes] No route found', {chatId, text});
                return;
            }

            const routeName = route.constructor?.name ?? 'AnonymousRoute';
            log('[telegram.routes] Executing route', {chatId, routeName});
            await route.execute(context);
        } catch (error) {
            await sendRouteError(chatId, error);
            throw error as BadRequestError | OpenAIError;
        }
    },
};

async function sendRouteError(chatId: number, error: unknown): Promise<void> {
    const message = isPostgresUnavailableError(error)
        ? TG_ERROR_POSTGRES_UNAVAILABLE
        : TG_ERROR_DEFAULT;

    await telegramMessagingService.sendErrorMessage(chatId, message);
}
