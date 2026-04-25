import {withAppInitialization} from '../../../../app/withAppInitialization.js';
import {createRouteKeyController} from '../../../../shared/http/controllers/createRouteKeyController.js';
import {handleExerciseGet} from '../handlers/exercise.js';

const routeHandler = createRouteKeyController('api', {
    'GET /exercise': handleExerciseGet,
});

export const handler = withAppInitialization(routeHandler);
