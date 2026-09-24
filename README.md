# AWS SQS & SNS Node.js Client

A small web UI for exercising AWS SNS and SQS: create queues and topics, wire them together, send and receive messages. It works against real AWS or a local emulator such as [LocalStack](https://github.com/localstack/localstack).

Built on Node.js, Express 5, EJS and the AWS SDK for JavaScript v3.

## Screenshots
Receiving a message from a queue:

![Receive message from an SQS queue](screenshots/sqs.png)

Listing SNS subscriptions:

![List SNS subscriptions](screenshots/sns.png)

Dark mode follows your system setting:

![Subscribe a queue to a topic, dark mode](screenshots/dark.png)

## Features

### SQS
- Create queues
- List queues (follows pagination, so every queue is returned)
- Get queue URL
- Get queue attributes
- Send a message to a queue
- Receive a message from a queue
- Delete a message from a queue
- Purge all messages from a queue
- Delete queues
- Set a queue policy that lets an SNS topic deliver to the queue

### SNS
- Create topics
- Subscribe a queue to a topic
- Subscribe an email address to a topic
- Publish a message to a topic
- List topics
- Delete topics
- List subscriptions
- Delete (unsubscribe) subscriptions

After each call the form fields are pre-filled from the response. Creating a queue fills in its URL, for example, and getting its attributes fills in its ARN. This lets you step through a full SNS → SQS setup without copying ARNs around.

## Requirements
- Node.js 20 or later

## Installation

```
git clone https://github.com/ajyounguk/aws-sqs-sns-client
cd aws-sqs-sns-client
npm install
```

## AWS credentials

You can supply credentials in either of two ways.

**Option 1: the standard AWS credential chain (recommended).** If `config/aws-config.json` doesn't exist, the app uses the SDK's default provider chain: `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` env vars, `~/.aws/credentials`, `AWS_PROFILE`, SSO, or an instance or container role. Set the region with `AWS_REGION`.

```
AWS_PROFILE=my-profile AWS_REGION=eu-west-2 npm start
```

**Option 2: a local config file.**

```
cp config/aws-config-sample.json config/aws-config.json
```

Then edit `accessKeyId`, `secretAccessKey` and `region`. `sessionToken` is optional. This file is git-ignored. Even so, take care not to commit your credentials.

### IAM permissions
The IAM user or role needs SQS and SNS access. `AmazonSQSFullAccess` and `AmazonSNSFullAccess` cover everything. Scope them down if you're only using part of the app.

## Using LocalStack (or another endpoint)

To send requests to a local emulator or proxy, override the endpoints. Either set env vars:

```
SQS_ENDPOINT=http://localhost:4566 SNS_ENDPOINT=http://localhost:4566 AWS_REGION=us-east-1 npm start
```

or create an override file (git-ignored):

```
cp config/aws-override-sample.json config/aws-override.json
```

The sample points at LocalStack's default edge port (`4566`). Env vars take precedence over the file. LocalStack accepts any credentials, e.g. `AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test`.

## Running it

```
npm start
```

Open http://localhost:3000 and pick an action from the sidebar.

The badge in the top-right corner shows where requests are going: red for real AWS, green for a local endpoint such as LocalStack, amber for any other endpoint. Destructive actions (purge, delete queue, delete topic, unsubscribe) ask for confirmation first. After an action runs, the page reloads cleanly, so refreshing never repeats it.

| Env var | Default     | Purpose |
|---------|-------------|---------|
| `PORT`  | `3000`      | Listen port |
| `HOST`  | `127.0.0.1` | Listen address. Set `HOST=0.0.0.0` to reach it from another machine or from outside a container |

> **Note:** there's no authentication, and the UI can delete queues and topics with whatever credentials you've given it. It listens on localhost only by default. Only expose it on a trusted network. The UI state (pre-filled fields and last responses) is shared by everyone connected, because it's meant as a single-user dev tool.

## Wiring a topic to a queue

1. **SQS → Create Queue**, then **SQS → Get Attributes** to capture the queue ARN.
2. **SNS → Create Topic**.
3. **SQS → Set Policy**. This adds a queue policy that lets `sns.amazonaws.com` send to the queue, restricted to that topic's ARN. See [info/example-queue-sub-policy](info/example-queue-sub-policy) for an example.
4. **SNS → Subscribe Queue**.
5. **SNS → Send Message**, then **SQS → Get Message** to see it arrive.

## Tests

```
npm test
```

The tests use Node's built-in test runner, [supertest](https://github.com/ladjs/supertest) and [aws-sdk-client-mock](https://github.com/m-radzikowski/aws-sdk-client-mock). They drive every route against mocked SQS and SNS clients, so they don't need AWS or LocalStack. They also cover the config loader and page rendering.

## Project layout

| Path | Contents |
|------|----------|
| `app.js` | Express app (`createApp()`) and server start-up |
| `controllers/` | HTTP routes and the SQS/SNS calls |
| `lib/awsConfig.js` | Builds SDK client config from the config files and env vars |
| `lib/render.js` | Writes results and errors into the UI state and renders the page |
| `config/` | Sample credentials and endpoint-override files |
| `views/` | `index.ejs` plus partials for the sidebar, SQS and SNS forms, and the response panel |
| `public/` | Stylesheet and browser script (sidebar, confirmations, copy, JSON highlighting) |
| `test/` | Test suite |

## Links
- AWS SNS: https://aws.amazon.com/sns/
- AWS SQS: https://aws.amazon.com/sqs/
- AWS SDK for JavaScript v3: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/
- LocalStack: https://github.com/localstack/localstack

## Acknowledgements
Based on code from the AWS SQS examples at https://www.youtube.com/watch?v=4Z74luiE2bg and https://github.com/andrewpuch/aws-sqs-node-js-examples

Mark Allen's SNS code: https://github.com/markcallen/snssqs/blob/master/create.js

CSS template inspired by https://www.sanwebe.com/2014/08/css-html-forms-designs

## Architecture

The app is a single Express server. Each form in the browser maps to one route, and each route makes one AWS SDK v3 call. The result is kept in memory and rendered back into the page.

```mermaid
flowchart TB
    browser["<b>Browser</b><br/>EJS page · public/app.js"]

    subgraph app["Node.js app · Express 5"]
        direction TB
        routes["<b>Routes</b><br/>controllers/sqsController.js<br/>controllers/snsController.js"]
        render["<b>Results + views</b><br/>lib/render.js · views/*.ejs<br/>ui state"]
        clients["<b>AWS SDK v3</b><br/>SQSClient · SNSClient"]
        routes --> render
        routes --> clients
    end

    config["<b>Configuration</b><br/>lib/awsConfig.js<br/>config/*.json or AWS provider chain"]

    subgraph cloud["AWS or LocalStack"]
        direction LR
        sns["Amazon SNS"]
        sqs["Amazon SQS"]
        sns -. "delivers via queue policy" .-> sqs
    end

    browser -- "form POST / GET" --> routes
    render -- "HTML" --> browser
    config --> clients
    clients --> sns
    clients --> sqs
```

Actions that change something are POSTs. After the AWS call, the result is stored and the browser is redirected back to the page, so refreshing can't repeat a delete or purge:

```mermaid
sequenceDiagram
    participant B as Browser
    participant E as Express app
    participant U as ui state
    participant A as AWS SQS / SNS

    B->>E: POST /sqs-queue/delete (form)
    E->>A: DeleteQueueCommand
    A-->>E: result or error
    E->>U: store result, update pre-filled fields
    E-->>B: 303 redirect to /
    B->>E: GET /
    E->>U: read results
    E-->>B: page with result panel
    Note over B,U: Refreshing now repeats the GET, not the delete.<br/>List, get and receive actions are GETs and render directly.
```
