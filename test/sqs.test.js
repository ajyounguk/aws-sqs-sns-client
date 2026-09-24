const { describe, it, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const {
    CreateQueueCommand,
    ListQueuesCommand,
    GetQueueUrlCommand,
    GetQueueAttributesCommand,
    SendMessageCommand,
    ReceiveMessageCommand,
    DeleteMessageCommand,
    PurgeQueueCommand,
    DeleteQueueCommand,
    SetQueueAttributesCommand
} = require('@aws-sdk/client-sqs')
const { buildSnsToSqsPolicy } = require('../controllers/sqsController')
const { setup, awsError, assertRedirected } = require('./helpers')

const QUEUE_URL = 'https://sqs.eu-west-2.amazonaws.com/123456789012/test-queue'
const QUEUE_ARN = 'arn:aws:sqs:eu-west-2:123456789012:test-queue'
const TOPIC_ARN = 'arn:aws:sns:eu-west-2:123456789012:test-topic'

describe('SQS routes', () => {
    let app, ui, sqsMock

    beforeEach(() => {
        ({ app, ui, sqsMock } = setup())
    })

    describe('POST /sqs-queue (create queue)', () => {
        it('creates the queue and prepopulates name + url', async () => {
            sqsMock.on(CreateQueueCommand, { QueueName: 'test-queue' }).resolves({ QueueUrl: QUEUE_URL })

            const res = await request(app).post('/sqs-queue').type('form').send({ queuename: 'test-queue' })

            assertRedirected(res)
            assert.equal(ui.menuitem, 1)
            assert.equal(ui.data[1].status, 201)
            assert.equal(ui.data[1].kind, 'success')
            assert.deepEqual(JSON.parse(ui.data[1].json), { QueueUrl: QUEUE_URL })
            assert.equal(ui.def_sqsname, 'test-queue')
            assert.equal(ui.def_sqsurl, QUEUE_URL)
        })

        it('uses the AWS status code on error and does not touch prepop', async () => {
            sqsMock.on(CreateQueueCommand).rejects(awsError('InvalidParameterValue', 'bad queue name', 400))

            const res = await request(app).post('/sqs-queue').type('form').send({ queuename: 'bad name!' })

            assertRedirected(res)
            assert.equal(ui.data[1].status, 400)
            assert.equal(ui.data[1].kind, 'error')
            assert.equal(ui.data[1].title, 'Queue Creation Error')
            assert.deepEqual(JSON.parse(ui.data[1].json), { name: 'InvalidParameterValue', message: 'bad queue name' })
            assert.equal(ui.data[1].requestId, 'req-123')
            assert.equal(ui.def_sqsname, '')
        })

        it('falls back to 500 when the error has no HTTP status', async () => {
            sqsMock.on(CreateQueueCommand).rejects(new Error('socket hang up'))

            await request(app).post('/sqs-queue').type('form').send({ queuename: 'q' })

            assert.equal(ui.data[1].status, 500)
            assert.match(ui.data[1].json, /socket hang up/)
        })
    })

    describe('GET /sqs-queue/list', () => {
        it('follows NextToken and returns every queue', async () => {
            sqsMock.on(ListQueuesCommand)
                .resolvesOnce({ QueueUrls: ['url-1', 'url-2'], NextToken: 'page2' })
                .resolvesOnce({ QueueUrls: ['url-3'] })

            const res = await request(app).get('/sqs-queue/list')

            assert.equal(res.status, 200)
            assert.equal(sqsMock.commandCalls(ListQueuesCommand).length, 2)
            assert.deepEqual(JSON.parse(ui.data[2].json), { QueueUrls: ['url-1', 'url-2', 'url-3'] })
        })

        it('returns 404 when there are no queues', async () => {
            sqsMock.on(ListQueuesCommand).resolves({})

            const res = await request(app).get('/sqs-queue/list')

            assert.equal(res.status, 404)
            assert.equal(ui.data[2].kind, 'info')
            assert.match(ui.data[2].message, /No Queues Found/)
        })

        it('renders a response on error (used to hang the request)', async () => {
            sqsMock.on(ListQueuesCommand).rejects(awsError('AccessDenied', 'nope', 403))

            const res = await request(app).get('/sqs-queue/list')

            assert.equal(res.status, 403)
            assert.equal(ui.data[2].title, 'List Queue Error')
        })
    })

    it('GET /sqs-queue gets the queue url', async () => {
        sqsMock.on(GetQueueUrlCommand, { QueueName: 'test-queue' }).resolves({ QueueUrl: QUEUE_URL })

        const res = await request(app).get('/sqs-queue').query({ queuename: 'test-queue' })

        assert.equal(res.status, 200)
        assert.equal(ui.def_sqsurl, QUEUE_URL)
        assert.equal(ui.def_sqsname, 'test-queue')
    })

    describe('GET /sqs-queue/attributes', () => {
        it('requests all attributes and prepopulates the queue ARN', async () => {
            sqsMock.on(GetQueueAttributesCommand).resolves({ Attributes: { QueueArn: QUEUE_ARN } })

            const res = await request(app).get('/sqs-queue/attributes').query({ queueurl: QUEUE_URL })

            assert.equal(res.status, 200)
            assert.deepEqual(sqsMock.commandCalls(GetQueueAttributesCommand)[0].args[0].input, {
                QueueUrl: QUEUE_URL,
                AttributeNames: ['All']
            })
            assert.equal(ui.def_sqsarn, QUEUE_ARN)
        })

        it('copes with a response that has no Attributes', async () => {
            sqsMock.on(GetQueueAttributesCommand).resolves({})

            const res = await request(app).get('/sqs-queue/attributes').query({ queueurl: QUEUE_URL })

            assert.equal(res.status, 200)
            assert.equal(ui.def_sqsarn, '')
        })
    })

    it('POST /sqs-queue/message sends the message', async () => {
        sqsMock.on(SendMessageCommand).resolves({ MessageId: 'm-1' })

        const res = await request(app).post('/sqs-queue/message').type('form')
            .send({ queueurl: QUEUE_URL, message: 'hello' })

        assertRedirected(res)
        assert.deepEqual(sqsMock.commandCalls(SendMessageCommand)[0].args[0].input, {
            QueueUrl: QUEUE_URL,
            MessageBody: 'hello'
        })
        assert.equal(ui.data[5].status, 201)
        assert.match(ui.data[5].json, /m-1/)
    })

    describe('GET /sqs-queue/message (receive)', () => {
        it('returns the message and prepopulates the receipt handle', async () => {
            sqsMock.on(ReceiveMessageCommand).resolves({
                Messages: [{ MessageId: 'm-1', ReceiptHandle: 'handle-1', Body: 'hello' }]
            })

            const res = await request(app).get('/sqs-queue/message').query({ queueurl: QUEUE_URL })

            assert.equal(res.status, 200)
            assert.equal(sqsMock.commandCalls(ReceiveMessageCommand)[0].args[0].input.VisibilityTimeout, 60)
            assert.equal(ui.def_msghandle, 'handle-1')
        })

        it('returns 404 when the queue is empty', async () => {
            sqsMock.on(ReceiveMessageCommand).resolves({})

            const res = await request(app).get('/sqs-queue/message').query({ queueurl: QUEUE_URL })

            assert.equal(res.status, 404)
            assert.match(ui.data[6].message, /No Messages in Queue/)
            assert.equal(ui.def_msghandle, '')
        })
    })

    it('POST /sqs-queue/message/delete deletes by receipt handle', async () => {
        sqsMock.on(DeleteMessageCommand).resolves({})

        const res = await request(app).post('/sqs-queue/message/delete').type('form')
            .send({ queueurl: QUEUE_URL, messagehandle: 'handle-1' })

        assertRedirected(res)
        assert.deepEqual(sqsMock.commandCalls(DeleteMessageCommand)[0].args[0].input, {
            QueueUrl: QUEUE_URL,
            ReceiptHandle: 'handle-1'
        })
        assert.equal(ui.data[7].status, 200)
    })

    it('POST /sqs-queue/purge purges the queue', async () => {
        sqsMock.on(PurgeQueueCommand).resolves({})

        const res = await request(app).post('/sqs-queue/purge').type('form').send({ queueurl: QUEUE_URL })

        assertRedirected(res)
        assert.equal(sqsMock.commandCalls(PurgeQueueCommand)[0].args[0].input.QueueUrl, QUEUE_URL)
        assert.equal(ui.menuitem, 8)
    })

    it('POST /sqs-queue/delete deletes the queue', async () => {
        sqsMock.on(DeleteQueueCommand).resolves({})

        const res = await request(app).post('/sqs-queue/delete').type('form').send({ queueurl: QUEUE_URL })

        assertRedirected(res)
        assert.equal(sqsMock.commandCalls(DeleteQueueCommand)[0].args[0].input.QueueUrl, QUEUE_URL)
        assert.equal(ui.menuitem, 9)
    })

    it('POST /sqs/setqattr sets an SNS -> SQS policy on the queue', async () => {
        sqsMock.on(SetQueueAttributesCommand).resolves({})

        const res = await request(app).post('/sqs/setqattr').type('form')
            .send({ sqsurl: QUEUE_URL, sqsarn: QUEUE_ARN, snsarn: TOPIC_ARN })

        assertRedirected(res)
        const input = sqsMock.commandCalls(SetQueueAttributesCommand)[0].args[0].input
        assert.equal(input.QueueUrl, QUEUE_URL)
        const statement = JSON.parse(input.Attributes.Policy).Statement[0]
        assert.equal(statement.Resource, QUEUE_ARN)
        assert.equal(statement.Condition.ArnEquals['aws:SourceArn'], TOPIC_ARN)
        assert.equal(ui.def_sqsarn, QUEUE_ARN)
        assert.equal(ui.def_snsarn, TOPIC_ARN)
    })
})

describe('buildSnsToSqsPolicy', () => {
    it('only lets SNS send, and only from the given topic', () => {
        const policy = buildSnsToSqsPolicy(QUEUE_ARN, TOPIC_ARN)

        assert.equal(policy.Version, '2012-10-17')
        assert.equal(policy.Id, QUEUE_ARN + '/SQSDefaultPolicy')
        assert.equal(policy.Statement.length, 1)
        assert.deepEqual(policy.Statement[0], {
            Sid: policy.Statement[0].Sid,
            Effect: 'Allow',
            Principal: { Service: 'sns.amazonaws.com' },
            Action: 'SQS:SendMessage',
            Resource: QUEUE_ARN,
            Condition: { ArnEquals: { 'aws:SourceArn': TOPIC_ARN } }
        })
        assert.match(policy.Statement[0].Sid, /^Sid\d+$/)
    })
})
