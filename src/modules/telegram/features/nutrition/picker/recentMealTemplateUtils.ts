import {intersects} from '../../../../../shared/utils/collectionUtils.js';
import {getDayDistance} from '../../../../../shared/utils/dateUtils.js';
import {MEAL_ITEM_ROLE, type MealTemplate} from '../nutritionModel.js';
import type {PickerContext, RecentMealTemplate} from './types.js';

export function filterByRecentTemplate(templates: MealTemplate[], context: PickerContext): MealTemplate[] {
    const recentTemplateKeys = getRecentTemplateKeys(context);

    return templates.filter((template) => !getTemplateHistoryKeys(template).some((key) => recentTemplateKeys.has(key)));
}

export function filterByRecentMainProtein(templates: MealTemplate[], context: PickerContext): MealTemplate[] {
    const recentProteinKeys = getRecentMainProteinKeys(context, context.config.avoidSameMainProteinDays);

    return templates.filter((template) => !intersects(getMainProteinKeys(template), recentProteinKeys));
}

export function getRecentMainProteinKeys(context: PickerContext, withinDays: number): Set<string> {
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

export function getNearestSameTemplateDistance(template: MealTemplate, context: PickerContext): number {
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const recentTemplate of context.recentTemplates) {
        if (recentTemplate.mealType !== context.request.mealType || !isSameTemplate(template, recentTemplate)) {
            continue;
        }

        nearestDistance = Math.min(nearestDistance, getDayDistance(recentTemplate.usedAt, context.targetDate));
    }

    return nearestDistance;
}

export function getMainProteinKeys(template: MealTemplate): Set<string> {
    const keys = template.items
        .filter((item) => item.role === MEAL_ITEM_ROLE.MAIN_PROTEIN)
        .map((item) => item.foodDict.key);

    return new Set(keys);
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

function isWithinTemplateAvoidDays(recentTemplate: RecentMealTemplate, context: PickerContext): boolean {
    return getDayDistance(recentTemplate.usedAt, context.targetDate) <= context.config.avoidSameTemplateDays;
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
