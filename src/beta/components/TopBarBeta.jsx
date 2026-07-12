import React from 'react';
import { Wifi, WifiOff, Search, Sun, Moon } from 'lucide-react';

const TopBarBeta = ({
    isOnline, currentUser, hostels, availableHostels = [],
    hostelFilter, setHostelFilter, theme, setTheme, onOpenSearch,
}) => (
    <div className="flex-shrink-0 flex items-center h-14 px-4 gap-4"
        style={{ background: 'var(--nav-bg)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>

        <div className="shrink-0 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0">
                <img src="https://hostella.uz/logo.png" alt="H" className="w-full h-full object-cover" />
            </div>
            <span className="text-sm font-black text-white tracking-tight">Hostella</span>
            <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(232,140,64,0.2)', color: '#f5b574', border: '1px solid rgba(232,140,64,0.4)' }}>
                Beta
            </span>
        </div>

        <div className="w-px h-7 shrink-0" style={{ background: 'rgba(255,255,255,0.18)' }} />

        <div className="shrink-0" title={isOnline ? 'Онлайн' : 'Оффлайн'}>
            {isOnline ? <Wifi size={16} style={{ color: '#6ee7b7' }} /> : <WifiOff size={16} style={{ color: '#fca5a5' }} />}
        </div>

        <button onClick={onOpenSearch} title="Умная строка (Ctrl+K)"
            className="flex items-center gap-2.5 px-4 py-1.5 text-xs font-bold rounded-xl transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--nav-muted)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', outline: 'none' }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--nav-muted)'; }}>
            <Search size={14} />
            <span className="hidden sm:inline">Гость, сумма или действие…</span>
            <span className="hidden md:inline px-1.5 py-0.5 rounded text-[10px]"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', opacity: 0.7 }}>
                Ctrl+K
            </span>
        </button>

        {availableHostels.length > 1 && (
            <div className="flex gap-0.5 p-0.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                {availableHostels.map(hid => (
                    <button key={hid} onClick={() => setHostelFilter(hid)}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all"
                        style={hostelFilter === hid
                            ? { background: '#e88c40', color: '#fff', border: 'none', cursor: 'default' }
                            : { background: 'transparent', color: 'var(--nav-muted)', border: 'none', cursor: 'pointer' }}>
                        {hid === 'all' ? 'Все' : (hostels[hid]?.name || hid)}
                    </button>
                ))}
            </div>
        )}

        <div className="flex-1" />

        <button onClick={() => setTheme(theme === 'dark' ? 'green' : 'dark')} title="Переключить тему"
            className="p-2 rounded-lg transition-all"
            style={{ background: 'transparent', color: 'var(--nav-muted)', border: 'none', cursor: 'pointer' }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--nav-muted)'; }}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div className="text-xs font-bold shrink-0" style={{ color: 'var(--nav-muted)' }}>
            {(currentUser?.name || '').split(' ')[0]}
        </div>
    </div>
);

export default TopBarBeta;
