import type {ProcessorContext} from '../../domain/context.js';
import {EMPTY_VIEW_VALUE} from '../../../../app/config/constants.js';
import {I18N_KEYS} from '../../../../shared/i18n/i18nKeys.js';
import {i18nService} from '../../../../shared/i18n/i18nService.js';
import {parseIsoDate, toIsoDate} from '../../../../shared/utils/dateUtils.js';
import {bodyMeasurementRepository} from './bodyMeasurementRepository.js';
import type {BodyMeasurement} from './bodyMeasurement.js';
import {
    BODY_MEASUREMENT_TYPES,
    BodyMeasurementType,
} from './bodyMeasurementType.js';
import type {MetricViewModel, ViewModel} from './template/viewModel.js';

const PROGRESS_MEASUREMENTS_LOOKBACK_DAYS = 365;

export const progressViewModelService = {
    buildProgressViewModel,
    buildProgressCaption,
    hasProgressData,
};

export async function buildProgressViewModel(context: ProcessorContext): Promise<ViewModel> {
    const lang = i18nService.normalizeLang(context.user.lang);
    const measurements = await loadMeasurements(context);
    const insightPromise = buildInsight(lang, measurements);
    const metrics = buildMetrics(lang, measurements);
    const period = buildPeriod(measurements);
    const insight = await insightPromise;

    return {
        label: i18nService.tr(lang, I18N_KEYS.telegram.progress.header.label),
        title: buildTitle(lang, period),
        dateRange: buildDateRange(lang, period),
        metrics,
        insightTitle: insight.title,
        insightText: insight.text,
    };
}

export function buildProgressCaption(viewModel: ViewModel, lang: string): string {
    const title = i18nService.tr(lang, I18N_KEYS.telegram.progress.caption.title);

    return `${title}\n${viewModel.insightText}`;
}

export function hasProgressData(viewModel: ViewModel): boolean {
    return viewModel.metrics.some((metric) => Boolean(metric.trend?.length));
}

async function loadMeasurements(context: ProcessorContext): Promise<BodyMeasurement[]> {
    const clientId = context.user.clientId;

    if (clientId == null) {
        return [];
    }

    return bodyMeasurementRepository.findForClientSince(clientId, getPastYearStart());
}

function buildMetrics(lang: string, measurements: BodyMeasurement[]): MetricViewModel[] {
    return BODY_MEASUREMENT_TYPES.map((type) => {
        return buildMetric(lang, type, findByType(measurements, type));
    });
}

function buildMetric(lang: string, type: BodyMeasurementType, measurements: BodyMeasurement[]): MetricViewModel {
    if (!measurements.length) {
        return buildEmptyMetric(lang, type);
    }

    const latest = measurements[measurements.length - 1];

    return {
        label: buildMetricLabel(lang, type),
        value: formatMeasurement(latest),
        delta: buildDelta(lang, measurements),
        trend: measurements.map((item) => item.amount),
        trendDates: measurements.map((item) => formatDate(lang, item.createdAt)),
    };
}

function buildEmptyMetric(lang: string, type: BodyMeasurementType): MetricViewModel {
    return {
        label: buildMetricLabel(lang, type),
        value: EMPTY_VIEW_VALUE,
        delta: '',
        emptyStateTitle: i18nService.tr(lang, I18N_KEYS.telegram.progress.empty.title),
        emptyStateHint: i18nService.tr(lang, I18N_KEYS.telegram.progress.empty.hint),
    };
}

function buildMetricLabel(lang: string, type: BodyMeasurementType): string {
    return i18nService.tr(lang, getMetricKey(type));
}

function getMetricKey(type: BodyMeasurementType): string {
    const keys = I18N_KEYS.telegram.progress.metric;

    return {
        [BodyMeasurementType.WEIGHT]: keys.weight,
        [BodyMeasurementType.WAIST]: keys.waist,
        [BodyMeasurementType.CHEST]: keys.chest,
        [BodyMeasurementType.THIGH]: keys.thigh,
        [BodyMeasurementType.CALF]: keys.calf,
        [BodyMeasurementType.BICEPS]: keys.biceps,
    }[type];
}

function buildDelta(lang: string, measurements: BodyMeasurement[]): string {
    if (measurements.length < 2) {
        return '';
    }

    const first = measurements[0];
    const latest = measurements[measurements.length - 1];
    const diff = roundAmount(latest.amount - first.amount);

    return formatDelta(lang, diff, latest.unitKey);
}

function formatDelta(lang: string, diff: number, unitKey: string): string {
    if (diff === 0) {
        return i18nService.tr(lang, I18N_KEYS.telegram.progress.delta.noChange);
    }

    const key = diff > 0 ? I18N_KEYS.telegram.progress.delta.up : I18N_KEYS.telegram.progress.delta.down;
    return i18nService.tr(lang, key, {amount: `${formatAmount(Math.abs(diff))} ${unitKey}`});
}

function formatMeasurement(measurement: BodyMeasurement): string {
    return `${formatAmount(measurement.amount)} ${measurement.unitKey}`;
}

function formatAmount(amount: number): string {
    const rounded = roundAmount(amount);

    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function roundAmount(amount: number): number {
    return Math.round(amount * 10) / 10;
}

function findByType(measurements: BodyMeasurement[], type: BodyMeasurementType): BodyMeasurement[] {
    return measurements.filter((item) => item.type === type);
}

function buildPeriod(measurements: BodyMeasurement[]): { start?: string; end?: string } {
    if (!measurements.length) {
        return {};
    }

    const dates = measurements.map((item) => item.createdAt).sort();

    return {
        start: dates[0],
        end: dates[dates.length - 1],
    };
}

function buildTitle(lang: string, period: { start?: string; end?: string }): string {
    if (!period.start || !period.end) {
        return i18nService.tr(lang, I18N_KEYS.telegram.progress.header.emptyTitle);
    }

    return i18nService.tr(lang, I18N_KEYS.telegram.progress.header.title, {
        days: countDays(period.start, period.end),
    });
}

function buildDateRange(lang: string, period: { start?: string; end?: string }): string {
    if (!period.start || !period.end) {
        return i18nService.tr(lang, I18N_KEYS.telegram.progress.dateRange.empty);
    }

    return `${formatDate(lang, period.start)} - ${formatDate(lang, period.end)}`;
}

function countDays(start: string, end: string): number {
    const diffMs = parseIsoDate(end).getTime() - parseIsoDate(start).getTime();

    return Math.max(1, Math.round(diffMs / 86400000) + 1);
}

function formatDate(lang: string, isoDate: string): string {
    const date = parseIsoDate(isoDate);
    const month = i18nService.tr(lang, I18N_KEYS.date.monthShort[date.getUTCMonth()]);

    return `${month} ${date.getUTCDate()}`;
}

async function buildInsight(lang: string, measurements: BodyMeasurement[]) {
    if (!measurements.length) {
        return buildNoDataInsight(lang);
    }

    await collectInsightData(measurements);

    return {
        title: i18nService.tr(lang, I18N_KEYS.telegram.progress.insight.title),
        text: i18nService.tr(lang, I18N_KEYS.telegram.progress.insight.text),
    };
}

async function buildNoDataInsight(lang: string) {
    await collectInsightData([]);

    return {
        title: i18nService.tr(lang, I18N_KEYS.telegram.progress.insight.title),
        text: i18nService.tr(lang, I18N_KEYS.telegram.progress.insight.noDataText),
    };
}

async function collectInsightData(measurements: BodyMeasurement[]): Promise<BodyMeasurement[]> {
    return Promise.resolve(measurements);
}

function getPastYearStart(): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - PROGRESS_MEASUREMENTS_LOOKBACK_DAYS);

    return toIsoDate(date);
}
