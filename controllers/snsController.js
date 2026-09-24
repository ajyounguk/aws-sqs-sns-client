// AWS test SNS controller / API
const {
    CreateTopicCommand,
    SubscribeCommand,
    PublishCommand,
    DeleteTopicCommand,
    UnsubscribeCommand,
    paginateListTopics,
    paginateListSubscriptions
} = require('@aws-sdk/client-sns')
const { renderSuccess, renderError } = require('../lib/render')

module.exports = function (app, sns, ui) {


    // 11. create Topic - input = topic name
    app.post('/sns', async function (req, res) {

        ui.menuitem = 11

        try {
            const data = await sns.send(new CreateTopicCommand({ Name: req.body.snstopic }))

            // ui prepop
            ui.def_snsname = req.body.snstopic
            ui.def_snsarn = data.TopicArn

            renderSuccess(res, ui, 201, data)
        } catch (err) {
            renderError(res, ui, 'Create Topic', err)
        }
    })


    // 12. subscribe queue to SNS topic
    app.post('/sns/subscribe-queue', async function (req, res) {

        ui.menuitem = 12

        try {
            const data = await sns.send(new SubscribeCommand({
                TopicArn: req.body.snsarn,
                Protocol: 'sqs',
                Endpoint: req.body.sqsarn,
                ReturnSubscriptionArn: true
            }))

            // ui prepop
            ui.def_snsarn = req.body.snsarn
            ui.def_sqsarn = req.body.sqsarn
            ui.def_subarn = data.SubscriptionArn

            renderSuccess(res, ui, 201, data)
        } catch (err) {
            renderError(res, ui, 'Queue Subscription', err)
        }
    })


    // 13. subscribe email to SNS topic
    app.post('/sns/subscribe-email', async function (req, res) {

        ui.menuitem = 13

        try {
            const data = await sns.send(new SubscribeCommand({
                TopicArn: req.body.snsarn,
                Protocol: 'email',
                Endpoint: req.body.email
            }))

            // ui prepop
            ui.def_snsarn = req.body.snsarn

            renderSuccess(res, ui, 201, data)
        } catch (err) {
            renderError(res, ui, 'Email Subscription', err)
        }
    })


    // 14. Send message to SNS topics
    app.post('/sns/message', async function (req, res) {

        ui.menuitem = 14

        try {
            const data = await sns.send(new PublishCommand({
                Message: req.body.snsmessage,
                TopicArn: req.body.snstopicarn
            }))

            // ui prepop
            ui.def_snsarn = req.body.snstopicarn

            renderSuccess(res, ui, 201, data)
        } catch (err) {
            renderError(res, ui, 'Send Message', err)
        }
    })


    // 15. List SNS topics - follows NextToken to get every page
    app.get('/sns', async function (req, res) {

        ui.menuitem = 15

        try {
            const topics = []
            for await (const page of paginateListTopics({ client: sns }, {})) {
                topics.push(...(page.Topics || []))
            }
            renderSuccess(res, ui, 200, { Topics: topics })
        } catch (err) {
            renderError(res, ui, 'List Topics', err)
        }
    })


    // 16. Delete Topic
    app.post('/sns/delete-topic', async function (req, res) {

        ui.menuitem = 16

        try {
            const data = await sns.send(new DeleteTopicCommand({ TopicArn: req.body.snsarn }))

            // ui prepop
            ui.def_snsarn = req.body.snsarn

            renderSuccess(res, ui, 200, data)
        } catch (err) {
            renderError(res, ui, 'Delete Topic', err)
        }
    })


    // 17. List SNS subscriptions - follows NextToken to get every page
    app.get('/sns/subscription', async function (req, res) {

        ui.menuitem = 17

        try {
            const subscriptions = []
            for await (const page of paginateListSubscriptions({ client: sns }, {})) {
                subscriptions.push(...(page.Subscriptions || []))
            }
            renderSuccess(res, ui, 200, { Subscriptions: subscriptions })
        } catch (err) {
            renderError(res, ui, 'List Subscriptions', err)
        }
    })


    // 18. Unsubscribe
    app.post('/sns/delete-subscription', async function (req, res) {

        ui.menuitem = 18

        try {
            const data = await sns.send(new UnsubscribeCommand({ SubscriptionArn: req.body.snssubarn }))

            ui.def_subarn = req.body.snssubarn

            renderSuccess(res, ui, 200, data)
        } catch (err) {
            renderError(res, ui, 'Delete Subscription', err)
        }
    })
}
