import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api.js'
import TagEditor from '../components/TagEditor.jsx'

function Toast({ toasts }) {
    return (
        <div className="toast-container">
            {toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}
        </div>
    )
}


function CreateModal({ voices, piperVoices, books, onClose, onSaved, addToast }) {
    const [bookId, setBookId] = useState('')
    const [voiceKey, setVoiceKey] = useState('')  // 'cloned:ID' or 'piper:voice_id'
    const [format, setFormat] = useState('mp3')
    const [tags, setTags] = useState([])
    const [mappings, setMappings] = useState({}) // tag -> voice_id
    const [tagsLoading, setTagsLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [useCloud, setUseCloud] = useState(false)

    const selectedBook = books.find(b => b.id === Number(bookId))
    const isPiper = voiceKey.startsWith('piper:')
    const selectedPiperId = isPiper ? voiceKey.split(':')[1] : null
    const selectedClonedId = !isPiper && voiceKey ? Number(voiceKey.split(':')[1]) : null

    useEffect(() => {
        if (!bookId || selectedBook?.type !== 'multi_voice') { setTags([]); return }
        setTagsLoading(true)
        api.books.tags(bookId)
            .then(r => setTags(r.tags || []))
            .catch(() => { })
            .finally(() => setTagsLoading(false))
    }, [bookId, selectedBook?.type])

    async function save() {
        if (!bookId) return addToast('Selecciona un libro', 'error')
        if (!voiceKey) return addToast('Selecciona una voz', 'error')

        const voice_mappings = tags
            .filter(t => mappings[t])
            .map(t => ({ tag_name: t, voice_id: Number(mappings[t]) }))

        // Para Piper: necesitamos un narrator_voice_id (FK obligatoria).
        // Usamos la primera voz clonada activa como placeholder.
        const fallbackVoiceId = voices.find(v => v.is_active)?.id || voices[0]?.id

        setSaving(true)
        try {
            await api.audiobooks.create({
                book_id: Number(bookId),
                narrator_voice_id: isPiper ? fallbackVoiceId : selectedClonedId,
                engine: useCloud ? 'cloud' : (isPiper ? 'piper' : 'qwen'),
                engine_voice_id: isPiper ? selectedPiperId : null,
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
                        {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">Voz narradora * <span style={{ color: 'var(--muted)', fontWeight: 400, textTransform: 'none' }}>(texto sin tag)</span></label>
                    <select className="form-select" value={voiceKey} onChange={e => setVoiceKey(e.target.value)}>
                        <option value="">— Selecciona una voz —</option>
                        <optgroup label="🟢 Voces clonadas (Qwen)">
                            {voices.filter(v => v.is_active).map(v => <option key={`c-${v.id}`} value={`cloned:${v.id}`}>{v.name}</option>)}
                        </optgroup>
                        <optgroup label="🟣 Voces Piper (local)">
                            {piperVoices.filter(pv => pv.downloaded).map(pv => <option key={`p-${pv.id}`} value={`piper:${pv.id}`}>{pv.name} ({pv.quality})</option>)}
                        </optgroup>
                    </select>
                    {voiceKey && (
                        <div style={{ marginTop: 6, fontSize: 11, color: isPiper ? '#8b5cf6' : '#10b981' }}>
                            Motor: {isPiper ? '🎺 Piper (local rápido)' : '🏠 Qwen (clonación)'}
                        </div>
                    )}
                </div>

                {!isPiper && (
                    <div className="form-group">
                        <label className="form-checkbox" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                            <input 
                                type="checkbox" 
                                checked={useCloud} 
                                onChange={e => setUseCloud(e.target.checked)}
                                style={{ width: 18, height: 18 }}
                            />
                            <div>
                                <span style={{ fontWeight: 600, color: useCloud ? 'var(--accent)' : 'inherit' }}>
                                    ☁️ Usar generación en la Nube (Modal.com)
                                </span>
                                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, marginBottom: 0 }}>
                                    Más rápido y ahorra RAM local. Requiere configuración previa.
                                </p>
                            </div>
                        </label>
                    </div>
                )}

                <div className="form-group">
                    <label className="form-label">Formato de salida</label>
                    <select className="form-select" value={format} onChange={e => setFormat(e.target.value)}>
                        <option value="mp3">MP3</option>
                        <option value="wav">WAV (sin compresión)</option>
                    </select>
                </div>

                {selectedBook?.type === 'multi_voice' && (
                    <>
                        <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Mapeo de personajes</span>
                            {tagsLoading && <span className="spinner" style={{ fontSize: 10 }}>⏳ Buscando personajes...</span>}
                        </div>
                        
                        {!tagsLoading && tags.length === 0 && (
                            <p style={{ fontSize: 12, color: 'var(--muted)', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: 8 }}>
                                No se encontraron personajes marcados con [TAG] en este libro.
                            </p>
                        )}

                        {tags.map(tag => (
                            <div className="form-group" key={tag} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                                <div style={{ 
                                    padding: '6px 10px', 
                                    borderRadius: 6, 
                                    background: 'rgba(6,182,212,0.1)',
                                    color: 'var(--accent)', 
                                    fontSize: 12, 
                                    fontWeight: 700, 
                                    minWidth: 100, 
                                    flexShrink: 0,
                                    border: '1px solid rgba(6,182,212,0.2)',
                                    textAlign: 'center'
                                }}>
                                    &lt;{tag}&gt;
                                </div>
                                <select
                                    className="form-select"
                                    value={mappings[tag] || ''}
                                    onChange={e => setMappings(m => ({ ...m, [tag]: e.target.value }))}
                                >
                                    <option value="">(Usar voz narradora)</option>
                                    <optgroup label="Voces disponibles">
                                        {voices.filter(v => v.is_active).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                    </optgroup>
                                </select>
                            </div>
                        ))}
                        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: -8, marginBottom: 16 }}>
                            * El texto fuera de etiquetas se asignará automáticamente a la voz del narrador.
                        </p>
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

function EditAudiobookModal({ ab, onClose, onSaved, addToast }) {
    const [title, setTitle] = useState(ab.book?.title || '')
    const [authorName, setAuthorName] = useState(ab.book?.author?.name || '')
    const [authors, setAuthors] = useState([])
    const [cover, setCover] = useState(null)
    const [saving, setSaving] = useState(false)
    const coverRef = useRef()

    useEffect(() => {
        api.authors.list().then(setAuthors).catch(() => { })
    }, [])

    async function save() {
        if (!title.trim()) return addToast('El título es obligatorio', 'error')

        setSaving(true)
        try {
            const form = new FormData()
            form.append('title', title)
            form.append('author_name', authorName.trim())
            if (cover) form.append('cover', cover)

            // 1. Actualizar el libro
            await api.books.update(ab.book_id, form)

            // 2. Refrescar los tags del MP3
            await api.audiobooks.refreshMetadata(ab.id)

            addToast('Metadatos actualizados', 'success')
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
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                    Ajustes de metadatos
                </h2>

                <div className="form-group">
                    <label className="form-label">Título</label>
                    <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} />
                </div>

                <div className="form-group">
                    <label className="form-label">Autor</label>
                    <input
                        className="form-input"
                        placeholder="Escribe el nombre del autor..."
                        value={authorName}
                        onChange={e => setAuthorName(e.target.value)}
                        list="authors-list-ab"
                    />
                    <datalist id="authors-list-ab">
                        {authors.map(a => <option key={a.id} value={a.name} />)}
                    </datalist>
                </div>

                <div className="form-group">
                    <label className="form-label">Portada MP3 (opcional)</label>
                    <div className={`file-drop ${cover ? 'has-file' : ''}`} onClick={() => coverRef.current.click()}>
                        <input ref={coverRef} type="file" accept="image/*" onChange={e => setCover(e.target.files[0])} />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                            {cover ? <strong>{cover.name}</strong> : 'Subir nueva portada'}
                        </div>
                    </div>
                </div>

                <TagEditor
                    type="audiobook"
                    entityId={ab.id}
                    currentTags={ab.tags || []}
                    addToast={addToast}
                    onTagsUpdated={onSaved}
                />

                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-primary" onClick={save} disabled={saving}>
                        {saving ? 'Guardando y re-etiquetando...' : 'Guardar y aplicar al MP3'}
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
                // Limpiar saltos de línea excesivos (Máximo 2 líneas en blanco = 3 saltos de línea)
                const cleaned = r.text.replace(/\n{4,}/g, '\n\n\n')
                setText(cleaned)

                // Si ab.end_char es 0 o nulo, apuntamos al final del texto limpio
                if (ab.end_char === null || ab.end_char === 0) {
                    setEnd(cleaned.length)
                } else if (cleaned.length !== r.text.length) {
                    // Si el texto ha cambiado de longitud, los índices originales podrían estar ligeramente desplazados.
                    // Por ahora los mantenemos, el usuario puede ajustarlos visualmente.
                }
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

function AudioPlayerModal({ ab, book, onClose, addToast }) {
    const audioRef = useRef(null)
    const [playing, setPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(ab.last_position || 0)
    const [duration, setDuration] = useState(0)
    const [playbackRate, setPlaybackRate] = useState(1)
    const saveTimerRef = useRef(null)

    const audioUrl = api.audiobooks.downloadUrl(ab.id)

    useEffect(() => {
        // Guardar progreso cada 10 segundos
        saveTimerRef.current = setInterval(() => {
            if (audioRef.current && !audioRef.current.paused) {
                savePosition(audioRef.current.currentTime)
            }
        }, 10000)
        return () => {
            clearInterval(saveTimerRef.current)
            if (audioRef.current) savePosition(audioRef.current.currentTime)
        }
    }, [ab.id])

    async function savePosition(pos) {
        try {
            await api.audiobooks.update(ab.id, { last_position: Math.floor(pos) })
        } catch (e) {
            console.error('Error al guardar posición', e)
        }
    }

    const togglePlay = () => {
        if (playing) audioRef.current.pause()
        else audioRef.current.play()
        setPlaying(!playing)
    }

    const handleStop = () => {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        setPlaying(false)
        savePosition(0)
    }

    const skip = (seconds) => {
        audioRef.current.currentTime += seconds
    }

    const onLoadedMetadata = () => {
        setDuration(audioRef.current.duration)
        audioRef.current.currentTime = ab.last_position || 0
    }

    const onTimeUpdate = () => {
        setCurrentTime(audioRef.current.currentTime)
    }

    const handleSeek = (e) => {
        const time = parseFloat(e.target.value)
        audioRef.current.currentTime = time
        setCurrentTime(time)
    }

    const formatTime = (s) => {
        const h = Math.floor(s / 3600)
        const m = Math.floor((s % 3600) / 60)
        const sec = Math.floor(s % 60)
        return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal audio-player-modal" onClick={e => e.stopPropagation()}>
                <div className="player-header">
                    <div className="player-title-box">
                        <span className="player-label">REPRODUCIENDO</span>
                        <h3 className="player-title">{book.title}</h3>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
                </div>

                <div className="player-body">
                    <div className="player-artwork">
                        {book.cover_path ? (
                            <img src={`/api${book.cover_path}`} alt="Cover" />
                        ) : (
                            <div className="artwork-placeholder">🎧</div>
                        )}
                    </div>

                    <div className="player-controls-main">
                        <audio
                            ref={audioRef}
                            src={audioUrl}
                            onPlay={() => setPlaying(true)}
                            onPause={() => setPlaying(false)}
                            onLoadedMetadata={onLoadedMetadata}
                            onTimeUpdate={onTimeUpdate}
                        />

                        <div className="seek-bar-container">
                            <span className="time-text">{formatTime(currentTime)}</span>
                            <input
                                type="range"
                                className="player-seek-bar"
                                min="0"
                                max={duration || 0}
                                value={currentTime}
                                onChange={handleSeek}
                            />
                            <span className="time-text">{formatTime(duration)}</span>
                        </div>

                        <div className="playback-btns">
                            <button className="btn-player-sub" onClick={() => skip(-15)} title="-15s">↺ 15</button>

                            <button className="btn-player-stop" onClick={handleStop} title="Stop">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
                            </button>

                            <button className="btn-player-main" onClick={togglePlay}>
                                {playing ? (
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                ) : (
                                    <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 2 }}><path d="M8 5v14l11-7z" /></svg>
                                )}
                            </button>

                            <button className="btn-player-sub" onClick={() => skip(15)} title="+15s">15 ↻</button>

                            <div className="speed-control">
                                <select
                                    value={playbackRate}
                                    onChange={(e) => {
                                        const rate = parseFloat(e.target.value)
                                        setPlaybackRate(rate)
                                        audioRef.current.playbackRate = rate
                                    }}
                                >
                                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => (
                                        <option key={r} value={r}>{r}x</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function ProgressCard({ ab, book, onRefresh, addToast, onRemove, onEdit, onPlay, viewMode = 'grid' }) {
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
    }, [ab.id, onRefresh])

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
    }, [ab.id, ab.status, fetchProgress])

    async function handleStart() {
        try {
            await api.audiobooks.start(ab.id, ab.engine || 'qwen')
            setPolling(true)
            fetchProgress()
            const labels = { qwen: 'Qwen 🧠', piper: 'Piper 🧠', cloud: 'Nube ☁️' }
            addToast(`Generación iniciada: ${labels[ab.engine] || ab.engine}`, 'info')
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

    if (viewMode === 'list') {
        return (
            <div className={`list-item audiobook-list-item ab-engine-${ab.engine} ab-status-${status} ${isRunning ? 'is-running' : ''}`}>
                <div className="list-item-cover" onClick={status === 'done' ? onPlay : onEdit} style={{ cursor: 'pointer' }}>
                    {coverUrl ? <img src={coverUrl} alt={book?.title} style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4}} /> : '🎧'}
                </div>
                <div className="list-item-info" onClick={status === 'done' ? onPlay : onEdit} style={{ cursor: 'pointer' }}>
                    <div className="list-item-title">{book?.title || `Audiolibro #${ab.id}`}</div>
                    <div className="list-item-author">🎙 {ab.narratorName}</div>
                    <div className="list-item-tags">
                        <span className={`badge badge-sm badge-${status === 'pending' && isRunning ? 'processing' : status}`} style={{fontSize: 9, padding: '1px 6px'}}>
                            {isRunning ? '...' : status === 'done' ? 'OK' : status}
                        </span>
                        <span className={`badge badge-sm badge-engine-${ab.engine}`} style={{fontSize: 9, padding: '1px 6px'}}>{ab.engine}</span>
                    </div>
                </div>

                {status !== 'done' && (
                    <div style={{ width: 60, marginRight: 8 }}>
                        <div className="progress-bar" style={{height: 4}}>
                            <div className="progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                    </div>
                )}

                <div className="list-item-meta">
                    <span>📊 {totalWords.toLocaleString()} pal.</span>
                    <span>⏱ {elapsed > 0 ? `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, '0')}` : '--:--'}</span>
                </div>

                <div className="list-item-actions">
                    {status === 'done' ? (
                        <>
                            <button className="btn btn-ghost btn-sm" onClick={() => onEdit(ab)} title="Ajustes">⚙️</button>
                            <a className="btn btn-primary btn-sm" href={api.audiobooks.downloadUrl(ab.id)} download title="Descargar">⬇</a>
                        </>
                    ) : (
                        <>
                            {isRunning ? (
                                <button className="btn btn-ghost btn-sm" onClick={handlePause}>⏸</button>
                            ) : (
                                <button className="btn btn-primary btn-sm" onClick={() => handleStart()}>🧠</button>
                            )}
                        </>
                    )}
                    <button className="btn btn-danger btn-sm" onClick={() => onRemove(ab.id)}>🗑</button>
                </div>
            </div>
        )
    }

    return (
        <div className={`card book-card horizontal audiobook-card ab-engine-${ab.engine} ab-status-${status} ${isRunning ? 'is-running' : ''}`}>
            <div className="book-card-left" onClick={status === 'done' ? onPlay : onEdit} title={status === 'done' ? 'Reproducir' : 'Editar rango'}>
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

                <div className="tags-list">
                    {ab.tags?.filter(t => t.name !== 'QWEN' && t.name !== 'PIPER').map(t => (
                        <span key={t.id} className="tag-badge" style={{ backgroundColor: t.color }}>
                            {t.name}
                        </span>
                    ))}
                </div>

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
                        <span className="stat-label">FRAGS</span>
                        <span className="stat-value">{progress?.completed_chunks ?? ab.completed_chunks}/{progress?.total_chunks ?? ab.total_chunks}</span>
                    </div>
                </div>

                <div className="ab-footer">
                    {status === 'done' ? (
                        <>
                            <span className={`badge badge-engine-${ab.engine}`}>{ab.engine === 'piper' ? 'Piper' : ab.engine === 'cloud' ? 'Cloud' : 'Qwen3'}</span>
                            <div style={{ flex: 1 }} />
                            <div className="ab-actions">
                                <button className="btn btn-ghost btn-sm" onClick={() => onEdit(ab)} title="Ajustes de metadatos">⚙️</button>
                                <a className="btn btn-primary btn-sm" href={api.audiobooks.downloadUrl(ab.id)} download title="Descargar">⬇</a>
                                <button className="btn btn-danger btn-sm" onClick={() => onRemove(ab.id)} title="Eliminar">🗑</button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="ab-progress-container">
                                <div className="progress-bar">
                                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="pct-text">{pct}%</span>
                            </div>
                            <div className="ab-actions">
                                {isRunning ? (
                                    <button className="btn btn-ghost btn-sm" onClick={handlePause} title="Pausar">⏸</button>
                                ) : (
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button className="btn btn-primary btn-sm" onClick={() => handleStart()} title={`Generar con ${ab.engine === 'piper' ? 'Piper' : 'Qwen'}`}>🧠</button>
                                    </div>
                                )}
                                <button className="btn btn-danger btn-sm" onClick={() => onRemove(ab.id)} title="Eliminar">🗑</button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}


export default function AudiobooksPage() {
    const [audiobooks, setAudiobooks] = useState([])
    const [allTags, setAllTags] = useState([])
    const [selectedTagId, setSelectedTagId] = useState(null)
    const [voices, setVoices] = useState([])
    const [piperVoices, setPiperVoices] = useState([])
    const [books, setBooks] = useState([])
    const [showCreate, setShowCreate] = useState(false)
    const [editingAb, setEditingAb] = useState(null)
    const [editingMetadataAb, setEditingMetadataAb] = useState(null)
    const [playingAb, setPlayingAb] = useState(null)
    const [toasts, setToasts] = useState([])
    const [viewMode, setViewMode] = useState(localStorage.getItem('studioViewMode') || 'grid')

    useEffect(() => {
        localStorage.setItem('studioViewMode', viewMode)
    }, [viewMode])


    function addToast(msg, type = 'info') {
        const id = Date.now()
        setToasts(t => [...t, { id, msg, type }])
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
    }

    const removeToast = (id) => {
        setToasts(t => t.filter(x => x.id !== id))
    }

    const load = useCallback(async () => {
        try {
            const [abs, vs, pv, bs, ts] = await Promise.all([
                api.audiobooks.list(),
                api.voices.list(),
                api.voices.piperVoices(),
                api.books.list(),
                api.tags.list(),
            ])
            setAudiobooks(abs)
            setVoices(vs)
            setPiperVoices(pv)
            setBooks(bs)
            setAllTags(ts)
        } catch (e) { addToast(e.message, 'error') }
    }, [])

    useEffect(() => { load() }, [load])

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
        book: books.find(b => b.id === ab.book_id), // Pass the whole book object
        bookTitle: books.find(b => b.id === ab.book_id)?.title || (ab.book_id ? `Libro #${ab.book_id}` : 'Libro (eliminado)'),
        narratorName: ab.engine === 'piper'
            ? (piperVoices.find(pv => pv.id === ab.engine_voice_id)?.name || ab.engine_voice_id || 'Piper')
            : (voices.find(v => v.id === ab.narrator_voice_id)?.name || `Voz #${ab.narrator_voice_id}`),
    }))

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Estudio</h1>
                    <p className="page-subtitle">{audiobooks.length} audiolibro{audiobooks.length !== 1 ? 's' : ''}</p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div className="filter-bar" style={{ display: 'flex', gap: 6 }}>
                        <button
                            className={`btn btn-xs ${selectedTagId === null ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setSelectedTagId(null)}
                        >
                            Todos
                        </button>
                        {allTags.filter(t => t.name === 'QWEN' || t.name === 'PIPER').map(tag => (
                            <button
                                key={tag.id}
                                className={`btn btn-xs ${selectedTagId === tag.id ? 'btn-primary' : 'btn-ghost'}`}
                                style={{
                                    borderColor: tag.color,
                                    color: selectedTagId === tag.id ? '#fff' : tag.color,
                                    backgroundColor: selectedTagId === tag.id ? tag.color : 'transparent'
                                }}
                                onClick={() => setSelectedTagId(selectedTagId === tag.id ? null : tag.id)}
                            >
                                {tag.name}
                            </button>
                        ))}
                    </div>
                    <div className="view-toggle">
                        <button 
                            className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                            onClick={() => setViewMode('grid')}
                            title="Vista cuadrícula"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                        </button>
                        <button 
                            className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                            onClick={() => setViewMode('list')}
                            title="Vista lista"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                        </button>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>

                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Nuevo audiolibro
                    </button>
                </div>
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
                        const group = enriched
                            .filter(a => a.status === s)
                            .filter(a => !selectedTagId || a.tags?.some(t => t.id === selectedTagId))

                        if (!group.length) return null
                        const labels = { processing: 'En proceso', pending: 'Pendientes', done: 'Completados', error: 'Con error' }
                        return (
                            <div key={s}>
                                <div className="section-label">{labels[s]}</div>
                                <div className={viewMode === 'grid' ? "card-grid" : "list-view"} style={{ marginBottom: 16 }}>
                                    {group.map(ab => (
                                        <ProgressCard
                                            key={ab.id}
                                            ab={ab}
                                            book={books.find(b => b.id === ab.book_id)}
                                            onRefresh={load}
                                            addToast={addToast}
                                            onRemove={remove}
                                            onEdit={ab.status === 'done' ? setEditingMetadataAb : setEditingAb}
                                            onPlay={() => setPlayingAb(ab)}
                                            viewMode={viewMode}
                                        />
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </>
            )}

            {showCreate && (
                <CreateModal
                    voices={voices}
                    piperVoices={piperVoices}
                    books={books}
                    onClose={() => setShowCreate(false)}
                    onSaved={() => { setShowCreate(false); load() }}
                    addToast={addToast}
                />
            )}
            {editingMetadataAb && (
                <EditAudiobookModal
                    ab={editingMetadataAb}
                    onClose={() => setEditingMetadataAb(null)}
                    addToast={addToast}
                    onSaved={() => {
                        setEditingMetadataAb(null)
                        load()
                    }}
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
            {playingAb && (
                <AudioPlayerModal
                    ab={playingAb}
                    book={books.find(b => b.id === playingAb.book_id)}
                    onClose={() => setPlayingAb(null)}
                    addToast={addToast}
                />
            )}
            <Toast toasts={toasts} />
        </>
    )
}
