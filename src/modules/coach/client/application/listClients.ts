import type {ClientListRequest} from '../domain/client.js';
import {clientsRepository} from '../repository/clientsRepository.js';

export async function listClients(input: ClientListRequest) {
    return clientsRepository.findAll(input);
}
