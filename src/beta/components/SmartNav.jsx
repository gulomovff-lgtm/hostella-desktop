import React from 'react';
import ReactDOM from 'react-dom';
import {
    Home, BedDouble, Users, Wallet, Settings, ChevronDown, ChevronRight,
    UserPlus, Power, Lock, LogOut, PanelLeftClose, Sun, Moon,
} from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';

// ─── 5 разделов вместо плоского списка из 24 пунктов ─────────────────────────
// Права на подпункты повторяют логику filterItem из Navigation.jsx.
const SECTIONS = [
    {
        id: 'sec-today', label: 'Сегодня', icon: Home,
        items: [
            { id: 'today',     label: 'Обзор дня' },
            { id: 'tasks',     label: 'Задачи', permKey: 'viewTasks', badge: 'tasks' },
            { id: 'dashboard', label: 'Статистика', adminOnly: true, permKey: 'viewStats' },
        ],
    },
    {
        id: 'sec-stay', label: 'Проживание', icon: BedDouble,
        items: [
            { id: 'rooms',    label: 'Комнаты' },
            { id: 'calendar', label: 'Календарь' },
            { id: 'bookings', label: 'Брони', permKey: 'viewBookings', badge: 'bookings' },
            { id: 'cadastre', label: 'Кадастр', permKey: 'viewCadastre' },
        ],
    },
    {
        id: 'sec-guests', label: 'Гости', icon: Users,
        items: [
            { id: 'clients',       label: 'Клиенты', permKey: 'viewClients' },
            { id: 'debts',         label: 'Долги', permKey: 'viewDebts' },
            { id: 'registrations', label: 'E-mehmon', permKey: 'viewRegistrations', badge: 'registrations' },
            { id: 'guesthistory',  label: 'История гостей', adminOnly: true },
            { id: 'manualstay',    label: 'Ручной учёт', permKey: 'viewManualStay' },
            { id: 'referrals',     label: 'Бонусы', permKey: 'viewReferrals' },
        ],
    },
    {
        id: 'sec-money', label: 'Деньги', icon: Wallet,
        items: [
            { id: 'expenses',  label: 'Расходы', adminOnly: true, permKey: 'viewExpenses' },
            { id: 'reports',   label: 'Отчёты', adminOnly: true, permKey: 'viewReports' },
            { id: 'analytics', label: 'Аналитика', adminOnly: true },
        ],
    },
    {
        id: 'sec-mgmt', label: 'Управление', icon: Settings,
        items: [
            { id: 'staff',        label: 'Персонал', adminOnly: true },
            { id: 'pricePerms',   label: 'Понижение цены', adminOnly: true },
            { id: 'shifts',       label: 'Смены', adminOnly: true },
            { id: 'telegram',     label: 'Telegram', adminOnly: true },
            { id: 'promos',       label: 'Промокоды', adminOnly: true },
            { id: 'hostelconfig', label: 'Настройки хостела', adminOnly: true },
            { id: 'versions',     label: 'Версии клиентов', adminOnly: true },
            { id: 'auditlog',     label: 'Аудит', superOnly: true },
            { id: 'sessions',     label: 'Сессии', superOnly: true },
        ],
    },
];

const SmartNav = ({
    currentUser, activeTab, setActiveTab, lang,
    pendingTasksCount = 0, pendingBookingsCount = 0, registrationsAlertCount = 0,
    canPerformActions,
    onOpenExpense, onOpenCheckIn, onOpenShift,
    onLogout, setLang, onOpenChangePassword,
    appTheme = 'green', setAppTheme,
    onSwitchToClassic,
    switchLabel = 'Классический вид',
}) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] ?? k;
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';
    const isSuper = currentUser.role === 'super';
    const canCheckin = currentUser.role !== 'admin' && currentUser.role !== 'super';

    const [openSec, setOpenSec] = React.useState(null); // null = авто (раздел с активной вкладкой)
    const [profileOpen, setProfileOpen] = React.useState(false);
    const [profilePos, setProfilePos] = React.useState({});
    const profileBtnRef = React.useRef(null);
    const profileRef = React.useRef(null);

    React.useEffect(() => {
        const handler = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target) &&
                profileBtnRef.current && !profileBtnRef.current.contains(e.target)) setProfileOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

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

    const badgeValue = (b) =>
        b === 'tasks' ? pendingTasksCount :
        b === 'bookings' ? pendingBookingsCount :
        b === 'registrations' ? registrationsAlertCount : 0;

    const sections = SECTIONS
        .map(s => ({ ...s, visItems: s.items.filter(filterItem) }))
        .filter(s => s.visItems.length > 0);

    const activeSection = sections.find(s => s.visItems.some(i => i.id === activeTab))?.id ?? null;
    const isOpen = (sid) => (openSec === null ? sid === activeSection : sid === openSec);

    // Если вкладка сменилась извне (клик по KPI и т.п.) — раскрываем её раздел
    React.useEffect(() => {
        if (openSec !== null && activeSection && openSec !== activeSection) setOpenSec(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    const handleSection = (s) => {
        setOpenSec(s.id);
        if (!s.visItems.some(i => i.id === activeTab)) setActiveTab(s.visItems[0].id);
    };

    const handleProfileToggle = () => {
        if (!profileOpen && profileBtnRef.current) {
            const r = profileBtnRef.current.getBoundingClientRect();
            setProfilePos({ bottom: window.innerHeight - r.bottom, left: r.right + 8 });
        }
        setProfileOpen(o => !o);
    };

    const roleLabel = isSuper ? t('superAdmin') : isAdmin ? t('admin') : t('cashier');

    return (
        <div className="hidden md:flex shrink-0 flex-col"
            style={{ width: 224, background: 'var(--nav-bg)', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
            <style>{`
                .snav-btn{transition:all .15s; cursor:pointer; border:none; outline:none}
                .snav-btn:focus{outline:none}
            `}</style>

            {/* Разделы */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: '10px 8px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
                {sections.map(s => {
                    const Icon = s.icon;
                    const open = isOpen(s.id);
                    const hasActive = s.visItems.some(i => i.id === activeTab);
                    const secBadge = s.visItems.reduce((sum, i) => sum + (i.badge ? badgeValue(i.badge) : 0), 0);
                    return (
                        <div key={s.id} style={{ marginBottom: 3 }}>
                            <button onClick={() => handleSection(s)}
                                className="snav-btn"
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '9px 12px', borderRadius: 11,
                                    background: hasActive && !open ? 'rgba(232,140,64,0.1)' : 'transparent',
                                    color: hasActive ? '#f5b574' : 'var(--nav-muted)',
                                }}
                                onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                                onMouseOut={e => { e.currentTarget.style.background = hasActive && !open ? 'rgba(232,140,64,0.1)' : 'transparent'; }}
                            >
                                <Icon size={17} strokeWidth={hasActive ? 2.5 : 2} style={{ flexShrink: 0 }}/>
                                <span style={{ fontSize: 13, fontWeight: 800, flex: 1, textAlign: 'left' }}>{s.label}</span>
                                {!open && secBadge > 0 && (
                                    <span style={{ background: '#e88c40', color: '#fff', fontSize: 10, fontWeight: 900, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{secBadge}</span>
                                )}
                                {open ? <ChevronDown size={13} style={{ opacity: 0.45, flexShrink: 0 }}/> : <ChevronRight size={13} style={{ opacity: 0.45, flexShrink: 0 }}/>}
                            </button>
                            {open && (
                                <div style={{ borderLeft: '2px solid rgba(232,140,64,0.22)', marginLeft: 19, marginTop: 1, marginBottom: 4 }}>
                                    {s.visItems.map(item => {
                                        const act = activeTab === item.id;
                                        const bv = item.badge ? badgeValue(item.badge) : 0;
                                        return (
                                            <button key={item.id} onClick={() => setActiveTab(item.id)}
                                                className="snav-btn"
                                                style={{
                                                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                                                    padding: '6px 10px', borderRadius: 8,
                                                    background: act ? 'rgba(232,140,64,0.13)' : 'transparent',
                                                    color: act ? '#f5b574' : 'var(--nav-muted)',
                                                    fontSize: 12.5, fontWeight: act ? 800 : 600, textAlign: 'left',
                                                }}
                                                onMouseOver={e => { if (!act) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#c8d8da'; } }}
                                                onMouseOut={e => { if (!act) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--nav-muted)'; } }}
                                            >
                                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                                                {bv > 0 && (
                                                    <span style={{ background: '#e88c40', color: '#fff', fontSize: 9, fontWeight: 900, minWidth: 16, padding: '1px 4px', borderRadius: 9, textAlign: 'center', flexShrink: 0 }}>{bv}</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Быстрые действия */}
            {canPerformActions && (
                <div style={{ display: 'flex', gap: 5, padding: '8px', borderTop: '1px solid rgba(255,255,255,0.09)' }}>
                    {canCheckin && (
                        <button onClick={onOpenCheckIn} className="snav-btn"
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '7px 3px 6px', borderRadius: 12, background: 'rgba(20,184,166,0.18)', color: '#5eead4', border: '1.5px solid rgba(20,184,166,0.3)' }}
                            onMouseOver={e => { e.currentTarget.style.background = 'linear-gradient(160deg,#0f9688,#0d7a6e)'; e.currentTarget.style.color = '#fff'; }}
                            onMouseOut={e => { e.currentTarget.style.background = 'rgba(20,184,166,0.18)'; e.currentTarget.style.color = '#5eead4'; }}>
                            <UserPlus size={16} strokeWidth={2.5}/><span style={{ fontSize: 9, fontWeight: 800 }}>{t('checkin')}</span>
                        </button>
                    )}
                    <button onClick={onOpenExpense} className="snav-btn"
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '7px 3px 6px', borderRadius: 12, background: 'rgba(234,179,8,0.14)', color: '#fde047', border: '1px solid rgba(234,179,8,0.22)' }}
                        onMouseOver={e => { e.currentTarget.style.background = 'rgba(234,179,8,0.32)'; e.currentTarget.style.color = '#fff'; }}
                        onMouseOut={e => { e.currentTarget.style.background = 'rgba(234,179,8,0.14)'; e.currentTarget.style.color = '#fde047'; }}>
                        <Wallet size={15} strokeWidth={2.5}/><span style={{ fontSize: 9, fontWeight: 800 }}>{t('expense')}</span>
                    </button>
                    {canCheckin && (
                        <button onClick={onOpenShift} className="snav-btn"
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '7px 3px 6px', borderRadius: 12, background: 'rgba(239,68,68,0.14)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.22)' }}
                            onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.32)'; e.currentTarget.style.color = '#fff'; }}
                            onMouseOut={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.14)'; e.currentTarget.style.color = '#fca5a5'; }}>
                            <Power size={15} strokeWidth={2.5}/><span style={{ fontSize: 9, fontWeight: 800 }}>{t('shift')}</span>
                        </button>
                    )}
                </div>
            )}

            {/* Профиль */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.09)' }}>
                <button ref={profileBtnRef} onClick={handleProfileToggle} className="snav-btn"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: profileOpen ? 'rgba(255,255,255,0.1)' : 'transparent' }}
                    onMouseOver={e => { if (!profileOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                    onMouseOut={e => { if (!profileOpen) e.currentTarget.style.background = 'transparent'; }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#e88c40', color: '#fff', fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {(currentUser.name || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#c8d8da', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(currentUser.name || '?').split(' ')[0]}</div>
                        <div style={{ fontSize: 10, color: 'var(--nav-muted)' }}>{roleLabel}</div>
                    </div>
                </button>

                {profileOpen && ReactDOM.createPortal(
                    <div ref={profileRef} style={{
                        position: 'fixed', bottom: profilePos.bottom, left: profilePos.left,
                        width: 240, background: 'var(--nav-popup)', border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 14, boxShadow: '0 8px 40px rgba(0,0,0,0.45)', zIndex: 180, overflow: 'hidden',
                    }}>
                        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                            <div className="text-sm font-black text-white">{currentUser.name}</div>
                            <div className="text-xs mt-0.5" style={{ color: 'var(--nav-muted)' }}>{roleLabel}</div>
                        </div>
                        <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                            <div className="text-[11px] font-bold uppercase mb-2" style={{ color: 'var(--nav-muted)' }}>{t('language')}</div>
                            <div className="flex gap-2">
                                {['ru', 'uz'].map(l => (
                                    <button key={l} onClick={() => setLang(l)}
                                        className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all snav-btn"
                                        style={lang === l ? { background: '#e88c40', color: '#fff' } : { background: 'rgba(255,255,255,0.08)', color: 'var(--nav-muted)' }}>
                                        {l.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {setAppTheme && (
                            <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                                <div className="text-[11px] font-bold uppercase mb-2" style={{ color: 'var(--nav-muted)' }}>Тема</div>
                                <div className="flex gap-2">
                                    {[{ id: 'green', Icon: Sun, label: 'Светлая' }, { id: 'dark', Icon: Moon, label: 'Тёмная' }].map(th => (
                                        <button key={th.id} onClick={() => setAppTheme(th.id)}
                                            className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 snav-btn"
                                            style={appTheme === th.id ? { background: '#e88c40', color: '#fff' } : { background: 'rgba(255,255,255,0.08)', color: 'var(--nav-muted)' }}>
                                            <th.Icon size={13} /><span>{th.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <button onClick={() => { setProfileOpen(false); onSwitchToClassic?.(); }}
                            className="w-full flex items-center gap-3 px-5 py-3 text-sm text-left snav-btn"
                            style={{ color: '#a5b4fc', background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
                            onMouseOver={e => { e.currentTarget.style.background = 'rgba(165,180,252,0.1)'; }}
                            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}>
                            <PanelLeftClose size={15}/> {switchLabel}
                        </button>
                        {onOpenChangePassword && (
                            <button onClick={() => { setProfileOpen(false); onOpenChangePassword(); }}
                                className="w-full flex items-center gap-3 px-5 py-3 text-sm text-left snav-btn"
                                style={{ color: '#c9e8ea', background: 'transparent' }}
                                onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                                onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}>
                                <Lock size={15}/> {t('changePassword')}
                            </button>
                        )}
                        <button onClick={() => { setProfileOpen(false); onLogout(); }}
                            className="w-full flex items-center gap-3 px-5 py-3 text-sm text-left border-t snav-btn"
                            style={{ color: '#fca5a5', background: 'transparent', borderColor: 'rgba(255,255,255,0.08)' }}
                            onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
                            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}>
                            <LogOut size={15}/> {t('logout')}
                        </button>
                    </div>,
                    document.body,
                )}
            </div>
        </div>
    );
};

export default SmartNav;
