import {SQSClient, SendMessageCommand} from '@aws-sdk/client-sqs';
import {TELEGRAM_SECURITY_TOKEN} from '../config/env.js';
import {MAIN_MESSAGE_QUEUE_URL} from "../config/env.js";
import {logError} from "../utils/logger.js";

const sqsClient = new SQSClient();

export const handler = async (event) => {
    if (!isAuthorized(event.headers)) {
        return buildResponse(401, 'Unauthorized');
    }

    try {
        const request = JSON.parse(event.body);
        await sendToQueue({request});

        return {
            statusCode: 200,
            body: JSON.stringify({ok: true}),
        };
    } catch (err) {
        logError("❌ Failed to process webhook", err);
        return buildResponse(500, 'Internal Server Error');
    }
};

function isAuthorized(headers = {}) {
    return headers['x-telegram-bot-api-secret-token'] === TELEGRAM_SECURITY_TOKEN;
}

function buildResponse(statusCode, message) {
    return {
        statusCode,
        body: JSON.stringify({message}),
    };
}

/**
 * Sends a given payload to the SQS message queue.
 * @param {Object} payload - The message payload to send.
 * @returns {Promise<void>}
 */
async function sendToQueue(payload) {
    const command = new SendMessageCommand({
        QueueUrl: MAIN_MESSAGE_QUEUE_URL,
        MessageBody: JSON.stringify(payload),
    });

    await sqsClient.send(command);
}
