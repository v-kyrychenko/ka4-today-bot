import type {AttributeValue} from '@aws-sdk/client-dynamodb';
import {dynamoDbService} from '../../../../infrastructure/persistence/dynamodb/legacy/dynamoDbService.js';

export const clientsRepository = {
    findAll,
};

export async function findAll(params: {
    limit: number;
    cursor?: Record<string, AttributeValue>;
}) {
    return dynamoDbService.getUsers({
        limit: params.limit,
        exclusiveStartKey: params.cursor,
    });
}
