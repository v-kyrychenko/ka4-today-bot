export const IMAGE_WIDTH = 1400;
export const IMAGE_HEIGHT = 1600;
export const FONT_FAMILY = 'Inter';
export const FONT_FILE_NAME = 'Inter-Regular.ttf';

type SatoriStyle = Record<string, number | string>;

export const theme = {
    colors: {
        background: '#0B0F14',
        foreground: '#E6EDF3',
        accent: '#A3FF3F',
        muted: '#8B98A5',
        cardBackground: '#121821',
        cardBorder: '#24301F',
        insightBackground: '#10161D'
    }
};

export const styles = {
    root: {
        width: `${IMAGE_WIDTH}px`,
        height: `${IMAGE_HEIGHT}px`,
        display: 'flex',
        flexDirection: 'column',
        padding: '72px',
        background: theme.colors.background,
        color: theme.colors.foreground,
        fontFamily: FONT_FAMILY,
        gap: '32px'
    } satisfies SatoriStyle,
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '32px'
    } satisfies SatoriStyle,
    headerMain: {
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        flex: 1
    } satisfies SatoriStyle,
    label: {
        color: theme.colors.accent,
        fontSize: 34,
        letterSpacing: 4
    } satisfies SatoriStyle,
    title: {
        fontSize: 86,
        fontWeight: 700,
        lineHeight: 1.05
    } satisfies SatoriStyle,
    dateRange: {
        width: '300px',
        color: theme.colors.muted,
        fontSize: 32,
        lineHeight: 1.2,
        textAlign: 'right'
    } satisfies SatoriStyle,
    cardGrid: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        width: '100%',
        gap: '28px'
    } satisfies SatoriStyle,
    cardRow: {
        display: 'flex',
        flex: 1,
        gap: '28px'
    } satisfies SatoriStyle,
    metricCard: {
        display: 'flex',
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'flex-start',
        minHeight: 0,
        padding: '42px',
        borderRadius: '38px',
        background: theme.colors.cardBackground,
        border: `2px solid ${theme.colors.cardBorder}`,
        gap: '24px'
    } satisfies SatoriStyle,
    metricHeader: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '14px'
    } satisfies SatoriStyle,
    metricLabel: {
        color: theme.colors.muted,
        fontSize: 36
    } satisfies SatoriStyle,
    metricStatRow: {
        display: 'flex',
        alignItems: 'baseline',
        flexWrap: 'nowrap',
        gap: '18px',
        minWidth: 0
    } satisfies SatoriStyle,
    metricValue: {
        fontSize: 76,
        fontWeight: 700,
        lineHeight: 1
    } satisfies SatoriStyle,
    metricDelta: {
        color: theme.colors.accent,
        fontSize: 36,
        lineHeight: 1
    } satisfies SatoriStyle,
    metricBody: {
        display: 'flex',
        flex: 1,
        width: '100%',
        minHeight: 0
    } satisfies SatoriStyle,
    chartWrap: {
        display: 'flex',
        flex: 1,
        flexDirection: 'column',
        width: '100%',
        minHeight: 0,
        alignItems: 'stretch',
        gap: '8px'
    } satisfies SatoriStyle,
    chartCanvas: {
        display: 'flex',
        flex: 1,
        width: '100%',
        minHeight: 0,
        gap: '12px'
    } satisfies SatoriStyle,
    chartYAxis: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        width: '44px',
        color: theme.colors.muted,
        fontSize: 20,
        lineHeight: 1
    } satisfies SatoriStyle,
    chartPlot: {
        display: 'flex',
        flex: 1,
        minHeight: 0
    } satisfies SatoriStyle,
    chartSvg: {
        width: '100%',
        height: '100%'
    } satisfies SatoriStyle,
    chartXAxis: {
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '12px',
        color: theme.colors.muted,
        fontSize: 18,
        lineHeight: 1.1
    } satisfies SatoriStyle,
    chartXAxisTitle: {
        color: theme.colors.muted,
        fontSize: 18,
        lineHeight: 1
    } satisfies SatoriStyle,
    chartXAxisTicks: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flex: 1,
        gap: '10px'
    } satisfies SatoriStyle,
    noDataState: {
        display: 'flex',
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: '14px',
        paddingRight: '36px'
    } satisfies SatoriStyle,
    noDataTitle: {
        color: theme.colors.foreground,
        fontSize: 46,
        fontWeight: 600,
        lineHeight: 1.1
    } satisfies SatoriStyle,
    noDataHint: {
        color: theme.colors.muted,
        fontSize: 28,
        lineHeight: 1.35,
        maxWidth: '360px'
    } satisfies SatoriStyle,
    insightCard: {
        display: 'flex',
        flexDirection: 'column',
        padding: '36px',
        borderRadius: '34px',
        background: theme.colors.insightBackground,
        border: `2px solid ${theme.colors.accent}`,
        gap: '18px'
    } satisfies SatoriStyle,
    insightTitle: {
        color: theme.colors.accent,
        fontSize: 34,
        fontWeight: 700
    } satisfies SatoriStyle,
    insightText: {
        color: theme.colors.foreground,
        fontSize: 38,
        lineHeight: 1.35
    } satisfies SatoriStyle
};
