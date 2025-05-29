import {
    BatchGetItemCommand,
    DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand, UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import {unmarshall} from "@aws-sdk/util-dynamodb";
import {log} from "../utils/logger.js";
import {DYNAMODB_ENDPOINT, OPENAI_DEFAULT_PROMPT} from "../config/env.js";
import {BadRequestError} from "../utils/errors.js";
import {DEFAULT_BATCH_SIZE, DEFAULT_PROMPT_VERSION} from "../config/constants.js";

const DYNAMO_USER_TABLE = "ka4-today-users";
const DYNAMO_USERS_SCHEDULE_TABLE = "ka4-today-users-training-schedule";
const USERS_SCHEDULE_INDEX = "ScheduleByDay";

const DYNAMO_PROMPT_TABLE = "ka4-today-prompts";

const dynamo = new DynamoDBClient({endpoint: DYNAMODB_ENDPOINT || undefined});

export const dynamoDbService = {
    getUser,
    ensureUserExists,
    markUserInactive,
    getUsersScheduledForDay,
    getPrompt
};

/**
 * Ensures the Telegram user is present in DynamoDB.
 * @param {object} context - command context
 */
export async function ensureUserExists(context) {
    const chatId = context.chatId;

    const get = new GetItemCommand({
        TableName: DYNAMO_USER_TABLE,
        Key: {chat_id: {N: String(chatId)}},
    });

    const result = await dynamo.send(get);
    if (result.Item) {
        log(`Chat id: ${chatId} already present in db`)
        return;
    }

    const user = context.message.from || {};
    const chat = context.message.chat || {};

    const put = new PutItemCommand({
        TableName: DYNAMO_USER_TABLE,
        Item: {
            chat_id: {N: String(chatId)},
            username: user.username ? {S: user.username} : {NULL: true},
            first_name: user.first_name ? {S: user.first_name} : {NULL: true},
            last_name: user.last_name ? {S: user.last_name} : {NULL: true},
            language_code: user.language_code ? {S: user.language_code} : {NULL: true},
            chat_type: chat.type ? {S: chat.type} : {NULL: true},
            is_bot: {BOOL: !!user.is_bot},
            created_at: {S: new Date().toISOString()},
            is_active: {N: '1'},
        },
    });
    log(`Store chat id: ${chatId} into db`)
    await dynamo.send(put);
}

/**
 * Mark a user as inactive.
 * @param {string|number} chatId - Telegram chat ID to mark inactive.
 * @returns {Promise<void>}
 */
export async function markUserInactive(chatId) {
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

/**
 * Retrieves active users who have scheduled training on a specific day of the week.
 * @returns {Promise<Array>} - An array of matching records from the table.
 */
export async function getUsersScheduledForDay() {
    const dayOfWeek = getCurrentDayCode()
    const command = new QueryCommand({
        TableName: DYNAMO_USERS_SCHEDULE_TABLE,
        IndexName: USERS_SCHEDULE_INDEX,
        KeyConditionExpression: "day_of_week = :day",
        ExpressionAttributeValues: {
            ":day": {S: dayOfWeek},
        },
    });

    const scheduleResult = await dynamo.send(command);
    const scheduleItems = (scheduleResult.Items || []).map(unmarshall);

    const chatIds = (scheduleResult.Items || []).map(
        (item) => item.chat_id.N
    );

    if (chatIds.length === 0) return [];

    const keys = chatIds.map((id) => ({chat_id: {N: id}}));

    const users = await batchGetItems(
        DYNAMO_USER_TABLE,
        keys,
        "chat_id, is_active, username, language_code",
        (user) => user.is_active === 1 || user.is_active === "1"
    );
    const userMap = Object.fromEntries(users.map((u) => [String(u.chat_id), u]));
    return scheduleItems
        .map((item) => {
            const user = userMap[String(item.chat_id)];
            if (!user) return null;
            return {...item, user};
        })
        .filter(Boolean);
}

/**
 * Get user from DynamoDB.
 * @param {Number} chatId - user chat id
 */
export async function getUser(chatId) {
    const get = new GetItemCommand({
        TableName: DYNAMO_USER_TABLE,
        Key: {chat_id: {N: String(chatId)}},
    });

    const result = await dynamo.send(get);
    if (!result.Item) {
        throw new BadRequestError(`User for chat id: ${chatId} not found in db`)
    }
    return unmarshall(result.Item);
}

/**
 * Get prompt from DynamoDB.
 * @param {String} lang - prompt language
 * @param {String} promptId - get prompt by reference
 */
export async function getPrompt(lang, promptId) {
    if (!promptId) {
        log("🟡 Prompt ID is not provided — using default prompt.");
        return OPENAI_DEFAULT_PROMPT
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
        throw new BadRequestError(`Prompt: ${promptId} not found in db`)
    }

    const item = unmarshall(result.Item);

    if (!item.prompts || !item.prompts[lang]) {
        throw new BadRequestError(`Prompt '${promptId}' has no translation for language '${lang}'.`);
    }

    return item.prompts[lang];
}

/**
 * Returns the current day of the week as a 3-letter uppercase code.
 * @returns {string} Day of the week, e.g., "MON", "TUE", "WED"
 */
function getCurrentDayCode() {
    const DAYS_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const today = new Date().getDay(); // 0 (Sunday) to 6 (Saturday)
    return DAYS_SHORT[today];
}


/**
 * Fetches items from a DynamoDB table in batches of 100 by primary key.
 * Optionally filters and maps the unmarshalled items.
 *
 * @param {string} tableName - The name of the DynamoDB table.
 * @param {Array<Object>} keys - Array of primary key objects (e.g., [{ chat_id: { N: "123" }}]).
 * @param {string} projection - Optional ProjectionExpression.
 * @param {(item: any) => boolean} [filterFn] - Optional filter function.
 * @returns {Promise<Array>} - Array of unmarshalled (and optionally filtered) items.
 */
async function batchGetItems(tableName, keys, projection, filterFn) {
    const result = [];

    for (let i = 0; i < keys.length; i += DEFAULT_BATCH_SIZE) {
        const chunk = keys.slice(i, i + DEFAULT_BATCH_SIZE);

        const batchResult = await dynamo.send(
            new BatchGetItemCommand({
                RequestItems: {
                    [tableName]: {
                        Keys: chunk,
                        ...(projection && {ProjectionExpression: projection}),
                    },
                },
            })
        );

        const items = batchResult.Responses?.[tableName] || [];

        for (const raw of items) {
            const item = unmarshall(raw);
            if (!filterFn || filterFn(item)) {
                result.push(item);
            }
        }
    }

    return result;
}
