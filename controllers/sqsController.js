// AWS test SQS controller / API
const {
    CreateQueueCommand,
    GetQueueUrlCommand,
    GetQueueAttributesCommand,
    SendMessageCommand,
    ReceiveMessageCommand,
    DeleteMessageCommand,
    PurgeQueueCommand,
    DeleteQueueCommand,
    SetQueueAttributesCommand,
    paginateListQueues
} = require('@aws-sdk/client-sqs')
const { renderResult, renderSuccess, renderError } = require('../lib/render')

module.exports = function (app, sqs, ui) {


    // 1. create Queue
    app.post('/sqs-queue', async function (req, res) {

        ui.menuitem = 1

        try {
            const data = await sqs.send(new CreateQueueCommand({ QueueName: req.body.queuename }))

            // default prepop
            ui.def_sqsname = req.body.queuename
            ui.def_sqsurl = data.QueueUrl

            renderSuccess(res, ui, 201, data)
        } catch (err) {
            renderError(res, ui, 'Queue Creation', err)
        }
    })


    // 2. list all queues (no input required) - follows NextToken to get every page
    app.get('/sqs-queue/list', async function (req, res) {

        ui.menuitem = 2

        try {
            const queueUrls = []
            for await (const page of paginateListQueues({ client: sqs }, {})) {
                queueUrls.push(...(page.QueueUrls || []))
            }

            if (queueUrls.length) {
                renderSuccess(res, ui, 200, { QueueUrls: queueUrls })
            } else { // no queues
                renderResult(res, ui, 404, 'No Queues Found')
            }
        } catch (err) {
            renderError(res, ui, 'List Queue', err)
        }
    })


    // 3. get Queue URL. input = queue name
    app.get('/sqs-queue', async function (req, res) {

        ui.menuitem = 3

        try {
            const data = await sqs.send(new GetQueueUrlCommand({ QueueName: req.query.queuename }))

            // default prepop
            ui.def_sqsname = req.query.queuename
            ui.def_sqsurl = data.QueueUrl

            renderSuccess(res, ui, 200, data)
        } catch (err) {
            renderError(res, ui, 'Get Queue URL', err)
        }
    })


    // 4. get Queue Attributes. input = queue URL
    app.get('/sqs-queue/attributes', async function (req, res) {

        ui.menuitem = 4

        try {
            const data = await sqs.send(new GetQueueAttributesCommand({
                QueueUrl: req.query.queueurl,
                AttributeNames: ['All']
            }))

            // default prepop
            ui.def_sqsurl = req.query.queueurl
            ui.def_sqsarn = data.Attributes?.QueueArn ?? ui.def_sqsarn

            renderSuccess(res, ui, 200, data)
        } catch (err) {
            renderError(res, ui, 'Get Queue Attributes', err)
        }
    })


    // 5. post message to queue. input = queue URL and message
    app.post('/sqs-queue/message', async function (req, res) {

        ui.menuitem = 5

        try {
            const data = await sqs.send(new SendMessageCommand({
                MessageBody: req.body.message,
                QueueUrl: req.body.queueurl
            }))

            // default prepop
            ui.def_sqsurl = req.body.queueurl

            renderSuccess(res, ui, 201, data)
        } catch (err) {
            renderError(res, ui, 'Post Message to Queue', err)
        }
    })


    // 6. receive (get) message. input = queue URL
    app.get('/sqs-queue/message', async function (req, res) {

        ui.menuitem = 6

        try {
            const data = await sqs.send(new ReceiveMessageCommand({
                QueueUrl: req.query.queueurl,
                VisibilityTimeout: 60 // 1 min wait time for anyone else to process / lock
            }))

            if (data.Messages && data.Messages.length) { // there is a msg

                // default prepop
                ui.def_sqsurl = req.query.queueurl
                ui.def_msghandle = data.Messages[0].ReceiptHandle

                renderSuccess(res, ui, 200, data)
            } else { // no messages
                renderResult(res, ui, 404, 'Not Found, No Messages in Queue')
            }
        } catch (err) {
            renderError(res, ui, 'Get Message from Queue', err)
        }
    })


    // 7. delete message from queue
    app.post('/sqs-queue/message/delete', async function (req, res) {

        ui.menuitem = 7

        try {
            const data = await sqs.send(new DeleteMessageCommand({
                QueueUrl: req.body.queueurl,
                ReceiptHandle: req.body.messagehandle
            }))

            // default prepop
            ui.def_sqsurl = req.body.queueurl

            renderSuccess(res, ui, 200, data)
        } catch (err) {
            renderError(res, ui, 'Delete Message from Queue', err)
        }
    })


    // 8. purge queue - dangerzone
    app.post('/sqs-queue/purge', async function (req, res) {

        ui.menuitem = 8

        try {
            const data = await sqs.send(new PurgeQueueCommand({ QueueUrl: req.body.queueurl }))

            // default prepop
            ui.def_sqsurl = req.body.queueurl

            renderSuccess(res, ui, 200, data)
        } catch (err) {
            renderError(res, ui, 'Purge Queue', err)
        }
    })


    // 9. delete queue - dangerzone
    app.post('/sqs-queue/delete', async function (req, res) {

        ui.menuitem = 9

        try {
            const data = await sqs.send(new DeleteQueueCommand({ QueueUrl: req.body.queueurl }))

            // default prepop
            ui.def_sqsurl = req.body.queueurl

            renderSuccess(res, ui, 200, data)
        } catch (err) {
            renderError(res, ui, 'Delete Queue', err)
        }
    })


    // 10. set policy for queue (allow sns -> sqs queue)
    app.post('/sqs/setqattr', async function (req, res) {

        ui.menuitem = 10

        const queuePolicyString = JSON.stringify(buildSnsToSqsPolicy(req.body.sqsarn, req.body.snsarn))

        try {
            const data = await sqs.send(new SetQueueAttributesCommand({  // needs queue URL as the parameter
                QueueUrl: req.body.sqsurl,
                Attributes: {
                    Policy: queuePolicyString
                }
            }))

            // default prepop
            ui.def_sqsurl = req.body.sqsurl
            ui.def_sqsarn = req.body.sqsarn
            ui.def_snsarn = req.body.snsarn

            renderSuccess(res, ui, 200, data)
        } catch (err) {
            renderError(res, ui, 'Set Queue Attributes', err)
        }
    })
}


// queue policy allowing the given SNS topic to deliver messages to the given queue
function buildSnsToSqsPolicy(queueArn, topicArn) {
    return {
        Version: '2012-10-17',
        Id: queueArn + '/SQSDefaultPolicy',
        Statement: [
            {
                Sid: 'Sid' + Date.now(),
                Effect: 'Allow',
                Principal: { Service: 'sns.amazonaws.com' },
                Action: 'SQS:SendMessage',
                Resource: queueArn,
                Condition: {
                    ArnEquals: {
                        'aws:SourceArn': topicArn
                    }
                }
            }
        ]
    }
}

module.exports.buildSnsToSqsPolicy = buildSnsToSqsPolicy
