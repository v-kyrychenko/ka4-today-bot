import {BaseCommand} from './BaseCommand.js';
import {START_COMMAND} from './registry.js';
import {openAiService} from '../services/openAiService.js';
import {telegramService} from '../services/telegramService.js';
import type {ProcessorContext} from '../models/app.js';

export class StartCommand extends BaseCommand {
    canHandle(text: string | null): boolean {
        return text === START_COMMAND;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const promptRef = 'welcome_greeting';
        const reply = await openAiService.fetchOpenAiReply({context, promptRef});
        await telegramService.sendMessage(context, reply);
    }
}
