import { useState, useEffect, useRef } from 'react'
import { Plus, Mic, BookOpen, Music, Activity, Trash2, Play, X, Upload, CheckCircle2, Download, Volume2, Loader2 } from 'lucide-react'

const Navbar = () => (
    <nav className="header">
        <div>
            <h1 style={{ fontSize: '2rem', background: 'linear-gradient(to right, #818cf8, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Audiobook AI
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Generación local multi-voz</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
                <Activity size={18} /> Dashboard
            </button>
        </div>
    </nav>
)

const VoiceCard = ({ voice, onTest, onDelete }) => (
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
                                style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)' }}
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
                                style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', height: '100px', resize: 'none' }}
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
                        style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', height: '100px', resize: 'none', fontSize: '1.1rem' }}
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

const ProjectGenerator = ({ voices }) => {
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

                if (data.total_segments > 0) {
                    const p = Math.round((data.completed_segments / data.total_segments) * 100)
                    setProgress(p)
                }
                setCurrentSentence(data.current_sentence || '')

                if (data.status === 'completed') {
                    setStatus('done')
                    setProgress(100)
                    // Auto download
                    window.location.href = `http://localhost:8080/projects/${id}/download`
                } else if (data.status === 'error') {
                    setStatus('error')
                    setError(data.error_message)
                } else {
                    // Continue polling
                    setTimeout(() => pollStatus(id), 2000)
                }
            }
        } catch (err) {
            console.error("Polling error", err)
            setTimeout(() => pollStatus(id), 5000)
        }
    }

    const handleGenerate = async () => {
        if (!file || !selectedVoice) return alert('Selecciona un archivo y una voz')

        setStatus('processing')
        setProgress(0)
        setError(null)
        setCurrentSentence('')

        const formData = new FormData()
        formData.append('file', file)
        formData.append('voice_id', selectedVoice)

        try {
            const res = await fetch('http://localhost:8080/generate-from-txt', {
                method: 'POST',
                body: formData
            })

            if (res.ok) {
                const data = await res.json()
                setProjectId(data.project_id)
                pollStatus(data.project_id)
            } else {
                const errData = await res.json()
                alert('Error al iniciar: ' + (errData.detail || 'Desconocido'))
                setStatus('idle')
            }
        } catch (err) {
            console.error(err)
            alert('Error de conexión')
            setStatus('idle')
        }
    }

    return (
        <section>
            <h2 style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                <BookOpen className="text-secondary" /> Generación de Audiobooks (MVP TXT)
            </h2>
            <div className="glass-card" style={{ padding: '2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Archivo del libro (.txt)</label>
                        <div style={{ border: '2px dashed var(--glass-border)', borderRadius: '0.5rem', padding: '1rem', textAlign: 'center' }}>
                            <input
                                type="file"
                                accept=".txt"
                                onChange={(e) => setFile(e.target.files[0])}
                                style={{ display: 'none' }}
                                id="txt-file"
                            />
                            <label htmlFor="txt-file" style={{ cursor: 'pointer' }}>
                                <Upload size={24} style={{ color: 'var(--secondary)', marginBottom: '0.5rem' }} />
                                <p style={{ fontSize: '0.875rem' }}>{file ? file.name : "Seleccionar TXT"}</p>
                            </label>
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Voz del Narrador</label>
                        <select
                            className="glass-card"
                            style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                            value={selectedVoice}
                            onChange={(e) => setSelectedVoice(e.target.value)}
                        >
                            <option value="">Selecciona una voz...</option>
                            {voices.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {status === 'processing' && (
                    <div style={{ marginBottom: '2rem' }}>
                        <div style={{ height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden', marginBottom: '1rem' }}>
                            <div className="progress-bar-fill" style={{ width: `${progress}%`, height: '100%', background: 'var(--secondary)', transition: 'width 0.5s ease' }}></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                <Loader2 size={14} className="animate-spin" style={{ display: 'inline', marginRight: '0.5rem' }} />
                                Generando frase a frase ({progress}%)
                            </p>
                            <span className="badge badge-info" style={{ background: 'rgba(167, 139, 250, 0.1)', color: '#a78bfa' }}>
                                {progress === 100 ? "Finalizando..." : "En proceso"}
                            </span>
                        </div>
                        {currentSentence && (
                            <div className="glass-card animate-pulse" style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(167, 139, 250, 0.2)' }}>
                                <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--secondary)', marginBottom: '0.5rem' }}>Tratando ahora:</p>
                                <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                                    "{currentSentence.length > 150 ? currentSentence.substring(0, 150) + '...' : currentSentence}"
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {status === 'error' && (
                    <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '0.5rem', marginBottom: '2rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <p style={{ color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                            <X size={20} /> Error en la generación
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>{error}</p>
                        <button className="btn btn-primary" style={{ marginTop: '1rem', background: 'rgba(239, 68, 68, 0.2)', color: 'white' }} onClick={() => setStatus('idle')}>
                            Reintentar
                        </button>
                    </div>
                )}

                {status === 'done' && (
                    <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '0.5rem', marginBottom: '2rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <p style={{ color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
                            <CheckCircle2 size={24} /> ¡Audiolibro completado!
                        </p>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                            La descarga debería haber comenzado automáticamente.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <a href={`http://localhost:8080/projects/${projectId}/download`} className="btn btn-primary" style={{ background: '#10b981', textDecoration: 'none' }}>
                                <Download size={18} /> Descargar de nuevo
                            </a>
                            <button className="btn" onClick={() => setStatus('idle')}>
                                Nueva generación
                            </button>
                        </div>
                    </div>
                )}

                <button
                    className="btn btn-primary"
                    style={{ width: '100%', background: 'var(--secondary)', border: 'none' }}
                    onClick={handleGenerate}
                    disabled={status === 'processing' || !file || !selectedVoice}
                >
                    {status === 'processing' ? 'Procesando...' : 'Empezar Generación'}
                </button>
            </div>

            <style>{`
                .progress-bar-fill {
                    background: linear-gradient(90deg, var(--secondary) 25%, #a78bfa 50%, var(--secondary) 75%);
                    background-size: 200% 100%;
                    animation: progress-move 2s linear infinite;
                }
                @keyframes progress-move {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                .animate-pulse {
                    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
            `}</style>
        </section>
    )
}

function App() {
    const [voices, setVoices] = useState([])
    const [loading, setLoading] = useState(true)
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [testVoice, setTestVoice] = useState(null)

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
        <div className="container">
            <Navbar />

            <section style={{ marginBottom: '4rem' }}>
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

            <ProjectGenerator voices={voices} />

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
