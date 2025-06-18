import {AthenaClient, StartQueryExecutionCommand, GetQueryResultsCommand} from "@aws-sdk/client-athena";
import {S3Client, GetObjectCommand, PutObjectCommand} from "@aws-sdk/client-s3";
import crypto from "crypto";
import {parse} from "csv-parse/sync";
import {pollUntil} from "../utils/poller.js";
import {POLLING} from "../config/constants.js";

const athena = new AthenaClient({region: process.env.AWS_REGION || "eu-central-1"});
const s3 = new S3Client({region: process.env.AWS_REGION || "eu-central-1"});

const BUCKET = process.env.ATHENA_CACHE_BUCKET;
const OUTPUT_LOCATION = process.env.ATHENA_OUTPUT_LOCATION;
const DATABASE = process.env.ATHENA_DATABASE;

const AthenaQueryCacheService = {
    executeCachedQuery: async (query) => {
        const hash = getQueryHash(query);
        const key = `athena-cache/${hash}.csv`;

        const cached = await fetchFromCache(key);
        if (cached) return cached;

        const queryExecutionId = await runAthenaQuery(query);
        await waitForQueryToFinish(queryExecutionId);
        const {records, headers} = await getQueryResults(queryExecutionId);
        await saveToCache(key, headers, records);
        return records;
    }
};

const getQueryHash = (query) => crypto.createHash("md5").update(query).digest("hex");

const fetchFromCache = async (key) => {
    try {
        const cached = await s3.send(new GetObjectCommand({Bucket: BUCKET, Key: key}));
        const body = await cached.Body.transformToString();
        const records = parse(body, {
            columns: true,
            skip_empty_lines: true
        });
        return records;
    } catch (err) {
        if (err.name !== 'NoSuchKey') throw err;
        return null;
    }
};

const runAthenaQuery = async (query) => {
    const startQuery = new StartQueryExecutionCommand({
        QueryString: query,
        QueryExecutionContext: {Database: DATABASE},
        ResultConfiguration: {OutputLocation: OUTPUT_LOCATION}
    });

    const {QueryExecutionId} = await athena.send(startQuery);
    return QueryExecutionId;
};

const waitForQueryToFinish = async (queryExecutionId) => {
    const success = await pollUntil(
        async () => {
            const status = await athena.send(new GetQueryResultsCommand({QueryExecutionId: queryExecutionId}));
            const state = status.QueryExecution.Status.State;
            if (state === "FAILED") throw new Error("Athena query failed");
            return state === "SUCCEEDED";
        },
        POLLING.DELAY_MS,
        POLLING.MAX_RETRIES);

    if (!success) throw new Error("Athena query timeout");
};

const getQueryResults = async (queryExecutionId) => {
    const resultData = await athena.send(new GetQueryResultsCommand({QueryExecutionId: queryExecutionId}));
    const rows = resultData.ResultSet.Rows;
    const headers = rows[0].Data.map((d) => d.VarCharValue);

    const records = rows.slice(1).map((row) => {
        const obj = {};
        row.Data.forEach((d, i) => {
            obj[headers[i]] = d?.VarCharValue ?? null;
        });
        return obj;
    });

    return {records, headers};
};

const saveToCache = async (key, headers, records) => {
    const csv = [headers.join(",")].concat(
        records.map((row) => headers.map((h) => JSON.stringify(row[h] ?? "")).join(","))
    ).join("\n");

    await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: csv,
        ContentType: "text/csv"
    }));
};

export default AthenaQueryCacheService;
