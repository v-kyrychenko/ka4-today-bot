import {createHmac} from 'node:crypto';
import 'dotenv/config';

const TELEGRAM_WEB_APP_DATA_PUBLIC_KEY = 'WebAppData';

const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
    throw new Error('Set TELEGRAM_BOT_TOKEN before running this generator');
}

const user = {
    id: parsePositiveInteger(process.env.TG_USER_ID ?? '1', 'TG_USER_ID'),
    first_name: process.env.TG_FIRST_NAME ?? 'Api',
    last_name: process.env.TG_LAST_NAME ?? 'Tester',
    username: process.env.TG_USERNAME ?? 'api_tester',
    language_code: process.env.TG_LANG ?? 'en',
    is_bot: false,
};

const initData = buildInitData({
    auth_date: process.env.TG_AUTH_DATE ?? Math.floor(Date.now() / 1000).toString(),
    query_id: process.env.TG_QUERY_ID ?? 'local-test-query',
    user: JSON.stringify(user),
});

const requestBody = {
    initData,
    measuredAt: process.env.MEASURED_AT ?? new Date().toISOString().slice(0, 10),
    measurements: [
        {type: 'WEIGHT', value: 80.1, unit: 'kg'},
        {type: 'WAIST', value: 90.2, unit: 'cm'},
        {type: 'CHEST', value: 101.3, unit: 'cm'},
    ],
};

console.log(JSON.stringify(requestBody, null, 4));

function buildInitData(fields) {
    const hash = createHash(fields);
    const params = new URLSearchParams(fields);
    params.set('hash', hash);

    return params.toString();
}

function createHash(fields) {
    const dataCheckString = Object.entries(fields)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    const secretKey = createHmac('sha256', TELEGRAM_WEB_APP_DATA_PUBLIC_KEY)
        .update(botToken)
        .digest();

    return createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');
}

function parsePositiveInteger(value, name) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }

    return parsed;
}
