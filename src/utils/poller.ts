import {log} from './logger.js';

export async function pollUntil(
    checkFn: () => Promise<boolean>,
    delayMs: number,
    maxTries: number
): Promise<boolean> {
    for (let attempt = 0; attempt < maxTries; attempt += 1) {
        const result = await checkFn();
        log(`Poll attempt ${attempt + 1}/${maxTries}: ${result ? 'OK' : 'waiting...'}`);
        if (result) return true;
        await wait(delayMs);
    }
    return false;
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
