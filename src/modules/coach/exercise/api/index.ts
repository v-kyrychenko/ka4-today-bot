import {createRouteKeyController} from '../../../../shared/http/controllers/createRouteKeyController.js';
import {handleExerciseGet} from '../handlers/exercise.js';

export const handler = createRouteKeyController('api', {
    'GET /exercise': handleExerciseGet,
});
