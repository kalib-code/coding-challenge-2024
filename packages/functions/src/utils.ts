import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { Table } from "sst/node/table";

const client = new DynamoDBClient({});

const docClient = DynamoDBDocumentClient.from(client);

const BUCKET_ID = "rateLimiter";
const BUCKET_CAPACITY = 45;
const LEAK_RATE = 1; // Leak rate in segments per second

const getBucketState = async (
    bucketId: string,
): Promise<
    | {
          count: number;
          lastUpdate: number;
      }
    | any
> => {
    const command = new GetCommand({
        TableName: Table.Table.tableName,
        Key: {
            BucketId: bucketId,
        },
    });
    const result = await docClient.send(command);
    return result.Item || { count: 0, lastUpdate: Date.now() };
};

const updateBucketState = async (
    bucketId: string,
    newState: { count: number; lastUpdate: number },
) => {
    const command = new PutCommand({
        TableName: Table.Table.tableName,
        Item: {
            BucketId: bucketId,
            count: newState.count,
            lastUpdate: newState.lastUpdate,
        },
        ConditionExpression:
            "attribute_not_exists(BucketId) OR lastUpdate <= :lastUpdate",
        ExpressionAttributeValues: {
            ":lastUpdate": newState.lastUpdate,
        },
    });
    await docClient.send(command);
};

export const canSendSegments = async (segments: number) => {
    while (true) {
        const bucket = await getBucketState(BUCKET_ID);
        const now = Date.now();
        const elapsedTime = (now - bucket.lastUpdate) / 1000;
        const leakedAmount = Math.floor(elapsedTime * LEAK_RATE);
        bucket.count = Math.max(0, bucket.count - leakedAmount);
        bucket.lastUpdate = now;

        if (bucket.count + segments <= BUCKET_CAPACITY) {
            bucket.count += segments;
            try {
                await updateBucketState(BUCKET_ID, bucket);
                return true;
            } catch (error) {
                if (error.name === "ConditionalCheckFailedException") {
                    continue;
                }
                throw error;
            }
        } else {
            await updateBucketState(BUCKET_ID, bucket);
            return false;
        }
    }
};

// https://frightanic.com/software-development/regex-for-gsm-03-38-7bit-character-set/
const gsm7bitRegex = new RegExp(
    "^[A-Za-z0-9 \\r\\n@£$¥èéùìòÇØøÅå\u0394_\u03A6\u0393\u039B\u03A9\u03A0\u03A8\u03A3\u0398\u039EÆæßÉ!\"#$%&amp;'()*+,\\-./:;&lt;=&gt;?¡ÄÖÑÜ§¿äöñüà^{}\\\\\\[~\\]|\u20AC]*$",
);

const isUcs2 = (content: string): boolean => !gsm7bitRegex.test(content);

const getTotalLengthGSM = (content: string): number => {
    const charset7bitExtraChars = /[\f^{}\\[\]~|€]/g;
    const baseLength = content.length;
    const extraLength = (content.match(charset7bitExtraChars) || []).length;
    return baseLength + extraLength;
};

export const calculateSMS = (
    content: string,
): {
    segmentCount: number;
    encoding: string;
    segments: string[];
} => {
    if (!content) {
        return {
            segmentCount: 0,
            encoding: "GSM-7",
            segments: [],
        };
    }

    const is_ucs_2 = isUcs2(content);
    const parts: string[] = [];

    if (!is_ucs_2) {
        const total_length = getTotalLengthGSM(content);
        if (total_length <= 160) {
            return {
                segmentCount: 1,
                encoding: "GSM-7",
                segments: [content],
            };
        } else {
            let part = "";
            let current_length = 0;
            const max_length = 153; // 160 - 7 (UDH)

            for (const c of content) {
                const char_length = gsm7bitRegex.test(c) ? 1 : 2;
                if (current_length + char_length <= max_length) {
                    part += c;
                    current_length += char_length;
                } else {
                    parts.push(part);
                    part = c;
                    current_length = char_length;
                }
            }

            if (part) parts.push(part);

            return {
                segmentCount: parts.length,
                encoding: "GSM-7",
                segments: parts,
            };
        }
    } else {
        const max_length = 70;
        const sms_count = Math.ceil(content.length / max_length);

        for (let i = 0; i < sms_count; i++) {
            parts.push(content.substring(i * max_length, (i + 1) * max_length));
        }
        return {
            segmentCount: parts.length,
            encoding: "UCS-2",
            segments: parts,
        };
    }
};
