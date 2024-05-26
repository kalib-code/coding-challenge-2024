import { SQSEvent } from "aws-lambda";
import { canSendSegments } from "./utils";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const processMessage = async (messageBody: {
    segmentCount: number;
    encoding: string;
    parts: string[];
}) => {
    const { parts } = messageBody;

    // If the message itself exceeds 45 segments, process in chunks
    let remainingSegments = parts.length;
    while (remainingSegments > 0) {
        const segmentsToSend = Math.min(remainingSegments, 45);

        // Check if we can send this chunk of segments
        if (!(await canSendSegments(segmentsToSend))) {
            console.log("Rate limit exceeded, delaying retry...");
            await delay(1000 - (Date.now() % 1000)); // Delay until the next second
            continue; // Retry in the next iteration
        }

        console.log("Sending segments:", parts.slice(0, segmentsToSend));

        // Simulate sending the segments to the external service e.g. Twilio API
        // await sendSegments(parts.slice(0, segmentsToSend));
        remainingSegments -= segmentsToSend;
    }
};

export const handler = async (event: SQSEvent) => {
    if (!event.Records || event.Records.length === 0) {
        console.log("No records found in the event");
        return;
    }

    const records: any[] = event.Records;
    const parts = JSON.parse(records[0].body) as {
        segmentCount: number;
        encoding: string;
        parts: string[];
        index?: number;
    };

    if (parts.index !== undefined) {
        console.log("Processing chunk index:", parts.index);
    }

    await processMessage(parts);

    return;
};
