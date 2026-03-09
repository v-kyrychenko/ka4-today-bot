import {BaseCommand} from './BaseCommand.js';
import {telegramService} from '../services/telegramService.js';
import {openAiService} from '../services/openAiService.js';
import {DEFAULT_COMMAND} from './registry.js';
import type {ProcessorContext} from '../models/app.js';

export class DefaultCommand extends BaseCommand {
    canHandle(text: string | null): boolean {
        return text === DEFAULT_COMMAND;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const promptRef = '42_default';
        const reply = await openAiService.fetchOpenAiReply({context, promptRef});
        await telegramService.sendMessage(context, reply);
    }
}
