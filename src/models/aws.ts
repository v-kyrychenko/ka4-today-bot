export interface LambdaResponse {
    statusCode: number;
    body: string;
}

export interface ApiGatewayHttpEvent {
    headers?: Record<string, string | undefined>;
    body?: string | null;
}

export interface SqsRecord {
    body: string;
}

export interface SqsEvent {
    Records: SqsRecord[];
}
