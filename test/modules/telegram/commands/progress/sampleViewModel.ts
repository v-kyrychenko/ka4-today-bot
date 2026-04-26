import type {ViewModel} from '../../../../../src/modules/telegram/commands/progress/template/viewModel.js';

export const sampleViewModel: ViewModel = {
    label: 'KA4 TODAY · Прогрес тіла',
    title: 'Січ 1 – Квіт 25',
    dateRange: '',
    metrics: [
        {
            label: 'Вага',
            value: '77.8 kg',
            delta: '↓ 0.7 kg',
            deltaStatus: 'GOOD',
            trend: [79.1, 78.8, 78.4, 78.2, 77.9, 77.8],
            trendDates: ['Січ 1', 'Квіт 5', 'Квіт 10', 'Квіт 15', 'Квіт 20', 'Квіт 25']
        },
        {
            label: 'Талія',
            value: '90 cm',
            delta: '↑ 1 cm',
            deltaStatus: 'BAD',
            trend: [89, 88.4, 87.9, 88.2, 89.1, 90],
            trendDates: ['Квіт 1', 'Квіт 5', 'Квіт 10', 'Квіт 15', 'Квіт 20', 'Квіт 25']
        },
        {
            label: 'Груди',
            value: '102 cm',
            delta: 'стабільно',
            deltaStatus: 'GOOD',
            trend: [101.8, 102.1, 101.9, 102, 102.2, 102],
            trendDates: ['Квіт 1', 'Квіт 5', 'Квіт 10', 'Квіт 15', 'Квіт 20', 'Квіт 25']
        },
        {
            label: 'Таз',
            value: '96 cm',
            delta: '↓ 1.5 cm',
            deltaStatus: 'GOOD',
            trend: [97.4, 97.1, 96.9, 96.6, 96.3, 96],
            trendDates: ['Квіт 1', 'Квіт 5', 'Квіт 10', 'Квіт 15', 'Квіт 20', 'Квіт 25']
        },
        {
            label: 'Стегно',
            value: '58.5 cm',
            delta: '↑ 0.5 cm',
            deltaStatus: 'GOOD',
            trend: [58, 58.1, 58.2, 58.3, 58.4, 58.5],
            trendDates: ['Квіт 1', 'Квіт 5', 'Квіт 10', 'Квіт 15', 'Квіт 20', 'Квіт 25']
        }
    ],
    insightTitle: 'Insight',
    insightText: 'Талія зменшується, поки вага залишається контрольованою. Схоже на рекомпозицію тіла, а не просто схуднення..'
};
