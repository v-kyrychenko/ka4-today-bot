import {BaseRoute} from './BaseRoute.js';
import {DEFAULT_ROUTE} from './registry.js';
import {promptReplyService} from '../features/prompts/promptReplyService.js';
import {telegramMessagingService} from '../features/messaging/telegramMessagingService.js';
import type {ProcessorContext} from './context.js';

export class DefaultRoute extends BaseRoute {
    canHandle(text: string | null): boolean {
        return text === DEFAULT_ROUTE;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const promptRef = '42_default';
        context.message.promptRef = promptRef;
        // TODO remove promptRef from input params of fetchOpenAiReply., and put it to ProcessorContext

        const reply = await promptReplyService.fetchOpenAiReply({context, promptRef});
        await telegramMessagingService.sendMessage(context, reply);
    }
}
