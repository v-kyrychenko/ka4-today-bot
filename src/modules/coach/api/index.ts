import {createRouteKeyController} from '../../../shared/http/controllers/createRouteKeyController.js';
import {handleClientsCreate, handleClientsGet} from '../client/handlers/clients.js';
import {handleExerciseGet} from '../exercise/handlers/exercise.js';

export const handler = createRouteKeyController('api', {
    'GET /clients': handleClientsGet,
    'GET /clients/{clientId}': handleClientsGet,
    'POST /clients': handleClientsCreate,

    'GET /exercise': handleExerciseGet,
});
