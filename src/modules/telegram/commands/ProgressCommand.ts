import {Resvg} from '@resvg/resvg-js';
import {telegramMessagingService} from '../application/telegramMessagingService.js';
import type {ProcessorContext} from '../domain/context.js';
import {BaseCommand} from './BaseCommand.js';
import {PROGRESS_COMMAND} from './registry.js';

type ProgressMetric = {
    label: string;
    value: string;
    delta: string;
};

type ProgressPoint = {
    label: string;
    weight: number;
    waist: number;
};

type ProgressMeasurement = {
    icon: string;
    label: string;
    from: string;
    to: string;
};

type ProgressData = {
    periodTitle: string;
    periodRange: string;
    metrics: ProgressMetric[];
    points: ProgressPoint[];
    measurements: ProgressMeasurement[];
    insight: string;
};

const WIDTH = 900;
const HEIGHT = 1280;

export class ProgressCommand extends BaseCommand {
    canHandle(text: string | null): boolean {
        return text === PROGRESS_COMMAND;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const progress = this.buildMockProgress();
        const pngBuffer = this.renderPng(progress);

        await telegramMessagingService.sendPhoto(context, pngBuffer, {
            filename: 'progress.png',
            caption: '📊 Прогрес',
        });
    }

    private renderPng(progress: ProgressData): Buffer {
        const svg = this.buildSvg(progress);
        const resvg = new Resvg(svg, {
            fitTo: {
                mode: 'width',
                value: WIDTH,
            },
            background: '#0B0F14',
        });

        return resvg.render().asPng();
    }

    private buildSvg(progress: ProgressData): string {
        const chart = this.buildChart(progress.points, 70, 505, 760, 255);
        const metrics = progress.metrics.map((metric, index) => this.buildMetricCard(metric, 60 + index * 260, 170)).join('');
        const measurements = progress.measurements.map((item, index) => this.buildMeasurementRow(item, 72, 926 + index * 54)).join('');

        return `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#0B0F14"/>
  <rect x="28" y="28" width="844" height="1224" rx="36" fill="#111827"/>
  <rect x="28" y="28" width="844" height="1224" rx="36" stroke="#1F2937" stroke-width="2"/>

  <text x="60" y="86" fill="#F9FAFB" font-size="34" font-weight="700" font-family="Arial, Helvetica, sans-serif">ПРОГРЕС</text>
  <text x="60" y="120" fill="#9CA3AF" font-size="20" font-family="Arial, Helvetica, sans-serif">${progress.periodTitle}</text>
  <text x="60" y="147" fill="#9CA3AF" font-size="18" font-family="Arial, Helvetica, sans-serif">${progress.periodRange}</text>
  <rect x="728" y="62" width="104" height="38" rx="19" fill="#A3E635" fill-opacity="0.12"/>
  <text x="756" y="87" fill="#A3E635" font-size="18" font-weight="700" font-family="Arial, Helvetica, sans-serif">FIT</text>

  ${metrics}

  <rect x="50" y="450" width="800" height="372" rx="28" fill="#111827" stroke="#1F2937" stroke-width="2"/>
  <text x="72" y="485" fill="#F9FAFB" font-size="24" font-weight="700" font-family="Arial, Helvetica, sans-serif">Динаміка</text>
  <circle cx="642" cy="478" r="6" fill="#38BDF8"/>
  <text x="656" y="484" fill="#9CA3AF" font-size="16" font-family="Arial, Helvetica, sans-serif">Вага</text>
  <circle cx="732" cy="478" r="6" fill="#A3E635"/>
  <text x="746" y="484" fill="#9CA3AF" font-size="16" font-family="Arial, Helvetica, sans-serif">Талія</text>
  ${chart.grid}
  ${chart.labels}
  <polyline points="${chart.weightPoints}" fill="none" stroke="#38BDF8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="${chart.waistPoints}" fill="none" stroke="#A3E635" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  ${chart.weightDots}
  ${chart.waistDots}

  <rect x="50" y="860" width="800" height="260" rx="28" fill="#111827" stroke="#1F2937" stroke-width="2"/>
  <text x="72" y="900" fill="#F9FAFB" font-size="24" font-weight="700" font-family="Arial, Helvetica, sans-serif">Інші заміри</text>
  ${measurements}

  <rect x="50" y="1148" width="800" height="76" rx="24" fill="#111827" stroke="#1F2937" stroke-width="2"/>
  <text x="72" y="1186" fill="#A3E635" font-size="24" font-weight="700" font-family="Arial, Helvetica, sans-serif">Інсайт</text>
  <text x="72" y="1212" fill="#F9FAFB" font-size="19" font-family="Arial, Helvetica, sans-serif">${progress.insight}</text>
</svg>`;
    }

    private buildMetricCard(metric: ProgressMetric, x: number, y: number): string {
        return `
  <rect x="${x}" y="${y}" width="240" height="220" rx="26" fill="#1F2937"/>
  <text x="${x + 22}" y="${y + 42}" fill="#9CA3AF" font-size="20" font-family="Arial, Helvetica, sans-serif">${metric.label}</text>
  <text x="${x + 22}" y="${y + 106}" fill="#F9FAFB" font-size="42" font-weight="700" font-family="Arial, Helvetica, sans-serif">${metric.value}</text>
  <rect x="${x + 22}" y="${y + 142}" width="120" height="34" rx="17" fill="#A3E635" fill-opacity="0.14"/>
  <text x="${x + 38}" y="${y + 165}" fill="#84CC16" font-size="20" font-weight="700" font-family="Arial, Helvetica, sans-serif">${metric.delta}</text>
  <rect x="${x + 22}" y="${y + 190}" width="170" height="8" rx="4" fill="#111827"/>
  <rect x="${x + 22}" y="${y + 190}" width="108" height="8" rx="4" fill="#A3E635"/>`;
    }

    private buildMeasurementRow(item: ProgressMeasurement, x: number, y: number): string {
        return `
  <text x="${x}" y="${y}" fill="#F9FAFB" font-size="20" font-family="Arial, Helvetica, sans-serif">${item.icon}</text>
  <text x="${x + 34}" y="${y}" fill="#9CA3AF" font-size="19" font-family="Arial, Helvetica, sans-serif">${item.label}</text>
  <text x="640" y="${y}" fill="#F9FAFB" font-size="19" text-anchor="end" font-family="Arial, Helvetica, sans-serif">${item.from}</text>
  <text x="668" y="${y}" fill="#9CA3AF" font-size="19" text-anchor="middle" font-family="Arial, Helvetica, sans-serif">→</text>
  <text x="786" y="${y}" fill="#F9FAFB" font-size="19" text-anchor="end" font-family="Arial, Helvetica, sans-serif">${item.to}</text>
  <line x1="${x}" y1="${y + 20}" x2="796" y2="${y + 20}" stroke="#1F2937" stroke-width="1"/>`;
    }

    private buildChart(points: ProgressPoint[], x: number, y: number, width: number, height: number): {
        grid: string;
        labels: string;
        weightPoints: string;
        waistPoints: string;
        weightDots: string;
        waistDots: string;
    } {
        const labels = points.map((point, index) => {
            const labelX = x + Math.round((width / Math.max(points.length - 1, 1)) * index);
            return `<text x="${labelX}" y="${y + height + 34}" fill="#9CA3AF" font-size="14" text-anchor="middle" font-family="Arial, Helvetica, sans-serif">${point.label}</text>`;
        }).join('');

        const grid = Array.from({length: 4}, (_, index) => {
            const lineY = y + Math.round((height / 3) * index);
            return `<line x1="${x}" y1="${lineY}" x2="${x + width}" y2="${lineY}" stroke="#1F2937" stroke-width="1"/>`;
        }).join('');

        const values = points.flatMap((point) => [point.weight, point.waist]);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);

        const weightSeries = this.mapSeries(points, 'weight', x, y, width, height, minValue, maxValue);
        const waistSeries = this.mapSeries(points, 'waist', x, y, width, height, minValue, maxValue);

        return {
            grid,
            labels,
            weightPoints: weightSeries.points,
            waistPoints: waistSeries.points,
            weightDots: weightSeries.dots,
            waistDots: waistSeries.dots,
        };
    }

    private mapSeries(
        points: ProgressPoint[],
        key: 'weight' | 'waist',
        x: number,
        y: number,
        width: number,
        height: number,
        minValue: number,
        maxValue: number,
    ): {points: string; dots: string} {
        const plotted = points.map((point, index) => {
            const pointX = x + Math.round((width / Math.max(points.length - 1, 1)) * index);
            const value = point[key];
            const ratio = maxValue === minValue ? 0.5 : (value - minValue) / (maxValue - minValue);
            const pointY = y + height - Math.round(ratio * height);
            return {x: pointX, y: pointY};
        });

        return {
            points: plotted.map((point) => `${point.x},${point.y}`).join(' '),
            dots: plotted.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="5" fill="${key === 'weight' ? '#38BDF8' : '#A3E635'}"/>`).join(''),
        };
    }

    private buildMockProgress(): ProgressData {
        return {
            periodTitle: 'Останні 90 днів',
            periodRange: '15 січ – 15 квіт',
            metrics: [
                {label: 'Вага', value: '77.8 кг', delta: '↓ 0.7 кг'},
                {label: 'Талія', value: '86 см', delta: '↓ 3 см'},
                {label: 'Жир', value: '18.7 %', delta: '↓ 1.1 %'},
            ],
            points: [
                {label: '15 січ', weight: 78.7, waist: 89.5},
                {label: '01 лют', weight: 78.3, waist: 88.6},
                {label: '15 лют', weight: 78.4, waist: 88.2},
                {label: '01 бер', weight: 77.9, waist: 87.5},
                {label: '15 бер', weight: 77.6, waist: 86.8},
                {label: '01 квіт', weight: 77.4, waist: 86.3},
                {label: '15 квіт', weight: 76.8, waist: 85.5},
            ],
            measurements: [
                {icon: '🦺', label: 'Груди', from: '101 см', to: '102 см'},
                {icon: '💪', label: 'Руки', from: '36 см', to: '36.5 см'},
                {icon: '🦵', label: 'Стегна', from: '58 см', to: '58 см'},
                {icon: '🩳', label: 'Бедра', from: '98 см', to: '97 см'},
            ],
            insight: 'Талія зменшується стабільно. Вага майже без змін — це сигнал recomposition.',
        };
    }
}
