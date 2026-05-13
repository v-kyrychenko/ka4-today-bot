import {clientsRepository} from '../../coach/client/repository/clientsRepository.js';
import type {ClientProfile} from '../../coach/client/domain/client.js';
import {NotFoundError, OpenAIError, TelegramError} from '../../../shared/errors';
import {I18N_KEYS} from '../../../shared/i18n/i18nKeys.js';
import {i18nService} from '../../../shared/i18n/i18nService.js';
import {bodyMeasurementRepository} from '../features/measurements/repository/bodyMeasurementRepository.js';
import {BodyMeasurementType, type BodyMeasurement} from '../features/measurements/bodyMeasurementsModel.js';
import {telegramMessagingService} from '../features/messaging/telegramMessagingService.js';
import {dailyNutritionPlanner} from '../features/nutrition/dailyNutritionPlanner.js';
import {
    ACTIVITY_LEVEL,
    DAY_TAG,
    GOAL_TAG,
    type ActivityLevel,
    type DayTag,
    type GoalTag, type DailyNutritionPlannerRequest,
} from '../features/nutrition/nutritionModel.js';
import {tgUserRepository} from '../repository/tgUserRepository.js';
import type {ProcessorContext} from '../model/context.js';
import {BaseRoute} from './BaseRoute.js';
import {DAILY_MEALS} from './constants.js';
import {log} from "../../../shared/logging";

export class DailyMealsRoute extends BaseRoute {
    canHandle(text: string | null): boolean {
        return text === DAILY_MEALS;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const request = await initPlannerRequest(context);
        if (request == null) {
            return;
        }

        const plan = await dailyNutritionPlanner.generate(request);

        log(JSON.stringify(plan, null, 2));
    }
}

async function initPlannerRequest(context: ProcessorContext): Promise<DailyNutritionPlannerRequest | null> {
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

    return {
        clientId,
        gender: client.gender,
        birthday: client.birthday,
        goal: getGoal(client),
        weight,
        height,
        activityLevel: getActivityLevel(),
        dayType: await getDayType(getChatId(context)),
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

function getActivityLevel(): ActivityLevel {
    return ACTIVITY_LEVEL.ACTIVE;
}

async function getDayType(chatId: number): Promise<DayTag> {
    const scheduled = await tgUserRepository.getUserScheduledForDay(chatId);

    return scheduled ? DAY_TAG.TRAINING_DAY : DAY_TAG.REST_DAY;
}

function isGoalTag(value: string | undefined): value is GoalTag {
    return Object.values(GOAL_TAG).includes(value as GoalTag);
}
