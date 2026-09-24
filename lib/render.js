// helpers for writing an API result into the ui state and re-rendering the page

// render the index page with the result text stored against the current menu item
function renderResult(res, ui, status, text) {
    ui.data[ui.menuitem] = `(${status}) ${text}`
    res.status(status).render('index', { ui: ui })
}

function renderSuccess(res, ui, status, data) {
    renderResult(res, ui, status, 'Success:\n\n' + JSON.stringify(data, null, 3))
}

// SDK v3 errors don't JSON.stringify usefully (message is non-enumerable), so pick out the useful bits.
// Uses the AWS HTTP status where there is one (e.g. 400 for a bad queue name), otherwise 500.
function renderError(res, ui, label, err) {
    const meta = err.$metadata || {}
    const status = meta.httpStatusCode >= 400 ? meta.httpStatusCode : 500
    const detail = {
        name: err.name,
        message: err.message,
        ...(err.Code && { code: err.Code }),
        ...(meta.requestId && { requestId: meta.requestId })
    }
    renderResult(res, ui, status, label + ' Error:\n\n' + JSON.stringify(detail, null, 3))
}

module.exports = { renderResult, renderSuccess, renderError }
