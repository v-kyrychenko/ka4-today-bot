import {
    BatchGetItemCommand,
    DynamoDBClient,
    GetItemCommand,
    PutItemCommand,
    QueryCommand,
    UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import {unmarshall} from "@aws-sdk/util-dynamodb";
import {log, logError} from "../utils/logger.js";
import {DYNAMODB_ENDPOINT} from "../config/env.js";
import {BadRequestError} from "../utils/errors.js";
import {DEFAULT_BATCH_SIZE, DEFAULT_PROMPT_VERSION} from "../config/constants.js";

const DYNAMO_USER_TABLE = "ka4-today-users";
const DYNAMO_USERS_SCHEDULE_TABLE = "ka4-today-users-training-schedule";
const USERS_SCHEDULE_INDEX = "ScheduleByDay";

const DYNAMO_PROMPT_TABLE = "ka4-today-prompts";
const DYNAMO_MESSAGE_LOG_TABLE = "ka4-today-log";

const dynamo = new DynamoDBClient({endpoint: DYNAMODB_ENDPOINT || undefined});

export const dynamoDbService = {
    getUser,
    getOrCreateUser,
    markUserInactive,
    getUsersScheduledForDay,
    getUserScheduledForDay,
    getPrompt,
    logSentMessage
};

/**
 * Retrieves a user from DynamoDB by chat ID.
 *
 * @param {number} chatId - The Telegram chat ID of the user.
 * @param {boolean} [throwIfNotFound=true] - Whether to throw an error if the user is not found.
 * @returns {Promise<object|null>} - The user object, or null if not found and throwIfNotFound is false.
 * @throws {BadRequestError} - If user is not found and throwIfNotFound is true (default).
 */
export async function getUser(chatId, throwIfNotFound = true) {
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

    return unmarshall(result.Item);
}


/**
 * Retrieves a Telegram user from the database, or creates one if it does not exist.
 * Ensures atomic creation using a conditional PutItem.
 * Safe against race conditions (retries fetch on ConditionalCheckFailed).
 *
 * @param {number} chatId - Telegram chat ID (numeric).
 * @param {object} message - Telegram message object, must contain `from` and `chat`.
 * @returns {Promise<object>} - The existing or newly created user object.
 */
export async function getOrCreateUser(chatId, message) {
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
        log(`🆕 Created user ${chatId}`);
        return unmarshall(item);
    } catch (err) {
        if (err.name === 'ConditionalCheckFailedException') {
            log(`⚠️ Race detected, reloading user ${chatId}`);
            return await getUser(chatId);
        }
        throw err;
    }
}

/**
 * Builds a DynamoDB item for a Telegram user.
 *
 * @param {number} chatId - Telegram chat ID.
 * @param {object} message - Telegram message object with `from` and `chat`.
 * @returns {object} - DynamoDB formatted item for PutItemCommand.
 */
function buildUserItem(chatId, message) {
    const user = message?.from || {};
    const chat = message?.chat || {};

    return {
        chat_id: {N: String(chatId)},
        username: user.username ? {S: user.username} : {NULL: true},
        first_name: user.first_name ? {S: user.first_name} : {NULL: true},
        last_name: user.last_name ? {S: user.last_name} : {NULL: true},
        language_code: user.language_code ? {S: user.language_code} : {NULL: true},
        chat_type: chat.type ? {S: chat.type} : {NULL: true},
        is_bot: {BOOL: !!user.is_bot},
        created_at: {S: new Date().toISOString()},
        is_active: {N: '1'},
    };
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
 * Returns today's training schedule entry for a specific user (if any).
 * Queries the ScheduleByDay GSI for the current weekday and filters by chatId.
 *
 * @param {number|string} chatId - Telegram chat ID.
 * @returns {Promise<object|null>} Resolves with the matched schedule item or null if none.
 */
export async function getUserScheduledForDay(chatId) {
    const day = getCurrentDayCode();
    const resp = await dynamo.send(new QueryCommand({
        TableName: DYNAMO_USERS_SCHEDULE_TABLE,
        IndexName: USERS_SCHEDULE_INDEX,
        KeyConditionExpression: "day_of_week = :day",
        ExpressionAttributeValues: {":day": {S: day}},
    }));

    const items = (resp.Items || []).map(unmarshall);
    const match = items.find(i => String(i.chat_id) === String(chatId));
    return match || null;
}

/**
 * Get prompt from DynamoDB.
 * @param {String} lang - prompt language
 * @param {String} promptId - get prompt by reference
 */
export async function getPrompt(lang, promptId) {
    if (!promptId) {
        throw new BadRequestError("🟡 Prompt ID is not provided");
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

    return item;
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

/**
 * Logs a sent message to DynamoDB for auditing and traceability purposes.
 *
 * @param {Object} params - The message details to log.
 * @param {number} params.chatId - The Telegram chat ID of the user.
 * @param {string} params.text - The message text that was sent.
 * @param {string} [params.promptRef] - Reference ID of the prompt used (if any).
 * @returns {Promise<void>} Resolves after logging the message or logs error on failure.
 */
export async function logSentMessage({chatId, text, promptRef}) {
    const timestamp = new Date().toISOString();

    const command = new PutItemCommand({
        TableName: DYNAMO_MESSAGE_LOG_TABLE,
        Item: {
            chat_id: {N: String(chatId)},
            timestamp: {S: timestamp},
            text: {S: text},
            prompt_ref: {S: promptRef || "unknown"}
        },
    });

    try {
        await dynamo.send(command);
    } catch (err) {
        logError("❌ Failed to log message:", err);
    }
}
