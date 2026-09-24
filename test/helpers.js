// shared test setup: an app wired to mocked SQS/SNS clients
const assert = require('node:assert/strict')
const { mockClient } = require('aws-sdk-client-mock')
const { SQSClient } = require('@aws-sdk/client-sqs')
const { SNSClient } = require('@aws-sdk/client-sns')
const { createApp, createUiState } = require('../app')

const fakeConfig = {
    region: 'eu-west-2',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' }
}

function setup({ connection = { kind: 'local', label: 'localhost:4566', region: 'eu-west-2' } } = {}) {
    const sqs = new SQSClient(fakeConfig)
    const sns = new SNSClient(fakeConfig)
    const sqsMock = mockClient(sqs)
    const snsMock = mockClient(sns)
    const ui = createUiState()
    const app = createApp({ sqs, sns, ui, connection })
    return { app, ui, sqsMock, snsMock }
}

// build an error shaped like the ones SDK v3 throws
function awsError(name, message, httpStatusCode = 400) {
    const err = new Error(message)
    err.name = name
    err.$metadata = { httpStatusCode, requestId: 'req-123' }
    return err
}

// POSTs store their result then redirect back to the page (post/redirect/get)
function assertRedirected(res) {
    assert.equal(res.status, 303)
    assert.equal(res.headers.location, '/')
}

module.exports = { setup, awsError, assertRedirected }
