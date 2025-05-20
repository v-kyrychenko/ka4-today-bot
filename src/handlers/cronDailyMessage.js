import {log} from '../utils/logger.js';
import {cronProcessor} from '../services/cronProcessor.js';

/**
 * AWS Lambda handler for scheduled daily message.
 * @returns {Promise<void>}
 */
export const handler = async () => {
    log('🕐 Daily cron started');

    try {
        await cronProcessor();
        log('✅ Daily cron finished');
    } catch (err) {
        log('🔥 Daily cron failed', err);
        throw err;
    }
};