import type {AttributeValue} from '@aws-sdk/client-dynamodb';
import {clientsRepository} from '../repository/clientsRepository.js';

export async function listClients(input: {
    limit: number;
    cursor?: Record<string, AttributeValue>;
}) {
    return clientsRepository.findAll(input);
}
