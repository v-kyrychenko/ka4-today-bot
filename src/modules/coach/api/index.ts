import {createRouteKeyController} from '../../../shared/http/controllers/createRouteKeyController.js';
import {handleClientsCreate, handleClientsGet, handleClientsUpdate} from '../client/handlers/clients.js';
import {handleExerciseGet} from '../exercise/handlers/exercise.js';

export const handler = createRouteKeyController('api', {
    'GET /clients': handleClientsGet,
    'GET /clients/{clientId}': handleClientsGet,
    'POST /clients': handleClientsCreate,
    'PUT /clients/{clientId}': handleClientsUpdate,

    'GET /exercise': handleExerciseGet,
});
