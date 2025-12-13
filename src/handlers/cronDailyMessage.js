import {log} from '../utils/logger.js';
import {SQSClient, SendMessageCommand} from '@aws-sdk/client-sqs';
import {dynamoDbService} from "../services/dynamoDbService.js";
import {MAIN_MESSAGE_QUEUE_URL} from "../config/env.js";

const sqsClient = new SQSClient();

/**
 * AWS Lambda handler triggered by a daily scheduled event.
 *
 * - Fetches all users who have training scheduled for the current day.
 * - For each user, it asynchronously invokes a Lambda function to handle their daily greeting.
 *
 * @returns {Promise<void>} Resolves when all invocation requests have been sent.
 */
export const handler = async () => {
    log("🕐 Daily cron started");

    try {
        const scheduledUsers = await dynamoDbService.getUsersScheduledForDay();

        await Promise.all(
            scheduledUsers.map(async (item) => {
                const payload = createRequest(item);
                await sendToQueue(payload);
            })
        );
    } catch (err) {
        log("🔥 Daily cron failed", err);
        throw err;
    }

    log("✅ Daily cron finished");
};

/**
 * Constructs a invocation payload for a asyncTelegramProcessor.js.
 *
 * This function prepares the input structure required by the Telegram webhook-compatible
 * Lambda function. The payload includes a message object with the chat ID and a fixed
 * text command (`/daily_greeting`), along with a prompt reference used to generate the response.
 *
 * @param {object} item - The input object containing user-specific data.
 * @param {number} item.chat_id - The Telegram chat ID of the recipient user.
 * @param {string} item.prompt_ref - Reference ID of the prompt to be used for the message.
 *
 * @returns {object} The structured payload to be sent to the Lambda function. Example:
 *   {
 *     request: {
 *       message: {
 *         promptRef: "chest_default",
 *         text: "/daily_greeting",
 *         chat: {
 *           id: 123456789
 *         }
 *       }
 *     }
 *   }
 */
function createRequest(item) {
    return {
        request: {
            message: {
                promptRef: item.prompt_ref,
                text: "/daily_greeting",
                chat: {
                    id: item.chat_id,
                },
            },
        },
    };
}

/**
 * Sends the message to the SQS queue.
 *
 * @param {object} payload - The structured payload to be enqueued.
 * @returns {Promise<void>}
 */
async function sendToQueue(payload) {
    const msg = JSON.stringify(payload)
    log(`📩 Sending to queue:${MAIN_MESSAGE_QUEUE_URL} payload:${msg}`);
    const command = new SendMessageCommand({
        QueueUrl: MAIN_MESSAGE_QUEUE_URL,
        MessageBody: msg,
    });

    await sqsClient.send(command);
}