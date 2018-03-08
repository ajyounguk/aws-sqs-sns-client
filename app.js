
// setup express server
var express  = require('express');
var app      = express();


var snsController = require('./controllers/snsController')
var sqsController = require('./controllers/sqsController')


snsController(app);
sqsController(app);

var port = process.env.PORT || 3000
app.use(express.static('public'))


// Start server.
app.listen(port)
console.log('AWS SNS SQS test server listening on port', port);




