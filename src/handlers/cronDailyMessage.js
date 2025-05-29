import {log} from '../utils/logger.js';
import {InvokeCommand, LambdaClient} from "@aws-sdk/client-lambda";
import {ASYNC_TELEGRAM_PROCESSOR} from "../config/constants.js";
import {dynamoDbService} from "../services/dynamoDbService.js";

const lambdaClient = new LambdaClient();
/**
 * AWS Lambda handler for scheduled daily message.
 * @returns {Promise<void>}
 */
export const handler = async () => {
    log('🕐 Daily cron started');
    try {
        const request = {}
        const users = await dynamoDbService.getUsersScheduledForDay();

        for (const user of users) {
            const command = new InvokeCommand({
                FunctionName: ASYNC_TELEGRAM_PROCESSOR,
                InvocationType: "Event",
                Payload: Buffer.from(JSON.stringify(request)),
            });
            await lambdaClient.send(command);

        }
    } catch (err) {
        log('🔥 Daily cron failed', err);
        throw err;
    }
    log('✅ Daily cron finished');
};