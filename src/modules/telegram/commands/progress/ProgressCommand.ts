import {telegramMessagingService} from '../../application/telegramMessagingService.js';
import {promptReplyService} from '../../application/promptReplyService.js';
import type {ProcessorContext} from '../../domain/context.js';
import {log, logError} from '../../../../shared/logging';
import {BaseCommand} from '../BaseCommand';
import {PROGRESS_COMMAND} from '../registry';
import {
    buildProgressCaption,
    buildProgressResult,
    hasProgressData,
    type ProgressResult,
} from './buildProgressViewModel.js';
import type {BodyMeasurementSummary} from './bodyMeasurementsModel.js';
import {bodyMeasurementSummaryRepository} from './repository/bodyMeasurementSummaryRepository.js';
import {renderPng} from './renderPng.js';
import type {MetricViewModel, ViewModel} from './template/viewModel.js';
import {createHash} from "node:crypto";

const COMMAND_PROGRESS_PROMPT_REF = 'command_progress';
const NO_MEASUREMENTS_PROMPT_REF = 'no_measurements';
const BODY_MEASUREMENT_SUMMARY_VARIABLE = 'BODY_MEASUREMENT_SUMMARY';
const PROGRESS_IMAGE_FILENAME = 'progress-poc.png';

export class ProgressCommand extends BaseCommand {
    canHandle(text: string | null): boolean {
        return text === PROGRESS_COMMAND;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const progress = await buildProgressResult(context);

        if (!hasProgressData(progress.viewModel)) {
            await handleNoDataProgress(context, progress.viewModel);
            return;
        }

        await handleDataBackedProgress(context, progress);
    }
}

async function handleNoDataProgress(context: ProcessorContext, viewModel: ViewModel): Promise<void> {
    viewModel.insightText = await fetchNoMeasurementsInsight(context);

    await telegramMessagingService.sendMessage(context, viewModel.insightText);
}

async function handleDataBackedProgress(context: ProcessorContext, progress: ProgressResult): Promise<void> {
    const dataHash = createProgressDataHash(progress.viewModel.metrics);
    const cached = await bodyMeasurementSummaryRepository.findByDataHash(dataHash);

    if (cached) {
        log('[telegram.progress.cache] Cache hit, using cached progress data', {dataHash});
        await sendCachedProgress(context, progress.viewModel, cached);
        return;
    }

    log('[telegram.progress.cache] Cache miss, generating new progress data', {dataHash});
    await generateAndCacheProgress(context, progress, dataHash);
}

async function sendCachedProgress(
    context: ProcessorContext,
    viewModel: ViewModel,
    cached: BodyMeasurementSummary
): Promise<void> {
    viewModel.insightText = cached.summaryText;

    await sendProgressMedia(context, viewModel, cached.summaryPng);
}

async function generateAndCacheProgress(
    context: ProcessorContext,
    progress: ProgressResult,
    dataHash: string
): Promise<void> {
    const {insightText, png} = await generateProgressMedia(context, progress.viewModel);
    progress.viewModel.insightText = insightText;

    await cacheGeneratedProgress(progress, dataHash, insightText, png);
    await sendProgressMedia(context, progress.viewModel, png);
}

async function generateProgressMedia(context: ProcessorContext, viewModel: ViewModel) {
    const insightTextPromise = fetchProgressInsight(context, viewModel.metrics);
    const pngPromise = renderPng(viewModel);
    const [insightText, png] = await Promise.all([insightTextPromise, pngPromise]);

    return {insightText, png};
}

async function cacheGeneratedProgress(
    progress: ProgressResult,
    dataHash: string,
    insightText: string,
    png: Buffer
): Promise<void> {
    if (progress.clientId == null || !progress.periodStart || !progress.periodEnd) {
        log('[telegram.progress.cache] Cache write skipped, missing cache metadata', {dataHash});
        return;
    }

    await bodyMeasurementSummaryRepository.create({
        clientId: progress.clientId,
        periodStart: progress.periodStart,
        periodEnd: progress.periodEnd,
        dataHash,
        summaryText: insightText,
        summaryPng: png,
    });
    log('[telegram.progress.cache] Progress data cached', {
        dataHash,
        clientId: progress.clientId,
        periodStart: progress.periodStart,
        periodEnd: progress.periodEnd,
    });
}

async function sendProgressMedia(context: ProcessorContext, viewModel: ViewModel, png: Buffer): Promise<void> {
    const caption = buildProgressCaption(viewModel, context.user.lang);

    await telegramMessagingService.sendWithMedia(context, {buffer: png, filename: PROGRESS_IMAGE_FILENAME}, caption);
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

export function createProgressDataHash(metrics: MetricViewModel[]): string {
    return createHash('sha256')
        .update(JSON.stringify(metrics))
        .digest('hex');
}
