import {telegramMessagingService} from '../../application/telegramMessagingService.js';
import {promptReplyService} from '../../application/promptReplyService.js';
import type {ProcessorContext} from '../../domain/context.js';
import {logError} from '../../../../shared/logging';
import {BaseCommand} from '../BaseCommand';
import {PROGRESS_COMMAND} from '../registry';
import {
    buildProgressCaption,
    buildProgressViewModel,
    hasProgressData,
} from './buildProgressViewModel.js';
import {renderPng} from './renderPng.js';
import type {MetricViewModel} from './template/viewModel.js';

const COMMAND_PROGRESS_PROMPT_REF = 'command_progress';
const NO_MEASUREMENTS_PROMPT_REF = 'no_measurements';
const BODY_MEASUREMENT_SUMMARY_VARIABLE = 'BODY_MEASUREMENT_SUMMARY';

export class ProgressCommand extends BaseCommand {
    canHandle(text: string | null): boolean {
        return text === PROGRESS_COMMAND;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const viewModel = await buildProgressViewModel(context);

        if (!hasProgressData(viewModel)) {
            viewModel.insightText = await fetchNoMeasurementsInsight(context);
            await telegramMessagingService.sendMessage(context, viewModel.insightText);
            return;
        }

        const insightTextPromise = fetchProgressInsight(context, viewModel.metrics);
        const pngPromise = renderPng(viewModel);
        const [insightText, png] = await Promise.all([insightTextPromise, pngPromise]);

        viewModel.insightText = insightText;
        const caption = buildProgressCaption(viewModel, context.user.lang);

        await telegramMessagingService.sendWithMedia(context, {buffer: png, filename: 'progress-poc.png'}, caption);
    }
}

function fetchNoMeasurementsInsight(context: ProcessorContext): Promise<string> {
    context.message.promptRef = NO_MEASUREMENTS_PROMPT_REF;

    return promptReplyService.fetchOpenAiReply({
        context,
        promptRef: NO_MEASUREMENTS_PROMPT_REF,
    });
}

async function fetchProgressInsight(context: ProcessorContext, metrics: MetricViewModel[]): Promise<string> {
    try {
        context.message.promptRef = COMMAND_PROGRESS_PROMPT_REF;
        return await promptReplyService.fetchOpenAiReply({
            context,
            promptRef: COMMAND_PROGRESS_PROMPT_REF,
            variables: {
                [BODY_MEASUREMENT_SUMMARY_VARIABLE]: JSON.stringify(metrics),
            },
        });
    } catch (error) {
        logError('[telegram.progress] Failed to generate progress insight', error);
        return '';
    }
}
