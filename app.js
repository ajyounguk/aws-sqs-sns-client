
// setup express server
var express  = require('express');
var app      = express();

// this is the main object for holding all the UI data 
// in arrays correspoding to the UI section/menuitem
// set ui.mode to false to invoke server in API mode ()

var ui = {
    menuitem: 1,
    data: []
}

var snsController = require('./controllers/snsController')
var sqsController = require('./controllers/sqsController')

snsController(app,ui);
sqsController(app,ui);

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




