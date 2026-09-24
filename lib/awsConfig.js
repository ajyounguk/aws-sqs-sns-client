// Builds the AWS SDK v3 client config for SQS and SNS.
//
// Credentials / region, in order of precedence:
//   1. config/aws-config.json (accessKeyId, secretAccessKey, optional sessionToken, region)
//   2. the standard AWS SDK provider chain (env vars, ~/.aws/credentials, SSO, instance role etc.)
//
// Endpoint overrides (e.g. LocalStack), in order of precedence:
//   1. SQS_ENDPOINT / SNS_ENDPOINT environment variables
//   2. config/aws-override.json (sqs_endpoint, sns_endpoint)

const fs = require('fs')
const path = require('path')

const DEFAULT_CONFIG_DIR = path.join(__dirname, '..', 'config')

// read and parse a JSON file, returning null if it doesn't exist
function readJsonIfExists(file) {
    let raw
    try {
        raw = fs.readFileSync(file, 'utf8')
    } catch (err) {
        if (err.code === 'ENOENT') return null
        throw err
    }
    try {
        return JSON.parse(raw)
    } catch (err) {
        throw new Error(`Invalid JSON in ${file}: ${err.message}`)
    }
}

function loadAwsConfig({ configDir = DEFAULT_CONFIG_DIR, env = process.env, log = console.log } = {}) {
    const base = {}

    const creds = readJsonIfExists(path.join(configDir, 'aws-config.json'))
    if (creds) {
        log('Using AWS credentials from config/aws-config.json')
        if (creds.region) base.region = creds.region
        if (creds.accessKeyId && creds.secretAccessKey) {
            base.credentials = {
                accessKeyId: creds.accessKeyId,
                secretAccessKey: creds.secretAccessKey,
                ...(creds.sessionToken && { sessionToken: creds.sessionToken })
            }
        }
    } else {
        log('No config/aws-config.json found, using the default AWS credential provider chain')
    }

    const overrides = readJsonIfExists(path.join(configDir, 'aws-override.json')) || {}
    const sqsEndpoint = env.SQS_ENDPOINT || overrides.sqs_endpoint
    const snsEndpoint = env.SNS_ENDPOINT || overrides.sns_endpoint

    if (sqsEndpoint) log('Overriding AWS SQS endpoint to:', sqsEndpoint)
    if (snsEndpoint) log('Overriding AWS SNS endpoint to:', snsEndpoint)

    return {
        sqs: { ...base, ...(sqsEndpoint && { endpoint: sqsEndpoint }) },
        sns: { ...base, ...(snsEndpoint && { endpoint: snsEndpoint }) }
    }
}

// describe where requests are going, for the environment badge in the page header.
// kind: 'aws' (real AWS), 'local' (e.g. LocalStack on this machine) or 'custom' (some other endpoint)
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', 'host.docker.internal']

function describeConnection(config) {
    const endpoint = config.sqs.endpoint || config.sns.endpoint
    if (!endpoint) return { kind: 'aws', label: 'AWS', region: config.sqs.region || null }

    let host, hostname
    try {
        ({ host, hostname } = new URL(endpoint))
    } catch {
        host = hostname = endpoint
    }
    const kind = LOCAL_HOSTS.includes(hostname) || hostname.includes('localstack') ? 'local' : 'custom'
    return { kind, label: host, region: config.sqs.region || null }
}

module.exports = { loadAwsConfig, describeConnection }
