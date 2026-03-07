import { useState, useEffect } from 'react'
import { api } from '../api.js'

function Toast({ toasts }) {
    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
            ))}
        </div>
    )
}

function AuthorModal({ author, onClose, onSaved, addToast }) {
    const [name, setName] = useState(author?.name || '')
    const [biography, setBiography] = useState(author?.biography || '')
    const [birthDate, setBirthDate] = useState(author?.birth_date || '')
    const [saving, setSaving] = useState(false)

    async function save() {
        if (!name.trim()) return addToast('El nombre es obligatorio', 'error')

        setSaving(true)
        try {
            const data = {
                name,
                biography: biography || null,
                birth_date: birthDate || null
            }

            if (author) {
                await api.authors.update(author.id, data)
            } else {
                await api.authors.create(data)
            }
            addToast(author ? 'Escritor actualizado' : 'Escritor creado', 'success')
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
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    {author ? 'Editar escritor' : 'Nuevo escritor'}
                </h2>

                <div className="form-group">
                    <label className="form-label">Nombre *</label>
                    <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Robert E. Howard" />
                </div>

                <div className="form-group">
                    <label className="form-label">Fecha de nacimiento</label>
                    <input type="date" className="form-input" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
                </div>

                <div className="form-group">
                    <label className="form-label">Biografía</label>
                    <textarea
                        className="form-input"
                        style={{ minHeight: 100, padding: '8px 12px' }}
                        value={biography}
                        onChange={e => setBiography(e.target.value)}
                        placeholder="Breve historia del autor..."
                    />
                </div>

                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-primary" onClick={save} disabled={saving}>
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function AuthorsPage() {
    const [authors, setAuthors] = useState([])
    const [editAuthor, setEditAuthor] = useState(undefined)
    const [toasts, setToasts] = useState([])

    function addToast(msg, type = 'info') {
        const id = Date.now()
        setToasts(t => [...t, { id, msg, type }])
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
    }

    async function load() {
        try {
            setAuthors(await api.authors.list())
        } catch (e) {
            addToast(e.message, 'error')
        }
    }

    useEffect(() => { load() }, [])

    async function remove(author) {
        if (!confirm(`¿Eliminar al escritor "${author.name}"? Esto no borrará sus libros.`)) return
        try {
            await api.authors.delete(author.id)
            addToast('Escritor eliminado', 'success')
            load()
        } catch (e) {
            addToast(e.message, 'error')
        }
    }

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Escritores</h1>
                    <p className="page-subtitle">{authors.length} escritor{authors.length !== 1 ? 'es' : ''} registrado{authors.length !== 1 ? 's' : ''}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setEditAuthor(null)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Añadir escritor
                </button>
            </div>

            {authors.length === 0 ? (
                <div className="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    <h3>No hay escritores todavía</h3>
                    <p>Añade los autores de tus libros para tener la biblioteca organizada</p>
                </div>
            ) : (
                <div className="card-grid">
                    {authors.map(a => (
                        <div key={a.id} className="card">
                            <div className="card-head">
                                <div className="voice-avatar" style={{ background: 'linear-gradient(135deg, var(--accent), var(--primary))' }}>{a.name[0].toUpperCase()}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="card-title">{a.name}</div>
                                    <div className="card-meta">
                                        {a.birth_date ? new Date(a.birth_date).toLocaleDateString('es-ES') : 'Fecha desconocida'}
                                    </div>
                                </div>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, minHeight: 48, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                                {a.biography || 'Sin biografía disponible.'}
                            </div>
                            <div className="card-actions">
                                <button className="btn btn-ghost btn-sm" onClick={() => setEditAuthor(a)}>Editar</button>
                                <button className="btn btn-danger btn-sm" onClick={() => remove(a)}>Eliminar</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {editAuthor !== undefined && (
                <AuthorModal
                    author={editAuthor}
                    onClose={() => setEditAuthor(undefined)}
                    onSaved={() => { setEditAuthor(undefined); load() }}
                    addToast={addToast}
                />
            )}

            <Toast toasts={toasts} />
        </>
    )
}
