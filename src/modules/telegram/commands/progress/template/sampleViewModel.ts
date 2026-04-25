import type {ViewModel} from './viewModel.js';

export const sampleViewModel: ViewModel = {
    label: 'KA4 TODAY · PROGRESS',
    title: 'Body progress check',
    dateRange: 'Apr 1 - Apr 25',
    metrics: [
        {
            label: 'Weight',
            value: '77.8 kg',
            delta: '↓ 0.7 kg',
            trend: [79.1, 78.8, 78.4, 78.2, 77.9, 77.8],
            trendDates: ['Apr 1', 'Apr 5', 'Apr 10', 'Apr 15', 'Apr 20', 'Apr 25']
        },
        {
            label: 'Waist',
            value: '86 cm',
            delta: '↓ 3 cm',
            trend: [89, 88.4, 87.9, 87.2, 86.6, 86],
            trendDates: ['Apr 1', 'Apr 5', 'Apr 10', 'Apr 15', 'Apr 20', 'Apr 25']
        },
        {
            label: 'Chest',
            value: '102 cm',
            delta: 'stable',
            trend: [101.8, 102.1, 101.9, 102, 102.2, 102],
            trendDates: ['Apr 1', 'Apr 5', 'Apr 10', 'Apr 15', 'Apr 20', 'Apr 25']
        },
        {
            label: 'Body fat',
            value: '--',
            delta: '',
            emptyStateTitle: 'No measurements yet',
            emptyStateHint: 'Add 2+ check-ins to see a trend.'
        }
    ],
    insightTitle: 'Insight',
    insightText: 'Waist is moving down while weight stays controlled. Looks like recomposition, not just weight loss.'
};

export const sampleCaption = `📊 Progress POC
${sampleViewModel.insightText}`;
