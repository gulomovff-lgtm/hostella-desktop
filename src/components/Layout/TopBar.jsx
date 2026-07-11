import React from 'react';
import { Wifi, WifiOff, Search, Minus, Square, X } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';

const TopBar = ({ isOnline, onOpenSearch, lang,
    selectedHostelFilter, hostels, availableHostels, setSelectedHostelFilter }) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] ?? k;
    const btnBase = { transition: 'all 0.15s', cursor: 'pointer' };
    
    const handleMinimize = () => window.electronAPI?.minimize();
    const handleMaximize = () => window.electronAPI?.maximize();
    const handleClose = () => window.electronAPI?.close();
    return (
        <div className="flex-shrink-0 hidden md:flex" style={{background:'var(--nav-bg)', WebkitAppRegion:'drag'}}>
            <div className="flex items-center h-14 pl-8 pr-2 gap-6 w-full">

                {/* Logo mark */}
                <div className="shrink-0 flex items-center gap-2" style={{WebkitAppRegion:'no-drag'}}>
                    <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0">
                        <img src="https://hostella.uz/logo.png" alt="H" className="w-full h-full object-cover"/>
                    </div>
                    <span className="text-sm font-black text-white tracking-tight">Hostella</span>
                </div>

                {/* Divider */}
                <div className="w-px h-7 shrink-0" style={{background:'rgba(255,255,255,0.18)'}}/>

                {/* Online icon */}
                <div className="shrink-0" style={{WebkitAppRegion:'no-drag'}} title={isOnline ? t('online') : t('offline')}>
                    {isOnline ? <Wifi size={17} style={{color:'#6ee7b7'}}/> : <WifiOff size={17} style={{color:'#fca5a5'}}/>}
                </div>

                {/* Search button */}
                <button onClick={onOpenSearch} title="Поиск (Ctrl+K)"
                    className="flex items-center gap-2.5 px-4 py-1.5 text-xs font-bold"
                    style={{...btnBase, transition:'all .18s cubic-bezier(.4,0,.2,1)', WebkitAppRegion:'no-drag',
                        background:'rgba(255,255,255,0.06)', color:'var(--nav-muted)',
                        border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, outline:'none'}}
                    onMouseOver={e=>{e.currentTarget.style.background='rgba(255,255,255,0.12)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.25)'; e.currentTarget.style.color='#fff';}}
                    onMouseOut={e=>{e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.12)'; e.currentTarget.style.color='var(--nav-muted)';}}>
                    <Search size={15}/>
                    <span>{t('search').replace('...','').trim()}</span>
                    <span style={{fontSize:10, fontWeight:700, marginLeft:4, padding:'1px 6px', borderRadius:5,
                        background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)',
                        color:'inherit', opacity:0.7, letterSpacing:'0.02em'}}>Ctrl+K</span>
                </button>

                {/* Hostel switcher — segmented control */}
                {availableHostels?.length > 0 && (
                    <div className="flex" style={{WebkitAppRegion:'no-drag', gap:3, padding:3, borderRadius:12,
                        background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)'}}>
                        {availableHostels.map(hid => (
                            <button key={hid} onClick={() => setSelectedHostelFilter(hid)}
                                className="px-4 py-1.5 text-xs font-bold"
                                style={selectedHostelFilter === hid
                                    ? {background:'#e88c40', color:'#fff', outline:'none', border:'none',
                                       borderRadius:9, cursor:'default', transition:'background .15s, color .15s'}
                                    : {...btnBase, transition:'background .15s, color .15s', background:'transparent',
                                       color:'var(--nav-muted)', outline:'none', border:'none', borderRadius:9}}
                                onMouseOver={e=>{ if(selectedHostelFilter!==hid){ e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#fff'; }}}
                                onMouseOut={e=>{ if(selectedHostelFilter!==hid){ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--nav-muted)'; }}}>
                                {hostels[hid]?.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* Drag spacer */}
                <div className="flex-1" style={{WebkitAppRegion:'drag'}}/>

                {/* Window controls */}
                <div className="flex items-center gap-1 shrink-0" style={{WebkitAppRegion:'no-drag'}}>
                    <button onClick={handleMinimize} className="p-2 transition-colors"
                        style={{background:'transparent', border:'none', borderRadius:8, color:'var(--nav-muted)', cursor:'pointer', outline:'none', transition:'all .15s'}}
                        onMouseOver={e=>{e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#fff';}}
                        onMouseOut={e=>{e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--nav-muted)';}}
                        title="Свернуть">
                        <Minus size={18}/>
                    </button>
                    <button onClick={handleMaximize} className="p-2 transition-colors"
                        style={{background:'transparent', border:'none', borderRadius:8, color:'var(--nav-muted)', cursor:'pointer', outline:'none', transition:'all .15s'}}
                        onMouseOver={e=>{e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#fff';}}
                        onMouseOut={e=>{e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--nav-muted)';}}
                        title="Развернуть">
                        <Square size={16}/>
                    </button>
                    <button onClick={handleClose} className="p-2 transition-colors"
                        style={{background:'transparent', border:'none', borderRadius:8, color:'var(--nav-muted)', cursor:'pointer', outline:'none', transition:'all .15s'}}
                        onMouseOver={e=>{e.currentTarget.style.background='#dc2626'; e.currentTarget.style.color='#fff';}}
                        onMouseOut={e=>{e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--nav-muted)';}}
                        title="Закрыть">
                        <X size={18}/>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TopBar;
