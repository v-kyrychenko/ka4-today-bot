import {log} from "./logger.js";

export async function pollUntil(checkFn, delayMs, maxTries) {
    for (let attempt = 0; attempt < maxTries; attempt++) {
        const result = await checkFn();
        log(`Poll attempt ${attempt + 1}/${maxTries}: ${result ? '✅' : 'waiting...'}`);
        if (result) return true;
        await wait(delayMs);
    }
    return false;
}

function wait(ms) {
    return new Promise((res) => setTimeout(res, ms));
}
