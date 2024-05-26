import { APIGatewayProxyEventV2 } from "aws-lambda";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { Queue } from "sst/node/queue";
import { v4 as uuidv4 } from "uuid";
import { calculateSMS } from "./utils";
import Joi from "joi";

const client = new SQSClient({});

const messageSchema = Joi.object({
    message: Joi.string().required(),
});

const validate = (body: any) => {
    const { error } = messageSchema.validate(body);
    if (error) throw new Error(`Validation Error: ${error.details[0].message}`);
};

const retry = async (fn: () => Promise<any>, retries = 3, delay = 500) => {
    try {
        return await fn();
    } catch (err) {
        if (retries === 0) {
            throw err;
        }
        await new Promise((res) => setTimeout(res, delay));
        return retry(fn, retries - 1, delay * 2); // Exponential backoff
    }
};

export const handler = async (event: APIGatewayProxyEventV2) => {
    if (event.headers.method !== "POST") {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: "Method Not Allowed" }),
        };
    }

    try {
        const body = JSON.parse(event.body as string) as any;
        validate(body);

        const message = calculateSMS(body.message);
        const { segments, ...others } = message;

        const chunks = message.segments.reduce((acc, part, index) => {
            const chunkIndex = Math.floor(index / 44);
            if (!acc[chunkIndex]) {
                acc[chunkIndex] = [];
            }
            acc[chunkIndex].push(part);
            return acc;
        }, [] as string[][]);

        for (let index = 0; index < chunks.length; index++) {
            const chunk = chunks[index];
            const chunkMessage = {
                index,
                ...others,
                parts: chunk,
            };
            const chunkCommand = new SendMessageCommand({
                QueueUrl: Queue.Queue.queueUrl,
                MessageGroupId: "HireMeChallenge",
                MessageDeduplicationId: uuidv4(),
                MessageBody: JSON.stringify(chunkMessage),
            });
            try {
                await retry(() => client.send(chunkCommand));
                console.log("Successfully sent chunk index:", index);
            } catch (error) {
                console.error("Error queuing message:", error);
                return {
                    statusCode: 500,
                    body: JSON.stringify({ error: "Internal server error" }),
                };
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Messages queued successfully" }),
        };
    } catch (error: any) {
        console.error("Error handling request:", error);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
