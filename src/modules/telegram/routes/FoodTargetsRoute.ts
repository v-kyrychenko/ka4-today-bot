import {I18N_KEYS} from '../../../shared/i18n/i18nKeys.js';
import {i18nService} from '../../../shared/i18n/i18nService.js';
import {telegramMessagingService} from '../features/messaging/telegramMessagingService.js';
import {calculateMacroTargets} from '../features/nutrition/macroTargetsCalculator.js';
import {buildDailyNutritionContext} from '../features/nutrition/dailyNutritionPlanner.js';
import {DAY_TAG, GOAL_TAG, type DayTag, type GoalTag} from '../features/nutrition/nutritionModel.js';
import type {ProcessorContext} from '../model/context.js';
import {BaseRoute} from './BaseRoute.js';
import {FOOD_TARGETS} from './constants.js';

export class FoodTargetsRoute extends BaseRoute {
    canHandle(text: string | null): boolean {
        return text === FOOD_TARGETS;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const request = await buildDailyNutritionContext(context);
        if (request == null) {
            return;
        }

        const targets = calculateMacroTargets(request);
        await telegramMessagingService.sendMessage(context, i18nService.tr(
            context.user.lang,
            I18N_KEYS.telegram.foodTargets.message,
            {
                dayType: i18nService.tr(context.user.lang, getDayTypeKey(request.dayType)),
                goal: i18nService.tr(context.user.lang, getGoalKey(request.goal ?? GOAL_TAG.MAINTENANCE)),
                calories: Math.round(targets.calories),
                protein: Math.round(targets.protein),
                fat: Math.round(targets.fat),
                carbs: Math.round(targets.carbs),
            }
        ));
    }
}

function getGoalKey(goal: GoalTag): string {
    if (goal === GOAL_TAG.FAT_LOSS) {
        return I18N_KEYS.telegram.foodTargets.goal.fatLoss;
    }

    if (goal === GOAL_TAG.MUSCLE_GAIN) {
        return I18N_KEYS.telegram.foodTargets.goal.muscleGain;
    }

    return I18N_KEYS.telegram.foodTargets.goal.maintenance;
}

function getDayTypeKey(dayType: DayTag): string {
    return dayType === DAY_TAG.TRAINING_DAY
        ? I18N_KEYS.telegram.foodTargets.dayType.trainingDay
        : I18N_KEYS.telegram.foodTargets.dayType.restDay;
}
