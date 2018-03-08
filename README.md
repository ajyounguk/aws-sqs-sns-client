## AWS SQS & SNS NodeJS Example / Demo code

## What is this?
node js web server + html forms that excercise AWS SNS & SQS functionality 

## Contains
- app.js = main app & webserver. Launch this
- /controllers = HTTP routes and sns/sqs API functionality 
- /config = example aws creds config file
- /public = main index.html, and sqs/sns html forms 

### SQS Functionality:
- Create SQS queues
- List SQS queues
- Get queue URL
- Get queue attributes
- Send message to queue
- Get (receive) message from queue
- Delete message from queue
- Purge all messages from queue
- Delete queues
- Set queue attributes (namely policy for SNS subcription)

### SNS Functionality:
- Create topics
- Add queue subscription
- Add email subscription
- Send message to topic
- List topics
- Delete topics
- List subscriptions
- Delete subscriptions

## Acknowledgements
Based on code from AWS SQS examples at: https://www.youtube.com/watch?v=4Z74luiE2bg\ and https://github.com/andrewpuch/aws-sqs-node-js-examples

Mark Allen's SNS code here: https://github.com/markcallen/snssqs/blob/master/create.js

CSS template inspired from: https://www.sanwebe.com/2014/08/css-html-forms-designs


## Installation overview
Mac = install node...

clone the repo and install modules:

```
git clone https://github.com/ajyounguk/aws-sns-sqs-demo
cd aws-sns-sqs-demo
npm install
```

## AWS Credentials
Copy the configuration details and add your AWS creds.
```
cd config
cp config-sample.json config.json
```

For IAM user, add group policy = AmazonSQSFullAccess, AmazonSNSFullAccess works)

## How to run it
run the webserver:

```
node app.js
```

point your browser at the local/remoteIP port 3000 to load the test harness, click the SNS/SQS buttons to launch the test html forms

For more information on AWS SNS and SQS:

https://aws.amazon.com/sns/
https://aws.amazon.com/sqs/

