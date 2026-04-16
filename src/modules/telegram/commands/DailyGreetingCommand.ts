import {BaseCommand} from './BaseCommand.js';
import {DAILY_GREETING_COMMAND} from './registry.js';
import {BadRequestError} from '../../../shared/errors/index.js';
import {promptReplyService} from '../application/promptReplyService.js';
import {telegramMessagingService} from '../application/telegramMessagingService.js';
import type {ProcessorContext} from '../domain/context.js';

export class DailyGreetingCommand extends BaseCommand {
    canHandle(text: string | null): boolean {
        return text === DAILY_GREETING_COMMAND;
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
