import {TG_ERROR_POSTGRES_UNAVAILABLE, TG_ERROR_DEFAULT} from '../../../app/config/constants.js';
import {isPostgresUnavailableError} from '../../../infrastructure/persistence/postgres/postgresErrors.js';
import type { OpenAIError} from '../../../shared/errors';
import {BadRequestError} from '../../../shared/errors';
import {I18N_KEYS} from '../../../shared/i18n/i18nKeys.js';
import {i18nService} from '../../../shared/i18n/i18nService.js';
import {log} from '../../../shared/logging';
import {conversationEngine} from '../features/conversations/engine.js';
import type {ConversationResponse} from '../features/conversations/model.js';
import {telegramMessagingService} from '../features/messaging/telegramMessagingService.js';
import {tgUserRepository} from '../repository/tgUserRepository.js';
import {ProcessorContext} from '../model/context.js';
import type {TelegramMessage} from '../model/telegram.js';
import { TelegramWebhookUpdate} from '../model/telegram.js';
import type {BaseRoute} from './BaseRoute.js';
import {CANCEL_COMMANDS, routeRegistry} from './registry.js';

export const routesProcessor = {
    execute: async (inputRequest: TelegramWebhookUpdate): Promise<void> => {
        const request = parseRequest(inputRequest);

        try {
            const context = await buildContext(request);

            if (await handleCallback(request, context)) return;
            if (await handleCancelCommand(request, context)) return;

            const matchedRoute = findRoute(context);
            if (matchedRoute) {
                await conversationEngine.preemptActiveConversation(request.chatId);
            }

            if (await continueConversation(request, context)) return;

            await executeRoute(context, matchedRoute);
        } catch (error) {
            await sendRouteError(request.chatId, error);
            throw error as BadRequestError | OpenAIError;
        }
    },
};

interface ParsedTelegramRequest {
    chatId: number;
    text: string | null;
    message: TelegramMessage;
    callbackData?: string;
    callbackQueryId?: string;
    callbackMessageId?: number;
}

function parseRequest(inputRequest: TelegramWebhookUpdate): ParsedTelegramRequest {
    const request = new TelegramWebhookUpdate(inputRequest);
    const callback = request.callback_query;
    const message = request.message ?? callback?.message;
    const chatId = message?.chat?.id ?? null;

    if (!message || chatId == null) {
        throw new BadRequestError('Telegram request message.chat.id is mandatory');
    }

    return {
        chatId,
        message,
        text: request.message?.text ?? null,
        callbackData: callback?.data,
        callbackQueryId: callback?.id,
        callbackMessageId: callback?.message?.message_id,
    };
}

async function buildContext(request: ParsedTelegramRequest): Promise<ProcessorContext> {
    const user = await tgUserRepository.getOrCreateUser(request.chatId, request.message);

    return new ProcessorContext({
        chatId: request.chatId,
        text: request.text,
        user,
        message: request.message,
    });
}

function findRoute(context: ProcessorContext): BaseRoute | null {
    if (context.text == null) {
        return null;
    }

    return routeRegistry.find((route) => route.canHandle(context.text, context)) ?? null;
}

async function handleCallback(request: ParsedTelegramRequest, context: ProcessorContext): Promise<boolean> {
    if (!request.callbackData) {
        return false;
    }

    if (request.callbackQueryId) {
        await telegramMessagingService.answerCallbackQuery(request.callbackQueryId);
    }

    const response = await conversationEngine.handleCallback({
        callbackData: request.callbackData,
        messageId: request.callbackMessageId ?? 0,
        user: context.user,
    });
    await sendConversationResponse(context, response);
    if (response?.removeReplyMarkup && request.callbackMessageId) {
        await telegramMessagingService.removeReplyMarkup(context, request.callbackMessageId);
    }
    return true;
}

async function handleCancelCommand(request: ParsedTelegramRequest, context: ProcessorContext): Promise<boolean> {
    if (!context.text || !CANCEL_COMMANDS.has(context.text)) {
        return false;
    }

    const response = await conversationEngine.cancel(request.chatId);
    await sendConversationResponse(context, response);
    return true;
}

async function continueConversation(request: ParsedTelegramRequest, context: ProcessorContext): Promise<boolean> {
    if (!context.text) {
        return false;
    }

    const response = await conversationEngine.handleText({
        text: context.text,
        user: context.user,
    });
    if (!response) {
        return false;
    }

    await sendConversationResponse(context, response);
    return true;
}

async function executeRoute(context: ProcessorContext, route: BaseRoute | null): Promise<void> {
    if (!route) {
        log('[telegram.routes] No route found', {chatId: context.chatId, text: context.text});
        await telegramMessagingService.sendMessage(
            context,
            i18nService.tr(context.user.lang, I18N_KEYS.telegram.routes.unknownCommand),
        );
        return;
    }

    const routeName = route.constructor?.name ?? 'AnonymousRoute';
    log('[telegram.routes] Executing route', {chatId: context.chatId, routeName});
    if (route.shouldSendProcessingNotice()) {
        await telegramMessagingService.sendMessage(
            context,
            i18nService.tr(context.user.lang, I18N_KEYS.telegram.routes.processing),
        );
    }
    await route.execute(context);
}

async function sendConversationResponse(
    context: ProcessorContext,
    response: ConversationResponse | null,
): Promise<void> {
    if (!response) {
        return;
    }

    if (response.media?.length) {
        await telegramMessagingService.sendWithMedia(context, response.media);
    }

    await telegramMessagingService.sendMessage(context, response.text, response.replyMarkup);
}

async function sendRouteError(chatId: number, error: unknown): Promise<void> {
    const message = isPostgresUnavailableError(error) ? TG_ERROR_POSTGRES_UNAVAILABLE : TG_ERROR_DEFAULT;

    await telegramMessagingService.sendErrorMessage(chatId, message);
}
