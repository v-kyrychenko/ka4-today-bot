import type {AttributeValue} from '@aws-sdk/client-dynamodb';
import {PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT} from '../../config/constants.js';
import {dynamoDbService} from '../../services/dynamoDbService.js';
import {BadRequestError} from '../../utils/errors.js';
import {logError} from '../../utils/logger.js';
import type {ApiGatewayHttpEvent, LambdaResponse} from '../../models/aws.js';
import {
    getHttpMethod,
    getPathParam,
    getQueryParam,
    jsonResponse,
    parseOptionalInteger,
} from '../../utils/api.js';

export const handler = async (event: ApiGatewayHttpEvent): Promise<LambdaResponse> => {
    const method = getHttpMethod(event);

    try {
        switch (method) {
            case 'GET':
                return handleGet(event);
            case 'POST':
                return handleCreate();
            default:
                return jsonResponse(405, {message: 'Method Not Allowed'});
        }
    } catch (error) {
        logError('Failed to fetch clients', error);
        const err = error as Error & { statusCode?: number };

        return jsonResponse(err.statusCode ?? 500, {
            message: err.message || 'Internal Server Error',
        });
    }
};

async function handleGet(event: ApiGatewayHttpEvent): Promise<LambdaResponse> {
    if (event.pathParameters?.clientId) {
        return handleGetById(event);
    }

    return handleList(event);
}

function parseCursor(cursor?: string): Record<string, AttributeValue> | undefined {
    if (!cursor) return undefined;

    try {
        const json = decodeCursor(cursor);
        return JSON.parse(json) as Record<string, AttributeValue>;
    } catch {
        throw new BadRequestError("Query param 'cursor' must be a valid pagination token");
    }
}

function encodeCursor(cursor: Record<string, AttributeValue>): string {
    return encodeURIComponent(JSON.stringify(cursor));
}

function decodeCursor(value: string): string {
    return decodeURIComponent(value);
}

async function handleList(event: ApiGatewayHttpEvent): Promise<LambdaResponse> {
    const limit = parseOptionalInteger(getQueryParam(event, 'limit'), {
        defaultValue: PAGINATION_DEFAULT_LIMIT,
        min: 1,
        max: PAGINATION_MAX_LIMIT,
        name: 'limit',
    });
    const cursor = parseCursor(getQueryParam(event, 'cursor'));
    const result = await dynamoDbService.getUsers({
        limit,
        exclusiveStartKey: cursor,
    });

    return jsonResponse(200, {
        items: result.items,
        pagination: {
            limit,
            nextCursor: result.lastEvaluatedKey ? encodeCursor(result.lastEvaluatedKey) : null,
        },
    });
}

async function handleGetById(event: ApiGatewayHttpEvent): Promise<LambdaResponse> {
    const clientId = getPathParam(event, 'clientId');

    return jsonResponse(501, {
        message: 'Not Implemented',
        clientId,
    });
}

async function handleCreate(): Promise<LambdaResponse> {
    return jsonResponse(501, {
        message: 'Not Implemented',
    });
}
