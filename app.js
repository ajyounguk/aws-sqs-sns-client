// setup express server
const path = require('path')
const express = require('express')
const { SQSClient } = require('@aws-sdk/client-sqs')
const { SNSClient } = require('@aws-sdk/client-sns')
const { loadAwsConfig, describeConnection } = require('./lib/awsConfig')
const snsController = require('./controllers/snsController')
const sqsController = require('./controllers/sqsController')


// this is the main object for holding all the UI data rendered in ejs templates
// the last result for each menu item is held in the 'data' array, indexed by menu item number
// (see lib/render.js for its shape).
//
// menuitem is the currently active / selected menu item - the templates show that panel and
// highlight it in the sidebar.
//
// the def_* variables are used to hold default / prepop values for the various input boxes
//
// note: this state is shared by everyone using the server - it's a single-user dev tool.
function createUiState() {
    return {
        menuitem: 1,
        data: [],
        def_snsname: '',
        def_snsarn: '',
        def_sqsname: '',
        def_sqsurl: '',
        def_sqsarn: '',
        def_subarn: '',
        def_msghandle: ''
    }
}


// build the express app. clients (and the connection description) can be injected - used by the tests
function createApp({ sqs, sns, ui = createUiState(), connection } = {}) {
    if (!sqs || !sns) {
        const config = loadAwsConfig()
        sqs = sqs || new SQSClient(config.sqs)
        sns = sns || new SNSClient(config.sns)
        connection = connection || describeConnection(config)
    }

    const app = express()

    // shown in the page header so it's obvious whether you're pointed at real AWS or a local emulator.
    // region can come from a profile / env var, so ask the client for it rather than the config
    app.locals.connection = connection || { kind: 'aws', label: 'AWS', region: null }
    if (!app.locals.connection.region) {
        sqs.config.region()
            .then(function (region) { app.locals.connection.region = region })
            .catch(function () { /* no region configured - calls will fail and say so */ })
    }

    // configure assets and views
    app.use('/assets', express.static(path.join(__dirname, 'public')))
    app.set('views', path.join(__dirname, 'views'))
    app.set('view engine', 'ejs')

    // form + json bodies. express 5 leaves req.body undefined when nothing was parsed, so default it
    app.use(express.json())
    app.use(express.urlencoded({ extended: false }))
    app.use(function (req, res, next) {
        req.body = req.body || {}
        next()
    })

    sqsController(app, sqs, ui)
    snsController(app, sns, ui)

    // serve up index
    app.get('/', function (req, res) {
        res.render('index', { ui: ui })
    })

    return app
}


// Start server when run directly (node app.js).
// server listen port / host can be overriden by environment variables.
// defaults to localhost only as there's no auth in front of this - set HOST=0.0.0.0 to expose it.
if (require.main === module) {
    const port = process.env.PORT || 3000
    const host = process.env.HOST || '127.0.0.1'

    createApp().listen(port, host, function () {
        console.log(`AWS SNS SQS test server listening on http://${host}:${port}`)
    })
}

module.exports = { createApp, createUiState }
