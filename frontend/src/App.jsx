import { useState, useEffect } from 'react'
import VoicesPage from './pages/VoicesPage.jsx'
import BooksPage from './pages/BooksPage.jsx'
import AudiobooksPage from './pages/AudiobooksPage.jsx'
import AdminPage from './pages/AdminPage.jsx'

const PAGES = [
    {
        id: 'voices', label: 'Voces',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>,
    },
    {
        id: 'books', label: 'Biblioteca',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>,
    },
    {
        id: 'audiobooks', label: 'Estudio',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>,
    },
    {
        id: 'admin', label: 'Ajustes',
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
    },
]

function Sidebar({ current, onChange, collapsed, mobileOpen, onClose, onToggle }) {
    return (
        <nav className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'open' : ''}`}>
            <div className="sidebar-logo">
                <button className="inner-toggle" onClick={onToggle} title={collapsed ? "Expandir" : "Colapsar"}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                </button>
                <span>VoxLibrix</span>
                {mobileOpen && (
                    <button className="close-mobile" onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                )}
            </div>
            {PAGES.map(p => (
                <button
                    key={p.id}
                    className={`nav-item ${current === p.id ? 'active' : ''}`}
                    onClick={() => {
                        onChange(p.id);
                        if (mobileOpen) onClose();
                    }}
                >
                    {p.icon}
                    <span>{p.label}</span>
                </button>
            ))}
        </nav>
    )
}

export default function App() {
    const [page, setPage] = useState('voices')
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [isMobileOpen, setIsMobileOpen] = useState(false)

    useEffect(() => {
        const theme = localStorage.getItem('vox-theme');
        if (theme) document.documentElement.setAttribute('data-theme', theme);
    }, [])

    return (
        <div className="app-layout">
            {!isMobileOpen && (
                <button className="sidebar-toggle" onClick={() => {
                    if (window.innerWidth <= 768) {
                        setIsMobileOpen(true);
                    } else {
                        setIsCollapsed(!isCollapsed);
                    }
                }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                </button>
            )}

            <Sidebar
                current={page}
                onChange={setPage}
                collapsed={isCollapsed}
                mobileOpen={isMobileOpen}
                onClose={() => setIsMobileOpen(false)}
                onToggle={() => setIsCollapsed(!isCollapsed)}
            />

            {isMobileOpen && <div className="modal-overlay" style={{ zIndex: 999 }} onClick={() => setIsMobileOpen(false)} />}

            <main className="main-content">
                {page === 'voices' && <VoicesPage />}
                {page === 'books' && <BooksPage />}
                {page === 'audiobooks' && <AudiobooksPage />}
                {page === 'admin' && <AdminPage />}
            </main>
        </div>
    )
}
