import {
    PAGINATION_DEFAULT_LIMIT,
    PAGINATION_DEFAULT_PAGE,
    PAGINATION_MAX_LIMIT,
} from '../../../../app/config/constants.js';
import {BadRequestError} from '../../../../shared/errors';
import {
    assertAllowedKeys,
    getPathParam,
    getQueryParam,
    jsonResponse,
    parseOptionalInteger,
    parseOptionalNullableString,
    parseRequiredDate,
    parseRequiredString,
} from '../../../../shared/http/apiHelpers.js';
import {parseJsonBody} from '../../../../shared/http/requestBody.js';
import type {ApiGatewayHttpEvent, LambdaResponse} from '../../../../shared/types/aws.js';
import {createClient} from '../application/createClient.js';
import {getClientById} from '../application/getClient.js';
import {listClients} from '../application/listClients.js';
import {updateClient} from '../application/updateClient.js';
import {
    CLIENT_STATUSES,
    type ClientCreateInput,
    type ClientStatus,
    type ClientUpdateInput,
} from '../domain/client.js';

export async function handleClientsGet(event: ApiGatewayHttpEvent): Promise<LambdaResponse> {
    if (event.pathParameters?.clientId) {
        return handleGetById(event);
    }

    return handleList(event);
}

async function handleList(event: ApiGatewayHttpEvent): Promise<LambdaResponse> {
    const coachId = parseRequiredPositiveIntegerPathParam(event, 'id');
    const page = parseOptionalInteger(getQueryParam(event, 'page'), {
        defaultValue: PAGINATION_DEFAULT_PAGE || 1,
        min: 1,
        max: Number.MAX_SAFE_INTEGER,
        name: 'page',
    });
    const limit = parseOptionalInteger(getQueryParam(event, 'limit'), {
        defaultValue: PAGINATION_DEFAULT_LIMIT,
        min: 1,
        max: PAGINATION_MAX_LIMIT,
        name: 'limit',
    });
    const result = await listClients({
        coachId,
        page,
        limit,
    });

    return jsonResponse(200, {
        items: result.items,
        pagination: {
            page,
            limit,
            total: result.total,
        },
    });
}

async function handleGetById(event: ApiGatewayHttpEvent): Promise<LambdaResponse> {
    const coachId = parseRequiredPositiveIntegerPathParam(event, 'id');
    const clientId = parseRequiredPositiveIntegerPathParam(event, 'clientId');

    return jsonResponse(200, await getClientById(coachId, clientId));
}

export async function handleClientsCreate(event: ApiGatewayHttpEvent): Promise<LambdaResponse> {
    const coachId = parseRequiredPositiveIntegerPathParam(event, 'id');

    return jsonResponse(201, await createClient(coachId, parseCreateInput(event)));
}

export async function handleClientsUpdate(event: ApiGatewayHttpEvent): Promise<LambdaResponse> {
    const coachId = parseRequiredPositiveIntegerPathParam(event, 'id');
    const clientId = parseRequiredPositiveIntegerPathParam(event, 'clientId');

    return jsonResponse(200, await updateClient(coachId, clientId, parseUpdateInput(event)));
}

function parseCreateInput(event: ApiGatewayHttpEvent): ClientCreateInput {
    const body = parseRequestBody(event);
    assertAllowedKeys(body, ['firstName', 'lastName', 'status', 'lang', 'birthday', 'goals', 'notes']);

    return {
        firstName: parseRequiredString(body, 'firstName', 60),
        lastName: parseRequiredString(body, 'lastName', 60),
        status: parseClientStatus(body, 'status'),
        lang: parseRequiredString(body, 'lang', 10),
        birthday: parseRequiredDate(body, 'birthday'),
        goals: parseOptionalNullableString(body, 'goals'),
        notes: parseOptionalNullableString(body, 'notes'),
    };
}

function parseUpdateInput(event: ApiGatewayHttpEvent): ClientUpdateInput {
    const body = parseRequestBody(event);
    assertAllowedKeys(body, ['firstName', 'lastName', 'status', 'lang', 'birthday', 'goals', 'notes']);

    const input: ClientUpdateInput = {};

    if ('firstName' in body) {
        input.firstName = parseRequiredString(body, 'firstName', 60);
    }
    if ('lastName' in body) {
        input.lastName = parseRequiredString(body, 'lastName', 60);
    }
    if ('status' in body) {
        input.status = parseClientStatus(body, 'status');
    }
    if ('lang' in body) {
        input.lang = parseRequiredString(body, 'lang', 10);
    }
    if ('birthday' in body) {
        input.birthday = parseRequiredDate(body, 'birthday');
    }
    if ('goals' in body) {
        input.goals = parseOptionalNullableString(body, 'goals');
    }
    if ('notes' in body) {
        input.notes = parseOptionalNullableString(body, 'notes');
    }

    if (Object.keys(input).length === 0) {
        throw new BadRequestError('Request body must include at least one updatable field');
    }

    return input;
}

function parseRequestBody(event: ApiGatewayHttpEvent): Record<string, unknown> {
    const body = parseJsonBody<unknown>(event);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new BadRequestError('Request body must be a JSON object');
    }

    return body as Record<string, unknown>;
}

function parseRequiredPositiveIntegerPathParam(event: ApiGatewayHttpEvent, name: string): number {
    const value = getPathParam(event, name);
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new BadRequestError(`Path param '${name}' must be a positive integer`);
    }

    return parsed;
}

function parseClientStatus(body: Record<string, unknown>, name: string): ClientStatus {
    const value = parseRequiredString(body, name, 20);

    if (!CLIENT_STATUSES.includes(value as ClientStatus)) {
        throw new BadRequestError(`Field '${name}' must be one of: ${CLIENT_STATUSES.join(', ')}`);
    }

    return value as ClientStatus;
}
