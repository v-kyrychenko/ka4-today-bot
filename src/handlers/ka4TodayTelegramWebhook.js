import {LambdaClient, InvokeCommand} from "@aws-sdk/client-lambda";
import {TELEGRAM_SECURITY_TOKEN} from '../config/env.js';
import {ASYNC_TELEGRAM_PROCESSOR} from "../config/constants.js";

const lambdaClient = new LambdaClient();

export const handler = async (event) => {
    if (!isAuthorized(event.headers)) {
        return buildResponse(401, 'Unauthorized');
    }

    const request = JSON.parse(event.body);

    //async invoke
    const command = new InvokeCommand({
        FunctionName: ASYNC_TELEGRAM_PROCESSOR,
        InvocationType: "Event",
        Payload: Buffer.from(JSON.stringify({request})),
    });

    await lambdaClient.send(command);

    return {
        statusCode: 200,
        body: JSON.stringify({ok: true}),
    };
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
