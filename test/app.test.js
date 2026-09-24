const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const request = require('supertest')
const { CreateQueueCommand, SendMessageCommand } = require('@aws-sdk/client-sqs')
const { loadAwsConfig, describeConnection } = require('../lib/awsConfig')
const { setup } = require('./helpers')

describe('app', () => {
    it('GET / renders every SQS and SNS panel with a sidebar link', async () => {
        const { app } = setup()

        const res = await request(app).get('/')

        assert.equal(res.status, 200)
        assert.match(res.headers['content-type'], /text\/html/)
        for (let i = 1; i <= 18; i++) {
            assert.match(res.text, new RegExp(`<section class="panel[^"]*" data-item="${i}">`), `panel ${i} missing`)
            assert.match(res.text, new RegExp(`<a href="#" data-item="${i}"`), `nav link ${i} missing`)
        }
        assert.equal((res.text.match(/<body/g) || []).length, 1)
    })

    it('marks only the current menu item active', async () => {
        const { app, ui } = setup()
        ui.menuitem = 14

        const res = await request(app).get('/')

        assert.deepEqual(res.text.match(/<section class="panel active" data-item="(\d+)"/g),
            ['<section class="panel active" data-item="14"'])
        assert.match(res.text, /<a href="#" data-item="14" class="active"/)
    })

    it('shows the result of a POST on the page it redirects to', async () => {
        const { app, sqsMock } = setup()
        sqsMock.on(CreateQueueCommand).resolves({ QueueUrl: 'https://example/q', $metadata: { requestId: 'rid-9' } })

        const agent = request.agent(app)
        const res = await agent.post('/sqs-queue').type('form').send({ queuename: 'q' }).redirects(1)

        assert.equal(res.status, 200)
        assert.match(res.text, /<section class="panel active" data-item="1">/)
        assert.match(res.text, /class="response response-success"/)
        assert.match(res.text, /<span class="badge">201<\/span>/)
        assert.match(res.text, /rid-9/)
        assert.doesNotMatch(res.text, /\$metadata/)
    })

    it('says so when AWS returns no data', async () => {
        const { app, sqsMock, ui } = setup()
        sqsMock.on(SendMessageCommand).resolves({ $metadata: { httpStatusCode: 200 } })

        await request(app).post('/sqs-queue/message').type('form').send({ queueurl: 'u', message: 'm' })

        assert.equal(ui.data[5].json, undefined)
        assert.match(ui.data[5].message, /no data returned/)
    })

    it('asks for confirmation on every destructive action', async () => {
        const { app } = setup()

        const res = await request(app).get('/')

        for (const action of ['/sqs-queue/purge', '/sqs-queue/delete', '/sns/delete-topic', '/sns/delete-subscription']) {
            assert.match(res.text, new RegExp(`action="${action}" data-confirm="[^"]+"`), `${action} has no confirm`)
        }
    })

    it('shows which environment requests go to', async () => {
        const local = await request(setup().app).get('/')
        assert.match(local.text, /class="env env-local"/)
        assert.match(local.text, /localhost:4566 &middot; eu-west-2/)

        const aws = await request(setup({ connection: { kind: 'aws', label: 'AWS', region: 'eu-west-1' } }).app).get('/')
        assert.match(aws.text, /class="env env-aws"/)
        assert.match(aws.text, /AWS &middot; eu-west-1/)
    })

    it('escapes values rendered back into the page', async () => {
        const { app, ui } = setup()
        ui.def_sqsname = '"><script>alert(1)</script>'

        const res = await request(app).get('/')

        assert.doesNotMatch(res.text, /<script>alert\(1\)<\/script>/)
    })

    it('serves the stylesheet and script', async () => {
        const { app } = setup()

        const css = await request(app).get('/assets/styles.css')
        const js = await request(app).get('/assets/app.js')

        assert.equal(css.status, 200)
        assert.match(css.headers['content-type'], /text\/css/)
        assert.equal(js.status, 200)
        assert.match(js.headers['content-type'], /javascript/)
    })
})

describe('describeConnection', () => {
    const cfg = (endpoint, region) => ({ sqs: { endpoint, region }, sns: { endpoint, region } })

    it('reports real AWS when no endpoint is overridden', () => {
        assert.deepEqual(describeConnection(cfg(undefined, 'eu-west-2')), { kind: 'aws', label: 'AWS', region: 'eu-west-2' })
    })

    it('reports local for localhost-style endpoints', () => {
        for (const endpoint of ['http://localhost:4566', 'http://127.0.0.1:4566', 'http://[::1]:4566', 'http://localstack:4566']) {
            assert.equal(describeConnection(cfg(endpoint)).kind, 'local', endpoint)
        }
        assert.equal(describeConnection(cfg('http://localhost:4566')).label, 'localhost:4566')
    })

    it('reports custom for any other endpoint', () => {
        assert.deepEqual(describeConnection(cfg('https://proxy.example.com')),
            { kind: 'custom', label: 'proxy.example.com', region: null })
    })
})

describe('loadAwsConfig', () => {
    let dir
    const quiet = () => {}

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aws-cfg-'))
    })

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true })
    })

    const write = (name, obj) => fs.writeFileSync(path.join(dir, name), JSON.stringify(obj))

    it('returns empty config (default provider chain) when no files exist', () => {
        assert.deepEqual(loadAwsConfig({ configDir: dir, env: {}, log: quiet }), { sqs: {}, sns: {} })
    })

    it('uses credentials and region from aws-config.json', () => {
        write('aws-config.json', { accessKeyId: 'AK', secretAccessKey: 'SK', region: 'eu-west-2' })

        const cfg = loadAwsConfig({ configDir: dir, env: {}, log: quiet })

        const expected = { region: 'eu-west-2', credentials: { accessKeyId: 'AK', secretAccessKey: 'SK' } }
        assert.deepEqual(cfg.sqs, expected)
        assert.deepEqual(cfg.sns, expected)
    })

    it('passes through a session token when present', () => {
        write('aws-config.json', { accessKeyId: 'AK', secretAccessKey: 'SK', sessionToken: 'ST', region: 'us-east-1' })

        const cfg = loadAwsConfig({ configDir: dir, env: {}, log: quiet })

        assert.equal(cfg.sqs.credentials.sessionToken, 'ST')
    })

    it('uses region only when keys are not in the file', () => {
        write('aws-config.json', { region: 'eu-west-1' })

        const cfg = loadAwsConfig({ configDir: dir, env: {}, log: quiet })

        assert.deepEqual(cfg.sqs, { region: 'eu-west-1' })
    })

    it('applies endpoint overrides from aws-override.json', () => {
        write('aws-override.json', { sqs_endpoint: 'http://localhost:4566', sns_endpoint: 'http://localhost:4567' })

        const cfg = loadAwsConfig({ configDir: dir, env: {}, log: quiet })

        assert.equal(cfg.sqs.endpoint, 'http://localhost:4566')
        assert.equal(cfg.sns.endpoint, 'http://localhost:4567')
    })

    it('lets env vars win over aws-override.json', () => {
        write('aws-override.json', { sqs_endpoint: 'http://file-sqs', sns_endpoint: 'http://file-sns' })

        const cfg = loadAwsConfig({ configDir: dir, env: { SQS_ENDPOINT: 'http://env-sqs' }, log: quiet })

        assert.equal(cfg.sqs.endpoint, 'http://env-sqs')
        assert.equal(cfg.sns.endpoint, 'http://file-sns')
    })

    it('gives a clear error for malformed JSON', () => {
        fs.writeFileSync(path.join(dir, 'aws-config.json'), '{ not json')

        assert.throws(() => loadAwsConfig({ configDir: dir, env: {}, log: quiet }), /Invalid JSON in .*aws-config\.json/)
    })
})
