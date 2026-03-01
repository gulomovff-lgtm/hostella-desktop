import React from 'react';
import ReactDOM from 'react-dom';
import {
    LayoutDashboard, BedDouble, Calendar, FileText, AlertCircle,
    CheckSquare, Wallet, Users, UserCog, Clock, Lock, LogOut,
    UserPlus, Power, Globe, BellRing, Tag, ClipboardList,
    Settings, Users2, Building2, ClipboardCheck, BarChart3,
} from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';

// ─── Menu groups definition ───────────────────────────────────────────────────
const NAV_GROUPS = (t, pendingBookingsCount, pendingTasksCount, registrationsAlertCount, isAdmin) => {
    if (isAdmin) {
        return [
            {
                id: 'main', label: null,
                items: [
                    { id: 'dashboard', icon: LayoutDashboard, label: t('dashboard'), adminOnly: true, permKey: 'viewStats' },
                    { id: 'rooms',     icon: BedDouble,        label: t('rooms') },
                    { id: 'calendar',  icon: Calendar,          label: t('calendar') },
                ],
            },
            {
                id: 'ops', label: 'ОПЕРАЦИИ',
                items: [
                    { id: 'bookings',      icon: Globe,          label: 'Брони',     badge: pendingBookingsCount, glow: (pendingBookingsCount || 0) > 0, permKey: 'viewBookings' },
                    { id: 'registrations', icon: ClipboardCheck, label: 'E-mehmon',  badge: registrationsAlertCount, glow: (registrationsAlertCount || 0) > 0 },
                    { id: 'debts',         icon: AlertCircle,    label: t('debts'),  permKey: 'viewDebts' },
                    { id: 'tasks',         icon: CheckSquare,    label: t('tasks'),  badge: pendingTasksCount },
                    { id: 'clients',       icon: Users,          label: t('clients'), permKey: 'viewClients' },
                ],
            },
            {
                id: 'finance', label: 'ФИНАНСЫ',
                items: [
                    { id: 'reports',   icon: FileText,  label: t('reports'),  adminOnly: true, permKey: 'viewReports'  },
                    { id: 'expenses',  icon: Wallet,    label: t('expenses'), adminOnly: true, permKey: 'viewExpenses' },
                    { id: 'analytics', icon: BarChart3, label: 'Аналитика',   adminOnly: true },
                ],
            },
            {
                id: 'staff', label: 'ПЕРСОНАЛ',
                items: [
                    { id: 'staff',  icon: UserCog, label: t('staff'),  adminOnly: true },
                    { id: 'shifts', icon: Clock,   label: t('shifts'), adminOnly: true },
                ],
            },
            {
                id: 'settings', label: 'ПРОЧЕЕ',
                items: [
                    { id: 'telegram',    icon: BellRing,     label: 'Telegram',   adminOnly: true },
                    { id: 'promos',      icon: Tag,           label: 'Промокоды', adminOnly: true },
                    { id: 'referrals',   icon: Users2,        label: 'Бонусы' },
                    { id: 'hostelconfig',icon: Settings,      label: 'Настройки', adminOnly: true },
                    { id: 'auditlog',    icon: ClipboardList, label: 'История',   superOnly: true },
                ],
            },
        ];
    }
    // ─── Кассир: брони/e-mehmon/задачи/клиенты → в «Прочее», бонусы → после долгов ───
    return [
        {
            id: 'main', label: null,
            items: [
                { id: 'rooms',    icon: BedDouble, label: t('rooms') },
                { id: 'calendar', icon: Calendar,  label: t('calendar') },
            ],
        },
        {
            id: 'ops', label: 'ОПЕРАЦИИ',
            items: [
                { id: 'debts',     icon: AlertCircle, label: t('debts'),   permKey: 'viewDebts' },
                { id: 'referrals', icon: Users2,      label: 'Бонусы' },
            ],
        },
        {
            id: 'settings', label: 'ПРОЧЕЕ',
            items: [
                { id: 'bookings',      icon: Globe,          label: 'Брони',    badge: pendingBookingsCount, glow: (pendingBookingsCount || 0) > 0, permKey: 'viewBookings' },
                { id: 'registrations', icon: ClipboardCheck, label: 'E-mehmon', badge: registrationsAlertCount, glow: (registrationsAlertCount || 0) > 0 },
                { id: 'tasks',         icon: CheckSquare,    label: t('tasks'), badge: pendingTasksCount },
                { id: 'clients',       icon: Users,          label: t('clients'), permKey: 'viewClients' },
            ],
        },
    ];
};

// ─── Component ────────────────────────────────────────────────────────────────
const Navigation = ({
    currentUser, activeTab, setActiveTab, pendingTasksCount, pendingBookingsCount, lang,
    canPerformActions, onOpenExpense, onOpenCheckIn, onOpenShift,
    onOpenGroupCheckIn, onOpenRoomRental,
    onLogout, setLang, onOpenChangePassword,
    registrationsAlertCount = 0,
}) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] ?? k;
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';
    const isSuper = currentUser.role === 'super';

    const [profileOpen,  setProfileOpen]  = React.useState(false);
    const [profilePos,    setProfilePos]    = React.useState({ top: 0 });
    const [checkinOpen,   setCheckinOpen]   = React.useState(false);
    const [checkinPos,    setCheckinPos]    = React.useState({ top: 0 });
    const [settingsOpen,  setSettingsOpen]  = React.useState(false);
    const [settingsPos,   setSettingsPos]   = React.useState({ top: 0 });
    const profileBtnRef  = React.useRef(null);
    const profileRef     = React.useRef(null);
    const checkinBtnRef  = React.useRef(null);
    const checkinMenuRef = React.useRef(null);
    const settingsBtnRef = React.useRef(null);
    const settingsMenuRef = React.useRef(null);

    React.useEffect(() => {
        const handler = (e) => {
            if (
                profileRef.current    && !profileRef.current.contains(e.target) &&
                profileBtnRef.current && !profileBtnRef.current.contains(e.target)
            ) setProfileOpen(false);
            if (
                checkinMenuRef.current && !checkinMenuRef.current.contains(e.target) &&
                checkinBtnRef.current  && !checkinBtnRef.current.contains(e.target)
            ) setCheckinOpen(false);
            if (
                settingsMenuRef.current && !settingsMenuRef.current.contains(e.target) &&
                settingsBtnRef.current  && !settingsBtnRef.current.contains(e.target)
            ) setSettingsOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleCheckinToggle = () => {
        if (!checkinOpen && checkinBtnRef.current) {
            const rect = checkinBtnRef.current.getBoundingClientRect();
            setCheckinPos({ top: rect.top, left: rect.right + 8 });
        }
        setCheckinOpen(o => !o);
    };

    const handleProfileToggle = () => {
        if (!profileOpen && profileBtnRef.current) {
            const rect  = profileBtnRef.current.getBoundingClientRect();
            const menuH = 250;
            const below = window.innerHeight - rect.bottom;
            const top   = below < menuH ? rect.top - menuH + rect.height : rect.top;
            setProfilePos({ top: Math.max(8, top) });
        }
        setProfileOpen(o => !o);
    };

    const handleSettingsToggle = () => {
        if (!settingsOpen && settingsBtnRef.current) {
            const rect   = settingsBtnRef.current.getBoundingClientRect();
            const menuH  = 300;
            // Если от верха кнопки до низа экрана хватает — открываем вниз от кнопки,
            // иначе прибиваем меню к нижнему краю экрана
            const top = (window.innerHeight - rect.top >= menuH)
                ? rect.top
                : Math.max(8, window.innerHeight - menuH - 8);
            setSettingsPos({ top, left: rect.right + 8 });
        }
        setSettingsOpen(o => !o);
    };

    const roleLabel   = isSuper ? t('superAdmin') : isAdmin ? t('admin') : t('cashier');
    const filterItem  = (item) => {
        if (item.superOnly) return isSuper;
        // adminOnly items: visible to admins always, to cashiers only if explicit perm=true
        if (item.adminOnly) {
            if (isAdmin) {
                // admin still respects permKey if set (e.g. viewReports/viewExpenses)
                if (item.permKey) return currentUser.permissions?.[item.permKey] !== false;
                return true;
            }
            // cashier: only if they have explicit permission granted
            if (item.permKey) return currentUser.permissions?.[item.permKey] === true;
            return false;
        }
        // Non-adminOnly items with permKey: visible unless explicitly blocked
        if (item.permKey) return currentUser.permissions?.[item.permKey] !== false;
        return true;
    };
    const visibleGroups = NAV_GROUPS(t, pendingBookingsCount, pendingTasksCount, registrationsAlertCount, isAdmin)
        .map(g => ({ ...g, items: g.items.filter(filterItem) }))
        .filter(g => g.items.length > 0);

    const canCheckin = currentUser.role !== 'admin' && currentUser.role !== 'super';
    const btnBase    = { transition: 'all 0.15s', cursor: 'pointer' };

    return (
        <div
            className="hidden md:flex flex-col shrink-0 overflow-hidden"
            style={{ width: 80, background: '#1a3c40', borderRight: '1px solid rgba(255,255,255,0.07)' }}
        >
            <style>{`
                .dsb:focus,.dsb-btn:focus{outline:none!important;box-shadow:none!important}
                @keyframes booking-pulse{0%,100%{box-shadow:0 0 0 0 rgba(232,140,64,0.8)}50%{box-shadow:0 0 0 6px rgba(232,140,64,0)}}
                .nav-item{padding-top:9px;padding-bottom:9px}
                .nav-lbl{font-size:9px;font-weight:600;letter-spacing:.01em;line-height:1;margin-top:3px;text-align:center}
                .nav-gl{font-size:7px;font-weight:800;letter-spacing:.10em;color:rgba(158,205,208,.4);text-align:center;padding:5px 4px 2px;text-transform:uppercase}
                @media(max-height:680px){
                    .nav-item{padding-top:5px!important;padding-bottom:5px!important}
                    .nav-gl{padding:3px 4px 1px!important}
                }
                @media(max-height:540px){
                    .nav-lbl{display:none!important}
                    .nav-gl{display:none!important}
                    .nav-item{padding-top:3px!important;padding-bottom:3px!important}
                }
            `}</style>

            {/* ── Nav items ── */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'none' }}>
                {visibleGroups.map((group, gi) => (
                    <div key={group.id}>
                        {gi > 0 && (
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '2px 0 0' }}>
                                {group.label && group.id !== 'settings' && <div className="nav-gl">{group.label}</div>}
                            </div>
                        )}
                        {group.id === 'settings' ? (
                            /* ── Settings group → dropdown trigger ── */
                            <>
                                <div style={{ borderTop: gi > 0 ? undefined : '1px solid rgba(255,255,255,0.07)', margin: '2px 0 0' }}>
                                    <div className="nav-gl">ПРОЧЕЕ</div>
                                </div>
                                <button
                                    ref={settingsBtnRef}
                                    onClick={handleSettingsToggle}
                                    className="dsb nav-item relative w-full flex flex-col items-center justify-center transition-all"
                                    style={{
                                        background: settingsOpen ? 'rgba(232,140,64,0.18)' : group.items.some(i => i.id === activeTab) ? 'rgba(232,140,64,0.12)' : 'transparent',
                                        color:      settingsOpen || group.items.some(i => i.id === activeTab) ? '#e88c40' : '#9ecdd0',
                                        borderLeft: group.items.some(i => i.id === activeTab) ? '3px solid #e88c40' : '3px solid transparent',
                                        outline: 'none',
                                    }}
                                    onMouseOver={e => { if (!settingsOpen) { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#fff'; } }}
                                    onMouseOut={e  => { if (!settingsOpen) { e.currentTarget.style.background = group.items.some(i => i.id === activeTab) ? 'rgba(232,140,64,0.12)' : 'transparent'; e.currentTarget.style.color = group.items.some(i => i.id === activeTab) ? '#e88c40' : '#9ecdd0'; } }}
                                >
                                    <Settings size={20} strokeWidth={settingsOpen ? 2.5 : 2} />
                                    <span className="nav-lbl">Прочее</span>
                                </button>
                            </>
                        ) : (
                            group.items.map(item => {
                                const Icon = item.icon;
                                const act  = activeTab === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveTab(item.id)}
                                        className="dsb nav-item relative w-full flex flex-col items-center justify-center transition-all"
                                        style={{
                                            background: act ? 'rgba(232,140,64,0.18)' : 'transparent',
                                            color:      act ? '#e88c40' : '#9ecdd0',
                                            borderLeft: act ? '3px solid #e88c40' : '3px solid transparent',
                                            outline: 'none',
                                        }}
                                        onMouseOver={e => { if (!act) { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#fff'; } }}
                                        onMouseOut={e  => { if (!act) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ecdd0'; } }}
                                    >
                                        <Icon size={20} strokeWidth={act ? 2.5 : 2} />
                                        <span className="nav-lbl">{item.label}</span>
                                        {(item.badge ?? 0) > 0 && (
                                            <span
                                                className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                                                style={{
                                                    background: '#e88c40', color: '#fff', fontSize: 9, fontWeight: 900,
                                                    animation: item.glow ? 'booking-pulse 1.5s ease-in-out infinite' : 'none',
                                                }}
                                            >
                                                {item.badge}
                                            </span>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                ))}
            </div>

            {/* ── Settings dropdown portal ── */}
            {settingsOpen && ReactDOM.createPortal(
                <div ref={settingsMenuRef} style={{
                    position: 'fixed', left: settingsPos.left, top: settingsPos.top,
                    width: 190, background: '#1e4a4f',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                    zIndex: 99999, overflow: 'hidden',
                    maxHeight: `calc(100vh - ${settingsPos.top}px - 8px)`,
                    overflowY: 'auto',
                }}>
                    {visibleGroups.find(g => g.id === 'settings')?.items.map(item => {
                        const Icon = item.icon;
                        const act  = activeTab === item.id;
                        return (
                            <button key={item.id}
                                onClick={() => { setSettingsOpen(false); setActiveTab(item.id); }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left"
                                style={{
                                    color: act ? '#e88c40' : '#9ecdd0',
                                    background: act ? 'rgba(232,140,64,0.18)' : 'transparent',
                                    border: 'none', outline: 'none', cursor: 'pointer', transition: 'background 0.15s',
                                }}
                                onMouseOver={e => { if (!act) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; } }}
                                onMouseOut={e  => { if (!act) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ecdd0'; } }}
                            >
                                <Icon size={15} strokeWidth={act ? 2.5 : 2} />
                                <span style={{ fontWeight: act ? 700 : 600 }}>{item.label}</span>
                            </button>
                        );
                    })}
                </div>,
                document.body,
            )}

            {/* ── Action buttons ── */}
            {canPerformActions && (
                <div className="py-2 flex flex-col gap-1 px-1.5"
                     style={{ borderTop: '1px solid rgba(255,255,255,0.09)' }}>
                    <button
                        onClick={onOpenExpense} title={t('expense')}
                        className="dsb-btn w-full flex flex-col items-center justify-center py-2.5 rounded-xl"
                        style={{ ...btnBase, background: 'rgba(232,140,64,0.18)', color: '#f6ad6b', border: '1px solid rgba(232,140,64,0.28)', gap: 3 }}
                        onMouseOver={e => { e.currentTarget.style.background = '#e88c40'; e.currentTarget.style.color = '#fff'; }}
                        onMouseOut={e  => { e.currentTarget.style.background = 'rgba(232,140,64,0.18)'; e.currentTarget.style.color = '#f6ad6b'; }}
                    >
                        <Wallet size={17} /><span style={{ fontSize: 9, fontWeight: 700 }}>{t('expense')}</span>
                    </button>
                    {canCheckin && (<>
                        <button
                            ref={checkinBtnRef}
                            onClick={handleCheckinToggle}
                            className="dsb-btn w-full flex flex-col items-center justify-center py-2.5 rounded-xl"
                            style={{ ...btnBase, background: checkinOpen ? 'rgba(94,234,212,0.28)' : 'rgba(94,234,212,0.13)', color: checkinOpen ? '#fff' : '#5eead4', border: '1px solid rgba(94,234,212,0.22)', gap: 3 }}
                            onMouseOver={e => { e.currentTarget.style.background = 'rgba(94,234,212,0.28)'; e.currentTarget.style.color = '#fff'; }}
                            onMouseOut={e  => { e.currentTarget.style.background = checkinOpen ? 'rgba(94,234,212,0.28)' : 'rgba(94,234,212,0.13)'; e.currentTarget.style.color = checkinOpen ? '#fff' : '#5eead4'; }}
                        >
                            <UserPlus size={17} /><span style={{ fontSize: 9, fontWeight: 700 }}>{t('checkin')}</span>
                        </button>
                        {checkinOpen && ReactDOM.createPortal(
                            <div ref={checkinMenuRef} style={{
                                position: 'fixed', left: checkinPos.left, top: checkinPos.top,
                                width: 170, background: '#1e4a4f',
                                border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                                zIndex: 99999, overflow: 'hidden',
                            }}>
                                {[
                                    { label: 'Один гость',  Icon: UserPlus,  color: '#5eead4', action: () => { setCheckinOpen(false); onOpenCheckIn(); } },
                                    { label: 'Группа',      Icon: Users2,    color: '#a5b4fc', action: () => { setCheckinOpen(false); onOpenGroupCheckIn(); } },
                                    { label: 'Аренда',      Icon: Building2, color: '#6ee7b7', action: () => { setCheckinOpen(false); onOpenRoomRental(); } },
                                ].map(({ label, Icon, color, action }) => (
                                    <button key={label} onClick={action}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left"
                                        style={{ color, background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                                        onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                                        onMouseOut={e  => { e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <Icon size={15} strokeWidth={2} />
                                        <span style={{ fontWeight: 600 }}>{label}</span>
                                    </button>
                                ))}
                            </div>,
                            document.body,
                        )}
                        <button
                            onClick={onOpenShift} title={t('shift')}
                            className="dsb-btn w-full flex flex-col items-center justify-center py-2.5 rounded-xl"
                            style={{ ...btnBase, background: 'rgba(239,68,68,0.16)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.28)', gap: 3 }}
                            onMouseOver={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                            onMouseOut={e  => { e.currentTarget.style.background = 'rgba(239,68,68,0.16)'; e.currentTarget.style.color = '#fca5a5'; }}
                        >
                            <Power size={17} /><span style={{ fontSize: 9, fontWeight: 700 }}>{t('shift')}</span>
                        </button>
                    </>)}
                </div>
            )}

            {/* ── Profile ── */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.09)' }}>
                <button
                    ref={profileBtnRef} onClick={handleProfileToggle}
                    className="w-full flex flex-col items-center justify-center py-3 transition-all"
                    style={{ ...btnBase, background: profileOpen ? 'rgba(255,255,255,0.12)' : 'transparent', gap: 3 }}
                    onMouseOver={e => { if (!profileOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseOut={e  => { if (!profileOpen) e.currentTarget.style.background = 'transparent'; }}
                >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black"
                         style={{ background: '#e88c40', color: '#fff' }}>
                        {(currentUser.name || '?')[0].toUpperCase()}
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#9ecdd0', maxWidth: 68, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {currentUser.name.split(' ')[0]}
                    </span>
                </button>

                {profileOpen && ReactDOM.createPortal(
                    <div
                        ref={profileRef}
                        style={{
                            position: 'fixed', left: 88, top: profilePos.top, width: 240,
                            background: '#1e4a4f', border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 14, boxShadow: '0 8px 40px rgba(0,0,0,0.45)', zIndex: 99999, overflow: 'hidden',
                        }}
                    >
                        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                            <div className="text-sm font-black text-white">{currentUser.name}</div>
                            <div className="text-xs mt-0.5" style={{ color: '#9ecdd0' }}>{roleLabel}</div>
                        </div>
                        <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                            <div className="text-[11px] font-bold uppercase mb-2" style={{ color: '#9ecdd0' }}>{t('language')}</div>
                            <div className="flex gap-2">
                                {['ru', 'uz'].map(l => (
                                    <button key={l} onClick={() => setLang(l)}
                                        className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                                        style={lang === l ? { background: '#e88c40', color: '#fff' } : { background: 'rgba(255,255,255,0.08)', color: '#9ecdd0' }}>
                                        {l.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={() => { setProfileOpen(false); onOpenChangePassword(); }}
                            className="w-full flex items-center gap-3 px-5 py-3 text-sm text-left"
                            style={{ color: '#c9e8ea', background: 'transparent', border: 'none', outline: 'none', transition: 'background .15s' }}
                            onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                            onMouseOut={e  => { e.currentTarget.style.background = 'transparent'; }}
                        >
                            <Lock size={15} /> {t('changePassword')}
                        </button>
                        <button
                            onClick={() => { setProfileOpen(false); onLogout(); }}
                            className="w-full flex items-center gap-3 px-5 py-3 text-sm text-left border-t"
                            style={{ color: '#fca5a5', background: 'transparent', borderColor: 'rgba(255,255,255,0.08)', outline: 'none', transition: 'background .15s' }}
                            onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
                            onMouseOut={e  => { e.currentTarget.style.background = 'transparent'; }}
                        >
                            <LogOut size={15} /> {t('logout')}
                        </button>
                    </div>,
                    document.body,
                )}
            </div>
        </div>
    );
};

export default Navigation;
