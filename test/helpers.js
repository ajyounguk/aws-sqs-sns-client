// shared test setup: an app wired to mocked SQS/SNS clients
const { mockClient } = require('aws-sdk-client-mock')
const { SQSClient } = require('@aws-sdk/client-sqs')
const { SNSClient } = require('@aws-sdk/client-sns')
const { createApp, createUiState } = require('../app')

const fakeConfig = {
    region: 'eu-west-2',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' }
}

function setup() {
    const sqs = new SQSClient(fakeConfig)
    const sns = new SNSClient(fakeConfig)
    const sqsMock = mockClient(sqs)
    const snsMock = mockClient(sns)
    const ui = createUiState()
    const app = createApp({ sqs, sns, ui })
    return { app, ui, sqsMock, snsMock }
}

// build an error shaped like the ones SDK v3 throws
function awsError(name, message, httpStatusCode = 400) {
    const err = new Error(message)
    err.name = name
    err.$metadata = { httpStatusCode, requestId: 'req-123' }
    return err
}

module.exports = { setup, awsError }
