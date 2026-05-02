export interface LambdaResponse {
    statusCode: number;
    body: string;
}

export function buildSuccessResponse(): LambdaResponse {
    return {
        statusCode: 200,
        body: JSON.stringify({ok: true}),
    };
}

export function buildResponse(statusCode: number, message: string): LambdaResponse {
    return {
        statusCode,
        body: JSON.stringify({message}),
    };
}

export interface ApiGatewayHttpEvent {
    requestContext?: {
        routeKey?: string;
        http?: {
            method?: string;
            path?: string;
        };
    };
    headers?: Record<string, string | undefined>;
    queryStringParameters?: Record<string, string | undefined> | null;
    pathParameters?: Record<string, string | undefined> | null;
    body?: string | null;
}

export interface SqsRecord {
    body: string;
}

export interface SqsEvent {
    Records: SqsRecord[];
}
