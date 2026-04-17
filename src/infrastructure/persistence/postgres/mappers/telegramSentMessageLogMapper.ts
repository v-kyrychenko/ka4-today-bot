export interface TelegramSentMessageLogInput {
    chatId: number;
    promptRef?: string | null;
    messageText: string;
}

export interface TgMsgCreateRow {
    chat_id: number;
    dict_prompt_id: number | null;
    created_at: string;
    msg: string;
}

export const telegramSentMessageLogMapper = {
    toCreateRow,
};

export function toCreateRow(
    input: TelegramSentMessageLogInput,
    dictPromptId: number | null,
    createdAt: string
): TgMsgCreateRow {
    return {
        chat_id: input.chatId,
        dict_prompt_id: dictPromptId,
        created_at: createdAt,
        msg: input.messageText,
    };
}
