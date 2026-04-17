/**
 * @deprecated This module is deprecated.
 */
import {
    BatchGetItemCommand,
    DynamoDBClient,
    QueryCommand,
    type AttributeValue,
} from '@aws-sdk/client-dynamodb';
import {unmarshall} from '@aws-sdk/util-dynamodb';
import {DYNAMODB_ENDPOINT} from '../../../../app/config/env.js';
import {DEFAULT_BATCH_SIZE} from '../../../../app/config/constants.js';
import {log, logError} from '../../../../shared/logging/index.js';
import {ScheduleUser, TrainingScheduleItem} from '../../../../shared/types/app.js';

const DYNAMO_USER_TABLE = 'ka4-today-users';
const DYNAMO_USERS_SCHEDULE_TABLE = 'ka4-today-users-training-schedule';
const USERS_SCHEDULE_INDEX = 'ScheduleByDay';

const dynamo = new DynamoDBClient({endpoint: DYNAMODB_ENDPOINT || undefined});

export const dynamoDbService = {
    getUsersScheduledForDay,
    getUserScheduledForDay,
};

export interface GetUsersParams {
    limit?: number;
    exclusiveStartKey?: Record<string, AttributeValue>;
}

export interface GetUsersResult {
    items: ScheduleUser[];
    lastEvaluatedKey?: Record<string, AttributeValue>;
}

/**
 * @deprecated This module is deprecated.
 */
export async function getUsersScheduledForDay(): Promise<TrainingScheduleItem[]> {
    const dayOfWeek = getCurrentDayCode();
    const command = new QueryCommand({
        TableName: DYNAMO_USERS_SCHEDULE_TABLE,
        IndexName: USERS_SCHEDULE_INDEX,
        KeyConditionExpression: 'day_of_week = :day',
        ExpressionAttributeValues: {
            ':day': {S: dayOfWeek},
        },
    });

    const scheduleResult = await dynamo.send(command);
    const scheduleItems = (scheduleResult.Items ?? []).map(
        (item) => new TrainingScheduleItem(unmarshall(item) as Partial<TrainingScheduleItem>)
    );

    const chatIds = (scheduleResult.Items ?? []).flatMap((item) => {
        const chatId = item.chat_id?.N;
        return chatId ? [chatId] : [];
    });

    if (chatIds.length === 0) return [];

    const keys = chatIds.map((id) => ({chat_id: {N: id}}));

    const users = await batchGetItems<ScheduleUser>(
        DYNAMO_USER_TABLE,
        keys,
        'chat_id, is_active, username, language_code',
        (user) => user.is_active === 1
    );

    const userMap = Object.fromEntries(users.map((user) => [String(user.chat_id), user]));

    return scheduleItems
        .map((item) => {
            const user = userMap[String(item.chat_id)];
            return user ? new TrainingScheduleItem({...item, user}) : null;
        })
        .filter((item): item is TrainingScheduleItem => item !== null);
}

/**
 * @deprecated This module is deprecated.
 */
export async function getUserScheduledForDay(chatId: number | string): Promise<TrainingScheduleItem | null> {
    const day = getCurrentDayCode();
    const response = await dynamo.send(
        new QueryCommand({
            TableName: DYNAMO_USERS_SCHEDULE_TABLE,
            IndexName: USERS_SCHEDULE_INDEX,
            KeyConditionExpression: 'day_of_week = :day',
            ExpressionAttributeValues: {':day': {S: day}},
        })
    );

    const items = (response.Items ?? []).map(
        (item) => new TrainingScheduleItem(unmarshall(item) as Partial<TrainingScheduleItem>)
    );
    return items.find((item) => String(item.chat_id) === String(chatId)) ?? null;
}

function getCurrentDayCode(): string {
    const daysShort = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const today = new Date().getDay();
    return daysShort[today] ?? 'SUN';
}

async function batchGetItems<T extends object>(
    tableName: string,
    keys: Array<Record<string, AttributeValue>>,
    projection?: string,
    filterFn?: (item: T) => boolean
): Promise<T[]> {
    const result: T[] = [];

    for (let index = 0; index < keys.length; index += DEFAULT_BATCH_SIZE) {
        const chunk = keys.slice(index, index + DEFAULT_BATCH_SIZE);

        const batchResult = await dynamo.send(
            new BatchGetItemCommand({
                RequestItems: {
                    [tableName]: {
                        Keys: chunk,
                        ...(projection ? {ProjectionExpression: projection} : {}),
                    },
                },
            })
        );

        const items = batchResult.Responses?.[tableName] ?? [];

        for (const raw of items) {
            const item = unmarshall(raw) as T;
            if (!filterFn || filterFn(item)) {
                result.push(item);
            }
        }
    }

    return result;
}
