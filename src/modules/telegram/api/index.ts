import {withAppInitialization} from '../../../app/withAppInitialization.js';
import {createRouteKeyController} from '../../../shared/http/controllers/createRouteKeyController.js';
import {handleBodyMeasurementsCreate} from '../handlers/bodyMeasurements.js';

const routeHandler = createRouteKeyController('telegram-api', {
    'POST /tg/body-measurements': handleBodyMeasurementsCreate,
});

export const handler = withAppInitialization(routeHandler);
