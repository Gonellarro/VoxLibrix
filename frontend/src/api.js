const BASE = '/api'

async function req(method, path, body, isForm = false) {
    const opts = { method, headers: {} }
    if (body) {
        if (isForm) {
            opts.body = body
        } else {
            opts.headers['Content-Type'] = 'application/json'
            opts.body = JSON.stringify(body)
        }
    }
    const res = await fetch(BASE + path, opts)
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || 'Error del servidor')
    }
    if (res.status === 204) return null
    return res.json()
}

async function reqBlob(method, path, body) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }
    const res = await fetch(BASE + path, opts)
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || 'Error del servidor')
    }
    return res.blob()
}

// ── Voices ────────────────────────────────────────────────────────────────────
export const api = {
    voices: {
        list: () => req('GET', '/voices'),
        piperVoices: () => req('GET', '/voices/piper'),
        piperDownload: (voiceId) => req('POST', `/voices/piper/${voiceId}/download`),
        piperTest: (voiceId, text) => reqBlob('POST', `/voices/piper/${voiceId}/test`, { text }),
        get: (id) => req('GET', `/voices/${id}`),
        create: (form) => req('POST', '/voices', form, true),
        update: (id, form) => req('PUT', `/voices/${id}`, form, true),
        delete: (id) => req('DELETE', `/voices/${id}`),
        sampleUrl: (id) => `${BASE}/voices/${id}/sample`,
        test: (id, text) => reqBlob('POST', `/voices/${id}/test`, { text }),
    },

    books: {
        list: () => req('GET', '/books'),
        get: (id) => req('GET', `/books/${id}`),
        create: (form) => req('POST', '/books', form, true),
        update: (id, form) => req('PATCH', `/books/${id}`, form, true),
        delete: (id) => req('DELETE', `/books/${id}`),
        tags: (id) => req('GET', `/books/${id}/tags`),
        text: (id) => req('GET', `/books/${id}/text`),
    },

    authors: {
        list: () => req('GET', '/authors'),
        create: (data) => req('POST', '/authors', data),
        update: (id, data) => req('PUT', `/authors/${id}`, data),
        delete: (id) => req('DELETE', `/authors/${id}`),
    },

    audiobooks: {
        list: () => req('GET', '/audiobooks'),
        get: (id) => req('GET', `/audiobooks/${id}`),
        create: (body) => req('POST', '/audiobooks', body),
        delete: (id) => req('DELETE', `/audiobooks/${id}`),
        start: (id, engine = 'qwen') => req('POST', `/audiobooks/${id}/start?engine=${engine}`),
        pause: (id) => req('POST', `/audiobooks/${id}/pause`),
        progress: (id) => req('GET', `/audiobooks/${id}/progress`),
        mappings: (id) => req('GET', `/audiobooks/${id}/mappings`),
        update: (id, body) => req('PATCH', `/audiobooks/${id}`, body),
        downloadUrl: (id, fmt) => `${BASE}/audiobooks/${id}/download`,
    },

    admin: {
        stats: () => req('GET', '/admin/stats'),
        backups: () => req('GET', '/admin/backups'),
        createBackup: () => req('POST', '/admin/backup'),
        deleteBackup: (filename) => req('DELETE', `/admin/backups/${filename}`),
        downloadBackupUrl: (filename) => `${BASE}/admin/backups/download/${filename}`,
    },
}
