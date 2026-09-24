const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const request = require('supertest')
const { loadAwsConfig } = require('../lib/awsConfig')
const { setup } = require('./helpers')

describe('app', () => {
    it('GET / renders every SQS and SNS panel', async () => {
        const { app } = setup()

        const res = await request(app).get('/')

        assert.equal(res.status, 200)
        assert.match(res.headers['content-type'], /text\/html/)
        assert.match(res.text, /onload="displayOption\(1\)"/)
        for (let i = 1; i <= 18; i++) {
            assert.match(res.text, new RegExp(`<div id="${i}" class="menu-div"`), `panel ${i} missing`)
        }
        assert.equal((res.text.match(/<body/g) || []).length, 1)
    })

    it('escapes values rendered back into the page', async () => {
        const { app, ui } = setup()
        ui.def_sqsname = '"><script>alert(1)</script>'

        const res = await request(app).get('/')

        assert.doesNotMatch(res.text, /<script>alert\(1\)<\/script>/)
    })

    it('serves the stylesheet', async () => {
        const { app } = setup()

        const res = await request(app).get('/assets/styles.css')

        assert.equal(res.status, 200)
        assert.match(res.headers['content-type'], /text\/css/)
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
