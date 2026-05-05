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
        const response = await conversationEngine.start({
            type: CONVERSATION_TYPE_BODY_MEASUREMENTS,
            user: context.user,
        });
        await telegramMessagingService.sendMessage(context, response.text, response.replyMarkup);
    }
}
