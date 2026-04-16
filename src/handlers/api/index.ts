import {createRouteKeyController} from '../controllers/createRouteKeyController.js';
import {handleClientsCreate, handleClientsGet} from './clients.js';
import {handleExerciseGet} from './exercise.js';

export const handler = createRouteKeyController('api', {
    'GET /clients': handleClientsGet,
    'GET /clients/{clientId}': handleClientsGet,
    'POST /clients': handleClientsCreate,
    'GET /exercise': handleExerciseGet,
});
