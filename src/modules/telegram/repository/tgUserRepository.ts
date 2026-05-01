import {CLIENT_STATUS_INACTIVE} from '../../coach/client/domain/client.js';
import {and, eq} from 'drizzle-orm';
import {workoutScheduleMapper} from '../../../infrastructure/persistence/postgres/mappers/workoutScheduleMapper.js';
import {tgUserMapper} from '../../../infrastructure/persistence/postgres/mappers/tgUserMapper.js';
import {getPostgresDb} from '../../../infrastructure/persistence/postgres/postgresDb.js';
import {isPostgresUniqueViolation} from '../../../infrastructure/persistence/postgres/postgresErrors.js';
import {client} from '../../../infrastructure/persistence/postgres/schema/client.js';
import {dictPrompt} from '../../../infrastructure/persistence/postgres/schema/dictPrompt.js';
import {tgUser} from '../../../infrastructure/persistence/postgres/schema/tgUser.js';
import {workout} from '../../../infrastructure/persistence/postgres/schema/workout.js';
import {workoutSchedule} from '../../../infrastructure/persistence/postgres/schema/workoutSchedule.js';
import {BadRequestError} from '../../../shared/errors';
import {getCurrentDayCode} from '../../../shared/utils/dayOfWeek.js';
import {TelegramMessage} from '../domain/telegram.js';
import {WorkoutSchedule} from '../domain/workout.js';

export const tgUserRepository = {
    getUsersScheduledForDay,
    getUserScheduledForDay,
    getOrCreateUser,
    findByChatId,
    findActiveByChatId,
    markInactive,
};

export async function getUsersScheduledForDay(dayOfWeek = getCurrentDayCode()): Promise<WorkoutSchedule[]> {
    const rows = await findScheduledRows(dayOfWeek);
    return rows.flatMap(mapScheduledRow);
}

export async function getUserScheduledForDay(
    chatId: number,
    dayOfWeek = getCurrentDayCode()
): Promise<WorkoutSchedule | null> {
    const rows = await findScheduledRows(dayOfWeek, chatId);
    const [scheduled] = rows.flatMap(mapScheduledRow);

    return scheduled ?? null;
}

export async function getOrCreateUser(chatId: number, message: TelegramMessage) {
    const existing = await findByChatId(chatId);
    if (existing) {
        return existing;
    }

    try {
        const [created] = await getPostgresDb()
            .insert(tgUser)
            .values(tgUserMapper.toCreateRow(chatId, message.from))
            .returning();

        return tgUserMapper.toAppModel(created);
    } catch (error) {
        if (isPostgresUniqueViolation(error)) {
            const user = await findByChatId(chatId);
            if (user) {
                return user;
            }

            throw new BadRequestError(`User for chat id: ${chatId} not found after retry`);
        }

        throw error;
    }
}

export async function markInactive(chatId: number): Promise<boolean> {
    return getPostgresDb().transaction(async (tx) => {
        const [user] = await tx
            .select({
                chatId: tgUser.chat_id,
                clientId: tgUser.client_id,
                isActive: tgUser.is_active,
            })
            .from(tgUser)
            .where(eq(tgUser.chat_id, chatId))
            .limit(1);

        if (!user) {
            return false;
        }

        if (user.isActive) {
            await tx
                .update(tgUser)
                .set({is_active: false})
                .where(eq(tgUser.chat_id, chatId));
        }

        if (user.clientId != null) {
            await tx
                .update(client)
                .set({status: CLIENT_STATUS_INACTIVE})
                .where(eq(client.id, user.clientId));
        }

        return true;
    });
}

async function findByChatId(chatId: number) {
    const [row] = await getPostgresDb()
        .select()
        .from(tgUser)
        .where(eq(tgUser.chat_id, chatId))
        .limit(1);

    return row ? tgUserMapper.toAppModel(row) : null;
}

async function findActiveByChatId(chatId: number) {
    const [row] = await getPostgresDb()
        .select()
        .from(tgUser)
        .where(and(
            eq(tgUser.chat_id, chatId),
            eq(tgUser.is_active, true),
        ))
        .limit(1);

    return row ? tgUserMapper.toAppModel(row) : null;
}

async function findScheduledRows(dayOfWeek: string, chatId?: number) {
    const conditions = [
        eq(workoutSchedule.day_of_week, dayOfWeek),
        eq(tgUser.is_active, true),
    ];

    if (chatId != null) {
        conditions.push(eq(tgUser.chat_id, chatId));
    }

    return getPostgresDb()
        .select({
            schedule: workoutSchedule,
            user: tgUser,
            workout,
            promptId: dictPrompt.id,
            promptKey: dictPrompt.key,
        })
        .from(workoutSchedule)
        .innerJoin(tgUser, eq(workoutSchedule.client_id, tgUser.client_id))
        .innerJoin(workout, eq(workoutSchedule.workout_id, workout.id))
        .innerJoin(dictPrompt, eq(workoutSchedule.dict_prompt_id, dictPrompt.id))
        .where(and(...conditions));
}

function mapScheduledRow(row: Awaited<ReturnType<typeof findScheduledRows>>[number]): WorkoutSchedule[] {
    const promptRef = row.promptKey?.trim();
    if (!promptRef) {
        return [];
    }

    return [workoutScheduleMapper.toAppModel(row.schedule, row.user, row.workout, {
        id: row.promptId,
        key: promptRef,
    })];
}
