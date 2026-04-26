import {telegramMessagingService} from '../../application/telegramMessagingService.js';
import type {ProcessorContext} from '../../domain/context.js';
import {BaseCommand} from '../BaseCommand';
import {PROGRESS_COMMAND} from '../registry';
import {
    buildProgressCaption,
    buildProgressViewModel,
    hasProgressData,
} from './buildProgressViewModel.js';
import {renderPng} from './renderPng.js';

export class ProgressCommand extends BaseCommand {
    canHandle(text: string | null): boolean {
        return text === PROGRESS_COMMAND;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const viewModel = await buildProgressViewModel(context);

        if (!hasProgressData(viewModel)) {
            await telegramMessagingService.sendMessage(context, viewModel.insightText);
            return;
        }

        const png = await renderPng(viewModel);
        const caption = buildProgressCaption(viewModel, context.user.lang);

        await telegramMessagingService.sendWithMedia(context, {
            buffer: png,
            filename: 'progress-poc.png'
        }, caption);
    }
}
