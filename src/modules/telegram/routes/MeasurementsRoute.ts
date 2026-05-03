import {OpenAIError} from '../../../shared/errors';
import {conversationEngine} from '../features/conversations/engine.js';
import {telegramMessagingService} from '../features/messaging/telegramMessagingService.js';
import {CONVERSATION_TYPE_BODY_MEASUREMENTS} from '../features/measurements/bodyMeasurementsModel.js';
import {BaseRoute} from './BaseRoute.js';
import {MEASUREMENTS_ROUTE} from './registry.js';
import type {ProcessorContext} from '../model/context.js';

export class MeasurementsRoute extends BaseRoute {
    canHandle(text: string | null): boolean {
        return text === MEASUREMENTS_ROUTE;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const chatId = context.chatId;
        if (chatId == null) {
            throw new OpenAIError('chatId is mandatory');
        }

        const response = await conversationEngine.start(chatId, CONVERSATION_TYPE_BODY_MEASUREMENTS);
        await telegramMessagingService.sendMessage(context, response.text, response.replyMarkup);
    }
}
