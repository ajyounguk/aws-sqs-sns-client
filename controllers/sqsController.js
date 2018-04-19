// AWS test SQS controller / API 
module.exports = function (aws, app,ui) {

  

    // setup bodyparser
    var bodyParser = require('body-parser');
    app.use(bodyParser.json()); // support json encoded bodies
    app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

    // load aws config
    aws.config.loadFromPath(__dirname + '/../config/aws-config.json')

    // create the sqs service object
    var sqs = new aws.SQS()
    
   
    // 1. create Queue 
    app.post('/sqs-queue', function (req, res) {

        ui.menuitem = 1
    
        var qParams = {
            QueueName: req.body.queuename
        }

        sqs.createQueue(qParams, function(err, data) {
            if (err) {
                res.status(500)
                ui.data[ui.menuitem] = '(500) Queue Creation Error:\n\n' + JSON.stringify(err, null, 3)
            } else {
                res.status(201)
                ui.data[ui.menuitem] ='(201) Success:\n\n' + JSON.stringify(data, null, 3)

                // default prepop
                ui.def_sqsname = req.body.queuename
                ui.def_sqsurl = data.QueueUrl

            }
            res.render('./index', {ui: ui})
        })
    })


    // 2. list all queues (no input required)
    app.get('/sqs-queue/list', function (req, res){

        ui.menuitem = 2
    
        sqs.listQueues(function(err, data) {
            if (err) {
                res.status(500)
                ui.data[ui.menuitem] = '(500) List Queue Error:\n\n' + JSON.stringify(err, null, 3)
            } else {
                if (data.QueueUrls) {        
                    res.status(200)
                    ui.data[ui.menuitem] ='(200) Success:\n\n' + JSON.stringify(data, null, 3)
                } else { // no queues
                    res.status(404)
                    ui.data[ui.menuitem] ='404, No Queues Found\n\n' + JSON.stringify(data, null, 3)
                }
                res.render('./index', {ui: ui})
            }
        })
    })



    // 3. get Queue URL. input = queue name
    app.get('/sqs-queue', function (req, res) {

        ui.menuitem = 3

        // pass in the queue name to get the queue URL
        var qParams = {
            QueueName: req.query.queuename
        }

        sqs.getQueueUrl(qParams, function(err, data) {
            if (err) {
                res.status(500)
                ui.data[ui.menuitem] = '(500) Get Queue URL Error:\n\n' + JSON.stringify(err, null, 3)
            } else {
                res.status(200)
                ui.data[ui.menuitem] ='(200) Success:\n\n' + JSON.stringify(data, null, 3)

                 // default prepop
                 ui.def_sqsname = req.query.queuename
                 ui.def_sqsurl = data.QueueUrl
            }
            res.render('./index', {ui: ui})
        })
    })



    // 4. get Queue Attributes. input = queue URL
    app.get('/sqs-queue/attributes', function (req, res) {

        ui.menuitem = 4

        // pass in the queue URL to get Attributes
        var qParams = {
            QueueUrl: req.query.queueurl,
            AttributeNames: ["All"]
        }

        sqs.getQueueAttributes(qParams, function(err, data) {
            if (err) {
                res.status(500)
                ui.data[ui.menuitem] = '(500) Get Queue Attributes Error:\n\n' + JSON.stringify(err, null, 3)
            } else {
                res.status(200)
                ui.data[ui.menuitem] = '(200) Success:\n\n' + JSON.stringify(data, null, 3)

                     // default prepop
                     ui.def_sqsurl = req.query.queueurl  
                     ui.def_sqsarn = data.Attributes.QueueArn 
            }
            res.render('./index', {ui: ui})
        })
    })

    
    
    // 5. post message to queue. input = queue URL and message
    app.post ('/sqs-queue/message', function (req, res) {

        ui.menuitem = 5

        var qParams = {
            MessageBody: req.body.message,
            QueueUrl: req.body.queueurl
            }   

        sqs.sendMessage(qParams, function(err, data) {
            if (err) {
                res.status(500)
                ui.data[ui.menuitem] = '(500) Post Message to Queue Error:\n\n' + JSON.stringify(err, null, 3)
            } else { 
                res.status(201)
                ui.data[ui.menuitem] =  '(201) Success:\n\n' + JSON.stringify(data, null, 3)

                // default prepop
                ui.def_sqsurl = req.body.queueurl 
            }
            res.render('./index', {ui: ui})
        }) 
    })


    // 6. receive (get) message. input = queue URL
    app.get('/sqs-queue/message', function (req, res) {

        ui.menuitem = 6

        var params = {
            QueueUrl: req.query.queueurl,
            VisibilityTimeout: 60 // 1 min wait time for anyone else to process / lock
        };
        
        sqs.receiveMessage(params, function(err, data) {
            if (err) {
                res.status(500)
                ui.data[ui.menuitem] = '(500) Get Message from Queue Error:\n\n' + JSON.stringify(err, null, 3)
            } else {
                if (data.Messages) { // there is a msg
                    res.status(200)
                    ui.data[ui.menuitem] = '(200) Success:\n\n' + JSON.stringify(data, null, 3)

                    // default prepop
                    ui.def_sqsurl = req.query.queueurl   
                    ui.def_msghandle = data.Messages[0].ReceiptHandle

                } else { // no messages
                    res.status(404)
                    ui.data[ui.menuitem] = '(404) Not Found, No Messages in Queue:\n\n' 
                }
            }
            res.render('./index', {ui: ui})
        })
    })


    // 7. delete message from queue
    app.post('/sqs-queue/message/delete', function (req, res) {

        ui.menuitem = 7

        var params = {
            QueueUrl: req.body.queueurl,
            ReceiptHandle: req.body.messagehandle
        };
        
        sqs.deleteMessage(params, function(err, data) {
            if (err) {
                res.status(500)
                ui.data[ui.menuitem] = '(500) Delete Message from Queue Error:\n\n' + JSON.stringify(err, null, 3)
            } else {
                res.status(200)
                ui.data[ui.menuitem] = '(200) Success:\n\n' + JSON.stringify(data, null, 3)

                // default prepop
                ui.def_sqsurl = req.body.queueurl   
            
            }
            res.render('./index', {ui: ui})
        });
    });


    // 8. purge queue - dangerzone
    app.post('/sqs-queue/purge', function (req, res) {

        ui.menuitem = 8

        var params = {
            QueueUrl: req.body.queueurl
        }
        
        sqs.purgeQueue(params, function(err, data) {
            if (err) {
                res.status(500)
                ui.data[ui.menuitem] = '(500) Delete Queue Error:\n\n' + JSON.stringify(err, null, 3)
            } else {
                res.status(200)
                ui.data[ui.menuitem] = '(200) Success:\n\n' + JSON.stringify(data, null, 3)

                // default prepop
                ui.def_sqsurl = req.body.queueurl   
            }
            res.render('./index', {ui: ui}) 
        })
    })


    // 9. delete queue - dangerzone
    app.post('/sqs-queue/delete', function (req, res) {
       
        ui.menuitem = 9
        
            var params = {
                QueueUrl: req.body.queueurl
            }
            
            sqs.deleteQueue(params, function(err, data) {
                if (err) { 
                    res.status(500)
                    ui.data[ui.menuitem] = '(500) Delete Queue Error:\n\n' + JSON.stringify(err, null, 3)
                } else {
                    res.status(200)
                    ui.data[ui.menuitem] = '(200) Success:\n\n' + JSON.stringify(data, null, 3)

                    // default prepop
                    ui.def_sqsurl = req.body.queueurl   
                }
            res.render('./index', {ui: ui}) 
        })
    })


    // 10. set policy for queue (allow sns -> sqs queue)
    app.post('/sqs/setqattr', function (req,res) {

        ui.menuitem = 10

        var queuePolicyString = JSON.stringify ({   
                "Version": "2012-10-17",
                "Id": req.body.sqsarn + "SQSDefaultPolicy",
                "Statement": [
                {
                    "Sid": "Sid" + new Date().getTime(),
                    "Effect": "Allow",
                    "Principal": "*",
                    "Action": "SQS:SendMessage",
                    "Resource": req.body.sqsarn,  // need queue ARN
                    "Condition": {
                    "ArnEquals": {
                        "aws:SourceArn": req.body.snsarn // need topic ARN
                    }
                    }
                }
                ]
            })
            
        var sqsParams = {
            QueueUrl: req.body.sqsurl,
            Attributes: { 
                Policy : queuePolicyString
            }
        }
    
        sqs.setQueueAttributes(sqsParams, function (err,data) {  // needs queue URL as the parameter
            if (err) {
                res.status(500)
                ui.data[ui.menuitem] = '(500) Set Queue Attributes Error:\n\n' + JSON.stringify(err, null, 3)
            } else {
                res.status(200)
                ui.data[ui.menuitem] = '(200) Success:\n\n' + JSON.stringify(data, null, 3)

                // default prepop
                ui.def_sqsarn = req.body.sqsarn  
                ui.def_snsarn = req.body.snsarn  

            }
            res.render('./index', {ui: ui})
        })
    })

}