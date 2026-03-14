import type {AttributeValue} from '@aws-sdk/client-dynamodb';
import {PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT} from '../../config/constants.js';
import {createMethodController} from '../../controllers/createMethodController.js';
import {clientsService} from '../../services/clientsService.js';
import type {ApiGatewayHttpEvent, LambdaResponse} from '../../models/aws.js';
import {
    getPathParam,
    jsonResponse,
} from '../../utils/api.js';
import {encodeDynamoCursor, parseDynamoCursor} from '../../utils/pagination/dynamoCursor.js';
import {parsePageRequest} from '../../utils/pagination/pageRequest.js';

export const handler = createMethodController('clients', {
    GET: handleGet,
    POST: handleCreate,
});

async function handleGet(event: ApiGatewayHttpEvent): Promise<LambdaResponse> {
    if (event.pathParameters?.clientId) {
        return handleGetById(event);
    }

    return handleList(event);
}

async function handleList(event: ApiGatewayHttpEvent): Promise<LambdaResponse> {
    const pageRequest = parsePageRequest<Record<string, AttributeValue>>(event, {
        defaultLimit: PAGINATION_DEFAULT_LIMIT,
        maxLimit: PAGINATION_MAX_LIMIT,
        parseCursor: parseDynamoCursor,
    });
    const result = await clientsService.listClients(pageRequest);

    return jsonResponse(200, {
        items: result.items,
        pagination: {
            limit: pageRequest.limit,
            nextCursor: result.lastEvaluatedKey ? encodeDynamoCursor(result.lastEvaluatedKey) : null,
        },
    });
}

async function handleGetById(event: ApiGatewayHttpEvent): Promise<LambdaResponse> {
    const clientId = getPathParam(event, 'clientId');

    return jsonResponse(501, await clientsService.getClientById(clientId));
}

async function handleCreate(event: ApiGatewayHttpEvent): Promise<LambdaResponse> {
    return jsonResponse(501, await clientsService.createClient(event.body));
}
