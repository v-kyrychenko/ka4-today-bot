export interface LambdaResponse {
    statusCode: number;
    body: string;
}

export interface ApiGatewayHttpEvent {
    requestContext?: {
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
