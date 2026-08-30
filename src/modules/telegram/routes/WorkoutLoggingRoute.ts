import {conversationEngine} from '../features/conversations/engine.js';
import {telegramMessagingService} from '../features/messaging/telegramMessagingService.js';
import {CONVERSATION_TYPE_WORKOUT_LOGGING} from '../features/workoutLogging/workoutLoggingConversation.js';
import type {ProcessorContext} from '../model/context.js';
import {BaseRoute} from './BaseRoute.js';
import {WORKOUT_LOGGING_START_ROUTE} from './constants.js';

export class WorkoutLoggingRoute extends BaseRoute {
    canHandle(text: string | null): boolean {
        return text === WORKOUT_LOGGING_START_ROUTE;
    }

    shouldSendProcessingNotice(): boolean {
        return false;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const response = await conversationEngine.start({
            type: CONVERSATION_TYPE_WORKOUT_LOGGING,
            user: context.user
        });
        await telegramMessagingService.sendMessage(context, response.text, response.replyMarkup);
    }
}
