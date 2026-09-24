// helpers for storing an API result in the ui state and showing it
//
// each result is stored against the current menu item as:
//   { status, kind: 'success' | 'info' | 'error', title, json?, message?, requestId? }
//
// POSTs redirect back to / after storing the result (post/redirect/get), so refreshing the
// page can't resend a delete or purge. GETs are safe to repeat, so they render directly.

const { STATUS_CODES } = require('http')

function respond(res, ui, result) {
    ui.data[ui.menuitem] = result
    if (res.req.method === 'POST') {
        res.redirect(303, '/')
    } else {
        res.status(result.status).render('index', { ui: ui })
    }
}

// informational result with no AWS data, e.g. (404) no messages in queue
function renderResult(res, ui, status, message) {
    respond(res, ui, { status, kind: status < 300 ? 'success' : 'info', title: STATUS_CODES[status], message })
}

// SDK v3 responses carry a $metadata block - keep the request id, drop the rest
function renderSuccess(res, ui, status, data) {
    const { $metadata, ...body } = data || {}
    const result = { status, kind: 'success', title: STATUS_CODES[status] }

    if (Object.keys(body).length) {
        result.json = JSON.stringify(body, null, 2)
    } else {
        result.message = 'Done - no data returned'
    }
    if ($metadata && $metadata.requestId) result.requestId = $metadata.requestId

    respond(res, ui, result)
}

// SDK v3 errors don't JSON.stringify usefully (message is non-enumerable), so pick out the useful bits.
// Uses the AWS HTTP status where there is one (e.g. 400 for a bad queue name), otherwise 500.
function renderError(res, ui, label, err) {
    const meta = err.$metadata || {}
    const status = meta.httpStatusCode >= 400 ? meta.httpStatusCode : 500
    const detail = {
        name: err.name,
        message: err.message,
        ...(err.Code && { code: err.Code })
    }
    respond(res, ui, {
        status,
        kind: 'error',
        title: label + ' Error',
        json: JSON.stringify(detail, null, 2),
        ...(meta.requestId && { requestId: meta.requestId })
    })
}

module.exports = { renderResult, renderSuccess, renderError }
