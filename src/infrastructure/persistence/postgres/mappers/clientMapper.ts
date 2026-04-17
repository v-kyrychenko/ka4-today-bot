import {
    ClientItem,
    type ClientCreateInput,
    type ClientUpdateInput,
} from '../../../../modules/coach/client/domain/client.js';
import type {ClientRow} from '../models/clientRow.js';

export interface ClientCreateRow {
    coach_id: number;
    first_name: string;
    last_name: string;
    status: string;
    lang: string;
    birthday: string;
    created_at: string;
    goals: string | null;
    notes: string | null;
}

export interface ClientUpdateRow {
    first_name?: string;
    last_name?: string;
    status?: string;
    lang?: string;
    birthday?: string;
    goals?: string | null;
    notes?: string | null;
}

export const clientMapper = {
    toAppModel,
    toCreateRow,
    toUpdateRow,
};

export function toAppModel(row: ClientRow): ClientItem {
    return new ClientItem({
        id: row.id,
        coachId: row.coach_id,
        firstName: row.first_name,
        lastName: row.last_name,
        status: row.status,
        lang: row.lang,
        birthday: row.birthday,
        createdAt: row.created_at,
        lastActivity: row.last_activity,
        goals: row.goals,
        notes: row.notes,
    });
}

export function toCreateRow(input: ClientCreateInput, coachId: number, createdAt: string): ClientCreateRow {
    return {
        coach_id: coachId,
        first_name: input.firstName,
        last_name: input.lastName,
        status: input.status,
        lang: input.lang,
        birthday: input.birthday,
        created_at: createdAt,
        goals: input.goals ?? null,
        notes: input.notes ?? null,
    };
}

export function toUpdateRow(input: ClientUpdateInput): ClientUpdateRow {
    const update: ClientUpdateRow = {};

    if (input.firstName !== undefined) {
        update.first_name = input.firstName;
    }
    if (input.lastName !== undefined) {
        update.last_name = input.lastName;
    }
    if (input.status !== undefined) {
        update.status = input.status;
    }
    if (input.lang !== undefined) {
        update.lang = input.lang;
    }
    if (input.birthday !== undefined) {
        update.birthday = input.birthday;
    }
    if (input.goals !== undefined) {
        update.goals = input.goals;
    }
    if (input.notes !== undefined) {
        update.notes = input.notes;
    }

    return update;
}
