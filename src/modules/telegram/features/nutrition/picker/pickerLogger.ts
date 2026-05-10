import {log} from '../../../../../shared/logging';
import type {MealTemplateFallbackLevel, PickerContext} from './types.js';

export function createPickLogger(context: PickerContext): PickLogger {
    const base = {
        clientId: context.request.clientId,
        mealType: context.request.mealType,
        goal: context.request.goal,
        dayType: context.request.dayType,
        excludedFoodCount: context.excludedFoodKeys.size + context.excludedFoodFlags.size,
        recentTemplateCount: context.recentTemplates.length,
    };

    return (event, detail) => {
        log(`### MEAL_TEMPLATE_PICK:${event}`, {
            ...base,
            candidateCount: detail.candidateCount,
            fallbackLevel: detail.fallbackLevel,
            selectedTemplateKey: detail.selectedTemplateKey,
        });
    };
}

export type PickLogger = (event: PickLogEvent, detail: PickLogDetail) => void;

type PickLogEvent = 'start' | 'filtered' | 'fallback' | 'selected' | 'stop';

type PickLogDetail = {
    candidateCount: number;
    fallbackLevel: MealTemplateFallbackLevel;
    selectedTemplateKey?: string;
};
