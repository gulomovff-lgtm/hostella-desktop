import React from 'react';
import ReactDOM from 'react-dom';
import {
    LayoutDashboard, BedDouble, Calendar, FileText, AlertCircle,
    CheckSquare, Wallet, Users, UserCog, Clock, Lock, LogOut,
    UserPlus, Power, Globe, BellRing, Tag, ClipboardList,
    Settings, Users2, Building2, ChevronDown, ChevronRight,
    BarChart2, TrendingDown,
} from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';

// в”Ђв”Ђв”Ђ Menu groups в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const NAV_GROUPS = (t, pendingBookingsCount, pendingTasksCount) => [
    {
        id: 'main', label: null, alwaysOpen: true,
        items: [
            { id: 'dashboard', icon: LayoutDashboard, label: t('dashboard'), adminOnly: true, permKey: 'viewStats' },
            { id: 'rooms',     icon: BedDouble,        label: t('rooms') },
            { id: 'calendar',  icon: Calendar,          label: t('calendar') },
        ],
    },
    {
        id: 'ops', label: 'РћРїРµСЂР°С†РёРё', icon: Globe,
        items: [
            { id: 'bookings', icon: Globe,       label: 'Р‘СЂРѕРЅРё',      badge: pendingBookingsCount, glow: (pendingBookingsCount || 0) > 0, permKey: 'viewBookings' },
            { id: 'debts',    icon: AlertCircle, label: t('debts'),   permKey: 'viewDebts' },
            { id: 'tasks',    icon: CheckSquare, label: t('tasks'),   badge: pendingTasksCount },
            { id: 'clients',  icon: Users,       label: t('clients'), permKey: 'viewClients' },
        ],
    },
    {
        id: 'finance', label: 'Р¤РёРЅР°РЅСЃС‹', icon: BarChart2,
        items: [
            { id: 'reports',  icon: FileText,    label: t('reports'),  adminOnly: true, permKey: 'viewReports'  },
            { id: 'expenses', icon: TrendingDown, label: t('expenses'), adminOnly: true, permKey: 'viewExpenses' },
        ],
    },
    {
        id: 'staff', label: 'РџРµСЂСЃРѕРЅР°Р»', icon: Users2,
        items: [
            { id: 'staff',  icon: UserCog, label: t('staff'),  adminOnly: true },
            { id: 'shifts', icon: Clock,   label: t('shifts'), adminOnly: true },
        ],
    },
    {
        id: 'settings', label: 'РџСЂРѕС‡РµРµ', icon: Settings,
        items: [
            { id: 'telegram',    icon: BellRing,     label: 'Telegram',   adminOnly: true },
            { id: 'promos',      icon: Tag,           label: 'РџСЂРѕРјРѕРєРѕРґС‹', adminOnly: true },
            { id: 'hostelconfig',icon: Settings,      label: 'РќР°СЃС‚СЂРѕР№РєРё', adminOnly: true },
            { id: 'auditlog',    icon: ClipboardList, label: 'РСЃС‚РѕСЂРёСЏ',   superOnly: true },
        ],
    },
];

// в”Ђв”Ђв”Ђ Sub-components в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const ActionBtn = ({ onClick, color, text, Icon }) => (
    <button onClick={onClick}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
        style={{ background: `${color}22`, color, border: `1px solid ${color}44`, outline: 'none', cursor: 'pointer' }}
        onMouseOver={e => { e.currentTarget.style.background = `${color}44`; e.currentTarget.style.color = '#fff'; }}
        onMouseOut={e  => { e.currentTarget.style.background = `${color}22`; e.currentTarget.style.color = color; }}
    >
        <Icon size={15} /><span style={{ fontSize: 11.5, fontWeight: 700 }}>{text}</span>
    </button>
);

const ProfileMenuItem = ({ Icon, label, color, danger, onClick }) => (
    <button onClick={onClick}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left"
        style={{ color, background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer',
            borderTop: danger ? '1px solid rgba(255,255,255,0.08)' : 'none', transition: 'background 0.15s' }}
        onMouseOver={e => { e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)'; }}
        onMouseOut={e  => { e.currentTarget.style.background = 'transparent'; }}
    >
        <Icon size={15} />{label}
    </button>
);

// в”Ђв”Ђв”Ђ Component в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const Navigation = ({
    currentUser, activeTab, setActiveTab, pendingTasksCount, pendingBookingsCount, lang,
    canPerformActions, onOpenExpense, onOpenCheckIn, onOpenShift,
    onOpenGroupCheckIn, onOpenRoomRental,
    onLogout, setLang, onOpenChangePassword,
}) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] ?? k;
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';
    const isSuper = currentUser.role === 'super';

    const allGroups    = NAV_GROUPS(t, pendingBookingsCount, pendingTasksCount);
    const activeGroupId = allGroups.find(g => g.items.some(i => i.id === activeTab))?.id ?? 'main';

    const [openGroups, setOpenGroups] = React.useState(() => {
        const s = { main: true };
        if (activeGroupId) s[activeGroupId] = true;
        return s;
    });

    const [profileOpen, setProfileOpen] = React.useState(false);
    const [profilePos,  setProfilePos]  = React.useState({ top: 0 });
    const profileBtnRef = React.useRef(null);
    const profileRef    = React.useRef(null);

    React.useEffect(() => {
        if (activeGroupId) setOpenGroups(s => ({ ...s, [activeGroupId]: true }));
    }, [activeGroupId]);

    React.useEffect(() => {
        const h = (e) => {
            if (profileRef.current    && !profileRef.current.contains(e.target) &&
                profileBtnRef.current && !profileBtnRef.current.contains(e.target))
                setProfileOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const handleProfileToggle = () => {
        if (!profileOpen && profileBtnRef.current) {
            const rect = profileBtnRef.current.getBoundingClientRect();
            const menuH = 260;
            const top   = window.innerHeight - rect.bottom < menuH
                ? rect.top - menuH + rect.height
                : rect.top;
            setProfilePos({ top: Math.max(8, top) });
        }
        setProfileOpen(o => !o);
    };

    const toggleGroup = (id) => setOpenGroups(s => ({ ...s, [id]: !s[id] }));

    const filterItem = (item) => {
        if (item.superOnly) return isSuper;
        if (item.adminOnly) {
            if (isAdmin) {
                if (item.permKey) return currentUser.permissions?.[item.permKey] !== false;
                return true;
            }
            if (item.permKey) return currentUser.permissions?.[item.permKey] === true;
            return false;
        }
        if (item.permKey) return currentUser.permissions?.[item.permKey] !== false;
        return true;
    };

    const visibleGroups = allGroups
        .map(g => ({ ...g, items: g.items.filter(filterItem) }))
        .filter(g => g.items.length > 0);

    const roleLabel  = isSuper ? t('superAdmin') : isAdmin ? t('admin') : t('cashier');
    const canCheckin = currentUser.role !== 'admin' && currentUser.role !== 'super';

    const BG     = '#1a3c40';
    const DIV    = 'rgba(255,255,255,0.08)';
    const MUTE   = '#7fb8bc';
    const ACCENT = '#e88c40';

    return (
        <div className="hidden md:flex flex-col shrink-0 overflow-hidden"
             style={{ width: 200, background: BG, borderRight: `1px solid ${DIV}` }}>

            {/* Logo */}
            <div className="flex items-center gap-2.5 px-4 py-4"
                 style={{ borderBottom: `1px solid ${DIV}` }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-base shrink-0"
                     style={{ background: ACCENT, color: '#fff' }}>H</div>
                <span className="font-black text-white text-sm tracking-tight">Hostella</span>
            </div>

            {/* Nav */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden py-1.5" style={{ scrollbarWidth: 'none' }}>
                {visibleGroups.map((group) => {
                    const isOpen   = group.alwaysOpen ? true : !!openGroups[group.id];
                    const GI       = group.icon;
                    const hasActive = group.items.some(i => i.id === activeTab);
                    const totalBadge = group.items.reduce((s, i) => s + (i.badge ?? 0), 0);

                    return (
                        <div key={group.id}>
                            {/* Group header (collapsible) */}
                            {!group.alwaysOpen && (
                                <button onClick={() => toggleGroup(group.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-left transition-all"
                                    style={{
                                        background: isOpen ? 'rgba(255,255,255,0.05)' : 'transparent',
                                        color: hasActive ? ACCENT : MUTE,
                                        border: 'none', outline: 'none', cursor: 'pointer',
                                    }}
                                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#fff'; }}
                                    onMouseOut={e  => { e.currentTarget.style.background = isOpen ? 'rgba(255,255,255,0.05)' : 'transparent'; e.currentTarget.style.color = hasActive ? ACCENT : MUTE; }}
                                >
                                    {GI && <GI size={13} strokeWidth={2} />}
                                    <span style={{ fontSize: 10.5, fontWeight: 700, flex: 1, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                        {group.label}
                                    </span>
                                    {!isOpen && totalBadge > 0 && (
                                        <span style={{ background: ACCENT, color: '#fff', fontSize: 9, fontWeight: 900, borderRadius: 999, padding: '0 4px', minWidth: 14, textAlign: 'center' }}>
                                            {totalBadge}
                                        </span>
                                    )}
                                    {isOpen
                                        ? <ChevronDown size={12} style={{ opacity: 0.5 }} />
                                        : <ChevronRight size={12} style={{ opacity: 0.4 }} />
                                    }
                                </button>
                            )}

                            {/* Items */}
                            {isOpen && group.items.map(item => {
                                const Icon = item.icon;
                                const act  = activeTab === item.id;
                                return (
                                    <button key={item.id}
                                        onClick={() => setActiveTab(item.id)}
                                        className="w-full flex items-center gap-2.5 text-left relative transition-all"
                                        style={{
                                            padding: '8px 12px 8px 14px',
                                            background:  act ? 'rgba(232,140,64,0.16)' : 'transparent',
                                            color:       act ? ACCENT : '#aecdd0',
                                            borderLeft:  act ? `3px solid ${ACCENT}` : '3px solid transparent',
                                            border:      'none', outline: 'none', cursor: 'pointer',
                                        }}
                                        onMouseOver={e => { if (!act) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#fff'; } }}
                                        onMouseOut={e  => { if (!act) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#aecdd0'; } }}
                                    >
                                        <Icon size={15} strokeWidth={act ? 2.5 : 1.8} />
                                        <span style={{ fontSize: 12.5, fontWeight: act ? 700 : 500, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {item.label}
                                        </span>
                                        {(item.badge ?? 0) > 0 && (
                                            <span style={{
                                                background: item.glow ? ACCENT : 'rgba(232,140,64,0.55)',
                                                color: '#fff', fontSize: 9, fontWeight: 900,
                                                borderRadius: 999, padding: '1px 5px', minWidth: 16, textAlign: 'center',
                                            }}>
                                                {item.badge}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            {/* Action buttons */}
            {canPerformActions && (
                <div className="px-2 py-2 flex flex-col gap-1" style={{ borderTop: `1px solid ${DIV}` }}>
                    <ActionBtn onClick={onOpenExpense}      color="#e88c40" text={t('expense')}  Icon={Wallet}    />
                    {canCheckin && (<>
                        <ActionBtn onClick={onOpenCheckIn}      color="#5eead4" text={t('checkin')} Icon={UserPlus}  />
                        <ActionBtn onClick={onOpenGroupCheckIn} color="#818cf8" text="Р“СЂСѓРїРїР°"       Icon={Users2}    />
                        <ActionBtn onClick={onOpenRoomRental}   color="#34d399" text="РђСЂРµРЅРґР°"       Icon={Building2} />
                        <ActionBtn onClick={onOpenShift}        color="#f87171" text={t('shift')}   Icon={Power}     />
                    </>)}
                </div>
            )}

            {/* Profile */}
            <div style={{ borderTop: `1px solid ${DIV}` }}>
                <button ref={profileBtnRef} onClick={handleProfileToggle}
                    className="w-full flex items-center gap-2 px-3 py-3 transition-all"
                    style={{ background: profileOpen ? 'rgba(255,255,255,0.09)' : 'transparent', border: 'none', outline: 'none', cursor: 'pointer' }}
                    onMouseOver={e => { if (!profileOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                    onMouseOut={e  => { if (!profileOpen) e.currentTarget.style.background = 'transparent'; }}
                >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                         style={{ background: ACCENT, color: '#fff' }}>
                        {(currentUser.name || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2eff0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {currentUser.name.split(' ')[0]}
                        </div>
                        <div style={{ fontSize: 10, color: MUTE }}>{roleLabel}</div>
                    </div>
                    <ChevronDown size={12} style={{ color: MUTE, transform: profileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                </button>

                {profileOpen && ReactDOM.createPortal(
                    <div ref={profileRef} style={{
                        position: 'fixed', left: 208, top: profilePos.top, width: 220,
                        background: '#1e4a4f', border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 14, boxShadow: '0 8px 40px rgba(0,0,0,0.45)', zIndex: 99999, overflow: 'hidden',
                    }}>
                        <div className="px-4 py-3 border-b" style={{ borderColor: DIV }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{currentUser.name}</div>
                            <div style={{ fontSize: 11, color: MUTE, marginTop: 1 }}>{roleLabel}</div>
                        </div>
                        <div className="px-4 py-3 border-b" style={{ borderColor: DIV }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: MUTE, textTransform: 'uppercase', marginBottom: 8 }}>{t('language')}</div>
                            <div className="flex gap-2">
                                {['ru', 'uz'].map(l => (
                                    <button key={l} onClick={() => setLang(l)}
                                        className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                                        style={lang === l
                                            ? { background: ACCENT, color: '#fff', border: 'none', cursor: 'pointer' }
                                            : { background: 'rgba(255,255,255,0.08)', color: MUTE, border: 'none', cursor: 'pointer' }}>
                                        {l.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <ProfileMenuItem Icon={Lock}   label={t('changePassword')} color="#c9e8ea"
                            onClick={() => { setProfileOpen(false); onOpenChangePassword(); }} />
                        <ProfileMenuItem Icon={LogOut} label={t('logout')}         color="#fca5a5" danger
                            onClick={() => { setProfileOpen(false); onLogout(); }} />
                    </div>,
                    document.body,
                )}
            </div>
        </div>
    );
};

export default Navigation;
