import {BaseRoute} from './BaseRoute.js';
import {START_ROUTE} from './registry.js';
import {promptReplyService} from '../features/prompts/promptReplyService.js';
import {telegramMessagingService} from '../features/messaging/telegramMessagingService.js';
import type {ProcessorContext} from '../model/context.js';

export class StartRoute extends BaseRoute {
    canHandle(text: string | null): boolean {
        return text === START_ROUTE;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const promptRef = 'welcome_greeting';
        const reply = await promptReplyService.fetchOpenAiReply({lang: context.user.lang, promptRef});
        await telegramMessagingService.sendMessage(context, reply);
    }
}
