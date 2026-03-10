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

function TextSelectionModal({ ab, book, onClose, onUpdated, addToast }) {
    const [text, setText] = useState('')
    const [loading, setLoading] = useState(true)
    const [start, setStart] = useState(ab.start_char ?? 0)
    const [end, setEnd] = useState(ab.end_char ?? 0)
    const [saving, setSaving] = useState(false)
    const [selectionMode, setSelectionMode] = useState(null) // 'start' or 'end'

    useEffect(() => {
        api.books.text(book.id)
            .then(r => {
                setText(r.text)
                if (ab.end_char === null || ab.end_char === 0) setEnd(r.text.length)
            })
            .catch(() => addToast('Error al cargar el texto', 'error'))
            .finally(() => setLoading(false))
    }, [book.id, ab.end_char])

    const countWords = (t) => t.split(/\s+/).filter(Boolean).length

    async function handleSave() {
        setSaving(true)
        try {
            await api.audiobooks.update(ab.id, { start_char: start, end_char: end })
            addToast('Rango actualizado', 'success')
            onUpdated()
            onClose()
        } catch (e) {
            addToast(e.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleTextClick = (e) => {
        if (!selectionMode) return

        let offset = 0
        if (document.caretRangeFromPoint) {
            const range = document.caretRangeFromPoint(e.clientX, e.clientY)
            const container = document.getElementById('selection-pre')
            const preRange = document.createRange()
            preRange.selectNodeContents(container)
            preRange.setEnd(range.startContainer, range.startOffset)
            offset = preRange.toString().length
        } else {
            const sel = window.getSelection()
            if (!sel.rangeCount) return
            const range = sel.getRangeAt(0)
            const container = document.getElementById('selection-pre')
            const preRange = document.createRange()
            preRange.selectNodeContents(container)
            preRange.setEnd(range.startContainer, range.startOffset)
            offset = preRange.toString().length
        }

        if (selectionMode === 'start') {
            setStart(Math.min(offset, end))
            addToast(`Inicio fijado en palabra ${countWords(text.substring(0, offset))}`, 'success')
        } else {
            setEnd(Math.max(offset, start))
            addToast(`Fin fijado en palabra ${countWords(text.substring(0, offset))}`, 'success')
        }
        setSelectionMode(null)
    }

    const renderText = () => {
        if (!text) return null
        const before = text.substring(0, start)
        const selected = text.substring(start, end)
        const after = text.substring(end)

        return (
            <pre
                id="selection-pre"
                className={`selection-content ${selectionMode ? 'selecting-' + selectionMode : ''}`}
                onClick={handleTextClick}
                style={{ cursor: selectionMode ? 'crosshair' : 'text' }}
            >
                <span className="text-range-before">{before}</span>
                <span className="text-range-selected">{selected}</span>
                <span className="text-range-after">{after}</span>
            </pre>
        )
    }

    const startWords = countWords(text.substring(0, start))
    const endWords = countWords(text.substring(0, end))
    const totalWords = countWords(text)

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal text-modal selection-modal" onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 className="modal-title" style={{ marginBottom: 0 }}>✂️ Seleccionar Rango: {book.title}</h2>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
                </div>

                <div className="selection-tools-v2">
                    <div className={`tool-btn bracket-btn ${selectionMode === 'start' ? 'active' : ''}`} onClick={() => setSelectionMode(selectionMode === 'start' ? null : 'start')}>
                        <div className="tool-info">
                            <span className="tool-label">INICIO</span>
                            <span className="tool-value">{startWords.toLocaleString()} Pal.</span>
                        </div>
                        <span className="bracket-icon green">]</span>
                    </div>

                    {selectionMode ? (
                        <div className="selection-instruction animate-pulse">
                            Selecciona en el texto el {selectionMode === 'start' ? 'COMIENZO' : 'FINAL'}
                        </div>
                    ) : (
                        <div className="selection-instruction inactive">
                            Usa los corchetes para delimitar el audio
                        </div>
                    )}

                    <div className={`tool-btn bracket-btn ${selectionMode === 'end' ? 'active' : ''}`} onClick={() => setSelectionMode(selectionMode === 'end' ? null : 'end')}>
                        <span className="bracket-icon red">[</span>
                        <div className="tool-info align-right">
                            <span className="tool-label">FIN</span>
                            <span className="tool-value">{endWords.toLocaleString()} Pal.</span>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Cargando texto...</div>
                ) : (
                    <div className="text-container-scroll">
                        {renderText()}
                    </div>
                )}

                <div className="modal-footer">
                    <p style={{ flex: 1, fontSize: 13, color: 'var(--muted)' }}>
                        📖 Selección: <b>{(endWords - startWords).toLocaleString()}</b> / {totalWords.toLocaleString()} palabras
                        <span style={{ marginLeft: 12 }}>({(((endWords - startWords) / (totalWords || 1)) * 100).toFixed(1)}%)</span>
                    </p>
                    <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving || selectionMode}>
                        {saving ? 'Guardando...' : 'Guardar Rango'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function ProgressCard({ ab, book, onRefresh, addToast, onRemove, onEdit }) {
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
            const startVal = ab.started_at ? new Date(ab.started_at).getTime() : Date.now()
            timer = setInterval(() => {
                setElapsed(Math.round((Date.now() - startVal) / 1000))
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

    const totalWords = ab.total_words || 0
    const coverUrl = book?.cover_path ? `/api${book.cover_path}` : null

    return (
        <div className="card book-card horizontal audiobook-card">
            <div className="book-card-left" onClick={onEdit} title="Editar rango">
                {coverUrl ? (
                    <img src={coverUrl} alt={book?.title} className="book-cover-img" />
                ) : (
                    <div className="book-icon-placeholder">🎧</div>
                )}
            </div>
            <div className="book-card-right">
                <div className="ab-header">
                    <h3 className="ab-title" title={book?.title}>{book?.title || `Audiolibro #${ab.id}`}</h3>
                    <span className={`badge badge-${status === 'pending' && isRunning ? 'processing' : status}`}>
                        {isRunning ? 'Procesando' : status === 'pending' ? 'Pendiente' : status === 'done' ? 'Completado' : status === 'error' ? 'Error' : 'En curso'}
                    </span>
                </div>

                <p className="ab-narrator">🎙 {ab.narratorName}</p>

                <div className="ab-stats-grid">
                    <div className="stat-item">
                        <span className="stat-label">FORMATO</span>
                        <span className="stat-value">{ab.output_format?.toUpperCase()}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">PALABRAS</span>
                        <span className="stat-value">{totalWords.toLocaleString()}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">TIEMPO</span>
                        <span className="stat-value">{elapsed > 0 ? `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, '0')}` : '--:--'}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">FRAGMENTOS</span>
                        <span className="stat-value">{progress?.completed_chunks ?? ab.completed_chunks}/{progress?.total_chunks ?? ab.total_chunks}</span>
                    </div>
                </div>

                <div className="ab-footer">
                    <div className="ab-progress-container">
                        <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="pct-text">{pct}%</span>
                    </div>

                    <div className="ab-actions">
                        {status === 'done' ? (
                            <a className="btn btn-primary btn-sm" href={api.audiobooks.downloadUrl(ab.id)} download title="Descargar">⬇</a>
                        ) : isRunning ? (
                            <button className="btn btn-ghost btn-sm" onClick={handlePause} title="Pausar">⏸</button>
                        ) : (
                            <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn btn-primary btn-sm" onClick={() => handleStart('qwen')} title="Motor QWEN (Local)">🏠</button>
                                <button className="btn btn-accent btn-sm" onClick={() => handleStart('piper')} title="Motor Piper (Rápido)">🎺</button>
                                <button className="btn btn-warning btn-sm" onClick={() => handleStart('cloud')} title="Motor Nube (Modal)">☁️</button>
                            </div>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={onEdit} title="Editar rango">⚙️</button>
                        <button className="btn btn-danger btn-sm" onClick={() => onRemove(ab.id)} title="Eliminar">🗑</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function AudiobooksPage() {
    const [audiobooks, setAudiobooks] = useState([])
    const [voices, setVoices] = useState([])
    const [books, setBooks] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [editingAb, setEditingAb] = useState(null)
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
                                            <ProgressCard
                                                ab={ab}
                                                book={books.find(b => b.id === ab.book_id)}
                                                onRefresh={load}
                                                addToast={addToast}
                                                onRemove={remove}
                                                onEdit={() => setEditingAb(ab)}
                                            />
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
            {editingAb && (
                <TextSelectionModal
                    ab={editingAb}
                    book={books.find(b => b.id === editingAb.book_id)}
                    onClose={() => setEditingAb(null)}
                    onUpdated={load}
                    addToast={addToast}
                />
            )}
            <Toast toasts={toasts} />
        </>
    )
}
