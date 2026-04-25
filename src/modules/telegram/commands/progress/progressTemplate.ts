import {progressStyles} from './progressStyles.js';
import type {ProgressMetricViewModel, ProgressViewModel} from './progressViewModel.js';

type SatoriStyle = Record<string, number | string>;
type SatoriChild = SatoriNode | string | SatoriChild[];

interface SatoriNode {
    type: string;
    props: {
        children?: SatoriChild;
        style?: SatoriStyle;
    };
}

export function createProgressTemplate(viewModel: ProgressViewModel): SatoriNode {
    return {
        type: 'div',
        props: {
            style: progressStyles.root,
            children: [
                createText(viewModel.label, progressStyles.label),
                createText(viewModel.title, progressStyles.title),
                createMetricGrid(viewModel.metrics),
            ]
        }
    };
}

function createMetricGrid(metrics: ProgressMetricViewModel[]): SatoriNode {
    return {
        type: 'div',
        props: {
            style: progressStyles.cardGrid,
            children: metrics.map(createMetricCard)
        }
    };
}

function createMetricCard(metric: ProgressMetricViewModel): SatoriNode {
    return {
        type: 'div',
        props: {
            style: progressStyles.metricCard,
            children: [
                createText(metric.label, progressStyles.metricLabel),
                createText(metric.value, progressStyles.metricValue),
                createText(metric.delta, progressStyles.metricDelta)
            ]
        }
    };
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
