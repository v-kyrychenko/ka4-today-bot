import type {ProgressViewModel} from './progressViewModel.js';

export const progressSampleViewModel: ProgressViewModel = {
    label: 'KA4 TODAY · PROGRESS',
    title: 'Body progress check',
    metrics: [
        {
            label: 'Weight',
            value: '77.8 kg',
            delta: '↓ 0.7 kg'
        },
        {
            label: 'Waist',
            value: '86 cm',
            delta: '↓ 3 cm'
        },
        {
            label: 'Chest',
            value: '102 cm',
            delta: 'stable'
        },
        {
            label: 'Mood',
            value: 'Good',
            delta: 'training ready'
        }
    ],
    insightTitle: 'Insight',
    insightText: 'Waist is moving down while weight stays controlled. Looks like recomposition, not just weight loss.'
};

export const progressSampleCaption = `📊 Progress POC
${progressSampleViewModel.insightText}`;
