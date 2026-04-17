/**
 * @deprecated This module is deprecated.
 */
import {
    BatchGetItemCommand,
    DynamoDBClient,
    GetItemCommand,
    PutItemCommand,
    QueryCommand,
    ScanCommand,
    UpdateItemCommand,
    type AttributeValue,
} from '@aws-sdk/client-dynamodb';
import {unmarshall} from '@aws-sdk/util-dynamodb';
import {DYNAMODB_ENDPOINT} from '../../../../app/config/env.js';
import {DEFAULT_BATCH_SIZE, DEFAULT_PROMPT_VERSION} from '../../../../app/config/constants.js';
import {TelegramMessage} from '../../../../modules/telegram/domain/telegram.js';
import {BadRequestError} from '../../../../shared/errors/index.js';
import {log, logError} from '../../../../shared/logging/index.js';
import {AppUser, PromptConfig, SentMessageLog, TrainingScheduleItem} from '../../../../shared/types/app.js';

const DYNAMO_USER_TABLE = 'ka4-today-users';
const DYNAMO_USERS_SCHEDULE_TABLE = 'ka4-today-users-training-schedule';
const USERS_SCHEDULE_INDEX = 'ScheduleByDay';

const DYNAMO_PROMPT_TABLE = 'ka4-today-prompts';

const dynamo = new DynamoDBClient({endpoint: DYNAMODB_ENDPOINT || undefined});

export const dynamoDbService = {
    getOrCreateUser,
    getUsersScheduledForDay,
    getUserScheduledForDay,
    getPrompt,
};

export interface GetUsersParams {
    limit?: number;
    exclusiveStartKey?: Record<string, AttributeValue>;
}

export interface GetUsersResult {
    items: AppUser[];
    lastEvaluatedKey?: Record<string, AttributeValue>;
}

/**
 * @deprecated This module is deprecated.
 */
export async function getOrCreateUser(chatId: number, message: TelegramMessage): Promise<AppUser> {
    const existing = await getUser(chatId, false);
    if (existing) return existing;

    const item = buildUserItem(chatId, message);

    const put = new PutItemCommand({
        TableName: DYNAMO_USER_TABLE,
        Item: item,
        ConditionExpression: 'attribute_not_exists(chat_id)',
    });

    try {
        await dynamo.send(put);
        log(`Created user ${chatId}`);
        return new AppUser(unmarshall(item) as Partial<AppUser>);
    } catch (error) {
        const err = error as Error;
        if (err.name === 'ConditionalCheckFailedException') {
            log(`Race detected, reloading user ${chatId}`);
            const user = await getUser(chatId);
            if (!user) {
                throw new BadRequestError(`User for chat id: ${chatId} not found after retry`);
            }
            return user;
        }
        throw error;
    }
}

/**
 * @deprecated This module is deprecated.
 */
function buildUserItem(chatId: number, message: TelegramMessage): Record<string, AttributeValue> {
    const user = message.from;
    const chat = message.chat;

    return {
        chat_id: {N: String(chatId)},
        username: user?.username ? {S: user.username} : {NULL: true},
        first_name: user?.first_name ? {S: user.first_name} : {NULL: true},
        last_name: user?.last_name ? {S: user.last_name} : {NULL: true},
        language_code: user?.language_code ? {S: user.language_code} : {NULL: true},
        chat_type: chat?.type ? {S: chat.type} : {NULL: true},
        is_bot: {BOOL: Boolean(user?.is_bot)},
        created_at: {S: new Date().toISOString()},
        is_active: {N: '1'},
    };
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

    const users = await batchGetItems<AppUser>(
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

/**
 * @deprecated This module is deprecated.
 */
export async function getPrompt(lang: string, promptId: string): Promise<PromptConfig> {
    if (!promptId) {
        throw new BadRequestError('Prompt ID is not provided');
    }

    const get = new GetItemCommand({
        TableName: DYNAMO_PROMPT_TABLE,
        Key: {
            prompt_id: {S: promptId},
            version: {N: DEFAULT_PROMPT_VERSION},
        },
    });

    const result = await dynamo.send(get);
    if (!result.Item) {
        throw new BadRequestError(`Prompt: ${promptId} not found in db`);
    }

    const item = new PromptConfig(unmarshall(result.Item) as Partial<PromptConfig>);

    if (!item.prompts || !item.prompts[lang]) {
        throw new BadRequestError(`Prompt '${promptId}' has no translation for language '${lang}'.`);
    }

    return item;
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
