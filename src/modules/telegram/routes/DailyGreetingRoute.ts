import {BaseRoute} from './BaseRoute.js';
import {DAILY_GREETING_ROUTE} from './registry.js';
import {BadRequestError} from '../../../shared/errors';
import {promptReplyService} from '../features/prompts/promptReplyService.js';
import {telegramMessagingService} from '../features/messaging/telegramMessagingService.js';
import type {ProcessorContext} from '../model/context.js';

export class DailyGreetingRoute extends BaseRoute {
    canHandle(text: string | null): boolean {
        return text === DAILY_GREETING_ROUTE;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const promptRef = context.message.promptRef;

        if (!promptRef) {
            throw new BadRequestError('promptRef missing in context.message');
        }

        const reply = await promptReplyService.fetchOpenAiReply({context, promptRef});
        await telegramMessagingService.sendMessage(context, reply);
    }
}
