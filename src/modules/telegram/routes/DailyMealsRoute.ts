import {clientsRepository} from '../../coach/client/repository/clientsRepository.js';
import type {ClientProfile} from '../../coach/client/domain/client.js';
import {NotFoundError, OpenAIError} from '../../../shared/errors';
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
    type GoalTag,
} from '../features/nutrition/nutritionModel.js';
import {tgUserRepository} from '../repository/tgUserRepository.js';
import type {ProcessorContext} from '../model/context.js';
import {BaseRoute} from './BaseRoute.js';
import {DAILY_MEALS} from './constants.js';

const CLIENT_NOT_LINKED_MESSAGE =
    "Я ще не бачу прив'язаного профілю клієнта. Попроси тренера перевірити налаштування профілю.";
const HEIGHT_MISSING_MESSAGE =
    'Щоб скласти меню, мені потрібен твій зріст. Додай зріст у профіль, і я одразу згенерую план харчування.';
const WEIGHT_MISSING_MESSAGE =
    'Щоб скласти меню, мені потрібна актуальна вага. Надішли заміри, і я одразу згенерую план харчування.';
const MEASUREMENT_START_DATE = '1970-01-01';

export class DailyMealsRoute extends BaseRoute {
    canHandle(text: string | null): boolean {
        return text === DAILY_MEALS;
    }

    async execute(context: ProcessorContext): Promise<void> {
        const clientId = getClientId(context);
        if (clientId == null) {
            await telegramMessagingService.sendMessage(context, CLIENT_NOT_LINKED_MESSAGE);
            return;
        }

        const client = await getClient(clientId);
        if (client == null) {
            await telegramMessagingService.sendMessage(context, CLIENT_NOT_LINKED_MESSAGE);
            return;
        }

        const height = getHeight(client);
        if (height == null) {
            await telegramMessagingService.sendMessage(context, HEIGHT_MISSING_MESSAGE);
            return;
        }

        const weight = await getWeight(clientId);
        if (weight == null) {
            await telegramMessagingService.sendMessage(context, WEIGHT_MISSING_MESSAGE);
            return;
        }

        const plan = await dailyNutritionPlanner.generate({
            clientId,
            gender: getGender(client),
            birthday: getBirthday(client),
            goal: getGoal(client),
            weight,
            height,
            activityLevel: getActivityLevel(),
            dayType: await getDayType(getChatId(context)),
        });

        await telegramMessagingService.sendMessage(context, JSON.stringify(plan, null, 2));
    }
}

function getClientId(context: ProcessorContext): number | null {
    return context.user.clientId ?? null;
}

function getChatId(context: ProcessorContext): number {
    if (context.chatId == null) {
        throw new OpenAIError('chatId is mandatory');
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

function getGender(client: ClientProfile) {
    return client.gender;
}

function getBirthday(client: ClientProfile): string {
    return client.birthday;
}

function getGoal(client: ClientProfile): GoalTag {
    const goal = client.goals?.trim();

    return isGoalTag(goal) ? goal : GOAL_TAG.MAINTENANCE;
}

function getHeight(client: ClientProfile): number | null {
    return client.height != null && client.height > 0 ? client.height : null;
}

async function getWeight(clientId: number): Promise<BodyMeasurement | null> {
    const measurements = await bodyMeasurementRepository.findForClientSince(clientId, MEASUREMENT_START_DATE);
    const weights = measurements.filter((item) => item.type === BodyMeasurementType.WEIGHT);

    return weights[weights.length - 1] ?? null;
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
