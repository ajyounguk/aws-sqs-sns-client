// AWS test SNS controller / API 
module.exports = function (aws, app, ui) {

 
    // setup bodyparser
    var bodyParser = require('body-parser');
    app.use(bodyParser.json()); // support json encoded bodies
    app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies


   
    // create the sns service object
    var sns = new aws.SNS()


    // 11. create Topic - input = topic name
    app.post('/sns', function (req, res) {

        ui.menuitem = 11
    
        var snsParams = {
            Name: req.body.snstopic
        }

        sns.createTopic(snsParams, function(err, data) {
            if (err) {              
                res.status(500)
                ui.data[ui.menuitem] = '(500) Create Topic Error:\n\n' + JSON.stringify(err, null, 3)
            } else {
                res.status(201)
                ui.data[ui.menuitem] = '(201) Success:\n\n' + JSON.stringify(data, null, 3)

                // ui prepop
                ui.def_snsname = req.body.snstopic
                ui.def_snsarn = data.TopicArn
                

            }
            res.render('./index', {ui: ui})
        })
    })

    // 12. subscribe queue to SNS topic
    app.post('/sns/subscribe-queue', function (req, res) {
        
        ui.menuitem = 12
    
        var snsParams = {
            'TopicArn': req.body.snsarn,
            'Protocol': 'sqs',
            'Endpoint': req.body.sqsarn

        }

        sns.subscribe(snsParams, function(err, data) {
            if (err) {              
                res.status(500)
                ui.data[ui.menuitem] = '(500) Queue Subscription Error:\n\n' + JSON.stringify(err, null, 3)
            } else {
                res.status(201)
                ui.data[ui.menuitem] = '(200) Success:\n\n' + JSON.stringify(data, null, 3)

                // ui prepop
                ui.def_snsarn = req.body.snsarn
                ui.def_sqsarn = req.body.snsarn
                ui.def_subarn = data.SubscriptionArn
            }
            res.render('./index', {ui: ui})
        })
    })


    // 13. subscribe email to SNS topic
    app.post('/sns/subscribe-email', function (req, res) {

        ui.menuitem = 13
    
        var snsParams = {
            'TopicArn': req.body.snsarn,
            'Protocol': 'email',
            'Endpoint': req.body.email

        }

        sns.subscribe(snsParams, function(err, data) {
            if (err) {              
                res.status(500)
                ui.data[ui.menuitem] = '(500) Email Subscription Error:\n\n' + JSON.stringify(err, null, 3)
            } else {
                res.status(201)
                ui.data[ui.menuitem] = '(200) Success:\n\n' + JSON.stringify(data, null, 3)
        
                // ui prepop
                ui.def_snsarn = req.body.snsarn

            }
            res.render('./index', {ui: ui})
        })
    })


    // 14. Send message to SNS topics
    app.post('/sns/message', function (req, res) {

        ui.menuitem = 14

        var snsParams = {
            Message: req.body.snsmessage,
            TopicArn: req.body.snstopicarn
        }

        sns.publish (snsParams, function (err, data) {
            if (err) {              
                res.status(500)
                ui.data[ui.menuitem] = '(500) Send Message Error:\n\n' + JSON.stringify(err, null, 3)
            } else {
                res.status(201)
                ui.data[ui.menuitem] = '(201) Success:\n\n' + JSON.stringify(data, null, 3)

                      // ui prepop
                      ui.def_snsarn = req.body.snstopicarn
                  
            }
            res.render('./index', {ui: ui})
        })   
    })



    // 15. List SNS topics
    app.get('/sns', function (req, res) {

        ui.menuitem = 15

        var datalist = { set: [] }
        var i = 0

        function listRecursive (listNextToken, callback) {

            if (listNextToken) {
                var snsParams = { NextToken : listNextToken }
            } else {
                var snsParams = {}
            }

            sns.listTopics (snsParams, function (err, data) {
                if (err) {
                    res.status(500)
                    ui.data[ui.menuitem] = '(500) List Topics Error:\n\n' + JSON.stringify(err, null, 3)
                } else {
                    datalist.set[i] = data
                    i++

                    // if we have a next token, list again
                    if (data.NextToken) {
                        listNextToken = data.NextToken
                        listRecursive(data.NextToken, callback)
                    } else {
                        res.status(200)
                        ui.data[ui.menuitem] = '(200) Success:\n\n' + JSON.stringify(datalist, null, 3)                        
                        callback()
                    }
                }  
            })
        }
        listRecursive(undefined, function () {
            res.render('./index', {ui: ui})
        })
        //res.render('./index', {ui: ui})
    })



    // 16. Delete Topic
    app.post('/sns/delete-topic', function (req, res) {

        ui.menuitem = 16

        var snsParams = {
            TopicArn: req.body.snsarn
        } 

        sns.deleteTopic (snsParams, function (err, data) {
            if (err) {              
                res.status(500)
                ui.data[ui.menuitem] = '(500) Delete Topic  Error:\n\n' + JSON.stringify(err, null, 3)
            } else {
                res.status(201)
                ui.data[ui.menuitem] = '(201) Success:\n\n' + JSON.stringify(data, null, 3)

                // ui prepop
                ui.def_snsarn = req.body.snsarn

            }
            res.render('./index', {ui: ui})
        })   
    })


    // 17. List SNS subscriptions
    app.get('/sns/subscription', function (req, res) {

        ui.menuitem = 17

        var datalist = { set: [] }
        var i = 0

        function listRecursive (listNextToken, callback) {
    
            if (listNextToken) {
                var snsParams = { NextToken : listNextToken }
            } else {
                var snsParams = {}
            }
            
            sns.listSubscriptions (snsParams, function (err, data) {
                if (err) {                 
                    res.status(500)
                    ui.data[ui.menuitem] = '(500) List Topics Error:\n\n' + JSON.stringify(err, null, 3)
                } else {
                    datalist.set[i] = data
                    i++
                   

                    // if we have a next token, list again
                    if (data.NextToken) {
                        listNextToken = data.NextToken
                        listRecursive(data.NextToken, callback)
                    } else {
                        res.status(200)
                        ui.data[ui.menuitem] = '(200) Success:\n\n' + JSON.stringify(datalist, null, 3)
                        callback()
                    }
                }  
            })
        }
        listRecursive(undefined, function () {
            res.render('./index', {ui: ui})
        })
    })

    

    // 18. Unsubscribe
    app.post('/sns/delete-subscription', function (req, res) {

        ui.menuitem = 18

        var snsParams = {
            SubscriptionArn: req.body.snssubarn
        } 

        sns.unsubscribe (snsParams, function (err, data) {
            if (err) {              
                res.status(500)
                ui.data[ui.menuitem] = '(500) Delete Subscription Error:\n\n' + JSON.stringify(err, null, 3)
            } else {
                res.status(200)
                ui.data[ui.menuitem] = '(200) Success:\n\n' + JSON.stringify(data, null, 3)

                ui.def_subarn = req.body.snssubarn
            }
            res.render('./index', {ui: ui})
        })   
    })
}