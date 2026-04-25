export interface ViewModel {
    label: string;
    title: string;
    dateRange: string;
    metrics: MetricViewModel[];
    insightTitle: string;
    insightText: string;
}

export interface MetricViewModel {
    label: string;
    value: string;
    delta: string;
    trend?: number[];
    trendDates?: string[];
    emptyStateTitle?: string;
    emptyStateHint?: string;
}
