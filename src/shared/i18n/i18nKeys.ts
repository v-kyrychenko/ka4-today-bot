export const I18N_KEYS = {
    date: {
        monthShort: [
            'date.monthShort.0',
            'date.monthShort.1',
            'date.monthShort.2',
            'date.monthShort.3',
            'date.monthShort.4',
            'date.monthShort.5',
            'date.monthShort.6',
            'date.monthShort.7',
            'date.monthShort.8',
            'date.monthShort.9',
            'date.monthShort.10',
            'date.monthShort.11',
        ],
    },
    telegram: {
        conversations: {
            bodyMeasurements: {
                buttonCancel: 'telegram.conversations.bodyMeasurements.buttonCancel',
                buttonEdit: 'telegram.conversations.bodyMeasurements.buttonEdit',
                buttonSave: 'telegram.conversations.bodyMeasurements.buttonSave',
                cancel: 'telegram.conversations.bodyMeasurements.cancel',
                confirmation: 'telegram.conversations.bodyMeasurements.confirmation',
                editPrompt: 'telegram.conversations.bodyMeasurements.editPrompt',
                initialMessage: 'telegram.conversations.bodyMeasurements.initialMessage',
                invalidInput: 'telegram.conversations.bodyMeasurements.invalidInput',
                missingFields: 'telegram.conversations.bodyMeasurements.missingFields',
                saveSuccess: 'telegram.conversations.bodyMeasurements.saveSuccess',
                unavailable: 'telegram.conversations.bodyMeasurements.unavailable',
            },
            cancelled: 'telegram.conversations.cancelled',
            safeError: 'telegram.conversations.safeError',
            unsupportedAction: 'telegram.conversations.unsupportedAction',
            unsupportedInput: 'telegram.conversations.unsupportedInput',
        },
        progress: {
            caption: {
                title: 'telegram.progress.caption.title',
            },
            dateRange: {
                empty: 'telegram.progress.dateRange.empty',
            },
            delta: {
                down: 'telegram.progress.delta.down',
                noChange: 'telegram.progress.delta.noChange',
                up: 'telegram.progress.delta.up',
            },
            empty: {
                hint: 'telegram.progress.empty.hint',
                title: 'telegram.progress.empty.title',
            },
            header: {
                emptyTitle: 'telegram.progress.header.emptyTitle',
                label: 'telegram.progress.header.label',
                title: 'telegram.progress.header.title',
            },
            insight: {
                noDataText: 'telegram.progress.insight.noDataText',
                text: 'telegram.progress.insight.text',
                title: 'telegram.progress.insight.title',
            },
            metric: {
                biceps: 'telegram.progress.metric.biceps',
                calf: 'telegram.progress.metric.calf',
                chest: 'telegram.progress.metric.chest',
                hips: 'telegram.progress.metric.hips',
                thigh: 'telegram.progress.metric.thigh',
                waist: 'telegram.progress.metric.waist',
                weight: 'telegram.progress.metric.weight',
            },
        },
    },
} as const;
