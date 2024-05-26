# Text Message Marketing Campaign Micro-Service

## Overview

This project implements a text message marketing campaign micro-service designed to handle high-throughput text message sending with a rate limit of 45 segments per second. It includes robust error handling, rate limiting, and logging mechanisms.

## Features

-   **Message Queuing**: Handles incoming text message requests, calculates segments, and queues them for processing.
-   **Rate Limiting**: Ensures the sending rate does not exceed 45 segments per second.
-   **Error Handling**: Implements retry logic and logs errors and successes.
-   **API Gateway**: Exposes the `QueueMessage` function as a RESTful endpoint.

## Project Structure

```
|-- packages/
|   |-- functions/
|       |-- src/
|           |-- utils.ts
|           |-- message.ts
|           |-- queueMessage.ts
|       |-- test/
|           |-- utils.specs.ts
|-- README.md
|-- .gitignore
|-- package.json
|-- tsconfig.json
|-- packages/
|   |-- stacks/
|           |-- MyStacks.ts
|-- sst.config.ts
```

## Prerequisites

-   Node.js (version 14 or higher)
-   AWS Account (for deploying AWS resources such as Lambda, SQS, DynamoDB)
-   TypeScript
-   SST (Serverless Stack)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/text-message-campaign.git
cd text-message-campaign
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Everything is configured in the `sst.config.ts` file.

### 4. Set Up AWS Resources

Make use you install aws cli and configure your credentials. docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html

### 5. Deploy the Service (using Serverless Framework as an example)

```bash
npx sst deploy

```

### 6. Run Tests

```bash
npm sst test
```

## Usage

### API Endpoints

#### QueueMessage

**Endpoint**: `POST /send`
**Description**: Queues new text message requests.

**Payload**:

```json
{
    "message": "Your SMS content here"
}
```

**Response**:

-   **200 OK**: Messages queued successfully.
-   **400 Bad Request**: Validation error or invalid payload.
-   **500 Internal Server Error**: Server error.

### Example Request

```bash
curl -X POST https://your-api-endpoint/send \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello, this is a test message."}'
```

## Code Overview

### `src/utils.ts`

Contains utility functions:

-   `canSendSegments()`: Implements a leaky bucket algorithm to enforce rate limiting.
-   `getBucketState()` and `updateBucketState()`: Manage leaky bucket state using DynamoDB.

### `src/message.ts`

Contains the `processMessage` function for sending segments while respecting the rate limit.

### `src/queueMessage.ts`

Contains the Lambda handler for queuing messages, validating input, calculating segments, and sending chunks to SQS.

### `test/utils.specs.ts`

Contains test placeholders for unit testing the utility functions.

## Error Handling

-   Implements retry logic with exponential backoff for handling transient errors.
-   Logs errors and successes to the console (consider using AWS CloudWatch for production).

# Scalability and Performance

-   instead of dynamoDB we can use redis for storing the bucket state as it is faster and more scalable.
-   using Dead Letter Queues (DLQ) for handling failed messages. This allows us to reprocess failed messages and ensure no message is lost.
-   using AWS Lambda Provisioned Concurrency to reduce cold starts and improve performance.
-   adding cloudwatch alarms to monitor the service and set up autoscaling based on the number of messages in the queue.
