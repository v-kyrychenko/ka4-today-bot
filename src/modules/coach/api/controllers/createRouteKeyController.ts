import {getHttpMethod, jsonResponse} from '../../../../shared/http/apiHelpers.js';
import {toErrorResponse} from '../../../../shared/http/errorResponse.js';
import {logError} from '../../../../shared/logging/index.js';
import type {ApiGatewayHttpEvent, LambdaResponse} from '../../../../shared/types/aws.js';

import type {ApiAction} from './createMethodController.js';

export type RouteKeyMap = Record<string, ApiAction>;

export function createRouteKeyController(controllerName: string, routes: RouteKeyMap): ApiAction {
    return async (event: ApiGatewayHttpEvent): Promise<LambdaResponse> => {
        const routeKey = buildRouteKey(event);
        const action = routes[routeKey];

        if (!action) {
            return jsonResponse(405, {message: 'Method Not Allowed'});
        }

        try {
            return await action(event);
        } catch (error) {
            logError(`Failed to process ${controllerName} request`, error);
            return toErrorResponse(error);
        }
    };
}

function buildRouteKey(event: ApiGatewayHttpEvent): string {
    const routeKey = event.requestContext?.routeKey;
    if (routeKey) {
        return routeKey;
    }

    const method = getHttpMethod(event);
    const path = event.requestContext?.http?.path ?? '';
    return `${method} ${path}`;
}
