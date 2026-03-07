import { useState, useEffect, useRef } from 'react'
import { api } from '../api.js'

function Toast({ toasts }) {
    return (
        <div className="toast-container">
            {toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}
        </div>
    )
}

function BookModal({ onClose, onSaved, addToast }) {
    const [title, setTitle] = useState('')
    const [authorId, setAuthorId] = useState('')
    const [type, setType] = useState('single_voice')
    const [file, setFile] = useState(null)
    const [authors, setAuthors] = useState([])
    const [saving, setSaving] = useState(false)
    const fileRef = useRef()

    useEffect(() => {
        api.authors.list().then(setAuthors).catch(e => addToast(e.message, 'error'))
    }, [])

    async function save() {
        if (!title.trim()) return addToast('El título es obligatorio', 'error')
        if (!file) return addToast('Sube un archivo .txt', 'error')

        setSaving(true)
        try {
            const form = new FormData()
            form.append('title', title)
            if (authorId) form.append('author_id', authorId)
            form.append('type', type)
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
                    <label className="form-label">Título *</label>
                    <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="El nombre del libro" />
                </div>
                <div className="form-group">
                    <label className="form-label">Escritor</label>
                    <select className="form-select" value={authorId} onChange={e => setAuthorId(e.target.value)}>
                        <option value="">-- Seleccionar escritor --</option>
                        {authors.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Tipo de narración</label>
                    <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                        <option value="single_voice">Una sola voz</option>
                        <option value="multi_voice">Múltiples voces (con tags [PERSONAJE])</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Archivo de texto *</label>
                    <div className={`file-drop ${file ? 'has-file' : ''}`} onClick={() => fileRef.current.click()}>
                        <input ref={fileRef} type="file" accept=".txt,text/plain" onChange={e => setFile(e.target.files[0])} />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                            {file ? <strong>{file.name}</strong> : 'Subir archivo .txt'}
                        </div>
                    </div>
                    {type === 'multi_voice' && (
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                            El archivo debe usar el formato <code style={{ color: 'var(--accent)' }}>{'[PERSONAJE] Texto...'}</code> en cada línea.
                        </p>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-primary" onClick={save} disabled={saving}>
                        {saving ? 'Subiendo...' : 'Añadir libro'}
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
                    {books.map(b => (
                        <div key={b.id} className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <div className="card-title">{b.title}</div>
                                <span style={{
                                    fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                                    background: `${TYPE_COLORS[b.type]}18`, color: TYPE_COLORS[b.type],
                                    flexShrink: 0, marginLeft: 8,
                                }}>
                                    {TYPE_LABELS[b.type]}
                                </span>
                            </div>
                            <div className="card-meta">
                                {b.author?.name ? <span>✍ {b.author.name}</span> : <span style={{ opacity: 0.5 }}>Autor desconocido</span>}
                                <span style={{ display: 'block', marginTop: 4, fontSize: 11, opacity: 0.6 }}>
                                    Añadido el {new Date(b.created_at).toLocaleDateString('es-ES')}
                                </span>
                            </div>
                            <div className="card-actions" style={{ marginTop: 12 }}>
                                <button className="btn btn-danger btn-sm" onClick={() => remove(b)}>Eliminar</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <BookModal
                    onClose={() => setShowModal(false)}
                    onSaved={() => { setShowModal(false); load() }}
                    addToast={addToast}
                />
            )}
            <Toast toasts={toasts} />
        </>
    )
}
