import { useState, useEffect } from 'react'
import { api } from '../api.js'

export default function TagEditor({ type, entityId, currentTags, addToast, onTagsUpdated }) {
    const [allTags, setAllTags] = useState([])
    const [loading, setLoading] = useState(false)
    const [showAdd, setShowAdd] = useState(false)
    const [newName, setNewName] = useState('')
    const [newColor, setNewColor] = useState('#808080')

    async function loadTags() {
        try {
            const tags = await api.tags.list()
            setAllTags(tags)
        } catch (e) { }
    }

    useEffect(() => {
        loadTags()
    }, [])

    async function toggleTag(tag) {
        setLoading(true)
        try {
            const isSelected = currentTags.some(t => t.id === tag.id)
            if (isSelected) {
                if (type === 'book') await api.tags.unlinkFromBook(entityId, tag.id)
                else await api.tags.unlinkFromAudiobook(entityId, tag.id)
            } else {
                if (type === 'book') await api.tags.linkToBook(entityId, tag.id)
                else await api.tags.linkToAudiobook(entityId, tag.id)
            }
            onTagsUpdated()
        } catch (e) {
            addToast(e.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    async function createAndLink() {
        if (!newName.trim()) return
        setLoading(true)
        try {
            // 1. Crear la etiqueta
            const tag = await api.tags.create({ name: newName.trim(), color: newColor })
            // 2. Vincularla
            if (type === 'book') await api.tags.linkToBook(entityId, tag.id)
            else await api.tags.linkToAudiobook(entityId, tag.id)

            setNewName('')
            setShowAdd(false)
            loadTags()
            onTagsUpdated()
        } catch (e) {
            addToast(e.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="form-group">
            <label className="form-label">Etiquetas</label>
            <div className="tag-selector">
                {allTags.map(tag => {
                    const isSelected = currentTags.some(t => t.id === tag.id)
                    return (
                        <div
                            key={tag.id}
                            className={`tag-option ${isSelected ? 'selected' : ''}`}
                            style={{
                                color: isSelected ? '#fff' : tag.color,
                                borderColor: tag.color,
                                backgroundColor: isSelected ? tag.color : 'transparent'
                            }}
                            onClick={() => !loading && toggleTag(tag)}
                            title={isSelected ? 'Clic para quitar' : 'Clic para asignar'}
                        >
                            {tag.name}
                        </div>
                    )
                })}

                {!showAdd ? (
                    <button
                        className="tag-add-btn"
                        onClick={() => setShowAdd(true)}
                        title="Crear nueva etiqueta"
                    >
                        +
                    </button>
                ) : (
                    <div className="tag-inline-form">
                        <input
                            autoFocus
                            className="tag-inline-input"
                            placeholder="Nueva..."
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && createAndLink()}
                        />
                        <input
                            type="color"
                            className="tag-inline-color"
                            value={newColor}
                            onChange={e => setNewColor(e.target.value)}
                        />
                        <button className="btn-icon" onClick={createAndLink}>✓</button>
                        <button className="btn-icon" onClick={() => setShowAdd(false)}>✕</button>
                    </div>
                )}
            </div>
        </div>
    )
}
