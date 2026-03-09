import {BaseCommand} from './BaseCommand.js';
import {DAILY_GREETING_COMMAND} from './registry.js';
import {openAiService} from '../services/openAiService.js';
import {telegramService} from '../services/telegramService.js';
import {BadRequestError} from '../utils/errors.js';
import type {ProcessorContext} from '../models/app.js';

export class DailyGreetingCommand extends BaseCommand {
    canHandle(text: string | null): boolean {
        return text === DAILY_GREETING_COMMAND;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const promptRef = context.message.promptRef;

        if (!promptRef) {
            throw new BadRequestError('promptRef missing in context.message');
        }

        const reply = await openAiService.fetchOpenAiReply({context, promptRef});
        await telegramService.sendMessage(context, reply);
    }
}
