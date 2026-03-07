import { useState } from 'react'
import VoicesPage from './pages/VoicesPage.jsx'
import BooksPage from './pages/BooksPage.jsx'
import AudiobooksPage from './pages/AudiobooksPage.jsx'
import AuthorsPage from './pages/AuthorsPage.jsx'

const PAGES = [
    {
        id: 'voices', label: 'Voces',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>,
    },
    {
        id: 'authors', label: 'Escritores',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
    },
    {
        id: 'books', label: 'Biblioteca',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>,
    },
    {
        id: 'audiobooks', label: 'Estudio',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>,
    },
]

function Sidebar({ current, onChange }) {
    return (
        <nav className="sidebar">
            <div className="sidebar-logo">
                <div className="logo-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>
                </div>
                <span>VoxLibrix</span>
            </div>
            {PAGES.map(p => (
                <button
                    key={p.id}
                    className={`nav-item ${current === p.id ? 'active' : ''}`}
                    onClick={() => onChange(p.id)}
                >
                    {p.icon}
                    {p.label}
                </button>
            ))}
        </nav>
    )
}

export default function App() {
    const [page, setPage] = useState('voices')

    return (
        <div className="app-layout">
            <Sidebar current={page} onChange={setPage} />
            <main className="main-content">
                {page === 'voices' && <VoicesPage />}
                {page === 'authors' && <AuthorsPage />}
                {page === 'books' && <BooksPage />}
                {page === 'audiobooks' && <AudiobooksPage />}
            </main>
        </div>
    )
}
