import {clientsRepository} from '../repository/clientsRepository.js';

export async function getClientById(coachId: number, clientId: number) {
    return clientsRepository.findById(coachId, clientId);
}
