import {progressStyles} from './progressStyles.js';
import type {ProgressMetricViewModel, ProgressViewModel} from './progressViewModel.js';

type SatoriStyle = Record<string, number | string>;
type SatoriChild = SatoriNode | string | SatoriChild[];

interface SatoriNode {
    type: string;
    props: {
        children?: SatoriChild;
        style?: SatoriStyle;
    } & Record<string, string | number | SatoriStyle | SatoriChild | undefined>;
}

export function createProgressTemplate(viewModel: ProgressViewModel): SatoriNode {
    return {
        type: 'div',
        props: {
            style: progressStyles.root,
            children: [
                createHeader(viewModel),
                createMetricGrid(viewModel.metrics),
            ]
        }
    };
}

function createMetricGrid(metrics: ProgressMetricViewModel[]): SatoriNode {
    const metricRows = chunkMetrics(metrics, 2);

    return {
        type: 'div',
        props: {
            style: progressStyles.cardGrid,
            children: metricRows.map((row) => ({
                type: 'div',
                props: {
                    style: progressStyles.cardRow,
                    children: row.map(createMetricCard)
                }
            }))
        }
    };
}

function createHeader(viewModel: ProgressViewModel): SatoriNode {
    return {
        type: 'div',
        props: {
            style: progressStyles.header,
            children: [
                {
                    type: 'div',
                    props: {
                        style: progressStyles.headerMain,
                        children: [
                            createText(viewModel.label, progressStyles.label),
                            createText(viewModel.title, progressStyles.title)
                        ]
                    }
                },
                createText(viewModel.dateRange, progressStyles.dateRange)
            ]
        }
    };
}

function createMetricCard(metric: ProgressMetricViewModel): SatoriNode {
    return {
        type: 'div',
        props: {
            style: progressStyles.metricCard,
            children: [
                {
                    type: 'div',
                    props: {
                        style: progressStyles.metricHeader,
                        children: [
                            createText(metric.label, progressStyles.metricLabel),
                            ...(metric.trend ? [createMetricStatRow(metric)] : [])
                        ]
                    }
                },
                {
                    type: 'div',
                    props: {
                        style: progressStyles.metricBody,
                        children: metric.trend ? createTrendChart(metric.trend) : createNoDataState(metric)
                    }
                }
            ]
        }
    };
}

function createMetricStatRow(metric: ProgressMetricViewModel): SatoriNode {
    return {
        type: 'div',
        props: {
            style: progressStyles.metricStatRow,
            children: [
                createText(metric.value, progressStyles.metricValue),
                ...(metric.delta ? [createText(metric.delta, progressStyles.metricDelta)] : [])
            ]
        }
    };
}

function createTrendChart(trend: number[]): SatoriNode {
    const points = createChartPoints(trend);

    return {
        type: 'div',
        props: {
            style: progressStyles.chartWrap,
            children: {
                type: 'svg',
                props: {
                    viewBox: '0 0 420 220',
                    style: progressStyles.chartSvg,
                    children: [
                        {
                            type: 'path',
                            props: {
                                d: points.path,
                                fill: 'none',
                                stroke: '#A3FF3F',
                                strokeWidth: '6',
                                strokeLinecap: 'round',
                                strokeLinejoin: 'round'
                            }
                        },
                        {
                            type: 'circle',
                            props: {
                                cx: String(points.lastPoint.x),
                                cy: String(points.lastPoint.y),
                                r: '8',
                                fill: '#A3FF3F'
                            }
                        }
                    ]
                }
            }
        }
    };
}

function createNoDataState(metric: ProgressMetricViewModel): SatoriNode {
    return {
        type: 'div',
        props: {
            style: progressStyles.noDataState,
            children: [
                createText(metric.emptyStateTitle ?? 'No measurements yet', progressStyles.noDataTitle),
                createText(metric.emptyStateHint ?? 'Add 2+ check-ins to see a trend.', progressStyles.noDataHint)
            ]
        }
    };
}

function createChartPoints(trend: number[]): { path: string; lastPoint: { x: number; y: number } } {
    const chartWidth = 420;
    const chartHeight = 220;
    const paddingX = 10;
    const paddingY = 18;
    const minValue = Math.min(...trend);
    const maxValue = Math.max(...trend);
    const valueRange = maxValue - minValue || 1;
    const stepX = trend.length > 1 ? (chartWidth - paddingX * 2) / (trend.length - 1) : 0;
    const points = trend.map((value, index) => {
        const normalized = (value - minValue) / valueRange;

        return {
            x: paddingX + index * stepX,
            y: chartHeight - paddingY - normalized * (chartHeight - paddingY * 2)
        };
    });
    const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    const lastPoint = points[points.length - 1];

    return {path, lastPoint};
}

function chunkMetrics(metrics: ProgressMetricViewModel[], size: number): ProgressMetricViewModel[][] {
    const rows: ProgressMetricViewModel[][] = [];

    for (let index = 0; index < metrics.length; index += size) {
        rows.push(metrics.slice(index, index + size));
    }

    return rows;
}

function createText(text: string, style: SatoriStyle): SatoriNode {
    return {
        type: 'div',
        props: {
            style,
            children: text
        }
    };
}
