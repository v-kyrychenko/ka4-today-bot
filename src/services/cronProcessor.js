import {userService} from './userService.js';
import {telegramService} from './telegramService.js';
import {fetchOpenAiReply} from './mainProcessor.js';
import {log, logError} from '../utils/logger.js';
import {MAX_DAILY_USERS} from '../config/constants.js';

export async function cronProcessor() {
    try {
        const users = await userService.getUsersScheduledForDay();

        log(`📬 Will attempt to send message to ${users.length} users (max limit: ${MAX_DAILY_USERS})`);
    //     let sent = 0;
    //
    //     for (const user of users) {
    //         try {
    //             const reply = await fetchOpenAiReply();
    //             await telegramService.sendMessage(user.chat_id.N, reply);
    //             sent++;
    //         } catch (e) {
    //             if (e.message.includes('Forbidden') || e.message.includes('user is deactivated')) {
    //                 await userService.markUserInactive(user.chat_id.N);
    //                 log(`🗑️ Removed user ${user.chat_id.N} (no longer reachable)`);
    //             } else {
    //                 logError(`❌ Failed to send message to ${user.chat_id.N}`, e);
    //             }
    //         }
    //     }
    //     log(`✅ Messages sent: ${sent}/${users.length}`);
    } catch (err) {
        logError('🔥 Failed during daily mainProcessor execution', err);
        throw err;
    }
}
