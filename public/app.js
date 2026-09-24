// client-side behaviour: sidebar navigation, confirm on destructive actions,
// copy buttons and JSON highlighting for responses
(function () {

    // sidebar - switch panels without a round trip
    function showPanel(item) {
        document.querySelectorAll('.panel').forEach(function (panel) {
            panel.classList.toggle('active', panel.dataset.item === item)
        })
        document.querySelectorAll('.sidebar a').forEach(function (link) {
            link.classList.toggle('active', link.dataset.item === item)
        })
    }

    document.querySelectorAll('.sidebar a').forEach(function (link) {
        link.addEventListener('click', function (event) {
            event.preventDefault()
            showPanel(link.dataset.item)
        })
    })


    // destructive forms carry data-confirm - show what's about to be hit before submitting
    document.querySelectorAll('form[data-confirm]').forEach(function (form) {
        form.addEventListener('submit', function (event) {
            var target = form.querySelector('input[type=text]')
            var message = form.dataset.confirm + (target && target.value ? '\n\n' + target.value : '')
            if (!window.confirm(message)) event.preventDefault()
        })
    })


    // copy response JSON
    document.querySelectorAll('.response .copy').forEach(function (button) {
        button.addEventListener('click', function () {
            var pre = button.closest('.response').querySelector('pre.json')
            navigator.clipboard.writeText(pre.textContent).then(function () {
                button.textContent = 'Copied'
                setTimeout(function () { button.textContent = 'Copy' }, 1500)
            })
        })
    })


    // JSON syntax highlighting. builds spans with textContent so response data is never parsed as HTML
    var TOKEN = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g

    function tokenClass(token) {
        if (token.charAt(0) === '"') return /:$/.test(token) ? 'j-key' : 'j-str'
        if (token === 'true' || token === 'false') return 'j-bool'
        if (token === 'null') return 'j-null'
        return 'j-num'
    }

    document.querySelectorAll('pre.json').forEach(function (pre) {
        var text = pre.textContent
        var fragment = document.createDocumentFragment()
        var last = 0
        text.replace(TOKEN, function (token, _str, _colon, offset) {
            if (offset > last) fragment.appendChild(document.createTextNode(text.slice(last, offset)))
            var span = document.createElement('span')
            span.className = tokenClass(token)
            span.textContent = token
            fragment.appendChild(span)
            last = offset + token.length
        })
        fragment.appendChild(document.createTextNode(text.slice(last)))
        pre.textContent = ''
        pre.appendChild(fragment)
    })
})()
