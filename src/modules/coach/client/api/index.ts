import {createRouteKeyController} from '../../../../shared/http/controllers/createRouteKeyController.js';
import {handleClientsCreate, handleClientsGet, handleClientsUpdate} from '../handlers/clients.js';

export const handler = createRouteKeyController('api', {
    'GET /clients': handleClientsGet,
    'GET /clients/{clientId}': handleClientsGet,
    'POST /clients': handleClientsCreate,
    'PUT /clients/{clientId}': handleClientsUpdate,
});
