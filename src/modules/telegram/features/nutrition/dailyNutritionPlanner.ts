import {ClientGender, ClientProfile} from '../../../coach/client/domain/client.js';
import {BodyMeasurement, type BodyMeasurementCreateInput} from '../measurements/bodyMeasurementsModel.js';

export interface DailyNutritionPlannerRequest {
    clientId: number;
    gender: ClientGender;
    birthday: string;
    goals?: string | null;
    weight: BodyMeasurement;
}

export interface DailyNutritionPlan {
//TODO
}


export async function generate(request: DailyNutritionPlannerRequest): Promise<DailyNutritionPlan> {


    return {}
}