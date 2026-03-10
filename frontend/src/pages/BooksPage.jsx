import { useState, useEffect, useRef } from 'react'
import { api } from '../api.js'

function Toast({ toasts }) {
    return (
        <div className="toast-container">
            {toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}
        </div>
    )
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
                    <pre className="text-content">{text}</pre>
                )}
            </div>
        </div>
    )
}

function BookModal({ onClose, onSaved, addToast }) {
    const [file, setFile] = useState(null)
    const [saving, setSaving] = useState(false)
    const fileRef = useRef()

    async function save() {
        if (!file) return addToast('Sube un archivo .epub o .txt', 'error')

        setSaving(true)
        try {
            const form = new FormData()
            form.append('txt_file', file)
            await api.books.create(form)
            addToast('Libro añadido a la biblioteca', 'success')
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
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                    Añadir libro
                </h2>
                <div className="form-group">
                    <label className="form-label">Archivo (EPUB o TXT) *</label>
                    <div className={`file-drop ${file ? 'has-file' : ''}`} onClick={() => fileRef.current.click()}>
                        <input ref={fileRef} type="file" accept=".txt,.epub" onChange={e => setFile(e.target.files[0])} />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                            {file ? <strong>{file.name}</strong> : 'Subir archivo .epub o .txt'}
                        </div>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                        Extraeremos automáticamente el título, autor y portada si es un EPUB.
                    </p>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-primary" onClick={save} disabled={saving}>
                        {saving ? 'Procesando...' : 'Añadir a la biblioteca'}
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
    const [showModal, setShowModal] = useState(false)
    const [textBook, setTextBook] = useState(null)
    const [toasts, setToasts] = useState([])

    function addToast(msg, type = 'info') {
        const id = Date.now()
        setToasts(t => [...t, { id, msg, type }])
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
    }

    async function load() {
        try { setBooks(await api.books.list()) }
        catch (e) { addToast(e.message, 'error') }
    }
    useEffect(() => { load() }, [])

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
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Añadir libro
                </button>
            </div>

            {books.length === 0 ? (
                <div className="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                    <h3>La biblioteca está vacía</h3>
                    <p>Añade un archivo .txt para empezar a generar audiolibros</p>
                </div>
            ) : (
                <div className="card-grid">
                    {books.map(b => {
                        const coverUrl = b.cover_path ? `/api${b.cover_path}` : null
                        const dateStr = new Date(b.created_at).toLocaleDateString('es-ES')

                        return (
                            <div key={b.id} className="card book-card horizontal" onClick={() => setTextBook(b)} style={{ cursor: 'pointer' }}>
                                <div className="book-card-left">
                                    {coverUrl ? (
                                        <img src={coverUrl} alt={b.title} className="book-cover-img" />
                                    ) : (
                                        <div className="book-icon-placeholder">📚</div>
                                    )}
                                </div>
                                <div className="book-card-right">
                                    <div className="book-details">
                                        <h3 className="book-title" title={b.title}>{b.title}</h3>
                                        <p className="book-author">👤 {b.author?.name || 'Autor desconocido'}</p>
                                        <div className="book-meta-footer">
                                            <span>📅 {dateStr}</span>
                                            <span>📊 {b.word_count?.toLocaleString()} palabras</span>
                                        </div>
                                    </div>
                                    <div className="book-card-actions">
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
                    onClose={() => setShowModal(false)}
                    onSaved={() => { setShowModal(false); load() }}
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
