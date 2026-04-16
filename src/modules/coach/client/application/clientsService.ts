import type {AttributeValue} from '@aws-sdk/client-dynamodb';
import {clientsRepository} from '../repository/clientsRepository.js';

export const clientsService = {
    listClients,
    getClientById,
    createClient,
};

export async function listClients(input: {
    limit: number;
    cursor?: Record<string, AttributeValue>;
}) {
    return clientsRepository.findAll(input);
}

export async function getClientById(clientId: string) {
    return {
        message: 'Not Implemented',
        clientId,
    };
}

export async function createClient(_input?: unknown) {
    return {
        message: 'Not Implemented',
    };
}
