import {APP_TIMEZONE_OFFSET_MINUTES} from '../../../app/config/constants.js';
import {I18N_KEYS} from '../../../shared/i18n/i18nKeys.js';
import {i18nService} from '../../../shared/i18n/i18nService.js';
import {conversationEngine} from '../features/conversations/engine.js';
import {telegramMessagingService} from '../features/messaging/telegramMessagingService.js';
import {CONVERSATION_TYPE_WORKOUT_LOGGING} from '../features/workoutLogging/workoutLoggingConversation.js';
import {workoutLoggingService} from '../features/workoutLogging/workoutLoggingService.js';
import type {ProcessorContext} from '../model/context.js';
import {BaseRoute} from './BaseRoute.js';
import {WORKOUT_LOGGING_START_ROUTE} from './constants.js';

export class WorkoutLoggingRoute extends BaseRoute {
    conversationType = CONVERSATION_TYPE_WORKOUT_LOGGING;

    canHandle(text: string | null): boolean {
        return text === WORKOUT_LOGGING_START_ROUTE;
    }

    shouldSendProcessingNotice(): boolean {
        return false;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const clientId = context.user.clientId ?? null;
        const startResult = await workoutLoggingService.startSession({
            clientId,
            now: new Date(),
            timezoneOffsetMinutes: APP_TIMEZONE_OFFSET_MINUTES,
        });

        if (startResult.outcome === 'not-a-client') {
            await telegramMessagingService.sendMessage(
                context,
                i18nService.tr(context.user.lang, I18N_KEYS.telegram.conversations.workoutLogging.notAClient),
            );
            return;
        }

        if (startResult.outcome === 'already-open') {
            await telegramMessagingService.sendMessage(
                context,
                i18nService.tr(context.user.lang, I18N_KEYS.telegram.conversations.workoutLogging.alreadyOpen),
            );
            return;
        }

        const response = await conversationEngine.start({
            type: CONVERSATION_TYPE_WORKOUT_LOGGING,
            user: context.user,
            data: {sessionId: startResult.sessionId, clientId},
        });
        await telegramMessagingService.sendMessage(context, response.text, response.replyMarkup);
    }
}
