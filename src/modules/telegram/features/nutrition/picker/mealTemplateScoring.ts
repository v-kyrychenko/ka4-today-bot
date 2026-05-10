import {intersects} from '../../../../../shared/utils/collectionUtils.js';
import {MEAL_ITEM_ROLE, MEAL_TYPE, type MealTemplate} from '../nutritionModel.js';
import type {PickerContext, ScoredMealTemplate} from './types.js';
import {
    getMainProteinKeys,
    getNearestSameTemplateDistance,
    getRecentMainProteinKeys,
} from './recentMealTemplateUtils.js';

export function scoreCandidates(templates: MealTemplate[], context: PickerContext): ScoredMealTemplate[] {
    return templates
        .map((template) => ({template, score: scoreTemplate(template, context)}))
        .filter((candidate) => candidate.score >= context.config.minScore);
}

export function pickWeighted(candidates: ScoredMealTemplate[], random: () => number = Math.random): ScoredMealTemplate {
    const total = candidates.reduce((sum, candidate) => sum + candidate.score, 0);
    const threshold = random() * total;
    let cumulative = 0;

    for (const candidate of candidates) {
        cumulative += candidate.score;

        if (threshold < cumulative) {
            return candidate;
        }
    }

    return candidates[candidates.length - 1];
}

function scoreTemplate(template: MealTemplate, context: PickerContext): number {
    let score = 100;
    score += getPreferenceBonus(template, context);
    score -= getRecentTemplatePenalty(template, context);
    score -= getSameMainProteinPenalty(template, context);

    return Math.max(context.config.minScore, score);
}

function getPreferenceBonus(template: MealTemplate, context: PickerContext): number {
    let bonus = 0;

    if (containsPreferredFood(template, context)) {
        bonus += context.config.preferredFoodBonus;
    }
    if (matchesPreferredBreakfastStyle(template, context)) {
        bonus += context.config.preferredBreakfastStyleBonus;
    }
    if (containsProteinBooster(template)) {
        bonus += context.config.proteinBoosterBonus;
    }

    return bonus;
}

function getRecentTemplatePenalty(template: MealTemplate, context: PickerContext): number {
    const distance = getNearestSameTemplateDistance(template, context);

    if (distance === 1) {
        return context.config.yesterdayTemplatePenalty;
    }

    return distance <= context.config.avoidSameTemplateDays ? context.config.recentTemplatePenalty : 0;
}

function getSameMainProteinPenalty(template: MealTemplate, context: PickerContext): number {
    const recentProteinKeys = getRecentMainProteinKeys(context, 1);

    return intersects(getMainProteinKeys(template), recentProteinKeys) ? context.config.sameMainProteinPenalty : 0;
}

function containsPreferredFood(template: MealTemplate, context: PickerContext): boolean {
    return template.items.some((item) => context.preferredFoodKeys.has(item.foodDict.key));
}

function matchesPreferredBreakfastStyle(template: MealTemplate, context: PickerContext): boolean {
    if (template.mealType !== MEAL_TYPE.BREAKFAST || !context.preferredBreakfastStyles.size) {
        return false;
    }

    return template.items.some((item) => {
        const terms = [template.key, item.role, item.foodDict.key, ...item.foodDict.flags];

        return terms.some((term) => context.preferredBreakfastStyles.has(term));
    });
}

function containsProteinBooster(template: MealTemplate): boolean {
    return template.items.some((item) => {
        const flags = new Set(item.foodDict.flags);

        return item.role === MEAL_ITEM_ROLE.PROTEIN_BOOSTER || flags.has('proteinBooster') || flags.has('protein_booster');
    });
}
