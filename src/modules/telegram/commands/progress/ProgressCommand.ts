import {telegramMessagingService} from '../../application/telegramMessagingService.js';
import type {ProcessorContext} from '../../domain/context.js';
import {BaseCommand} from '../BaseCommand';
import {PROGRESS_COMMAND} from '../registry';
import {renderProgressPng} from './renderProgressPng.js';
import {progressSampleCaption, progressSampleViewModel} from './sampleProgressViewModel.js';

export class ProgressCommand extends BaseCommand {
    canHandle(text: string | null): boolean {
        return text === PROGRESS_COMMAND;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const png = await renderProgressPng(progressSampleViewModel);

        await telegramMessagingService.sendWithMedia(context, {
            buffer: png,
            filename: 'progress-poc.png'
        }, progressSampleCaption);
    }
}
