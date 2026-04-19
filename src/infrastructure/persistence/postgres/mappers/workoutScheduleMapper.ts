import {PromptDict} from '../../../../modules/telegram/domain/prompt.js';
import {WorkoutSchedule} from '../../../../modules/telegram/domain/workout.js';
import type {TgUserRow} from '../models/tgUserRow.js';
import type {WorkoutScheduleRow} from '../models/workoutScheduleRow.js';
import {tgUserMapper} from './tgUserMapper.js';

export const workoutScheduleMapper = {
    toAppModel,
};

export function toAppModel(
    scheduleRow: WorkoutScheduleRow,
    userRow: TgUserRow,
    prompt: Pick<PromptDict, 'id' | 'key'>
): WorkoutSchedule {
    return new WorkoutSchedule({
        id: scheduleRow.id,
        dayOfWeek: scheduleRow.day_of_week,
        client: tgUserMapper.toAppModel(userRow),
        dictPrompt: new PromptDict({
            id: prompt.id,
            key: prompt.key,
        }),
    });
}
