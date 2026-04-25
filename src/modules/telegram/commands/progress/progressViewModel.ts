export interface ProgressViewModel {
    label: string;
    title: string;
    dateRange: string;
    metrics: ProgressMetricViewModel[];
    insightTitle: string;
    insightText: string;
}

export interface ProgressMetricViewModel {
    label: string;
    value: string;
    delta: string;
    trend?: number[];
    emptyStateTitle?: string;
    emptyStateHint?: string;
}
