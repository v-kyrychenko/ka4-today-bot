import {clientsRepository} from '../../../coach/client/repository/clientsRepository.js';
import type {ClientProfile} from '../../../coach/client/domain/client.js';
import {NotFoundError, TelegramError} from '../../../../shared/errors';
import {I18N_KEYS} from '../../../../shared/i18n/i18nKeys.js';
import {i18nService} from '../../../../shared/i18n/i18nService.js';
import {bodyMeasurementRepository} from '../measurements/repository/bodyMeasurementRepository.js';
import {BodyMeasurementType, type BodyMeasurement} from '../measurements/bodyMeasurementsModel.js';
import {telegramMessagingService} from '../messaging/telegramMessagingService.js';
import {tgUserRepository} from '../../repository/tgUserRepository.js';
import type {ProcessorContext} from '../../model/context.js';
import {
    ACTIVITY_LEVEL,
    DAY_TAG,
    GOAL_TAG,
    MEAL_TYPE,
    type DailyNutritionPlan,
    type DailyNutritionPlanMeal,
    type DailyNutritionContext,
    type DayTag,
    type GoalTag,
    type MealType,
} from './nutritionModel.js';
import {today} from '../../../../shared/utils/dateUtils.js';
import {log} from '../../../../shared/logging';
import {mealTemplatePicker} from './picker/mealTemplatePicker.js';
import {calculateMacroTargets} from "./macroTargetsCalculator";
import {adjust} from "./nutritionAdjuster";
import {calculatePlanTotals} from './planMacroTotals.js';

const DAILY_MEAL_ORDER = [
    MEAL_TYPE.BREAKFAST,
    MEAL_TYPE.LUNCH,
    MEAL_TYPE.DINNER,
    MEAL_TYPE.SNACK,
] as const;

export const dailyNutritionPlanner = {
    buildDailyNutritionContext,
    generate,
};

export async function buildDailyNutritionContext(context: ProcessorContext): Promise<DailyNutritionContext | null> {
    const clientId = getClientId(context);
    if (clientId == null) {
        await sendLocalizedMessage(context, I18N_KEYS.telegram.dailyMeals.clientNotLinked);
        return null;
    }

    const client = await getClient(clientId);
    if (client == null) {
        await sendLocalizedMessage(context, I18N_KEYS.telegram.dailyMeals.clientNotLinked);
        return null;
    }

    const height = getHeight(client);
    if (height == null) {
        await sendLocalizedMessage(context, I18N_KEYS.telegram.dailyMeals.heightMissing);
        return null;
    }

    const weight = await getWeight(clientId);
    if (weight == null) {
        await sendLocalizedMessage(context, I18N_KEYS.telegram.dailyMeals.weightMissing);
        return null;
    }

    const dayType = await getDayType(getChatId(context));

    return {
        clientId,
        gender: client.gender,
        birthday: client.birthday,
        goal: getGoal(client),
        weight,
        height,
        activityLevel: dayType === DAY_TAG.TRAINING_DAY ? ACTIVITY_LEVEL.ACTIVE : ACTIVITY_LEVEL.LOW_ACTIVE,
        dayType,
    };
}

export async function generate(request: DailyNutritionContext): Promise<DailyNutritionPlan> {
    //TODO get history of daily plans and pass it to buildDraftDailyPlan
    log('### DAILY_NUTRITION_PLANNER:generate:request', request);

    const draftPlan = await buildDraftDailyPlan(request);
    const dailyMacroTargets = calculateMacroTargets(request);
    log('### DAILY_NUTRITION_PLANNER:generate:dailyMacroTargets', dailyMacroTargets);
    const adjustedPlan = await adjust(draftPlan, dailyMacroTargets);

    return adjustedPlan
}

async function buildDraftDailyPlan(request: DailyNutritionContext): Promise<DailyNutritionPlan> {
    const goal = request.goal ?? GOAL_TAG.MAINTENANCE;

    const meals: DailyNutritionPlanMeal[] = [];

    for (const mealType of DAILY_MEAL_ORDER) {
        meals.push(await pickDraftMeal(request, mealType, goal));
    }

    const draftPlan = initDraftPlan(request, goal, meals);

    return {
        ...draftPlan,
        totals: calculatePlanTotals(draftPlan),
    };
}

function getClientId(context: ProcessorContext): number | null {
    return context.user.clientId ?? null;
}

async function sendLocalizedMessage(context: ProcessorContext, key: string): Promise<void> {
    await telegramMessagingService.sendMessage(context, i18nService.tr(context.user.lang, key));
}

function getChatId(context: ProcessorContext): number {
    if (context.chatId == null) {
        throw new TelegramError('chatId is mandatory');
    }

    return context.chatId;
}

async function getClient(clientId: number): Promise<ClientProfile | null> {
    try {
        return await clientsRepository.findByClientId(clientId);
    } catch (error) {
        if (!(error instanceof NotFoundError)) {
            throw error;
        }

        return null;
    }
}

function getGoal(client: ClientProfile): GoalTag {
    const goal = client.goals?.trim();

    return isGoalTag(goal) ? goal : GOAL_TAG.MAINTENANCE;
}

function getHeight(client: ClientProfile): number | null {
    return client.height != null && client.height > 0 ? client.height : null;
}

async function getWeight(clientId: number): Promise<BodyMeasurement | null> {
    return bodyMeasurementRepository.findLatestForClientByType(clientId, BodyMeasurementType.WEIGHT);
}

async function getDayType(chatId: number): Promise<DayTag> {
    const scheduled = await tgUserRepository.getUserScheduledForDay(chatId);

    return scheduled ? DAY_TAG.TRAINING_DAY : DAY_TAG.REST_DAY;
}

function isGoalTag(value: string | undefined): value is GoalTag {
    return Object.values(GOAL_TAG).includes(value as GoalTag);
}

function initDraftPlan(request: DailyNutritionContext,
                       goal: GoalTag,
                       meals: DailyNutritionPlanMeal[]): DailyNutritionPlan {
    const targetDate = today();
    return {
        clientId: request.clientId,
        goal,
        dayType: request.dayType,
        targetDate,
        totals: {
            calories: 0,
            protein: 0,
            fat: 0,
            carbs: 0,
        },
        meals,
    };
}

async function pickDraftMeal(request: DailyNutritionContext,
                             mealType: MealType,
                             goal: GoalTag): Promise<DailyNutritionPlanMeal> {
    const result = await mealTemplatePicker.pickMealTemplate({
        clientId: request.clientId,
        mealType,
        goal,
        dayType: request.dayType,
    });

    return {
        mealType,
        template: result.template,
        fallbackLevel: result.fallbackLevel,
        reason: result.reason,
        score: result.score,
    };
}
