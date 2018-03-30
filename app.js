
// setup express server
var express  = require('express');
var app      = express();

var awsdemo = { menuitem: 1}

var snsController = require('./controllers/snsController')
var sqsController = require('./controllers/sqsController')


snsController(app);
sqsController(app);

var port = process.env.PORT || 3000

// configure assets and views
app.use('/assets', express.static(__dirname+'/public'))
app.set('views', __dirname+'/views');
app.set('view engine', 'ejs')



// login and serve up index
app.get('/', function (req, res) {

    res.setHeader('Content-Type', 'text/html');

    res.render('./index', {awsdemo: awsdemo})
})



// Start server.
app.listen(port)
console.log('AWS SNS SQS test server listening on port', port);




