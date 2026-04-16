import {BaseCommand} from './BaseCommand.js';
import {DEFAULT_COMMAND} from './registry.js';
import {promptReplyService} from '../application/promptReplyService.js';
import {telegramMessagingService} from '../application/telegramMessagingService.js';
import type {ProcessorContext} from '../domain/context.js';

export class DefaultCommand extends BaseCommand {
    canHandle(text: string | null): boolean {
        return text === DEFAULT_COMMAND;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const promptRef = '42_default';
        const reply = await promptReplyService.fetchOpenAiReply({context, promptRef});
        await telegramMessagingService.sendMessage(context, reply);
    }
}
