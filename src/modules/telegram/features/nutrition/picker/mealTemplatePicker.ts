import {nutritionRepository} from '../nutritionRepository.js';
import {toSet} from '../../../../../shared/utils/collectionUtils.js';
import {today} from '../../../../../shared/utils/dateUtils.js';
import {MEAL_TYPE, type MealTemplate, type MealType} from '../nutritionModel.js';
import {applyFallbackRule, fallbackRules, getNextFallbackRule} from './fallbackRules.js';
import {pickWeighted, scoreCandidates} from './mealTemplateScoring.js';
import {createPickLogger, type PickLogger} from './pickerLogger.js';
import {
    FallbackRule, MealTemplateNotFoundError, MealTemplatePickerConfig, MealTemplatePickerRequest,
    MealTemplatePickResult, PickerContext, ScoredMealTemplate
} from './types.js';

const mealTemplatePickerConfig: MealTemplatePickerConfig = {
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
    return pickMealTemplate({...request, mealType: MEAL_TYPE.BREAKFAST});
}

export async function pickLunchTemplate(
    request: Omit<MealTemplatePickerRequest, 'mealType'>
): Promise<MealTemplatePickResult> {
    return pickMealTemplate({...request, mealType: MEAL_TYPE.LUNCH});
}

export async function pickDinnerTemplate(
    request: Omit<MealTemplatePickerRequest, 'mealType'>
): Promise<MealTemplatePickResult> {
    return pickMealTemplate({...request, mealType: MEAL_TYPE.DINNER});
}

export async function pickSnackTemplate(
    request: Omit<MealTemplatePickerRequest, 'mealType'>
): Promise<MealTemplatePickResult> {
    return pickMealTemplate({...request, mealType: MEAL_TYPE.SNACK});
}

async function getActiveTemplatesByMealType(mealType: MealType): Promise<MealTemplate[]> {
    const templates = await nutritionRepository.findMealTemplatesByMealType(mealType);
    return templates.filter((template) => template.active && template.mealType === mealType);
}

function createPickerContext(request: MealTemplatePickerRequest): PickerContext {
    const exclusions = request.exclusions ?? {};
    const preferences = request.preferences ?? {};

    return {
        request,
        config: {...mealTemplatePickerConfig, ...request.config},
        targetDate: request.targetDate ?? today(),
        excludedFoodKeys: toSet([
            ...(exclusions.allergyFoodKeys ?? []),
            ...(exclusions.excludedFoodKeys ?? []),
            ...(exclusions.dietaryRestrictionFoodKeys ?? []),
        ]),
        excludedFoodFlags: toSet(exclusions.excludedFoodFlags ?? []),
        preferredFoodKeys: toSet(preferences.preferredFoodKeys ?? []),
        preferredBreakfastStyles: toSet(preferences.preferredBreakfastStyles ?? []),
        recentTemplates: request.recentTemplates ?? [],
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
                pickWeighted(scoredCandidates),
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

function logNextFallback(rule: FallbackRule, pickLog: PickLogger): void {
    const nextRule = getNextFallbackRule(rule);

    if (!nextRule) {
        return;
    }

    pickLog('fallback', {candidateCount: 0, fallbackLevel: nextRule.level});
}
