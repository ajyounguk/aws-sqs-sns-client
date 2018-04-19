
// setup express server
var express  = require('express');
var aws      = require('aws-sdk');
var fs       = require('fs');
var app      = express();


// load aws config
aws.config.loadFromPath(__dirname + '/config/aws-config.json')

// load and override endpoints (if config file exists)
var configFile = null
try {
    configFile = fs.readFileSync(__dirname + '/config/aws-override.json','utf8');
} catch (err) {
    if (err.code === 'ENOENT') {
        console.log("No local AWS endpoint config found, using dafault routing to AWS")
    } else {
        throw(err)
    }
}

// if found, parse override config
if (configFile) {
            overrides = JSON.parse(configFile)
            
            console.log('Overriding AWS SQS endpoint to:', overrides.sqs_endpoint)
            console.log('Overriding AWS SNS endpoint to:', overrides.sns_endpoint)
    
            aws.config.sqs = { 'endpoint': overrides.sqs_endpoint }
            aws.config.sns = { 'endpoint': overrides.sns_endpoint }
}
        

// this is the main object for holding all the UI data 
// in arrays correspoding to the UI section/menuitem

var ui = {
    menuitem: 1,
    data: [],
    def_snsname: '',
    def_snsarn: '',
    def_sqsname: '',
    def_sqsurl: '',
    def_sqsar: '',
    def_subarn: '',
    def_msghandle: ''
}




var snsController = require('./controllers/snsController')
var sqsController = require('./controllers/sqsController')

snsController(aws, app, ui);
sqsController(aws, app, ui);

var port = process.env.PORT || 3000

// configure assets and views
app.use('/assets', express.static(__dirname+'/public'))
app.set('views', __dirname+'/views');
app.set('view engine', 'ejs')


// login and serve up index
app.get('/', function (req, res) {
    res.setHeader('Content-Type', 'text/html');
    res.render('./index', {ui: ui})
})


// Start server.
app.listen(port)
console.log('AWS SNS SQS test server listening on port', port);




