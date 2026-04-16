import type {AttributeValue} from '@aws-sdk/client-dynamodb';
import {PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT} from '../../../../app/config/constants.js';
import {getPathParam, jsonResponse} from '../../../../shared/http/apiHelpers.js';
import {encodeDynamoCursor, parseDynamoCursor} from '../../../../shared/pagination/dynamoCursor.js';
import {parsePageRequest} from '../../../../shared/pagination/pageRequest.js';
import type {ApiGatewayHttpEvent, LambdaResponse} from '../../../../shared/types/aws.js';
import {createClient} from '../application/createClient.js';
import {getClientById} from '../application/getClient.js';
import {listClients} from '../application/listClients.js';
import {updateClient} from '../application/updateClient.js';

export async function handleClientsGet(event: ApiGatewayHttpEvent): Promise<LambdaResponse> {
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
    const result = await listClients(pageRequest);

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

    return jsonResponse(501, await getClientById(clientId));
}

export async function handleClientsCreate(event: ApiGatewayHttpEvent): Promise<LambdaResponse> {
    return jsonResponse(501, await createClient(event.body));
}

export async function handleClientsUpdate(event: ApiGatewayHttpEvent): Promise<LambdaResponse> {
    const clientId = getPathParam(event, 'clientId');

    return jsonResponse(501, await updateClient(clientId, event.body));
}
