import type {ClientUpdateInput} from '../domain/client.js';
import {clientsRepository} from '../repository/clientsRepository.js';

export async function updateClient(coachId: number, clientId: number, input: ClientUpdateInput) {
    return clientsRepository.update(coachId, clientId, input);
}
