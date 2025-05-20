import {
    DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand, UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import {log} from "../utils/logger.js";

const DYNAMO_USER_TABLE = "ka4-today-users";
const ACTIVE_USERS_INDEX = 'ActiveUsersIndex';

const dynamo = new DynamoDBClient();

/**
 * Ensures the Telegram user is present in DynamoDB.
 * @param {object} message - Telegram message object
 */
export async function ensureUserExists(message) {
    const chatId = message.chat?.id;
    if (!chatId || !isStartCommand(message)) return;

    const get = new GetItemCommand({
        TableName: DYNAMO_USER_TABLE,
        Key: {chat_id: {N: String(chatId)}},
    });

    const result = await dynamo.send(get);
    if (result.Item) {
        log(`Chat id: ${chatId} already present in db`)
        return;
    }

    const user = message.from || {};
    const chat = message.chat || {};

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
 * Fetch all active users using GSI.
 * Limits results if provided.
 * @param {number} [limit] - Optional maximum number of users to return
 * @returns {Promise<Array<Object>>}
 */
export async function getActiveUsers(limit) {
    const command = new QueryCommand({
        TableName: DYNAMO_USER_TABLE,
        IndexName: ACTIVE_USERS_INDEX,
        KeyConditionExpression: 'is_active = :true',
        ExpressionAttributeValues: {
            ':true': {N: '1'},
        },
        ProjectionExpression: 'chat_id',
        Limit: limit,
    });

    const response = await dynamo.send(command);
    return response.Items || [];
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

export function isStartCommand(message) {
    return message?.text?.trim() === '/start';
}

export const userService = {
    ensureUserExists, getActiveUsers, markUserInactive
};