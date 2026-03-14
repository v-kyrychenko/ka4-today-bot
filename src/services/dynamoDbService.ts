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
import {log, logError} from '../utils/logger.js';
import {DYNAMODB_ENDPOINT} from '../config/env.js';
import {BadRequestError} from '../utils/errors.js';
import {DEFAULT_BATCH_SIZE, DEFAULT_PROMPT_VERSION} from '../config/constants.js';
import {AppUser, PromptConfig, SentMessageLog, TrainingScheduleItem} from '../models/app.js';
import type {TelegramMessage} from '../models/telegram.js';

const DYNAMO_USER_TABLE = 'ka4-today-users';
const DYNAMO_USERS_SCHEDULE_TABLE = 'ka4-today-users-training-schedule';
const USERS_SCHEDULE_INDEX = 'ScheduleByDay';

const DYNAMO_PROMPT_TABLE = 'ka4-today-prompts';
const DYNAMO_MESSAGE_LOG_TABLE = 'ka4-today-log';

const dynamo = new DynamoDBClient({endpoint: DYNAMODB_ENDPOINT || undefined});

export const dynamoDbService = {
    getUsers,
    getUser,
    getOrCreateUser,
    markUserInactive,
    getUsersScheduledForDay,
    getUserScheduledForDay,
    getPrompt,
    logSentMessage,
};

export async function getUser(chatId: number | string, throwIfNotFound = true): Promise<AppUser | null> {
    const get = new GetItemCommand({
        TableName: DYNAMO_USER_TABLE,
        Key: {chat_id: {N: String(chatId)}},
    });

    const result = await dynamo.send(get);

    if (!result.Item) {
        if (throwIfNotFound) {
            throw new BadRequestError(`User for chat id: ${chatId} not found in db`);
        }
        return null;
    }

    return new AppUser(unmarshall(result.Item) as Partial<AppUser>);
}

export interface GetUsersParams {
    limit?: number;
    exclusiveStartKey?: Record<string, AttributeValue>;
}

export interface GetUsersResult {
    items: AppUser[];
    lastEvaluatedKey?: Record<string, AttributeValue>;
}

export async function getUsers(params: GetUsersParams = {}): Promise<GetUsersResult> {
    const command = new ScanCommand({
        TableName: DYNAMO_USER_TABLE,
        Limit: params.limit,
        ExclusiveStartKey: params.exclusiveStartKey,
    });

    const result = await dynamo.send(command);

    return {
        items: (result.Items ?? []).map((item) =>
            new AppUser(unmarshall(item) as Partial<AppUser>)),
        lastEvaluatedKey: result.LastEvaluatedKey,
    };
}

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

export async function markUserInactive(chatId: string | number): Promise<void> {
    const command = new UpdateItemCommand({
        TableName: DYNAMO_USER_TABLE,
        Key: {
            chat_id: {N: String(chatId)},
        },
        UpdateExpression: 'SET is_active = :false',
        ExpressionAttributeValues: {
            ':false': {N: '0'},
        },
    });

    await dynamo.send(command);
}

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

export async function logSentMessage(params: SentMessageLog): Promise<void> {
    const {chatId, text, promptRef} = params;
    const timestamp = new Date().toISOString();

    const command = new PutItemCommand({
        TableName: DYNAMO_MESSAGE_LOG_TABLE,
        Item: {
            chat_id: {N: String(chatId)},
            timestamp: {S: timestamp},
            text: {S: text},
            prompt_ref: {S: promptRef || 'unknown'},
        },
    });

    try {
        await dynamo.send(command);
    } catch (error) {
        logError('Failed to log message:', error);
    }
}
