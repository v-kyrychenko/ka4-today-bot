import {getHttpMethod, jsonResponse} from '../../../../shared/http/apiHelpers.js';
import {toErrorResponse} from '../../../../shared/http/errorResponse.js';
import {logError} from '../../../../shared/logging/index.js';
import type {ApiGatewayHttpEvent, LambdaResponse} from '../../../../shared/types/aws.js';

export type ApiAction = (event: ApiGatewayHttpEvent) => Promise<LambdaResponse>;
export type MethodMap = Partial<Record<string, ApiAction>>;

export function createMethodController(controllerName: string, methods: MethodMap): ApiAction {
    return async (event: ApiGatewayHttpEvent): Promise<LambdaResponse> => {
        const method = getHttpMethod(event);
        const action = methods[method];

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
