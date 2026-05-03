import type {ProcessorContext} from '../../model/context.js';
import {I18N_KEYS} from '../../../../shared/i18n/i18nKeys.js';
import {i18nService} from '../../../../shared/i18n/i18nService.js';
import {parseIsoDate, toIsoDate} from '../../../../shared/utils/dateUtils.js';
import {bodyMeasurementRepository} from '../measurements/repository/bodyMeasurementRepository.js';
import {
    BODY_MEASUREMENT_TREND_CONFIG,
    BODY_MEASUREMENT_TYPES,
    type BodyMeasurement,
    BodyMeasurementType,
    TrendDirection,
} from '../measurements/bodyMeasurementsModel.js';
import type {MetricViewModel, ViewModel} from './template/viewModel.js';

const PROGRESS_MEASUREMENTS_LOOKBACK_DAYS = 365;

export const progressViewModelService = {
    buildProgressResult,
    buildProgressViewModel,
    buildProgressCaption,
    hasProgressData,
};

export interface ProgressResult {
    viewModel: ViewModel;
    clientId: number | null;
    periodStart: string | null;
    periodEnd: string | null;
}

export async function buildProgressViewModel(context: ProcessorContext): Promise<ViewModel> {
    const result = await buildProgressResult(context);

    return result.viewModel;
}

export async function buildProgressResult(context: ProcessorContext): Promise<ProgressResult> {
    const lang = i18nService.normalizeLang(context.user.lang);
    const measurements = await loadMeasurements(context);
    const metrics = buildMetrics(lang, measurements);
    const period = buildPeriod(measurements);

    return {
        viewModel: {
            label: i18nService.tr(lang, I18N_KEYS.telegram.progress.header.label),
            title: buildTitle(lang, period),
            dateRange: '',
            metrics,
            insightTitle: i18nService.tr(lang, I18N_KEYS.telegram.progress.insight.title),
            insightText: '',
        },
        clientId: context.user.clientId ?? null,
        periodStart: period.start ?? null,
        periodEnd: period.end ?? null,
    };
}

export function buildProgressCaption(viewModel: ViewModel, lang: string): string {
    const title = i18nService.tr(lang, I18N_KEYS.telegram.progress.caption.title);

    return viewModel.insightText ? `${title}\n${viewModel.insightText}` : title;
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
    return BODY_MEASUREMENT_TYPES.flatMap((type) => {
        return buildMetric(lang, type, findByType(measurements, type));
    });
}

function buildMetric(lang: string, type: BodyMeasurementType, measurements: BodyMeasurement[]): MetricViewModel[] {
    if (!measurements.length) {
        return [];
    }

    const latest = measurements[measurements.length - 1];

    return [{
        label: buildMetricLabel(lang, type),
        value: formatMeasurement(latest),
        delta: buildDelta(lang, measurements),
        deltaStatus: buildDeltaStatus(type, measurements),
        trend: measurements.map((item) => item.amount),
        trendDates: measurements.map((item) => formatDate(lang, item.createdAt)),
    }];
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
        [BodyMeasurementType.HIPS]: keys.hips,
        [BodyMeasurementType.THIGH]: keys.thigh,
        [BodyMeasurementType.CALF]: keys.calf,
        [BodyMeasurementType.BICEPS]: keys.biceps,
    }[type];
}

function buildDelta(lang: string, measurements: BodyMeasurement[]): string {
    const pair = getLatestMeasurementPair(measurements);

    if (!pair) {
        return '';
    }

    const diff = roundAmount(pair.latest.amount - pair.previous.amount);

    return formatDelta(lang, diff, pair.latest.unitKey);
}

function buildDeltaStatus(type: BodyMeasurementType, measurements: BodyMeasurement[]) {
    const pair = getLatestMeasurementPair(measurements);

    if (!pair) {
        return undefined;
    }

    const direction = getActualTrendDirection(pair);
    return getDeltaStatus(type, direction);
}

function getLatestMeasurementPair(measurements: BodyMeasurement[]) {
    if (measurements.length < 2) {
        return null;
    }

    return {
        previous: measurements[measurements.length - 2],
        latest: measurements[measurements.length - 1],
    };
}

function getActualTrendDirection(pair: { previous: BodyMeasurement; latest: BodyMeasurement }): TrendDirection {
    const diff = roundAmount(pair.latest.amount - pair.previous.amount);

    return getTrendDirection(diff);
}

function getTrendDirection(diff: number): TrendDirection {
    if (diff === 0) {
        return TrendDirection.NEUTRAL;
    }

    return diff > 0 ? TrendDirection.UP : TrendDirection.DOWN;
}

function getDeltaStatus(type: BodyMeasurementType, actual: TrendDirection) {
    if (actual === TrendDirection.NEUTRAL) {
        return 'GOOD';
    }

    return actual === BODY_MEASUREMENT_TREND_CONFIG[type] ? 'GOOD' : 'BAD';
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
        return i18nService.tr(lang, I18N_KEYS.telegram.progress.dateRange.empty);
    }

    return formatDatePeriod(lang, period.start, period.end);
}

function formatDatePeriod(lang: string, start: string, end: string): string {
    if (getYear(start) === getYear(end)) {
        return `${formatDate(lang, start)} – ${formatDate(lang, end)}`;
    }

    return `${formatDateWithYear(lang, start)} — ${formatDate(lang, end)}`;
}

function formatDateWithYear(lang: string, isoDate: string): string {
    return `${formatDate(lang, isoDate)} ’${String(getYear(isoDate)).slice(-2)}`;
}

function formatDate(lang: string, isoDate: string): string {
    const date = parseIsoDate(isoDate);
    const month = i18nService.tr(lang, I18N_KEYS.date.monthShort[date.getUTCMonth()]);

    return `${month} ${date.getUTCDate()}`;
}

function getYear(isoDate: string): number {
    return parseIsoDate(isoDate).getUTCFullYear();
}

function getPastYearStart(): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - PROGRESS_MEASUREMENTS_LOOKBACK_DAYS);

    return toIsoDate(date);
}
