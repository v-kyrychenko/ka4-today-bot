import {log} from '../utils/logger.js';
import {InvokeCommand, LambdaClient} from "@aws-sdk/client-lambda";
import {ASYNC_TELEGRAM_PROCESSOR} from "../config/constants.js";
import {dynamoDbService} from "../services/dynamoDbService.js";

const lambdaClient = new LambdaClient();

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
                const payload = createLambdaRequest(item);
                log(`📤 Invoking Lambda for chat_id=${item.chat_id}, prompt_ref=${item.prompt_ref}`);
                await invokeTelegramProcessor(payload);
            })
        );
    } catch (err) {
        log("🔥 Daily cron failed", err);
        throw err;
    }

    log("✅ Daily cron finished");
};

/**
 * Constructs a Lambda invocation payload for a Telegram message.
 *
 * This function prepares the input structure required by the Telegram webhook-compatible
 * Lambda function. The payload includes a message object with the chat ID and a fixed
 * text command (`/daily_greeting`), along with a prompt reference used to generate
 * the assistant's response.
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
function createLambdaRequest(item) {
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
 * Asynchronously invokes the Telegram processing Lambda function.
 *
 * This function sends a fire-and-forget ("Event" type) invocation
 * to the `ASYNC_TELEGRAM_PROCESSOR` Lambda, allowing Telegram messages
 * to be processed independently of the current execution flow.
 *
 * @param {object} payload - The payload to send to the Lambda function.
 *
 * @returns {Promise<void>} A Promise that resolves when the Lambda invocation
 *   request has been successfully sent.
 *
 * @throws {Error} Throws if the Lambda invocation fails to be dispatched.
 */
async function invokeTelegramProcessor(payload) {
    const command = new InvokeCommand({
        FunctionName: ASYNC_TELEGRAM_PROCESSOR,
        InvocationType: "Event",
        Payload: Buffer.from(JSON.stringify(payload)),
    });
    await lambdaClient.send(command);
}