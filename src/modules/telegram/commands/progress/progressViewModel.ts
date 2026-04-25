export interface ProgressViewModel {
    label: string;
    title: string;
    metrics: ProgressMetricViewModel[];
    insightTitle: string;
    insightText: string;
}

export interface ProgressMetricViewModel {
    label: string;
    value: string;
    delta: string;
}
