import {log} from '../../../../../shared/logging';
import {nutritionRepository} from '../nutritionRepository.js';
import type {DayTag, GoalTag, MealTemplate, MealType} from '../nutritionModel.js';
import {
    FallbackRule,
    MealTemplateFallbackLevel, MealTemplateNotFoundError,
    MealTemplatePickerConfig, MealTemplatePickerRequest, MealTemplatePickResult, PickerContext, RecentMealTemplate,
    ScoredMealTemplate
} from "./types";

export const mealTemplatePickerConfig: MealTemplatePickerConfig = {
    avoidSameTemplateDays: 3,
    avoidSameMainProteinDays: 2,
    recentTemplatePenalty: 40,
    yesterdayTemplatePenalty: 80,
    sameMainProteinPenalty: 20,
    preferredFoodBonus: 20,
    preferredBreakfastStyleBonus: 25,
    proteinBoosterBonus: 10,
    minScore: 1,
};

export const mealTemplatePicker = {
    pickMealTemplate,
    pickBreakfastTemplate,
    pickLunchTemplate,
    pickDinnerTemplate,
    pickSnackTemplate,
};

export async function pickMealTemplate(request: MealTemplatePickerRequest): Promise<MealTemplatePickResult> {
    const context = createPickerContext(request);
    const pickLog = createPickLogger(context);
    pickLog('start', {candidateCount: 0, fallbackLevel: 'strict'});

    const templates = await getActiveTemplatesByMealType(request.mealType);
    const result = selectTemplate(templates, context, pickLog);
    pickLog('selected', result.metadata);
    pickLog('stop', result.metadata);

    return result;
}

export async function pickBreakfastTemplate(
    request: Omit<MealTemplatePickerRequest, 'mealType'>
): Promise<MealTemplatePickResult> {
    return pickMealTemplate({...request, mealType: 'breakfast'});
}

export async function pickLunchTemplate(
    request: Omit<MealTemplatePickerRequest, 'mealType'>
): Promise<MealTemplatePickResult> {
    return pickMealTemplate({...request, mealType: 'lunch'});
}

export async function pickDinnerTemplate(
    request: Omit<MealTemplatePickerRequest, 'mealType'>
): Promise<MealTemplatePickResult> {
    return pickMealTemplate({...request, mealType: 'dinner'});
}

export async function pickSnackTemplate(
    request: Omit<MealTemplatePickerRequest, 'mealType'>
): Promise<MealTemplatePickResult> {
    return pickMealTemplate({...request, mealType: 'snack'});
}

export async function getActiveTemplatesByMealType(mealType: MealType): Promise<MealTemplate[]> {
    const templates = await nutritionRepository.findMealTemplatesByMealType(mealType);
    return templates.filter((template) => template.active && template.mealType === mealType);
}

export function filterByGoal(templates: MealTemplate[], goal: GoalTag): MealTemplate[] {
    return templates.filter((template) => template.goalTags.includes(goal));
}

export function filterByDayType(templates: MealTemplate[], dayType: DayTag): MealTemplate[] {
    return templates.filter((template) => template.dayTags.includes(dayType));
}

export function filterByHardExclusions(templates: MealTemplate[], context: PickerContext): MealTemplate[] {
    return templates.filter((template) => !hasHardExcludedItem(template, context));
}

export function filterByAntiRepeat(templates: MealTemplate[], context: PickerContext): MealTemplate[] {
    return filterByRecentMainProtein(filterByRecentTemplate(templates, context), context);
}

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

function createPickerContext(request: MealTemplatePickerRequest): PickerContext {
    const exclusions = request.exclusions ?? {};
    const preferences = request.preferences ?? {};

    return {
        request,
        config: {...mealTemplatePickerConfig, ...request.config},
        targetDate: request.targetDate ?? new Date().toISOString().slice(0, 10),
        excludedFoodKeys: toSet([
            ...(exclusions.allergyFoodKeys ?? []),
            ...(exclusions.excludedFoodKeys ?? []),
            ...(exclusions.dietaryRestrictionFoodKeys ?? []),
        ]),
        excludedFoodFlags: toSet(exclusions.excludedFoodFlags ?? []),
        preferredFoodKeys: toSet(preferences.preferredFoodKeys ?? []),
        preferredBreakfastStyles: toSet(preferences.preferredBreakfastStyles ?? []),
        recentTemplates: request.recentTemplates ?? [],
        random: request.random ?? Math.random,
    };
}

function selectTemplate(
    templates: MealTemplate[],
    context: PickerContext,
    pickLog: PickLogger
): MealTemplatePickResult {
    for (const rule of fallbackRules) {
        const candidates = applyFallbackRule(templates, context, rule);
        const scoredCandidates = scoreCandidates(candidates, context);
        pickLog('filtered', {candidateCount: candidates.length, fallbackLevel: rule.level});

        if (scoredCandidates.length) {
            return toPickResult(
                pickWeighted(scoredCandidates, context.random),
                context,
                rule,
                templates,
                candidates,
                scoredCandidates.length
            );
        }

        logNextFallback(rule, pickLog);
    }

    pickLog('stop', {candidateCount: 0, fallbackLevel: 'relax_goal'});
    throw new MealTemplateNotFoundError(context);
}

function applyFallbackRule(templates: MealTemplate[], context: PickerContext, rule: FallbackRule): MealTemplate[] {
    let candidates = filterByHardExclusions(templates, context);

    if (rule.includeGoal) {
        candidates = filterByGoal(candidates, context.request.goal);
    }
    if (rule.includeDayType) {
        candidates = filterByDayType(candidates, context.request.dayType);
    }
    if (rule.includeAntiRepeat) {
        candidates = filterByAntiRepeat(candidates, context);
    }

    return candidates;
}

function toPickResult(
    selected: ScoredMealTemplate,
    context: PickerContext,
    rule: FallbackRule,
    templates: MealTemplate[],
    candidates: MealTemplate[],
    scoredCandidateCount: number
): MealTemplatePickResult {
    return {
        template: selected.template,
        fallbackLevel: rule.level,
        reason: rule.reason,
        score: selected.score,
        metadata: {
            fallbackLevel: rule.level,
            candidateCount: candidates.length,
            scoredCandidateCount,
            loadedTemplateCount: templates.length,
            activeTemplateCount: templates.length,
            excludedFoodCount: context.excludedFoodKeys.size + context.excludedFoodFlags.size,
            recentTemplateCount: context.recentTemplates.length,
            selectedTemplateKey: selected.template.key,
        },
    };
}

function filterByRecentTemplate(templates: MealTemplate[], context: PickerContext): MealTemplate[] {
    const recentTemplateKeys = getRecentTemplateKeys(context);

    return templates.filter((template) => !getTemplateHistoryKeys(template).some((key) => recentTemplateKeys.has(key)));
}

function filterByRecentMainProtein(templates: MealTemplate[], context: PickerContext): MealTemplate[] {
    const recentProteinKeys = getRecentMainProteinKeys(context, context.config.avoidSameMainProteinDays);

    return templates.filter((template) => !intersects(getMainProteinKeys(template), recentProteinKeys));
}

function getRecentTemplateKeys(context: PickerContext): Set<string> {
    const keys = new Set<string>();

    for (const recentTemplate of context.recentTemplates) {
        if (recentTemplate.mealType !== context.request.mealType || !isWithinTemplateAvoidDays(recentTemplate, context)) {
            continue;
        }

        addRecentTemplateKey(keys, recentTemplate);
    }

    return keys;
}

function addRecentTemplateKey(keys: Set<string>, recentTemplate: RecentMealTemplate): void {
    if (recentTemplate.templateId !== undefined) {
        keys.add(`id:${recentTemplate.templateId}`);
    }
    if (recentTemplate.templateKey) {
        keys.add(`key:${recentTemplate.templateKey}`);
    }
}

function getRecentMainProteinKeys(context: PickerContext, withinDays: number): Set<string> {
    const keys = new Set<string>();

    for (const recentTemplate of context.recentTemplates) {
        if (getDayDistance(recentTemplate.usedAt, context.targetDate) > withinDays) {
            continue;
        }

        for (const foodKey of recentTemplate.mainProteinFoodKeys ?? []) {
            keys.add(foodKey);
        }
    }

    return keys;
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

function getNearestSameTemplateDistance(template: MealTemplate, context: PickerContext): number {
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const recentTemplate of context.recentTemplates) {
        if (recentTemplate.mealType !== context.request.mealType || !isSameTemplate(template, recentTemplate)) {
            continue;
        }

        nearestDistance = Math.min(nearestDistance, getDayDistance(recentTemplate.usedAt, context.targetDate));
    }

    return nearestDistance;
}

function hasHardExcludedItem(template: MealTemplate, context: PickerContext): boolean {
    return template.items.some((item) => {
        const food = item.foodDict;

        return context.excludedFoodKeys.has(food.key) || intersects(food.flags, context.excludedFoodFlags);
    });
}

function containsPreferredFood(template: MealTemplate, context: PickerContext): boolean {
    return template.items.some((item) => context.preferredFoodKeys.has(item.foodDict.key));
}

function matchesPreferredBreakfastStyle(template: MealTemplate, context: PickerContext): boolean {
    if (template.mealType !== 'breakfast' || !context.preferredBreakfastStyles.size) {
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

        return item.role === 'protein_booster' || flags.has('proteinBooster') || flags.has('protein_booster');
    });
}

function getMainProteinKeys(template: MealTemplate): Set<string> {
    const keys = template.items
        .filter((item) => item.role === 'main_protein')
        .map((item) => item.foodDict.key);

    return new Set(keys);
}

function isWithinTemplateAvoidDays(recentTemplate: RecentMealTemplate, context: PickerContext): boolean {
    return getDayDistance(recentTemplate.usedAt, context.targetDate) <= context.config.avoidSameTemplateDays;
}

function getDayDistance(usedAt: string, targetDate: string): number {
    const usedTime = parseDateOnly(usedAt);
    const targetTime = parseDateOnly(targetDate);

    if (usedTime === null || targetTime === null || usedTime > targetTime) {
        return Number.POSITIVE_INFINITY;
    }

    return Math.round((targetTime - usedTime) / 86400000);
}

function parseDateOnly(value: string): number | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

    if (!match) {
        return null;
    }

    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function isSameTemplate(template: MealTemplate, recentTemplate: RecentMealTemplate): boolean {
    return recentTemplate.templateId === template.id || recentTemplate.templateKey === template.key;
}

function getTemplateHistoryKeys(template: MealTemplate): string[] {
    const keys = [`key:${template.key}`];

    if (template.id) {
        keys.push(`id:${template.id}`);
    }

    return keys;
}

function toSet(values: string[]): Set<string> {
    return new Set(values.filter(Boolean));
}

function intersects(values: Iterable<string>, target: Set<string>): boolean {
    for (const value of values) {
        if (target.has(value)) {
            return true;
        }
    }

    return false;
}

function logNextFallback(rule: FallbackRule, pickLog: PickLogger): void {
    const nextRule = fallbackRules[fallbackRules.indexOf(rule) + 1];

    if (!nextRule) {
        return;
    }

    pickLog('fallback', {candidateCount: 0, fallbackLevel: nextRule.level});
}

function createPickLogger(context: PickerContext): PickLogger {
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

type PickLogEvent = 'start' | 'filtered' | 'fallback' | 'selected' | 'stop';

type PickLogDetail = {
    candidateCount: number;
    fallbackLevel: MealTemplateFallbackLevel;
    selectedTemplateKey?: string;
};

type PickLogger = (event: PickLogEvent, detail: PickLogDetail) => void;

export const fallbackRules: FallbackRule[] = [
    {
        level: 'strict',
        reason: 'matched_meal_type_goal_day_type_exclusions_and_anti_repeat',
        includeGoal: true,
        includeDayType: true,
        includeAntiRepeat: true,
    },
    {
        level: 'relax_anti_repeat',
        reason: 'matched_meal_type_goal_day_type_and_exclusions',
        includeGoal: true,
        includeDayType: true,
        includeAntiRepeat: false,
    },
    {
        level: 'relax_day_type',
        reason: 'matched_meal_type_goal_and_exclusions',
        includeGoal: true,
        includeDayType: false,
        includeAntiRepeat: false,
    },
    {
        level: 'relax_goal',
        reason: 'matched_meal_type_and_exclusions',
        includeGoal: false,
        includeDayType: false,
        includeAntiRepeat: false,
    },
];
