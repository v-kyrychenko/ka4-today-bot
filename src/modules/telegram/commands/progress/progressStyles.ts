export const PROGRESS_IMAGE_WIDTH = 1400;
export const PROGRESS_IMAGE_HEIGHT = 1600;
export const PROGRESS_FONT_FAMILY = 'Inter';
export const PROGRESS_FONT_FILE_NAME = 'Inter-Regular.ttf';

type SatoriStyle = Record<string, number | string>;

export const progressTheme = {
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

export const progressStyles = {
    root: {
        width: `${PROGRESS_IMAGE_WIDTH}px`,
        height: `${PROGRESS_IMAGE_HEIGHT}px`,
        display: 'flex',
        flexDirection: 'column',
        padding: '80px',
        background: progressTheme.colors.background,
        color: progressTheme.colors.foreground,
        fontFamily: PROGRESS_FONT_FAMILY,
        gap: '42px'
    } satisfies SatoriStyle,
    label: {
        color: progressTheme.colors.accent,
        fontSize: 30,
        letterSpacing: 4
    } satisfies SatoriStyle,
    title: {
        fontSize: 72,
        fontWeight: 700,
        lineHeight: 1.05
    } satisfies SatoriStyle,
    cardGrid: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '28px'
    } satisfies SatoriStyle,
    metricCard: {
        width: '430px',
        height: '210px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '32px',
        borderRadius: '34px',
        background: progressTheme.colors.cardBackground,
        border: `2px solid ${progressTheme.colors.cardBorder}`
    } satisfies SatoriStyle,
    metricLabel: {
        color: progressTheme.colors.muted,
        fontSize: 30
    } satisfies SatoriStyle,
    metricValue: {
        fontSize: 58,
        fontWeight: 700
    } satisfies SatoriStyle,
    metricDelta: {
        color: progressTheme.colors.accent,
        fontSize: 32
    } satisfies SatoriStyle,
    insightCard: {
        display: 'flex',
        flexDirection: 'column',
        padding: '36px',
        borderRadius: '34px',
        background: progressTheme.colors.insightBackground,
        border: `2px solid ${progressTheme.colors.accent}`,
        gap: '18px'
    } satisfies SatoriStyle,
    insightTitle: {
        color: progressTheme.colors.accent,
        fontSize: 34,
        fontWeight: 700
    } satisfies SatoriStyle,
    insightText: {
        color: progressTheme.colors.foreground,
        fontSize: 38,
        lineHeight: 1.35
    } satisfies SatoriStyle
};
