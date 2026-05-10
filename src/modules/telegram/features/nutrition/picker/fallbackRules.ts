import type {MealTemplate} from '../nutritionModel.js';
import type {FallbackRule, PickerContext} from './types.js';
import {filterByAntiRepeat, filterByDayType, filterByGoal, filterByHardExclusions} from './mealTemplateFilters.js';

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

export function applyFallbackRule(templates: MealTemplate[], context: PickerContext, rule: FallbackRule): MealTemplate[] {
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

export function getNextFallbackRule(rule: FallbackRule): FallbackRule | undefined {
    return fallbackRules[fallbackRules.indexOf(rule) + 1];
}
