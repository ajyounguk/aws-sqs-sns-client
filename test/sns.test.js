const { describe, it, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const {
    CreateTopicCommand,
    SubscribeCommand,
    PublishCommand,
    ListTopicsCommand,
    DeleteTopicCommand,
    ListSubscriptionsCommand,
    UnsubscribeCommand
} = require('@aws-sdk/client-sns')
const { setup, awsError, assertRedirected } = require('./helpers')

const QUEUE_ARN = 'arn:aws:sqs:eu-west-2:123456789012:test-queue'
const TOPIC_ARN = 'arn:aws:sns:eu-west-2:123456789012:test-topic'
const SUB_ARN = TOPIC_ARN + ':0f1e2d3c-aaaa-bbbb-cccc-123456789012'

describe('SNS routes', () => {
    let app, ui, snsMock

    beforeEach(() => {
        ({ app, ui, snsMock } = setup())
    })

    describe('POST /sns (create topic)', () => {
        it('creates the topic and prepopulates name + arn', async () => {
            snsMock.on(CreateTopicCommand, { Name: 'test-topic' }).resolves({ TopicArn: TOPIC_ARN })

            const res = await request(app).post('/sns').type('form').send({ snstopic: 'test-topic' })

            assertRedirected(res)
            assert.equal(ui.menuitem, 11)
            assert.equal(ui.data[11].status, 201)
            assert.equal(ui.def_snsname, 'test-topic')
            assert.equal(ui.def_snsarn, TOPIC_ARN)
        })

        it('stores the error', async () => {
            snsMock.on(CreateTopicCommand).rejects(awsError('InvalidParameter', 'bad topic name'))

            await request(app).post('/sns').type('form').send({ snstopic: '!!' })

            assert.equal(ui.data[11].status, 400)
            assert.equal(ui.data[11].title, 'Create Topic Error')
            assert.equal(ui.def_snsarn, '')
        })
    })

    describe('POST /sns/subscribe-queue', () => {
        it('subscribes the queue ARN (not the topic ARN) and prepopulates correctly', async () => {
            snsMock.on(SubscribeCommand).resolves({ SubscriptionArn: SUB_ARN })

            const res = await request(app).post('/sns/subscribe-queue').type('form')
                .send({ snsarn: TOPIC_ARN, sqsarn: QUEUE_ARN })

            assertRedirected(res)
            assert.deepEqual(snsMock.commandCalls(SubscribeCommand)[0].args[0].input, {
                TopicArn: TOPIC_ARN,
                Protocol: 'sqs',
                Endpoint: QUEUE_ARN,
                ReturnSubscriptionArn: true
            })
            assert.equal(ui.def_snsarn, TOPIC_ARN)
            assert.equal(ui.def_sqsarn, QUEUE_ARN) // was previously set to the topic ARN
            assert.equal(ui.def_subarn, SUB_ARN)
        })
    })

    it('POST /sns/subscribe-email subscribes an email endpoint', async () => {
        snsMock.on(SubscribeCommand).resolves({ SubscriptionArn: 'pending confirmation' })

        const res = await request(app).post('/sns/subscribe-email').type('form')
            .send({ snsarn: TOPIC_ARN, email: 'someone@example.com' })

        assertRedirected(res)
        assert.deepEqual(snsMock.commandCalls(SubscribeCommand)[0].args[0].input, {
            TopicArn: TOPIC_ARN,
            Protocol: 'email',
            Endpoint: 'someone@example.com'
        })
        assert.match(ui.data[13].json, /pending confirmation/)
    })

    it('POST /sns/message publishes to the topic', async () => {
        snsMock.on(PublishCommand).resolves({ MessageId: 'm-1' })

        const res = await request(app).post('/sns/message').type('form')
            .send({ snstopicarn: TOPIC_ARN, snsmessage: 'hello' })

        assertRedirected(res)
        assert.deepEqual(snsMock.commandCalls(PublishCommand)[0].args[0].input, {
            TopicArn: TOPIC_ARN,
            Message: 'hello'
        })
        assert.equal(ui.def_snsarn, TOPIC_ARN)
    })

    describe('GET /sns (list topics)', () => {
        it('follows NextToken and returns every topic', async () => {
            snsMock.on(ListTopicsCommand)
                .resolvesOnce({ Topics: [{ TopicArn: 'a' }], NextToken: 'page2' })
                .resolvesOnce({ Topics: [{ TopicArn: 'b' }] })

            const res = await request(app).get('/sns')

            assert.equal(res.status, 200)
            assert.equal(snsMock.commandCalls(ListTopicsCommand).length, 2)
            assert.deepEqual(snsMock.commandCalls(ListTopicsCommand)[1].args[0].input, { NextToken: 'page2' })
            assert.deepEqual(JSON.parse(ui.data[15].json), { Topics: [{ TopicArn: 'a' }, { TopicArn: 'b' }] })
        })

        it('renders a response on error (used to hang the request)', async () => {
            snsMock.on(ListTopicsCommand).rejects(awsError('AuthorizationError', 'nope', 403))

            const res = await request(app).get('/sns')

            assert.equal(res.status, 403)
            assert.equal(ui.data[15].title, 'List Topics Error')
        })
    })

    it('POST /sns/delete-topic deletes the topic', async () => {
        snsMock.on(DeleteTopicCommand).resolves({})

        const res = await request(app).post('/sns/delete-topic').type('form').send({ snsarn: TOPIC_ARN })

        assertRedirected(res)
        assert.equal(snsMock.commandCalls(DeleteTopicCommand)[0].args[0].input.TopicArn, TOPIC_ARN)
    })

    describe('GET /sns/subscription (list subscriptions)', () => {
        it('follows NextToken and returns every subscription', async () => {
            snsMock.on(ListSubscriptionsCommand)
                .resolvesOnce({ Subscriptions: [{ SubscriptionArn: 's1' }], NextToken: 't' })
                .resolvesOnce({ Subscriptions: [{ SubscriptionArn: 's2' }] })

            const res = await request(app).get('/sns/subscription')

            assert.equal(res.status, 200)
            assert.deepEqual(JSON.parse(ui.data[17].json), {
                Subscriptions: [{ SubscriptionArn: 's1' }, { SubscriptionArn: 's2' }]
            })
        })

        it('renders a response on error (used to hang the request)', async () => {
            snsMock.on(ListSubscriptionsCommand).rejects(new Error('boom'))

            const res = await request(app).get('/sns/subscription')

            assert.equal(res.status, 500)
            assert.equal(ui.data[17].title, 'List Subscriptions Error')
        })
    })

    it('POST /sns/delete-subscription unsubscribes', async () => {
        snsMock.on(UnsubscribeCommand).resolves({})

        const res = await request(app).post('/sns/delete-subscription').type('form').send({ snssubarn: SUB_ARN })

        assertRedirected(res)
        assert.equal(snsMock.commandCalls(UnsubscribeCommand)[0].args[0].input.SubscriptionArn, SUB_ARN)
        assert.equal(ui.def_subarn, SUB_ARN)
    })
})
