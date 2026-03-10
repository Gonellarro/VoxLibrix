import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.js'

function Toast({ toasts }) {
    return (
        <div className="toast-container">
            {toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}
        </div>
    )
}

function CreateModal({ voices, books, onClose, onSaved, addToast }) {
    const [bookId, setBookId] = useState('')
    const [narratorId, setNarratorId] = useState('')
    const [format, setFormat] = useState('mp3')
    const [tags, setTags] = useState([])
    const [mappings, setMappings] = useState({}) // tag -> voice_id
    const [saving, setSaving] = useState(false)

    const selectedBook = books.find(b => b.id === Number(bookId))

    useEffect(() => {
        if (!bookId || selectedBook?.type !== 'multi_voice') { setTags([]); return }
        api.books.tags(bookId).then(r => setTags(r.tags || [])).catch(() => { })
    }, [bookId])

    async function save() {
        if (!bookId) return addToast('Selecciona un libro', 'error')
        if (!narratorId) return addToast('Selecciona una voz narradora', 'error')

        const voice_mappings = tags
            .filter(t => mappings[t])
            .map(t => ({ tag_name: t, voice_id: Number(mappings[t]) }))

        setSaving(true)
        try {
            await api.audiobooks.create({
                book_id: Number(bookId),
                narrator_voice_id: Number(narratorId),
                output_format: format,
                voice_mappings: voice_mappings.length ? voice_mappings : null,
            })
            addToast('Audiolibro creado', 'success')
            onSaved()
        } catch (e) {
            addToast(e.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <h2 className="modal-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
                    Nuevo audiolibro
                </h2>

                <div className="form-group">
                    <label className="form-label">Libro *</label>
                    <select className="form-select" value={bookId} onChange={e => setBookId(e.target.value)}>
                        <option value="">— Selecciona un libro —</option>
                        {books.map(b => <option key={b.id} value={b.id}>{b.title} {b.author ? `· ${b.author}` : ''}</option>)}
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">Voz narradora * <span style={{ color: 'var(--muted)', fontWeight: 400, textTransform: 'none' }}>(texto sin tag)</span></label>
                    <select className="form-select" value={narratorId} onChange={e => setNarratorId(e.target.value)}>
                        <option value="">— Selecciona una voz —</option>
                        {voices.filter(v => v.is_active).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">Formato de salida</label>
                    <select className="form-select" value={format} onChange={e => setFormat(e.target.value)}>
                        <option value="mp3">MP3</option>
                        <option value="wav">WAV (sin compresión)</option>
                    </select>
                </div>

                {tags.length > 0 && (
                    <>
                        <div className="section-label">Mapeo de personajes</div>
                        {tags.map(tag => (
                            <div className="form-group" key={tag} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <span style={{
                                    padding: '4px 10px', borderRadius: 6, background: 'rgba(6,182,212,0.1)',
                                    color: 'var(--accent)', fontSize: 13, fontWeight: 600, minWidth: 120, flexShrink: 0
                                }}>[{tag}]</span>
                                <select
                                    className="form-select"
                                    value={mappings[tag] || ''}
                                    onChange={e => setMappings(m => ({ ...m, [tag]: e.target.value }))}
                                >
                                    <option value="">(voz narradora)</option>
                                    {voices.filter(v => v.is_active).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                </select>
                            </div>
                        ))}
                    </>
                )}

                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-primary" onClick={save} disabled={saving}>
                        {saving ? 'Creando...' : 'Crear audiolibro'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function ProgressCard({ ab, onRefresh, addToast, onRemove }) {
    const [progress, setProgress] = useState(null)
    const [polling, setPolling] = useState(false)
    const [elapsed, setElapsed] = useState(0)

    const fetchProgress = useCallback(async () => {
        try {
            const p = await api.audiobooks.progress(ab.id)
            setProgress(p)
            if (p.status === 'processing' || p.is_running) {
                setTimeout(fetchProgress, 1500)
            } else {
                setPolling(false)
                if (p.status === 'done') onRefresh()
            }
        } catch { }
    }, [ab.id])

    useEffect(() => {
        let timer
        if (polling || ab.status === 'processing') {
            const start = ab.started_at ? new Date(ab.started_at).getTime() : Date.now()
            timer = setInterval(() => {
                setElapsed(Math.round((Date.now() - start) / 1000))
            }, 1000)
        } else if (ab.status === 'done' && ab.finished_at && ab.started_at) {
            const diff = (new Date(ab.finished_at).getTime() - new Date(ab.started_at).getTime()) / 1000
            setElapsed(Math.round(diff))
        }
        return () => clearInterval(timer)
    }, [polling, ab.status, ab.started_at, ab.finished_at])

    useEffect(() => {
        if (ab.status === 'processing') {
            setPolling(true)
            fetchProgress()
        } else {
            setProgress({ status: ab.status, percent: ab.status === 'done' ? 100 : 0, total_chunks: ab.total_chunks, completed_chunks: ab.completed_chunks })
        }
    }, [ab.id, ab.status])

    async function handleStart(engine = 'qwen') {
        try {
            await api.audiobooks.start(ab.id, engine)
            setPolling(true)
            fetchProgress()
            const labels = { qwen: 'QWEN 🏠', piper: 'Piper 🎺', cloud: 'Nube ☁️' }
            addToast(`Generación iniciada: ${labels[engine] || engine}`, 'info')
        } catch (e) { addToast(e.message, 'error') }
    }

    async function handlePause() {
        try {
            await api.audiobooks.pause(ab.id)
            addToast('Pausando... se detendrá al finalizar el fragmento actual', 'info')
        } catch (e) { addToast(e.message, 'error') }
    }

    const pct = progress?.percent ?? 0
    const status = progress?.status ?? ab.status
    const isRunning = progress?.is_running ?? false

    // Calcular métricas
    const totalWords = ab.total_words || 0
    const wordsPerSec = elapsed > 0 ? (totalWords / elapsed).toFixed(2) : 0
    const secPerWord = totalWords > 0 ? (elapsed / totalWords).toFixed(2) : 0

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="card-title" style={{ fontSize: 14 }}>ID #{ab.id}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {elapsed > 0 && (
                        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
                            ⏱ {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')}
                        </span>
                    )}
                    <span className={`badge badge-${status === 'pending' && isRunning ? 'processing' : status}`}>
                        {isRunning ? 'Procesando' : status === 'pending' ? 'Pendiente' : status === 'done' ? 'Completado' : status === 'error' ? 'Error' : 'En curso'}
                    </span>
                </div>
            </div>
            <div className="card-meta">
                Formato: {ab.output_format?.toUpperCase()} · {totalWords} palabras
            </div>

            {(status !== 'pending' || progress?.total_chunks > 0) && (
                <div className="progress-wrap">
                    <div className="progress-label">
                        <span>{progress?.completed_chunks ?? ab.completed_chunks}/{progress?.total_chunks ?? ab.total_chunks} fragmentos</span>
                        <span>{pct}%</span>
                    </div>
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    {status === 'done' && elapsed > 0 && (
                        <div style={{ fontSize: 11, marginTop: 4, color: 'var(--accent)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Velocidad: {wordsPerSec} pal/s</span>
                            <span>({secPerWord} s/pal)</span>
                        </div>
                    )}
                </div>
            )}

            {progress?.error_message && (
                <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 8 }}>{progress.error_message}</p>
            )}

            <div className="card-actions">
                {status === 'done' ? (
                    <a className="btn btn-primary btn-sm" href={api.audiobooks.downloadUrl(ab.id)} download>
                        ⬇ Descargar
                    </a>
                ) : isRunning ? (
                    <button className="btn btn-ghost btn-sm" onClick={handlePause}>⏸ Pausar</button>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => handleStart('qwen')} disabled={status === 'error'}>
                            🏠 QWEN
                        </button>
                        <button className="btn btn-accent btn-sm" onClick={() => handleStart('piper')} disabled={status === 'error'}>
                            🎺 Piper
                        </button>
                        <button className="btn btn-warning btn-sm" onClick={() => handleStart('cloud')} disabled={status === 'error'}>
                            ☁️ Nube
                        </button>
                    </div>
                )}
                <button className="btn btn-danger btn-sm" onClick={() => onRemove(ab.id)}>Eliminar</button>
            </div>
        </div>
    )
}

export default function AudiobooksPage() {
    const [audiobooks, setAudiobooks] = useState([])
    const [voices, setVoices] = useState([])
    const [books, setBooks] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [toasts, setToasts] = useState([])

    function addToast(msg, type = 'info') {
        const id = Date.now()
        setToasts(t => [...t, { id, msg, type }])
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
    }

    async function load() {
        try {
            const [abs, vs, bs] = await Promise.all([
                api.audiobooks.list(),
                api.voices.list(),
                api.books.list(),
            ])
            setAudiobooks(abs)
            setVoices(vs)
            setBooks(bs)
        } catch (e) { addToast(e.message, 'error') }
    }

    useEffect(() => { load() }, [])

    async function remove(id) {
        if (!confirm('¿Eliminar este audiolibro?')) return
        try {
            await api.audiobooks.delete(id)
            addToast('Audiolibro eliminado', 'success')
            load()
        } catch (e) { addToast(e.message, 'error') }
    }

    // Enrich audiobooks with book title
    const enriched = audiobooks.map(ab => ({
        ...ab,
        bookTitle: books.find(b => b.id === ab.book_id)?.title || (ab.book_id ? `Libro #${ab.book_id}` : 'Libro (eliminado)'),
        narratorName: voices.find(v => v.id === ab.narrator_voice_id)?.name || `Voz #${ab.narrator_voice_id}`,
    }))

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Estudio</h1>
                    <p className="page-subtitle">{audiobooks.length} audiolibro{audiobooks.length !== 1 ? 's' : ''}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Nuevo audiolibro
                </button>
            </div>

            {enriched.length === 0 ? (
                <div className="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }}><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
                    <h3>Sin audiolibros</h3>
                    <p>Crea tu primer audiolibro seleccionando un libro y una voz</p>
                </div>
            ) : (
                <>
                    {/* Group by status */}
                    {['processing', 'pending', 'done', 'error'].map(s => {
                        const group = enriched.filter(a => a.status === s)
                        if (!group.length) return null
                        const labels = { processing: 'En proceso', pending: 'Pendientes', done: 'Completados', error: 'Con error' }
                        return (
                            <div key={s}>
                                <div className="section-label">{labels[s]}</div>
                                <div className="card-grid" style={{ marginBottom: 8 }}>
                                    {group.map(ab => (
                                        <div key={ab.id} style={{ position: 'relative' }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{ab.bookTitle}</div>
                                            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>🎙 {ab.narratorName}</div>
                                            <ProgressCard ab={ab} onRefresh={load} addToast={addToast} onRemove={remove} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </>
            )}

            {showModal && (
                <CreateModal
                    voices={voices}
                    books={books}
                    onClose={() => setShowModal(false)}
                    onSaved={() => { setShowModal(false); load() }}
                    addToast={addToast}
                />
            )}
            <Toast toasts={toasts} />
        </>
    )
}
