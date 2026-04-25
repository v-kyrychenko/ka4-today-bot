import {telegramMessagingService} from '../../application/telegramMessagingService.js';
import type {ProcessorContext} from '../../domain/context.js';
import {BaseCommand} from '../BaseCommand';
import {PROGRESS_COMMAND} from '../registry';

export class ProgressCommand extends BaseCommand {
    canHandle(text: string | null): boolean {
        return text === PROGRESS_COMMAND;
    }

    async execute(context: ProcessorContext): Promise<void> {
        await telegramMessagingService.sendMessage(context, "🚧 👷 🛠️ ⏳");
    }
}
