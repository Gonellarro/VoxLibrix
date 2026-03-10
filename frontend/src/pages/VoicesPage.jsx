import { useState, useEffect, useRef } from 'react'
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

function VoiceModal({ voice, onClose, onSaved, addToast }) {
    const [name, setName] = useState(voice?.name || '')
    const [description, setDescription] = useState(voice?.description || '')
    const [gender, setGender] = useState(voice?.gender || 'feminine')
    const [language, setLanguage] = useState(voice?.language || 'Spanish')
    const [audioFile, setAudioFile] = useState(null)
    const [textFile, setTextFile] = useState(null)
    const [saving, setSaving] = useState(false)

    const audioRef = useRef()
    const textRef = useRef()

    async function save() {
        if (!name.trim()) return addToast('El nombre es obligatorio', 'error')
        if (!voice && !audioFile) return addToast('Sube un audio de muestra', 'error')
        if (!voice && !textFile) return addToast('Sube el texto de referencia', 'error')

        setSaving(true)
        try {
            const form = new FormData()
            form.append('name', name)
            form.append('description', description)
            form.append('gender', gender)
            form.append('language', language)
            if (audioFile) form.append('audio_file', audioFile)
            if (textFile) form.append('text_file', textFile)

            if (voice) {
                await api.voices.update(voice.id, form)
            } else {
                await api.voices.create(form)
            }
            addToast(voice ? 'Voz actualizada' : 'Voz creada', 'success')
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
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                    {voice ? 'Editar voz' : 'Nueva voz'}
                </h2>

                <div className="form-group">
                    <label className="form-label">Nombre *</label>
                    <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Narradora principal" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="form-group">
                        <label className="form-label">Sexo</label>
                        <select className="form-select" value={gender} onChange={e => setGender(e.target.value)}>
                            <option value="feminine">Femenino</option>
                            <option value="masculine">Masculino</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Idioma</label>
                        <select className="form-select" value={language} onChange={e => setLanguage(e.target.value)}>
                            <option value="Spanish">Español</option>
                            <option value="English">Inglés</option>
                        </select>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Descripción</label>
                    <input className="form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Voz femenina, tono cálido..." />
                </div>

                <div className="form-group">
                    <label className="form-label">Archivo de Audio de muestra {!voice && '*'}</label>
                    <div className={`file-drop ${audioFile ? 'has-file' : ''}`} onClick={() => audioRef.current.click()}>
                        <input ref={audioRef} type="file" accept="audio/*" onChange={e => setAudioFile(e.target.files[0])} />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                            {audioFile ? <strong>{audioFile.name}</strong> : 'Subir audio (WAV, MP3...)'}
                        </div>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Archivo de Texto de referencia {!voice && '*'}</label>
                    <div className={`file-drop ${textFile ? 'has-file' : ''}`} onClick={() => textRef.current.click()}>
                        <input ref={textRef} type="file" accept=".txt" onChange={e => setTextFile(e.target.files[0])} />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                            {textFile ? <strong>{textFile.name}</strong> : 'Subir transcripción (.txt)'}
                        </div>
                    </div>
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

function TestVoiceModal({ voice, onClose, addToast }) {
    const [text, setText] = useState('Esta es una prueba de voz para comprobar la calidad de la clonación en tiempo real.')
    const [loading, setLoading] = useState(false)
    const [audioUrl, setAudioUrl] = useState(null)

    async function generateTest() {
        if (!text.trim()) return addToast('Escribe un texto para probar', 'error')
        setLoading(true)
        setAudioUrl(null)
        try {
            const blob = await api.voices.test(voice.id, text)
            const url = URL.createObjectURL(blob)
            setAudioUrl(url)
            addToast('Prueba generada con éxito', 'success')
        } catch (e) {
            addToast(e.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <h2 className="modal-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M10 8l6 4-6 4V8z" /></svg>
                    Probar voz: {voice.name}
                </h2>

                <div className="form-group">
                    <label className="form-label">Texto de prueba</label>
                    <textarea
                        className="form-input"
                        rows="4"
                        style={{ minHeight: 100, padding: '10px' }}
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder="Escribe lo que quieras que la voz diga..."
                    />
                </div>

                {audioUrl && (
                    <div style={{ marginTop: 16 }}>
                        <label className="form-label">Resultado de audio</label>
                        <audio src={audioUrl} controls autoPlay style={{ width: '100%' }} />
                    </div>
                )}

                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
                    <button className="btn btn-primary" onClick={generateTest} disabled={loading}>
                        {loading ? 'Generando audio...' : 'Generar prueba'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function TestPiperModal({ voice, onClose, addToast }) {
    const [text, setText] = useState('Érase una vez, en un reino muy lejano, vivía un joven caballero que soñaba con descubrir el mundo más allá de las montañas.')
    const [loading, setLoading] = useState(false)
    const [audioUrl, setAudioUrl] = useState(null)

    async function generateTest() {
        if (!text.trim()) return addToast('Escribe un texto para probar', 'error')
        setLoading(true)
        setAudioUrl(null)
        try {
            const blob = await api.voices.piperTest(voice.id, text)
            const url = URL.createObjectURL(blob)
            setAudioUrl(url)
            addToast('Prueba Piper generada', 'success')
        } catch (e) {
            addToast(e.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <h2 className="modal-title" style={{ color: '#8b5cf6' }}>
                    🎺 Probar voz Piper: {voice.name}
                </h2>

                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
                    ID: <code style={{ fontSize: 11, color: '#8b5cf6', background: 'rgba(139,92,246,0.1)', padding: '2px 6px', borderRadius: 4 }}>{voice.id}</code>
                </div>

                <div className="form-group">
                    <label className="form-label">Texto de prueba</label>
                    <textarea
                        className="form-input"
                        rows="4"
                        style={{ minHeight: 100, padding: '10px' }}
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder="Escribe lo que quieras que la voz diga..."
                    />
                </div>

                {audioUrl && (
                    <div style={{ marginTop: 16 }}>
                        <label className="form-label">Resultado de audio</label>
                        <audio src={audioUrl} controls autoPlay style={{ width: '100%' }} />
                    </div>
                )}

                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
                    <button className="btn btn-primary" style={{ background: '#8b5cf6' }} onClick={generateTest} disabled={loading}>
                        {loading ? '🎺 Generando...' : '🎺 Generar prueba'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function VoicesPage() {
    const [voices, setVoices] = useState([])
    const [piperVoices, setPiperVoices] = useState([])
    const [editVoice, setEditVoice] = useState(undefined)
    const [testVoice, setTestVoice] = useState(undefined)
    const [testPiperVoice, setTestPiperVoice] = useState(undefined)
    const [downloading, setDownloading] = useState({})
    const [toasts, setToasts] = useState([])

    function addToast(msg, type = 'info') {
        const id = Date.now()
        setToasts(t => [...t, { id, msg, type }])
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
    }

    async function load() {
        try {
            const [v, pv] = await Promise.all([
                api.voices.list(),
                api.voices.piperVoices()
            ])
            setVoices(v)
            setPiperVoices(pv)
        } catch (e) {
            addToast(e.message, 'error')
        }
    }

    useEffect(() => { load() }, [])

    async function remove(voice) {
        if (!confirm(`¿Eliminar la voz "${voice.name}"?`)) return
        try {
            await api.voices.delete(voice.id)
            addToast('Voz eliminada', 'success')
            load()
        } catch (e) {
            addToast(e.message, 'error')
        }
    }

    const qualityLabels = { x_low: 'Básica', low: 'Baja', medium: 'Media', high: 'Alta' }

    async function downloadPiperVoice(pv) {
        setDownloading(d => ({ ...d, [pv.id]: true }))
        try {
            await api.voices.piperDownload(pv.id)
            addToast(`Voz ${pv.name} descargada ✓`, 'success')
            load()
        } catch (e) {
            addToast(e.message, 'error')
        } finally {
            setDownloading(d => ({ ...d, [pv.id]: false }))
        }
    }

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Voces</h1>
                    <p className="page-subtitle">{voices.length} clonada{voices.length !== 1 ? 's' : ''} · {piperVoices.length} Piper</p>
                </div>
                <button className="btn btn-primary" onClick={() => setEditVoice(null)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Nueva voz
                </button>
            </div>

            {/* ── Sección Voces Clonadas ─────────────────────────── */}
            <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#10b981' }}>●</span> Voces clonadas ({voices.length})
            </div>

            {voices.length === 0 ? (
                <div className="empty-state" style={{ marginBottom: 32 }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /></svg>
                    <h3>Sin voces clonadas</h3>
                    <p>Crea tu primera voz clonada para usar con Qwen o Cloud</p>
                </div>
            ) : (
                <div className="card-grid" style={{ marginBottom: 32 }}>
                    {voices.map(v => (
                        <div key={v.id} className="card voice-card-cloned">
                            <div className="card-head">
                                <div className="voice-avatar" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>{v.name[0].toUpperCase()}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="card-title">{v.name}</div>
                                    <div className="card-meta">
                                        <span style={{ color: 'var(--accent)' }}>{v.gender === 'masculine' ? '♂ Masc' : '♀ Fem'}</span> · {v.language === 'Spanish' ? '🇪🇸 ESP' : '🇺🇸 ENG'}
                                    </div>
                                </div>
                                <span className={`badge ${v.is_active ? 'badge-done' : 'badge-pending'}`}>
                                    {v.is_active ? 'Activa' : 'Inactiva'}
                                </span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, minHeight: 32 }}>
                                {v.description || 'Sin descripción adicional.'}
                            </div>
                            <audio src={api.voices.sampleUrl(v.id)} controls />
                            <div className="card-actions">
                                <button className="btn btn-primary btn-sm" onClick={() => setTestVoice(v)}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 4 }}><path d="M10 8l6 4-6 4V8z" /></svg>
                                    Probar
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setEditVoice(v)}>Editar</button>
                                <button className="btn btn-danger btn-sm" onClick={() => remove(v)}>Eliminar</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Sección Voces Piper ─────────────────────────────── */}
            <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#8b5cf6' }}>●</span> Voces Piper ({piperVoices.length})
            </div>

            <div className="card-grid">
                {piperVoices.map(pv => (
                    <div key={pv.id} className="card voice-card-piper">
                        <div className="card-head">
                            <div className="voice-avatar" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>{pv.name[0].toUpperCase()}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="card-title">{pv.name}</div>
                                <div className="card-meta">
                                    🇪🇸 {pv.language} · Calidad: {qualityLabels[pv.quality] || pv.quality}
                                </div>
                            </div>
                            {pv.downloaded
                                ? <span className="badge badge-done" style={{ fontSize: 10 }}>Descargada</span>
                                : <span className="badge badge-pending" style={{ fontSize: 10 }}>No descargada</span>
                            }
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                            Motor local ligero · Sin clonación · ID: <code style={{ fontSize: 11, color: '#8b5cf6' }}>{pv.id}</code>
                        </div>
                        <div className="card-actions">
                            {pv.downloaded ? (
                                <button className="btn btn-sm" style={{ background: '#8b5cf6', color: '#fff' }} onClick={() => setTestPiperVoice(pv)}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 4 }}><path d="M10 8l6 4-6 4V8z" /></svg>
                                    Probar
                                </button>
                            ) : (
                                <button className="btn btn-sm" style={{ background: '#8b5cf6', color: '#fff' }} onClick={() => downloadPiperVoice(pv)} disabled={downloading[pv.id]}>
                                    {downloading[pv.id] ? (
                                        <><span className="spinner" style={{ marginRight: 4 }}>⏳</span> Descargando...</>
                                    ) : (
                                        <>📥 Descargar</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {editVoice !== undefined && (
                <VoiceModal
                    voice={editVoice}
                    onClose={() => setEditVoice(undefined)}
                    onSaved={() => { setEditVoice(undefined); load() }}
                    addToast={addToast}
                />
            )}

            {testVoice !== undefined && (
                <TestVoiceModal
                    voice={testVoice}
                    onClose={() => setTestVoice(undefined)}
                    addToast={addToast}
                />
            )}

            {testPiperVoice !== undefined && (
                <TestPiperModal
                    voice={testPiperVoice}
                    onClose={() => setTestPiperVoice(undefined)}
                    addToast={addToast}
                />
            )}

            <Toast toasts={toasts} />
        </>
    )
}
