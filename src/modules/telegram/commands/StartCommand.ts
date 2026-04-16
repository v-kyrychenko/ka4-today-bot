import {BaseCommand} from './BaseCommand.js';
import {START_COMMAND} from './registry.js';
import {promptReplyService} from '../application/promptReplyService.js';
import {telegramMessagingService} from '../application/telegramMessagingService.js';
import type {ProcessorContext} from '../domain/context.js';

export class StartCommand extends BaseCommand {
    canHandle(text: string | null): boolean {
        return text === START_COMMAND;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const promptRef = 'welcome_greeting';
        const reply = await promptReplyService.fetchOpenAiReply({context, promptRef});
        await telegramMessagingService.sendMessage(context, reply);
    }
}
