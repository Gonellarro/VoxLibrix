import { useState, useEffect, useRef } from 'react'
import { Plus, Mic, BookOpen, Music, Activity, Trash2, Play, Pause, Clock, X, Upload, CheckCircle2, Download, Volume2, Loader2 } from 'lucide-react'

const Navbar = ({ onToggleSidebar }) => (
    <nav className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="btn" style={{ padding: '8px' }} onClick={onToggleSidebar}>
                <BookOpen size={24} />
            </button>
            <div>
                <h1 style={{ fontSize: '1.5rem', background: 'linear-gradient(to right, #818cf8, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
                    Audiobook AI
                </h1>
            </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
                <Activity size={18} /> Sync
            </button>
        </div>
    </nav>
)

const Sidebar = ({ activeView, setActiveView, isOpen }) => {
    const menuItems = [
        { id: 'voices', label: 'Clonar Voces', icon: <Mic size={20} /> },
        { id: 'audio', label: 'Crear Audio', icon: <Volume2 size={20} /> },
        { id: 'book', label: 'Crear Libro', icon: <BookOpen size={20} /> },
    ]

    return (
        <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
            <div className="sidebar-content">
                {menuItems.map(item => (
                    <button
                        key={item.id}
                        className={`sidebar-item ${activeView === item.id ? 'active' : ''}`}
                        onClick={() => setActiveView(item.id)}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </button>
                ))}
            </div>
        </aside>
    )
}

const VoiceCard = ({ voice, onTest, onDelete }) => (
    // ... (resto del código igual hasta App)
    <div className="glass-card animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.25rem' }}>{voice.name}</h3>
            <span className="badge badge-info">Qwen3 0.6B</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {voice.reference_text || "Sin transcripción"}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" style={{ flex: 1, height: '40px', padding: '0 1rem' }} onClick={() => onTest(voice)}>
                <Play size={16} /> Probar
            </button>
            <button className="btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }} onClick={() => onDelete(voice.id)}>
                <Trash2 size={16} />
            </button>
        </div>
    </div>
)

const AddVoiceModal = ({ isOpen, onClose, onSuccess }) => {
    const [name, setName] = useState('')
    const [text, setText] = useState('')
    const [file, setFile] = useState(null)
    const [status, setStatus] = useState('idle') // idle, uploading, success
    const [progress, setProgress] = useState(0)

    useEffect(() => {
        if (!isOpen) {
            setName(''); setText(''); setFile(null); setStatus('idle'); setProgress(0);
        }
    }, [isOpen])

    if (!isOpen) return null

    const handleSubmit = async (e) => {
        e.preventDefault()
        setStatus('uploading')
        setProgress(20)

        const formData = new FormData()
        formData.append('name', name)
        formData.append('reference_text', text)
        formData.append('file', file)

        try {
            setProgress(50)
            const res = await fetch('http://localhost:8080/voices', {
                method: 'POST',
                body: formData
            })
            if (res.ok) {
                setProgress(100)
                setStatus('success')
                setTimeout(() => {
                    onSuccess()
                    onClose()
                }, 1500)
            } else {
                alert('Error al crear la voz')
                setStatus('idle')
            }
        } catch (err) {
            console.error(err)
            alert('Error de conexión')
            setStatus('idle')
        }
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '500px', background: 'var(--bg-card)', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.5rem' }}>Nueva Voz</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                {status === 'success' ? (
                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                        <CheckCircle2 size={64} color="#10b981" style={{ marginBottom: '1rem' }} />
                        <h3>¡Voz creada correctamente!</h3>
                        <p style={{ color: 'var(--text-muted)' }}>La voz ya está disponible en tu catálogo.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Nombre de la voz</label>
                            <input
                                type="text"
                                className="glass-card"
                                style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ej: Narrador"
                                disabled={status === 'uploading'}
                                required
                            />
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Audio de referencia (5-15s)</label>
                            <div style={{ border: '2px dashed var(--glass-border)', borderRadius: '0.5rem', padding: '1.5rem', textAlign: 'center' }}>
                                <input
                                    type="file"
                                    onChange={(e) => setFile(e.target.files[0])}
                                    style={{ display: 'none' }}
                                    id="voice-file"
                                    accept="audio/*"
                                    disabled={status === 'uploading'}
                                    required
                                />
                                <label htmlFor="voice-file" style={{ cursor: 'pointer' }}>
                                    <Upload size={32} style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
                                    <p>{file ? file.name : "Subir archivo WAV/MP3"}</p>
                                </label>
                            </div>
                        </div>
                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Transcripción exacta</label>
                            <textarea
                                className="glass-card"
                                style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', height: '100px', resize: 'none', color: 'white' }}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Escribe exactamente lo que se dice en el audio..."
                                disabled={status === 'uploading'}
                                required
                            />
                        </div>

                        {status === 'uploading' && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                                    <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s ease' }}></div>
                                </div>
                                <p style={{ fontSize: '0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>Guardando perfil de voz...</p>
                            </div>
                        )}

                        <button className="btn btn-primary" style={{ width: '100%' }} disabled={status === 'uploading'}>
                            {status === 'uploading' ? "Procesando..." : "Guardar voz"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}

const TestVoiceModal = ({ isOpen, voice, onClose }) => {
    const [text, setText] = useState('Hola, esta es una prueba de mi nueva voz clonada.')
    const [status, setStatus] = useState('idle') // idle, generating, done
    const [audioUrl, setAudioUrl] = useState(null)
    const audioRef = useRef(null)

    useEffect(() => {
        if (!isOpen) {
            setStatus('idle'); setAudioUrl(null); setText('Hola, esta es una prueba de mi nueva voz clonada.');
        }
    }, [isOpen])

    if (!isOpen || !voice) return null

    const handleGenerate = async () => {
        setStatus('generating')
        try {
            const res = await fetch(`http://localhost:8080/voices/${voice.id}/test?text=${encodeURIComponent(text)}`)
            if (res.ok) {
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                setAudioUrl(url)
                setStatus('done')
            } else {
                alert('Error al generar audio')
                setStatus('idle')
            }
        } catch (err) {
            console.error(err)
            alert('Error de conexión')
            setStatus('idle')
        }
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '500px', background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Volume2 size={24} color="var(--primary)" /> Probar: {voice.name}
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Texto para sintetizar</label>
                    <textarea
                        className="glass-card"
                        style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', height: '100px', resize: 'none', fontSize: '1.1rem', color: 'white' }}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Escribe algo..."
                        disabled={status === 'generating'}
                    />
                </div>

                {status === 'generating' && (
                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                        <Loader2 size={48} className="animate-spin" color="var(--primary)" style={{ marginBottom: '1rem', margin: '0 auto', display: 'block' }} />
                        <p style={{ color: 'var(--text-muted)' }}>Usando Qwen3-TTS para generar audio...</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '0.5rem' }}>Esto puede tardar unos segundos en CPU</p>
                    </div>
                )}

                {status === 'done' && audioUrl && (
                    <div className="animate-fade-in" style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                        <audio ref={audioRef} src={audioUrl} controls style={{ width: '100%', marginBottom: '1.5rem' }} />
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <a href={audioUrl} download={`${voice.name}_test.wav`} className="btn btn-primary" style={{ flex: 1, textDecoration: 'none', justifyContent: 'center' }}>
                                <Download size={18} /> Descargar WAV
                            </a>
                            <button className="btn" style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)' }} onClick={() => setStatus('idle')}>
                                Nueva frase
                            </button>
                        </div>
                    </div>
                )}

                {status === 'idle' && (
                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleGenerate}>
                        <Play size={18} /> Generar muestra
                    </button>
                )}
            </div>

            <style>{`
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}

const BookGenerator = ({ voices }) => {
    const [text, setText] = useState(() => localStorage.getItem('book_text') || '')
    const [mappings, setMappings] = useState(() => {
        const saved = localStorage.getItem('book_mappings')
        return saved ? JSON.parse(saved) : {}
    })
    const [defaultVoice, setDefaultVoice] = useState(() => localStorage.getItem('book_default_voice') || '')
    const [status, setStatus] = useState('idle') // idle, processing, done, error
    const [progress, setProgress] = useState(0)
    const [currentSentence, setCurrentSentence] = useState('')
    const [error, setError] = useState(null)
    const [projectId, setProjectId] = useState(null)

    // Escanear etiquetas cuando el texto cambia
    useEffect(() => {
        localStorage.setItem('book_text', text)
        const tags = [...text.matchAll(/<([^>]+)>/g)].map(m => m[1].replace('/', ''))
        const uniqueTags = [...new Set(tags)]

        setMappings(prev => {
            const next = { ...prev }
            uniqueTags.forEach(tag => {
                if (!next[tag]) next[tag] = ''
            })
            // Limpiar tags que ya no existen
            Object.keys(next).forEach(tag => {
                if (!uniqueTags.includes(tag)) delete next[tag]
            })
            return next
        })
    }, [text])

    useEffect(() => {
        localStorage.setItem('book_mappings', JSON.stringify(mappings))
    }, [mappings])

    useEffect(() => {
        localStorage.setItem('book_default_voice', defaultVoice)
    }, [defaultVoice])

    const pollStatus = async (id) => {
        try {
            const res = await fetch(`http://localhost:8080/projects/${id}`)
            if (res.ok) {
                const data = await res.json()
                if (data.total_segments > 0) setProgress(Math.round((data.completed_segments / data.total_segments) * 100))
                setCurrentSentence(data.current_sentence || '')

                if (data.status === 'completed') {
                    setStatus('done')
                    setProgress(100)
                    window.location.href = `http://localhost:8080/projects/${id}/download`
                } else if (data.status === 'error') {
                    setStatus('error')
                    setError(data.error_message)
                } else {
                    setTimeout(() => pollStatus(id), 2000)
                }
            }
        } catch (err) { console.error(err); setTimeout(() => pollStatus(id), 5000) }
    }

    const handlePause = async () => {
        try {
            await fetch(`http://localhost:8080/projects/${projectId}/pause`, { method: 'POST' })
            setStatus('paused')
        } catch (err) { console.error(err) }
    }

    const handleResume = async () => {
        try {
            await fetch(`http://localhost:8080/projects/${projectId}/resume`, { method: 'POST' })
            setStatus('processing')
            pollStatus(projectId)
        } catch (err) { console.error(err) }
    }

    const handleGenerate = async () => {
        if (!text || !defaultVoice) return alert('Escribe algo y selecciona una voz para el narrador')
        setStatus('processing'); setProgress(0); setError(null); setCurrentSentence('')
        try {
            const res = await fetch('http://localhost:8080/generate-multi-voice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, mappings, default_voice_id: defaultVoice })
            })
            if (res.ok) {
                const data = await res.json()
                setProjectId(data.project_id); pollStatus(data.project_id)
            } else {
                const errData = await res.json(); setError(errData.detail || 'Error desconocido'); setStatus('error')
            }
        } catch (err) { console.error(err); setError('Error de conexión'); setStatus('error') }
    }

    return (
        <section>
            <h2 style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                <BookOpen className="text-secondary" /> Generación de Libro Multi-voz
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '2rem', alignItems: 'start' }}>
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <label style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>
                            Contenido del Libro (usar &lt;personaje&gt;Texto&lt;/personaje&gt;)
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="file"
                                accept=".txt"
                                style={{ display: 'none' }}
                                id="book-upload"
                                onChange={(e) => {
                                    const file = e.target.files[0]
                                    if (file) {
                                        const reader = new FileReader()
                                        reader.onload = (ev) => setText(ev.target.result)
                                        reader.readAsText(file)
                                    }
                                }}
                            />
                            <label htmlFor="book-upload" className="btn" style={{ padding: '4px 12px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)' }}>
                                <Upload size={14} /> Subir .txt
                            </label>
                            <button className="btn" style={{ padding: '4px 12px', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }} onClick={() => { if (confirm('¿Vaciar todo el texto?')) setText('') }}>
                                <Trash2 size={14} /> Limpiar
                            </button>
                        </div>
                    </div>
                    <textarea
                        className="glass-card"
                        style={{ width: '100%', minHeight: '400px', background: 'rgba(0,0,0,0.2)', color: 'white', lineHeight: '1.8', fontSize: '1rem' }}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Había una vez... <p1>¡Hola!</p1>"
                    />
                </div>

                <div className="glass-card" style={{ padding: '1.5rem', position: 'sticky', top: '2rem' }}>
                    <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Mapeo de Voces</h3>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Voz por Defecto (Narrador)</label>
                        <select
                            className="glass-card"
                            style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                            value={defaultVoice}
                            onChange={(e) => setDefaultVoice(e.target.value)}
                        >
                            <option value="">Seleccionar...</option>
                            {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                    </div>

                    {Object.keys(mappings).length > 0 && (
                        <div style={{ padding: '1rem 0' }}>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>Personajes detectados:</p>
                            {Object.keys(mappings).map(tag => (
                                <div key={tag} style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem' }}>&lt;{tag}&gt;</label>
                                    <select
                                        className="glass-card"
                                        style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                                        value={mappings[tag]}
                                        onChange={(e) => setMappings(prev => ({ ...prev, [tag]: e.target.value }))}
                                    >
                                        <option value="">Igual que Narrador</option>
                                        {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                    )}

                    <button
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '1rem', background: 'var(--secondary)' }}
                        onClick={handleGenerate}
                        disabled={status === 'processing' || status === 'paused'}
                    >
                        {status === 'processing' ? 'Procesando...' : status === 'paused' ? 'Pausado' : 'Generar Libro'}
                    </button>

                    {(status === 'processing' || status === 'paused') && (
                        <div style={{ marginTop: '1.5rem' }}>
                            <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginBottom: '1rem' }}>
                                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--secondary)', transition: 'width 0.5s' }}></div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{progress}% completado</p>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {status === 'processing' ? (
                                        <button className="btn" style={{ padding: '4px 8px', fontSize: '0.7rem' }} onClick={handlePause}>
                                            <Pause size={12} /> Pausar
                                        </button>
                                    ) : (
                                        <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.7rem' }} onClick={handleResume}>
                                            <Play size={12} /> Reanudar
                                        </button>
                                    )}
                                </div>
                            </div>
                            {currentSentence && (
                                <div className="glass-card" style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.3)', fontSize: '0.8rem', borderLeft: '3px solid var(--secondary)' }}>
                                    <p style={{ color: 'var(--text-muted)', marginBottom: '0.25rem', fontSize: '0.7rem', textTransform: 'uppercase' }}>Procesando ahora:</p>
                                    <p style={{ color: 'white', fontStyle: 'italic' }}>"{currentSentence}..."</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {status === 'done' && (
                <div style={{ marginTop: '2rem' }} className="animate-fade-in">
                    <div className="glass-card" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981' }}>
                        <p style={{ color: '#10b981', fontWeight: 'bold' }}>¡Libro generado con éxito!</p>
                        <a href={`http://localhost:8080/projects/${projectId}/download`} className="btn btn-primary" style={{ marginTop: '1rem', background: '#10b981' }}>
                            <Download size={18} /> Descargar Libro (MP3)
                        </a>
                    </div>
                </div>
            )}

            {status === 'error' && (
                <div style={{ marginTop: '2rem' }} className="animate-fade-in">
                    <div className="glass-card" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444' }}>
                        <p style={{ color: '#ef4444', fontWeight: 'bold' }}>Error: {error}</p>
                        <button className="btn" onClick={() => setStatus('idle')} style={{ marginTop: '1rem' }}>Reintentar</button>
                    </div>
                </div>
            )}
        </section>
    )
}

const SimpleAudioGenerator = ({ voices }) => {
    const [file, setFile] = useState(null)
    const [selectedVoice, setSelectedVoice] = useState('')
    const [status, setStatus] = useState('idle') // idle, processing, done, error
    const [progress, setProgress] = useState(0)
    const [currentSentence, setCurrentSentence] = useState('')
    const [error, setError] = useState(null)
    const [projectId, setProjectId] = useState(null)

    const pollStatus = async (id) => {
        try {
            const res = await fetch(`http://localhost:8080/projects/${id}`)
            if (res.ok) {
                const data = await res.json()
                if (data.total_segments > 0) setProgress(Math.round((data.completed_segments / data.total_segments) * 100))
                setCurrentSentence(data.current_sentence || '')

                if (data.status === 'processing') setStatus('processing')
                if (data.status === 'paused') setStatus('paused')

                if (data.status === 'completed') {
                    setStatus('done')
                    setProgress(100)
                    window.location.href = `http://localhost:8080/projects/${id}/download`
                } else if (data.status === 'error') {
                    setStatus('error')
                    setError(data.error_message)
                } else if (data.status !== 'paused') {
                    setTimeout(() => pollStatus(id), 2000)
                }
            }
        } catch (err) { console.error(err); setTimeout(() => pollStatus(id), 5000) }
    }

    const handlePause = async () => {
        try {
            await fetch(`http://localhost:8080/projects/${projectId}/pause`, { method: 'POST' })
            setStatus('paused')
        } catch (err) { console.error(err) }
    }

    const handleResume = async () => {
        try {
            await fetch(`http://localhost:8080/projects/${projectId}/resume`, { method: 'POST' })
            setStatus('processing')
            pollStatus(projectId)
        } catch (err) { console.error(err) }
    }

    const handleGenerate = async () => {
        if (!file || !selectedVoice) return alert('Selecciona un archivo y una voz')
        setStatus('processing'); setProgress(0); setError(null); setCurrentSentence('')
        const formData = new FormData()
        formData.append('file', file)
        formData.append('voice_id', selectedVoice)
        try {
            const res = await fetch('http://localhost:8080/generate-from-txt', { method: 'POST', body: formData })
            if (res.ok) {
                const data = await res.json()
                setProjectId(data.project_id); pollStatus(data.project_id)
            } else {
                const errData = await res.json()
                alert('Error: ' + (errData.detail || 'Desconocido'))
                setStatus('idle')
            }
        } catch (err) { console.error(err); alert('Error de conexión'); setStatus('idle') }
    }

    return (
        <section>
            <h2 style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                <Volume2 className="text-secondary" /> Generación de Audio (MVP TXT)
            </h2>
            <div className="glass-card" style={{ padding: '2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Archivo del libro (.txt)</label>
                        <div style={{ border: '2px dashed var(--glass-border)', borderRadius: '0.5rem', padding: '1rem', textAlign: 'center' }}>
                            <input type="file" accept=".txt" onChange={(e) => setFile(e.target.files[0])} style={{ display: 'none' }} id="txt-file" />
                            <label htmlFor="txt-file" style={{ cursor: 'pointer' }}>
                                <Upload size={24} style={{ color: 'var(--secondary)', marginBottom: '0.5rem' }} />
                                <p style={{ fontSize: '0.875rem' }}>{file ? file.name : "Seleccionar TXT"}</p>
                            </label>
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Voz del Narrador</label>
                        <select className="glass-card" style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', color: 'white' }} value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)}>
                            <option value="">Selecciona una voz...</option>
                            {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                    </div>
                </div>

                {(status === 'processing' || status === 'paused') && (
                    <div style={{ marginBottom: '2rem' }}>
                        <div style={{ height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden', marginBottom: '1rem' }}>
                            <div className="progress-bar-fill" style={{ width: `${progress}%`, height: '100%', background: 'var(--secondary)', transition: 'width 0.5s ease' }}></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                {status === 'processing' ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" style={{ display: 'inline', marginRight: '0.5rem' }} />
                                        Generando audio... ({progress}%)
                                    </>
                                ) : (
                                    <>
                                        <Pause size={14} style={{ display: 'inline', marginRight: '0.5rem' }} />
                                        Proceso pausado ({progress}%)
                                    </>
                                )}
                            </p>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                {status === 'processing' ? (
                                    <button className="btn" onClick={handlePause}>
                                        <Pause size={16} /> Pausar
                                    </button>
                                ) : (
                                    <button className="btn btn-secondary" onClick={handleResume}>
                                        <Play size={16} /> Reanudar
                                    </button>
                                )}
                            </div>
                        </div>
                        {currentSentence && (
                            <div className="glass-card" style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderLeft: '4px solid var(--secondary)' }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Frase actual:</p>
                                <p style={{ color: 'white', lineHeight: '1.6' }}>"{currentSentence}..."</p>
                            </div>
                        )}
                    </div>
                )}

                <button className="btn btn-primary" style={{ width: '100%', background: 'var(--secondary)' }} onClick={handleGenerate} disabled={status === 'processing' || status === 'paused' || !file || !selectedVoice}>
                    {status === 'processing' ? 'Procesando...' : status === 'paused' ? 'Pausado' : 'Empezar Generación'}
                </button>
            </div>
        </section>
    )
}

const ProjectHistory = () => {
    const [projects, setProjects] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchProjects = async () => {
        try {
            const res = await fetch('http://localhost:8080/projects')
            if (res.ok) {
                const data = await res.json()
                setProjects(data)
            }
        } catch (err) { console.error(err) }
        setLoading(false)
    }

    useEffect(() => {
        fetchProjects()
        const interval = setInterval(fetchProjects, 5000)
        return () => clearInterval(interval)
    }, [])

    if (loading && projects.length === 0) return null

    return (
        <section style={{ marginTop: '4rem', paddingBottom: '4rem' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-muted)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} /> Proyectos Recientes
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {projects.map(p => (
                    <div key={p.id} className="glass-card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: p.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {p.status === 'completed' ? <CheckCircle2 size={20} color="#10b981" /> : <Clock size={20} color="var(--text-muted)" />}
                            </div>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '0.9rem' }}>{p.title}</h4>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {p.is_multi_voice ? 'Multi-voz' : 'Sencillo'} • {p.status === 'completed' ? 'Completado' : p.status === 'processing' ? 'Procesando...' : p.status === 'paused' ? 'Pausado' : 'Error'}
                                    {p.status === 'processing' && ` (${Math.round((p.completed_segments / p.total_segments) * 100)}%)`}
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            {p.status === 'completed' && (
                                <a href={`http://localhost:8080/projects/${p.id}/download`} className="btn" style={{ padding: '4px 12px', fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#10b981' }}>
                                    <Download size={14} /> Descargar
                                </a>
                            )}
                            {p.status === 'error' && <p style={{ color: '#ef4444', fontSize: '0.7rem' }}>Error</p>}
                        </div>
                    </div>
                ))}
                {projects.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>No hay proyectos previos.</p>}
            </div>
        </section>
    )
}

function App() {
    const [voices, setVoices] = useState([])
    const [loading, setLoading] = useState(true)
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [testVoice, setTestVoice] = useState(null)
    const [activeView, setActiveView] = useState('voices') // voices, audio, book
    const [sidebarOpen, setSidebarOpen] = useState(true)

    const fetchVoices = () => {
        setLoading(true)
        fetch('http://localhost:8080/voices')
            .then(res => res.json())
            .then(data => {
                setVoices(data)
                setLoading(false)
            })
            .catch(err => {
                console.error(err)
                setLoading(false)
            })
    }

    useEffect(() => {
        fetchVoices()
    }, [])

    const handleDelete = async (id) => {
        if (!confirm('¿Estás seguro de que quieres eliminar esta voz?')) return
        try {
            const res = await fetch(`http://localhost:8080/voices/${id}`, { method: 'DELETE' })
            if (res.ok) fetchVoices()
        } catch (err) { console.error(err) }
    }

    return (
        <div className="main-layout">
            <Sidebar
                activeView={activeView}
                setActiveView={setActiveView}
                isOpen={sidebarOpen}
            />

            <div className="content-area">
                <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

                <div className="container">
                    {activeView === 'voices' && (
                        <section className="animate-fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <h2 style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Music className="text-primary" /> Catálogo de Voces
                                </h2>
                                <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
                                    <Plus size={18} /> Nueva Voz
                                </button>
                            </div>

                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '4rem' }}>
                                    <Loader2 size={32} className="animate-spin" color="var(--primary)" style={{ margin: '0 auto' }} />
                                    <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Cargando catálogo...</p>
                                </div>
                            ) : (
                                <div className="grid">
                                    {voices.length > 0 ? (
                                        voices.map(v => (
                                            <VoiceCard
                                                key={v.id}
                                                voice={v}
                                                onTest={() => setTestVoice(v)}
                                                onDelete={handleDelete}
                                            />
                                        ))
                                    ) : (
                                        <div className="glass-card" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem' }}>
                                            <Mic size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                                            <h3>No hay voces registradas</h3>
                                            <p style={{ color: 'var(--text-muted)' }}>Sube un fragmento de audio para empezar</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    )}

                    {activeView === 'audio' && (
                        <section className="animate-fade-in">
                            <SimpleAudioGenerator voices={voices} />
                        </section>
                    )}

                    {activeView === 'book' && (
                        <section className="animate-fade-in">
                            <BookGenerator voices={voices} />
                        </section>
                    )}

                    {/* Historial de Proyectos */}
                    <ProjectHistory />
                </div>
            </div>

            <AddVoiceModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={fetchVoices}
            />

            <TestVoiceModal
                isOpen={!!testVoice}
                voice={testVoice}
                onClose={() => setTestVoice(null)}
            />

            <style>{`
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}

export default App
