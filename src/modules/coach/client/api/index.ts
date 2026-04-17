import {createRouteKeyController} from '../../../../shared/http/controllers/createRouteKeyController.js';
import {handleClientsCreate, handleClientsGet, handleClientsUpdate} from '../handlers/clients.js';

export const handler = createRouteKeyController('api', {
    'GET /coaches/{id}/clients': handleClientsGet,
    'GET /coaches/{id}/clients/{clientId}': handleClientsGet,
    'POST /coaches/{id}/clients': handleClientsCreate,
    'PUT /coaches/{id}/clients/{clientId}': handleClientsUpdate,
});
