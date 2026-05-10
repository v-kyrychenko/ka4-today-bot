import {intersects} from '../../../../../shared/utils/collectionUtils.js';
import type {DayTag, GoalTag, MealTemplate} from '../nutritionModel.js';
import type {PickerContext} from './types.js';
import {filterByRecentMainProtein, filterByRecentTemplate} from './recentMealTemplateUtils.js';

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

function hasHardExcludedItem(template: MealTemplate, context: PickerContext): boolean {
    return template.items.some((item) => {
        const food = item.foodDict;

        return context.excludedFoodKeys.has(food.key) || intersects(food.flags, context.excludedFoodFlags);
    });
}
