import { StackContext, Api, Queue, Table } from "sst/constructs";
import { Duration } from "aws-cdk-lib";

export function API({ stack }: StackContext) {
    const table = new Table(stack, "Table", {
        fields: {
            BucketId: "string",
            count: "number",
            lastUpdate: "number",
        },
        primaryIndex: { partitionKey: "BucketId" },
    });

    const queue = new Queue(stack, "Queue", {
        consumer: {
            function: {
                handler: "packages/functions/src/message.handler",
                bind: [table],
            },
        },

        cdk: {
            queue: {
                fifo: true,
                visibilityTimeout: Duration.seconds(20),
            },
        },
    });

    const api = new Api(stack, "api", {
        defaults: {
            function: {
                bind: [queue, table],
            },
        },
        routes: {
            "POST /send": "packages/functions/src/queueMessage.handler",
        },
    });

    stack.addOutputs({
        ApiEndpoint: api.url,
    });
}
