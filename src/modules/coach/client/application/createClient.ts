import type {ClientCreateInput} from '../domain/client.js';
import {clientsRepository} from '../repository/clientsRepository.js';

export async function createClient(coachId: number, input: ClientCreateInput) {
    return clientsRepository.create(coachId, input);
}
