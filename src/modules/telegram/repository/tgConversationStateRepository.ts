import {and, eq, lte} from 'drizzle-orm';
import {getPostgresDb} from '../../../infrastructure/persistence/postgres/postgresDb.js';
import {tgConversationState} from '../../../infrastructure/persistence/postgres/schema/tgConversationState.js';
import {nowIso} from '../../../shared/utils/dateUtils.js';

const DEFAULT_CURRENT_STEP = 'WAITING_INPUT';
const DEFAULT_TTL_MINUTES = 30;
const EXPIRED_STEP = 'EXPIRED';
const REPLACED_STEP = 'REPLACED';

type PostgresTransaction = Parameters<Parameters<ReturnType<typeof getPostgresDb>['transaction']>[0]>[0];

export interface TgConversationStateRow {
    id: number;
    chat_id: number;
    type: string;
    current_step: string;
    data: unknown;
    last_bot_msg_id: number | null;
    is_active: boolean;
    expires_at: string;
    created_at: string;
    updated_at: string;
}

export interface StartConversationInput {
    chatId: number;
    type: string;
    currentStep?: string;
    data?: unknown;
    ttlMinutes?: number;
    lastBotMsgId?: number | null;
}

export interface UpdateConversationInput {
    id: number;
    currentStep?: string;
    data?: unknown;
    lastBotMsgId?: number | null;
}

export interface DeactivateConversationInput {
    id: number;
    finalStep: string;
}

export const tgConversationStateRepository = {
    findActiveByChatId,
    deactivateActiveByChatId,
    startConversation,
    updateConversation,
    deactivateConversation,
    expireOutdated,
};

export async function findActiveByChatId(chatId: number): Promise<TgConversationStateRow | null> {
    const [row] = await getPostgresDb()
        .select()
        .from(tgConversationState)
        .where(and(
            eq(tgConversationState.chat_id, chatId),
            eq(tgConversationState.is_active, true),
        ))
        .limit(1);

    if (!row) {
        return null;
    }

    if (isExpired(row.expires_at)) {
        await deactivateConversation({id: row.id, finalStep: EXPIRED_STEP});
        return null;
    }

    return row as TgConversationStateRow;
}

export async function deactivateActiveByChatId(
    chatId: number,
    finalStep = 'CANCELLED',
): Promise<TgConversationStateRow | null> {
    const [row] = await getPostgresDb()
        .update(tgConversationState)
        .set({
            is_active: false,
            current_step: finalStep,
            updated_at: nowIso(),
        })
        .where(and(
            eq(tgConversationState.chat_id, chatId),
            eq(tgConversationState.is_active, true),
        ))
        .returning();

    return (row as TgConversationStateRow | undefined) ?? null;
}

export async function startConversation(input: StartConversationInput): Promise<TgConversationStateRow> {
    return getPostgresDb().transaction(async (tx) => {
        const now = nowIso();

        await deactivatePreviousActiveConversations(tx, input.chatId, now);

        const [row] = await tx
            .insert(tgConversationState)
            .values(toCreateValues(input, now))
            .returning();

        return row as TgConversationStateRow;
    });
}

export async function updateConversation(input: UpdateConversationInput): Promise<TgConversationStateRow | null> {
    const [row] = await getPostgresDb()
        .update(tgConversationState)
        .set(toUpdateValues(input))
        .where(and(
            eq(tgConversationState.id, input.id),
            eq(tgConversationState.is_active, true),
        ))
        .returning();

    return (row as TgConversationStateRow | undefined) ?? null;
}

export async function deactivateConversation(
    input: DeactivateConversationInput,
): Promise<TgConversationStateRow | null> {
    const [row] = await getPostgresDb()
        .update(tgConversationState)
        .set({
            is_active: false,
            current_step: input.finalStep,
            updated_at: nowIso(),
        })
        .where(and(
            eq(tgConversationState.id, input.id),
            eq(tgConversationState.is_active, true),
        ))
        .returning();

    return (row as TgConversationStateRow | undefined) ?? null;
}

export async function expireOutdated(): Promise<TgConversationStateRow[]> {
    const rows = await getPostgresDb()
        .update(tgConversationState)
        .set({
            is_active: false,
            current_step: EXPIRED_STEP,
            updated_at: nowIso(),
        })
        .where(and(
            eq(tgConversationState.is_active, true),
            lte(tgConversationState.expires_at, nowIso()),
        ))
        .returning();

    return rows as TgConversationStateRow[];
}

async function deactivatePreviousActiveConversations(
    tx: PostgresTransaction,
    chatId: number,
    now: string,
): Promise<void> {
    await tx
        .update(tgConversationState)
        .set({
            is_active: false,
            current_step: REPLACED_STEP,
            updated_at: now,
        })
        .where(and(
            eq(tgConversationState.chat_id, chatId),
            eq(tgConversationState.is_active, true),
        ));
}

function toCreateValues(input: StartConversationInput, now: string) {
    return {
        chat_id: input.chatId,
        type: input.type,
        current_step: input.currentStep ?? DEFAULT_CURRENT_STEP,
        data: input.data ?? {},
        last_bot_msg_id: input.lastBotMsgId ?? null,
        is_active: true,
        expires_at: expiresAtIso(input.ttlMinutes ?? DEFAULT_TTL_MINUTES),
        created_at: now,
        updated_at: now,
    };
}

function toUpdateValues(input: UpdateConversationInput) {
    const values: {
        current_step?: string;
        data?: unknown;
        last_bot_msg_id?: number | null;
        updated_at: string;
    } = {updated_at: nowIso()};

    if (input.currentStep != null) {
        values.current_step = input.currentStep;
    }

    if (input.data !== undefined) {
        values.data = input.data;
    }

    if (input.lastBotMsgId !== undefined) {
        values.last_bot_msg_id = input.lastBotMsgId;
    }

    return values;
}

function isExpired(expiresAt: string): boolean {
    return new Date(expiresAt).getTime() <= Date.now();
}

function expiresAtIso(ttlMinutes: number): string {
    return new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
}
