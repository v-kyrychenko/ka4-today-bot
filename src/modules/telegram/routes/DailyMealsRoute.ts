import {telegramMessagingService} from '../features/messaging/telegramMessagingService.js';
import {buildDailyNutritionContext, dailyNutritionPlanner} from '../features/nutrition/dailyNutritionPlanner.js';
import {
    DAY_TAG,
    GOAL_TAG,
    type DailyNutritionPlan,
    MEAL_TYPE,
} from '../features/nutrition/nutritionModel.js';
import type {ProcessorContext} from '../model/context.js';
import {BaseRoute} from './BaseRoute.js';
import {DAILY_MEALS} from './constants.js';
import {log} from '../../../shared/logging';

export class DailyMealsRoute extends BaseRoute {
    canHandle(text: string | null): boolean {
        return text === DAILY_MEALS;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const request = await buildDailyNutritionContext(context);
        if (request == null) {
            return;
        }

        const plan = await dailyNutritionPlanner.generate(request);
        await telegramMessagingService.sendMessage(context, this.generateDailyMealsTemplate(plan));
    }

    private generateDailyMealsTemplate(plan: DailyNutritionPlan): string {
        const dayTypeLabels = {
            [DAY_TAG.REST_DAY]: 'День відпочинку',
            [DAY_TAG.TRAINING_DAY]: 'Тренувальний день',
        };
        const goalLabels = {
            [GOAL_TAG.FAT_LOSS]: 'зниження ваги',
            [GOAL_TAG.MAINTENANCE]: 'підтримка форми',
            [GOAL_TAG.MUSCLE_GAIN]: 'набір мʼязів',
        };
        const mealLabels = {
            [MEAL_TYPE.BREAKFAST]: {emoji: '🥣', title: 'Сніданок'},
            [MEAL_TYPE.LUNCH]: {emoji: '🍽', title: 'Обід'},
            [MEAL_TYPE.DINNER]: {emoji: '🌙', title: 'Вечеря'},
            [MEAL_TYPE.SNACK]: {emoji: '🍓', title: 'Перекус'},
        };
        const unitLabels = {
            g: 'г',
            pcs: 'шт',
        };
        const formatAmount = (amount: number): string => Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
        const getText = (text: Record<string, string>): string => text.uk ?? text.en ?? Object.values(text)[0] ?? '';
        const lines = [
            '🍽 Меню на сьогодні',
            '',
            `${dayTypeLabels[plan.dayType]} · ${goalLabels[plan.goal]}`,
            '',
            '📊 Разом за день:',
            `${Math.round(plan.totals.calories)} ккал · Б ${Math.round(plan.totals.protein)} г`
            + ` · Ж ${Math.round(plan.totals.fat)} г · В ${Math.round(plan.totals.carbs)} г`,
        ];

        for (const meal of plan.meals) {
            const label = mealLabels[meal.mealType];
            lines.push('', `${label.emoji} ${label.title}`, getText(meal.template.title), '');

            for (const item of meal.template.items) {
                lines.push(`• ${getText(item.foodDict.name)} — ${formatAmount(item.amount)} ${unitLabels[item.unit]}`);
            }
        }

        return lines.join('\n');
    }
}
