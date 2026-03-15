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

function TagManager({ addToast }) {
    const [tags, setTags] = useState([])
    const [newName, setNewName] = useState('')
    const [newColor, setNewColor] = useState('#808080')
    const [loading, setLoading] = useState(false)

    async function loadTags() {
        try { setTags(await api.tags.list()) } catch (e) { }
    }

    useEffect(() => { loadTags() }, [])

    async function createTag() {
        if (!newName.trim()) return addToast('El nombre es obligatorio', 'error')
        setLoading(true)
        try {
            await api.tags.create({ name: newName.trim(), color: newColor })
            setNewName('')
            addToast('Etiqueta creada', 'success')
            loadTags()
        } catch (e) {
            addToast(e.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    async function deleteTag(id) {
        if (!confirm('¿Eliminar esta etiqueta? Se quitará de todos los libros y audiolibros.')) return
        try {
            await api.tags.delete(id)
            addToast('Etiqueta eliminada', 'success')
            loadTags()
        } catch (e) {
            addToast(e.message, 'error')
        }
    }

    const colorOptions = [
        '#808080', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
        '#2196F3', '#00BCD4', '#009688', '#4CAF50', '#8BC34A',
        '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'
    ]

    return (
        <div className="card" style={{ marginBottom: 30 }}>
            <h2 className="card-title" style={{ marginBottom: 16 }}>Gestión de Etiquetas</h2>

            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <input
                    className="form-input"
                    placeholder="Nombre de la etiqueta..."
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    style={{ flex: 1 }}
                />
                <input
                    type="color"
                    value={newColor}
                    onChange={e => setNewColor(e.target.value)}
                    style={{ width: 44, height: 44, padding: 2, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', cursor: 'pointer' }}
                />
                <button className="btn btn-primary" onClick={createTag} disabled={loading}>
                    Añadir
                </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {tags.map(tag => (
                    <div
                        key={tag.id}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '6px 12px', borderRadius: 8,
                            backgroundColor: tag.color + '20',
                            border: `1px solid ${tag.color}`,
                            color: tag.color,
                            fontSize: 13, fontWeight: 600
                        }}
                    >
                        {tag.name}
                        <button
                            onClick={() => deleteTag(tag.id)}
                            style={{
                                background: 'transparent', border: 'none',
                                color: tag.color, cursor: 'pointer',
                                padding: 0, fontSize: 16, display: 'flex'
                            }}
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function AdminPage() {
    const [stats, setStats] = useState(null)
    const [backups, setBackups] = useState([])
    const [loading, setLoading] = useState(false)
    const [toasts, setToasts] = useState([])

    function addToast(msg, type = 'info') {
        const id = Date.now()
        setToasts(t => [...t, { id, msg, type }])
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
    }

    async function loadData() {
        try {
            const [s, b] = await Promise.all([
                api.admin.stats(),
                api.admin.backups()
            ])
            setStats(s)
            setBackups(b)
        } catch (e) {
            addToast(e.message, 'error')
        }
    }

    useEffect(() => {
        loadData()
        const timer = setInterval(loadData, 30000) // Actualizar cada 30s
        return () => clearInterval(timer)
    }, [])

    async function handleCreateBackup() {
        setLoading(true)
        addToast('Generando backup, esto puede tardar unos segundos...', 'info')
        try {
            await api.admin.createBackup()
            addToast('Backup creado con éxito', 'success')
            loadData()
        } catch (e) {
            addToast(e.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    async function handleDeleteBackup(filename) {
        if (!confirm(`¿Eliminar el backup ${filename}?`)) return
        try {
            await api.admin.deleteBackup(filename)
            addToast('Backup eliminado', 'success')
            loadData()
        } catch (e) {
            addToast(e.message, 'error')
        }
    }

    async function handleImport(e) {
        const file = e.target.files[0]
        if (!file) return
        if (!confirm('¿Estás SEGURO? Esto sustituirá la base de datos y archivos actuales por los del paquete importado.')) return

        setLoading(true)
        addToast('Importando datos, por favor espera...', 'info')
        try {
            await api.admin.importData(file)
            addToast('Importación completada con éxito. Recargando...', 'success')
            setTimeout(() => window.location.reload(), 2000)
        } catch (e) {
            addToast(e.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    function formatSize(bytes) {
        if (!bytes) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    return (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Administración del sistema</h1>
                    <p className="page-subtitle">Gestiona backups, monitoriza el disco y salud del motor</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 30 }}>
                {/* Salud del Sistema */}
                <div className="card">
                    <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                        Estado del Motor
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 12, height: 12, borderRadius: '50%',
                            backgroundColor: stats?.tts_engine === 'online' ? '#10b981' : '#ef4444'
                        }}></div>
                        <span style={{ textTransform: 'uppercase', fontWeight: 'bold', fontSize: 13 }}>
                            Motor TTS {stats?.tts_engine || 'Cargando...'}
                        </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                        {stats?.tts_engine === 'online' ? 'Listo para generar audio.' : 'El motor no responde o está offline.'}
                    </p>
                </div>

                {/* Uso de Disco */}
                <div className="card">
                    <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7" /><path d="M16 19h6" /><path d="M19 16v6" /><circle cx="7.5" cy="15.5" r=".5" /><circle cx="11.5" cy="15.5" r=".5" /></svg>
                        Uso de Disco (/data)
                    </h3>
                    {stats?.disk ? (
                        <>
                            <div style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                                <div style={{
                                    width: `${stats.disk.percent}%`,
                                    height: '100%',
                                    backgroundColor: stats.disk.percent > 90 ? '#ef4444' : 'var(--accent)'
                                }}></div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                <span>{stats.disk.percent}% ocupado</span>
                                <span style={{ color: 'var(--muted)' }}>{formatSize(stats.disk.used)} / {formatSize(stats.disk.total)}</span>
                            </div>
                        </>
                    ) : 'Cargando...'}
                </div>
            </div>
            <div className="card" style={{ marginBottom: 30 }}>
                <h2 className="card-title" style={{ marginBottom: 16 }}>Migración y Transferencia</h2>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
                    Utiliza estas opciones para mover tu biblioteca a otro servidor. Genera un único archivo con todos tus libros, voces y audiolibros generados.
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                    <a
                        href={api.admin.exportDataUrl()}
                        className="btn btn-primary"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => addToast('Generando exportación, espera a que comience la descarga...', 'info')}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 8 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        Exportar Todo
                    </a>
                    <button
                        className="btn btn-ghost"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => document.getElementById('import-file-input').click()}
                        disabled={loading}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 8 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                        Importar Paquete
                    </button>
                    <input
                        type="file"
                        id="import-file-input"
                        style={{ display: 'none' }}
                        accept=".tar.gz"
                        onChange={handleImport}
                    />
                </div>
            </div>

            <TagManager addToast={addToast} />

            <div className="card" style={{ marginBottom: 30 }}>
                <h2 className="card-title" style={{ marginBottom: 16 }}>Apariencia</h2>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button
                        className={`btn ${document.documentElement.getAttribute('data-theme') !== 'light' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => {
                            document.documentElement.setAttribute('data-theme', 'dark');
                            localStorage.setItem('vox-theme', 'dark');
                            loadData(); // Force re-render simple
                        }}
                        style={{ flex: 1, justifyContent: 'center' }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                        Tema Oscuro
                    </button>
                    <button
                        className={`btn ${document.documentElement.getAttribute('data-theme') === 'light' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => {
                            document.documentElement.setAttribute('data-theme', 'light');
                            localStorage.setItem('vox-theme', 'light');
                            loadData(); // Force re-render simple
                        }}
                        style={{ flex: 1, justifyContent: 'center' }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
                        Tema Claro
                    </button>
                </div>
            </div>

            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 className="card-title" style={{ margin: 0 }}>Copias de Seguridad</h2>
                    <button
                        className={`btn ${loading ? 'btn-ghost' : 'btn-primary'} btn-sm`}
                        onClick={handleCreateBackup}
                        disabled={loading}
                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                        {loading ? (
                            <>
                                <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                                Cifrando datos...
                            </>
                        ) : (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                Crear Nuevo Backup
                            </>
                        )}
                    </button>
                </div>

                {loading && (
                    <div style={{
                        padding: '20px', backgroundColor: 'rgba(59, 130, 246, 0.05)',
                        border: '1px dashed var(--accent)', borderRadius: 12, marginBottom: 20,
                        textAlign: 'center', animation: 'pulse-slow 2s infinite'
                    }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--accent)', marginBottom: 4 }}>
                            Generando archivo comprimido...
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                            Esto puede tardar desde unos segundos hasta un minuto dependiendo del volumen de audios. No cierres esta pestaña.
                        </div>
                    </div>
                )}

                {backups.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
                        No hay copias de seguridad generadas.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                        {backups.map(b => (
                            <div key={b.filename} style={{
                                display: 'flex', alignItems: 'center', gap: 15, padding: 12,
                                backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)'
                                }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 'bold', fontSize: 14 }}>{b.filename}</div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                                        {new Date(b.created_at * 1000).toLocaleString()} · {formatSize(b.size)}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <a href={api.admin.downloadBackupUrl(b.filename)} className="btn btn-ghost btn-sm" download>
                                        Descargar
                                    </a>
                                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteBackup(b.filename)} style={{ padding: '4px 8px' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Toast toasts={toasts} />
        </div>
    )
}
