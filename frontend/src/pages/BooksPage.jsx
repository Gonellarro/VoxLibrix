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

const charColors = {}
const getCharColor = (name) => {
    if (charColors[name]) return charColors[name]
    const hues = [200, 280, 20, 150, 330, 60, 240, 10, 180, 300]
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const color = `hsl(${hues[hash % hues.length]}, 70%, 45%)`
    charColors[name] = color
    return color
}

function TextModal({ book, onClose }) {
    const [text, setText] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        api.books.text(book.id)
            .then(r => setText(r.text))
            .catch(() => setText('Error al cargar el texto.'))
            .finally(() => setLoading(false))
    }, [book.id])

    const formatText = (content) => {
        if (!content || book.type !== 'multi_voice') return <pre className="text-content">{content}</pre>

        // Regex para <Tag>Contenido</Tag> incluyendo nuevas líneas
        const parts = content.split(/(<[^>]+>[\s\S]*?<\/[^>]+>)/g)

        return (
            <div className="text-content-formatted">
                {parts.map((part, i) => {
                    const match = part.match(/<([^>]+)>([\s\S]*?)<\/\1>/)
                    if (match) {
                        const tagName = match[1]
                        const innerText = match[2]
                        const color = getCharColor(tagName)

                        return (
                            <span key={i} className="multi-voice-block">
                                <span className="char-badge" style={{ backgroundColor: color }}>{tagName}</span>
                                {innerText}
                                <span className="char-badge" style={{ backgroundColor: color }}>{tagName}</span>
                            </span>
                        )
                    }
                    return <span key={i}>{part}</span>
                })}
            </div>
        )
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal text-modal" onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 className="modal-title" style={{ marginBottom: 0 }}>📖 {book.title}</h2>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
                </div>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                        <span className="spinner">⏳</span> Cargando texto...
                    </div>
                ) : (
                    <div className="text-container-v2">
                        {formatText(text)}
                    </div>
                )}
            </div>
        </div>
    )
}

function BookModal({ allTags = [], onClose, onSaved, addToast }) {
    const [file, setFile] = useState(null)
    const [isMultiVoice, setIsMultiVoice] = useState(false)
    const [title, setTitle] = useState('')
    const [authorName, setAuthorName] = useState('')
    const [authors, setAuthors] = useState([])
    const [cover, setCover] = useState(null)
    const [selectedTagIds, setSelectedTagIds] = useState([])
    const [saving, setSaving] = useState(false)
    
    const fileRef = useRef()
    const coverRef = useRef()

    useEffect(() => {
        api.authors.list().then(setAuthors).catch(() => { })
    }, [])

    async function save() {
        if (!file) return addToast('Sube un archivo .epub o .txt', 'error')

        setSaving(true)
        try {
            const form = new FormData()
            form.append('txt_file', file)
            form.append('type', isMultiVoice ? 'multi_voice' : 'single_voice')
            if (title.trim()) form.append('title', title)
            if (authorName.trim()) form.append('author_name', authorName.trim())
            if (cover) form.append('cover', cover)

            const book = await api.books.create(form)
            
            // Vincular tags si hay seleccionados
            if (selectedTagIds.length > 0) {
                await Promise.all(selectedTagIds.map(tid => api.tags.linkToBook(book.id, tid)))
            }

            addToast('Libro añadido a la biblioteca', 'success')
            onSaved()
        } catch (e) {
            addToast(e.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const toggleTag = (id) => {
        setSelectedTagIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <h2 className="modal-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                    Añadir libro
                </h2>
                
                <div className="form-group">
                    <label className="form-label">Archivo (EPUB o TXT) *</label>
                    <div className={`file-drop ${file ? 'has-file' : ''}`} onClick={() => fileRef.current.click()}>
                        <input ref={fileRef} type="file" accept=".txt,.epub" onChange={e => {
                            const f = e.target.files[0];
                            setFile(f);
                            if (f && !title) {
                                // Autocompletar titulo desde nombre de archivo si esta vacio
                                const name = f.name.replace(/\.[^/.]+$/, "");
                                setTitle(name);
                            }
                        }} />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                            {file ? <strong>{file.name}</strong> : 'Subir archivo .epub o .txt'}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="form-group">
                        <label className="form-label">Título (opcional)</label>
                        <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Título del libro" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Autor (opcional)</label>
                        <input 
                            className="form-input" 
                            value={authorName} 
                            onChange={e => setAuthorName(e.target.value)} 
                            placeholder="Nombre del autor"
                            list="authors-list-add"
                        />
                        <datalist id="authors-list-add">
                            {authors.map(a => <option key={a.id} value={a.name} />)}
                        </datalist>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Portada (opcional)</label>
                    <div className={`file-drop ${cover ? 'has-file' : ''}`} style={{padding: '12px'}} onClick={() => coverRef.current.click()}>
                        <input ref={coverRef} type="file" accept="image/*" onChange={e => setCover(e.target.files[0])} />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                            {cover ? <strong>{cover.name}</strong> : 'Subir portada'}
                        </div>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Etiquetas</label>
                    <div className="tag-selector" style={{maxHeight: 100, overflowY: 'auto', marginTop: 4}}>
                        {allTags.length === 0 && <span style={{fontSize: 12, color: 'var(--muted)'}}>No hay etiquetas creadas</span>}
                        {allTags.map(tag => (
                            <div 
                                key={tag.id} 
                                className={`tag-option ${selectedTagIds.includes(tag.id) ? 'selected' : ''}`}
                                onClick={() => toggleTag(tag.id)}
                            >
                                <span style={{display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: tag.color, marginRight: 6}} />
                                {tag.name}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }} onClick={() => setIsMultiVoice(!isMultiVoice)}>
                    <input
                        type="checkbox"
                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                        checked={isMultiVoice}
                        onChange={() => { }}
                    />
                    <div>
                        <strong style={{ display: 'block', fontSize: 13 }}>Contenido Multi-voz</strong>
                    </div>
                </div>

                <div className="modal-footer">
                    <p style={{fontSize: 11, color: 'var(--muted)', flex: 1}}>* En EPUB los metadatos se extraen si no se especifican.</p>
                    <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-primary" onClick={save} disabled={saving}>
                        {saving ? 'Procesando...' : 'Añadir'}
                    </button>
                </div>
            </div>
        </div>
    )
}


function EditBookModal({ book, onClose, onSaved, addToast }) {
    const [title, setTitle] = useState(book.title)
    const [authorName, setAuthorName] = useState(book.author?.name || '')
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

            await api.books.update(book.id, form)
            addToast('Libro actualizado', 'success')
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
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    Editar libro
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
                        list="authors-list"
                    />
                    <datalist id="authors-list">
                        {authors.map(a => <option key={a.id} value={a.name} />)}
                    </datalist>
                </div>

                <div className="form-group">
                    <label className="form-label">Portada (opcional)</label>
                    <div className={`file-drop ${cover ? 'has-file' : ''}`} onClick={() => coverRef.current.click()}>
                        <input ref={coverRef} type="file" accept="image/*" onChange={e => setCover(e.target.files[0])} />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                            {cover ? <strong>{cover.name}</strong> : 'Subir nueva portada'}
                        </div>
                    </div>
                </div>

                <TagEditor
                    type="book"
                    entityId={book.id}
                    currentTags={book.tags || []}
                    addToast={addToast}
                    onTagsUpdated={onSaved}
                />

                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-primary" onClick={save} disabled={saving}>
                        {saving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                </div>
            </div>
        </div>
    )
}

const TYPE_LABELS = { single_voice: 'Voz única', multi_voice: 'Multi-voz' }
const TYPE_COLORS = { single_voice: 'var(--primary)', multi_voice: 'var(--accent)' }

export default function BooksPage() {
    const [books, setBooks] = useState([])
    const [allTags, setAllTags] = useState([])
    const [selectedTagId, setSelectedTagId] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [editBook, setEditBook] = useState(null)
    const [textBook, setTextBook] = useState(null)
    const [toasts, setToasts] = useState([])
    const [viewMode, setViewMode] = useState(localStorage.getItem('booksViewMode') || 'grid')

    useEffect(() => {
        localStorage.setItem('booksViewMode', viewMode)
    }, [viewMode])


    function addToast(msg, type = 'info') {
        const id = Date.now()
        setToasts(t => [...t, { id, msg, type }])
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
    }

    const load = useCallback(async () => {
        try {
            const [b, t] = await Promise.all([api.books.list(), api.tags.list()])
            setBooks(b)
            setAllTags(t)
        }
        catch (e) { addToast(e.message, 'error') }
    }, [])
    useEffect(() => { load() }, [load])

    async function remove(book) {
        if (!confirm(`¿Eliminar "${book.title}"? Se eliminarán los audiolibros asociados.`)) return
        try {
            await api.books.delete(book.id)
            addToast('Libro eliminado', 'success')
            load()
        } catch (e) {
            addToast(e.message, 'error')
        }
    }

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Biblioteca</h1>
                    <p className="page-subtitle">{books.length} libro{books.length !== 1 ? 's' : ''} en la biblioteca</p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div className="filter-bar" style={{ display: 'flex', gap: 6 }}>
                        <button
                            className={`btn btn-xs ${selectedTagId === null ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setSelectedTagId(null)}
                        >
                            Todos
                        </button>
                        {allTags.map(tag => (
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
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>

                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Añadir libro
                    </button>
                </div>
            </div>

            {books.length === 0 ? (
                <div className="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                    <h3>La biblioteca está vacía</h3>
                    <p>Añade un archivo .txt para empezar a generar audiolibros</p>
                </div>
            ) : (
                <div className={viewMode === 'grid' ? "card-grid" : "list-view"}>
                    {books
                        .filter(b => !selectedTagId || b.tags?.some(t => t.id === selectedTagId))
                        .map(b => {
                            const coverUrl = b.cover_path ? `/api${b.cover_path}` : null
                            const dateStr = new Date(b.created_at).toLocaleDateString('es-ES')

                            if (viewMode === 'list') {
                                return (
                                    <div key={b.id} className="list-item">
                                        <div className="list-item-cover" onClick={() => setTextBook(b)} style={{ cursor: 'pointer' }}>
                                            {coverUrl ? <img src={coverUrl} alt={b.title} style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4}} /> : '📚'}
                                        </div>
                                        <div className="list-item-info" onClick={() => setTextBook(b)} style={{ cursor: 'pointer' }}>
                                            <div className="list-item-title">{b.title}</div>
                                            <div className="list-item-author">👤 {b.author?.name || 'Autor desconocido'}</div>
                                            <div className="list-item-tags">
                                                {b.type === 'multi_voice' && (
                                                    <span className="tag-badge" style={{ backgroundColor: 'var(--accent)', scale: '0.9' }}>🎭</span>
                                                )}
                                                {b.tags?.slice(0, 3).map(t => (
                                                    <span key={t.id} className="tag-badge" style={{ backgroundColor: t.color, scale: '0.9' }}>
                                                        {t.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="list-item-meta">
                                            <span>📅 {dateStr}</span>
                                            <span>📊 {b.word_count?.toLocaleString()} palabras</span>
                                        </div>
                                        <div className="list-item-actions">
                                            <button className="btn btn-ghost btn-sm" onClick={() => setEditBook(b)} title="Editar metadatos">⚙️</button>
                                            <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); remove(b) }} title="Eliminar libro">🗑</button>
                                        </div>
                                    </div>
                                )
                            }

                            return (
                                <div key={b.id} className="card book-card horizontal">
                                    <div className="book-card-left" onClick={() => setTextBook(b)} style={{ cursor: 'pointer' }}>
                                        {coverUrl ? (
                                            <img src={coverUrl} alt={b.title} className="book-cover-img" />
                                        ) : (
                                            <div className="book-icon-placeholder">📚</div>
                                        )}
                                    </div>
                                    <div className="book-card-right">
                                        <div className="book-details" onClick={() => setTextBook(b)} style={{ cursor: 'pointer' }}>
                                            <h3 className="book-title" title={b.title}>{b.title}</h3>
                                            <p className="book-author">👤 {b.author?.name || 'Autor desconocido'}</p>

                                            <div className="tags-list">
                                                {b.type === 'multi_voice' && (
                                                    <span className="tag-badge" style={{ backgroundColor: 'var(--accent)', boxShadow: '0 0 10px rgba(6,182,212,0.3)' }}>
                                                        🎭 MULTI-VOZ
                                                    </span>
                                                )}
                                                {b.tags?.map(t => (
                                                    <span key={t.id} className="tag-badge" style={{ backgroundColor: t.color }}>
                                                        {t.name}
                                                    </span>
                                                ))}
                                            </div>

                                            <div className="book-meta-footer">
                                                <span>📅 {dateStr}</span>
                                                <span>📊 {b.word_count?.toLocaleString()} palabras</span>
                                            </div>
                                        </div>
                                        <div className="book-card-actions">
                                            <button className="btn btn-ghost btn-sm" onClick={() => setEditBook(b)} title="Editar metadatos">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                                            </button>
                                            <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); remove(b) }} title="Eliminar libro">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                </div>
            )}

            {showModal && (
                <BookModal
                    allTags={allTags}
                    onClose={() => setShowModal(false)}
                    onSaved={() => { setShowModal(false); load() }}
                    addToast={addToast}
                />
            )}
            {editBook && (
                <EditBookModal
                    book={editBook}
                    onClose={() => setEditBook(null)}
                    onSaved={() => { setEditBook(null); load() }}
                    addToast={addToast}
                />
            )}
            {textBook && (
                <TextModal book={textBook} onClose={() => setTextBook(null)} />
            )}
            <Toast toasts={toasts} />
        </>
    )
}
