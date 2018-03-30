// AWS test SQS controller / API 
module.exports = function (app) {

    // load the AWS SDK
    var aws = require('aws-sdk')

    // setup bodyparser
    var bodyParser = require('body-parser');
    app.use(bodyParser.json()); // support json encoded bodies
    app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

    // load aws config
    aws.config.loadFromPath(__dirname + '/../config/aws-config.json')

    // create the sqs service object
    var sqs = new aws.SQS()
   
    // 1. create Queue - input = queue name
    app.post('/sqs-queue', function (req, res) {
    
        var qParams = {
            QueueName: req.body.queuename
        }

        sqs.createQueue(qParams, function(err, data) {
            if (err) {
                console.log("!!(create queue) Error creating queue", err)
                res.status(500)
                res.send(err)
            } else {
                console.log("(create queue) Queue\" " + req.body.queuename + " \"created")
                console.log("(create queue) Queue Url is:", data.QueueUrl)
                res.status(201)
                res.send(data)
            }
        })
    })


    // 2. list all queues (no input required)
    app.get('/sqs-queue/list', function (req, res){
    
        sqs.listQueues(function(err, data) {
            if (err) {
                console.log("!!(list queues)", err)
                res.status(500)
                res.send(err)
            } else {
                if (data.QueueUrls) {

                    console.log("(list queues) Found", data.QueueUrls.length, "queue(s)")  
        
                    for (i = 0; i < data.QueueUrls.length; i++) {
                        console.log("(list queues) Queue Url", i+1 ,"is:" , data.QueueUrls[i])
                    }
                    res.status(200)
                    res.send(data)    
                } else { // no queues
                    console.log("(list queues) No SQS queues found")  
                    res.status(404)
                    res.send(data)  
                }  
            }
        })
    })



    // 3. get Queue URL. input = queue name
    app.get('/sqs-queue', function (req, res) {

        // pass in the queue name to get the queue URL
        var qParams = {
            QueueName: req.query.queuename
        }

        sqs.getQueueUrl(qParams, function(err, data) {
            if (err) {
                console.log("1!(get queue url)", err, err.stack) // an error occurred
                res.status(500)
                res.send(err)
            } else {
                console.log("(get queue url) Queue URL for", req.query.queuename, "is", data.QueueUrl)
                res.status(200)
                res.send(data)
            }
        })
    })



    // 4. get Queue Attributes. input = queue URL
    app.get('/sqs-queue/attributes', function (req, res) {

        // pass in the queue URL to get Attributes
        var qParams = {
            QueueUrl: req.query.queueurl,
            AttributeNames: ["All"]
        }

        sqs.getQueueAttributes(qParams, function(err, data) {
            if (err) {
                console.log("!!(get queue attr)", err, err.stack) // an error occurred
                res.status(500)
                res.send(err)
            } else {
                console.log("(get queue attr) Queue Attributes are:")
                console.log(data) 
                res.status(200)
                res.send(data)
            }
        })
    })

    
    
    // 5. post message to queue. input = queue URL and message
    app.post ('/sqs-queue/message', function (req, res) {

        var qParams = {
            MessageBody: req.body.message,
            QueueUrl: req.body.queueurl
            }   

        sqs.sendMessage(qParams, function(err, data) {
            if (err) {
            console.log("!!(post message) POST->500", err)
            res.status(500)
            res.send(err)
        } else { 
            console.log("(post message) Sent \"" + req.body.message + "\" to queue Url:", req.body.queueurl )
            console.log("(post message ID is:", data.MessageId)
            res.status(401)
            res.send(data)
        }
    }) 
    })


    // 6. receive (get) message. input = queue URL
    app.get('/sqs-queue/message', function (req, res) {

        var params = {
            QueueUrl: req.query.queueurl,
            VisibilityTimeout: 60 // 1 min wait time for anyone else to process / lock
        };
        
        sqs.receiveMessage(params, function(err, data) {
            if(err) {
                console.log("!!(get message)", err)
                res.status(500)
                res.send(err)
            } 
            else {
                if (data.Messages) {
                    console.log("(get message) Message Receipt Handle:")
                    console.log(data.Messages[0].ReceiptHandle)
                    console.log("(get message) With body:", data.Messages[0].Body)
                    res.status(200)
                    res.send(data);
                }  else { // no messages
                    console.log("(get message) no messages to get")
                    res.status(404)
                    res.send(data);
                }
            }
        })
    })


    // 7. delete message from queue
    app.post('/sqs-queue/message/delete', function (req, res) {

        var params = {
            QueueUrl: req.body.queueurl,
            ReceiptHandle: req.body.messagehandle
        };
        
        sqs.deleteMessage(params, function(err, data) {
            if(err) {
                console.log("!!(delete message)", err)
                res.status(500)
                res.send(err)
            } 
            else {
                console.log("(delete message) Delete Message. Receipt Handle:", req.body.messagehandle)
                res.status(200)
                res.send(data);
            } 
        });
    });



    // 8. purge queue - dangerzone
    app.post('/sqs-queue/purge', function (req, res) {

        var params = {
            QueueUrl: req.body.queueurl
        }
        
        sqs.purgeQueue(params, function(err, data) {
            if(err) {
                console.log("!!(purge queue)", err)
                res.status(500)
                res.send(err);
            } 
            else {
                console.log("(purge queue) Delete Queue", req.body.queueurl)
                res.send(data);
            } 
        })
    })



    // 9. delete queue - dangerzone
    app.post('/sqs-queue/delete', function (req, res) {
        
            var params = {
                QueueUrl: req.body.queueurl
            }
            
            sqs.deleteQueue(params, function(err, data) {
                if(err) {
                    console.log("!!(delete queue)", err)
                    res.status(500)
                    res.send(err);
                } 
                else {
                    console.log("(delete queue) Delete Queue", req.body.queueurl)
                    res.send(data);
                } 
            })
        })


    // 10. set policy for queue (allow sns -> sqs queue)
    app.post('/sqs/setqattr', function (req,res) {

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
                console.log("!!(set queue attr) Error", err)
                res.status(500)
                res.send(err)
            } else {
                console.log("(set queue attr) set policy for queue to:")
                console.log (queuePolicyString)
                res.status(200)
                res.send(data)
            }
        })
    })
        

}