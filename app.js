
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
        

// this is the main object for holding all the UI data rendered in ejs templates
// date for the various UI menu items is held in the 'data' array.
//
// menuitem is used to hold the currently active / selected menu items to be displayed, 
// when index.ejs is loaded, it invokes a javascript function to enable the required div section using
// this variable. 
// 
// the def_* variables are used to hold default / prepop values for the various input boxes 

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

// server listen port - can be overriden by an environment variable
var port = process.env.PORT || 3100

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




