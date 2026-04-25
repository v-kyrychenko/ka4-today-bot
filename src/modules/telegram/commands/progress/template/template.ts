import {styles} from './styles.js';
import type {MetricViewModel, ViewModel} from './viewModel.js';

type SatoriStyle = Record<string, number | string>;
type SatoriChild = SatoriNode | string | SatoriChild[];

interface SatoriNode {
    type: string;
    props: {
        children?: SatoriChild;
        style?: SatoriStyle;
    } & Record<string, string | number | SatoriStyle | SatoriChild | undefined>;
}

export function createTemplate(viewModel: ViewModel): SatoriNode {
    return {
        type: 'div',
        props: {
            style: styles.root,
            children: [
                createHeader(viewModel),
                createMetricGrid(viewModel.metrics),
            ]
        }
    };
}

function createMetricGrid(metrics: MetricViewModel[]): SatoriNode {
    const metricRows = chunkMetrics(metrics, 2);

    return {
        type: 'div',
        props: {
            style: styles.cardGrid,
            children: metricRows.map((row) => ({
                type: 'div',
                props: {
                    style: styles.cardRow,
                    children: row.map(createMetricCard)
                }
            }))
        }
    };
}

function createHeader(viewModel: ViewModel): SatoriNode {
    return {
        type: 'div',
        props: {
            style: styles.header,
            children: [
                {
                    type: 'div',
                    props: {
                        style: styles.headerMain,
                        children: [
                            createText(viewModel.label, styles.label),
                            createText(viewModel.title, styles.title)
                        ]
                    }
                },
                createText(viewModel.dateRange, styles.dateRange)
            ]
        }
    };
}

function createMetricCard(metric: MetricViewModel): SatoriNode {
    return {
        type: 'div',
        props: {
            style: styles.metricCard,
            children: [
                {
                    type: 'div',
                    props: {
                        style: styles.metricHeader,
                        children: [
                            createText(metric.label, styles.metricLabel),
                            ...(metric.trend ? [createMetricStatRow(metric)] : [])
                        ]
                    }
                },
                {
                    type: 'div',
                    props: {
                        style: styles.metricBody,
                        children: metric.trend ? createTrendChart(metric) : createNoDataState(metric)
                    }
                }
            ]
        }
    };
}

function createMetricStatRow(metric: MetricViewModel): SatoriNode {
    return {
        type: 'div',
        props: {
            style: styles.metricStatRow,
            children: [
                createText(metric.value, styles.metricValue),
                ...(metric.delta ? [createText(metric.delta, styles.metricDelta)] : [])
            ]
        }
    };
}

function createTrendChart(metric: MetricViewModel): SatoriNode {
    const trend = metric.trend ?? [];
    const points = createChartPoints(trend);
    const xAxisTicks = createXAxisTicks(metric.trendDates);
    const yAxisTicks = createYAxisTicks(trend);

    return {
        type: 'div',
        props: {
            style: styles.chartWrap,
            children: [
                {
                    type: 'div',
                    props: {
                        style: styles.chartCanvas,
                        children: [
                            {
                                type: 'div',
                                props: {
                                    style: styles.chartYAxis,
                                    children: yAxisTicks.map((tick) => createText(tick, styles.chartXAxisTitle))
                                }
                            },
                            {
                                type: 'div',
                                props: {
                                    style: styles.chartPlot,
                                    children: {
                                        type: 'svg',
                                        props: {
                                            viewBox: '0 0 420 220',
                                            style: styles.chartSvg,
                                            children: [
                                                ...createGridLines(),
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
                            }
                        ]
                    }
                },
                {
                    type: 'div',
                    props: {
                        style: styles.chartXAxis,
                        children: {
                            type: 'div',
                            props: {
                                style: styles.chartXAxisTicks,
                                children: xAxisTicks.map((tick) => createText(tick, styles.chartXAxisTitle))
                            }
                        }
                    }
                }
            ]
        }
    };
}

function createNoDataState(metric: MetricViewModel): SatoriNode {
    return {
        type: 'div',
        props: {
            style: styles.noDataState,
            children: [
                createText(metric.emptyStateTitle ?? 'No measurements yet', styles.noDataTitle),
                createText(metric.emptyStateHint ?? 'Add 2+ check-ins to see a trend.', styles.noDataHint)
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

function createGridLines(): SatoriNode[] {
    const horizontalLines = [26, 110, 194].map((y) => ({
        type: 'line',
        props: {
            x1: '10',
            y1: String(y),
            x2: '410',
            y2: String(y),
            stroke: '#24301F',
            strokeWidth: '2'
        }
    }));
    const verticalLines = [10, 210, 410].map((x) => ({
        type: 'line',
        props: {
            x1: String(x),
            y1: '18',
            x2: String(x),
            y2: '202',
            stroke: '#1B2530',
            strokeWidth: '2'
        }
    }));

    return [...horizontalLines, ...verticalLines];
}

function createXAxisTicks(trendDates?: string[]): string[] {
    if (!trendDates?.length) {
        return ['Apr 1', 'Apr 10', 'Apr 20', 'Apr 25'];
    }

    if (trendDates.length <= 4) {
        return trendDates;
    }

    const tickIndexes = new Set([
        0,
        Math.floor((trendDates.length - 1) / 3),
        Math.floor(((trendDates.length - 1) * 2) / 3),
        trendDates.length - 1
    ]);

    return [...tickIndexes].sort((left, right) => left - right).map((index) => trendDates[index]);
}

function createYAxisTicks(trend: number[]): string[] {
    const minValue = Math.min(...trend);
    const maxValue = Math.max(...trend);
    const middleValue = (minValue + maxValue) / 2;

    return [
        formatAxisNumber(maxValue),
        formatAxisNumber(middleValue),
        formatAxisNumber(minValue)
    ];
}

function formatAxisNumber(value: number): string {
    const rounded = Math.round(value * 10) / 10;

    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function chunkMetrics(metrics: MetricViewModel[], size: number): MetricViewModel[][] {
    const rows: MetricViewModel[][] = [];

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
