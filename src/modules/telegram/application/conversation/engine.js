
// 3. Implement `conversationEngine`.
//
//     Required methods:
//     - start(chatId, type)
//     - handleText(chatId, text)
//     - handleCallback(chatId, callbackData, messageId)
//     - cancel(chatId)
//
// Behavior:
//     - `start` resolves the conversation definition from registry, creates conversation_state, and returns the first Telegram message payload.
// - `handleText` loads active state by chatId, resolves the conversation definition and current step handler, then delegates to that handler.
// - `handleCallback` does the same for callback actions.
// - `cancel` deactivates active conversation and returns a cancellation message.
// - If no active conversation exists, return null so normal router can continue.
// - If conversation type or step is unknown, deactivate it as `FAILED` and return a safe error mess