import React, { useState, useRef, useEffect } from 'react';
import {
    LayoutDashboard, BedDouble, Calendar, Globe, AlertCircle, CheckSquare,
    Wallet, Users, UserCog, Clock, Tag, ClipboardList, Settings, BellRing,
    LogOut, MoreHorizontal, UserPlus, X, Building2, Users2, FileText, Lock,
    ClipboardCheck,
} from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';

// ─── Primary tabs always shown in the bottom bar ─────────────────────────────
const PRIMARY_TABS = [
    { id: 'rooms',    icon: BedDouble,   label: 'Комнаты' },
    { id: 'calendar', icon: Calendar,    label: 'Календарь' },
    { id: 'bookings', icon: Globe,       label: 'Брони',  badgeKey: 'bookings', glow: true },
    { id: 'tasks',    icon: CheckSquare, label: 'Задачи', badgeKey: 'tasks' },
];

// ─── Groups for the "Ещё" drawer ─────────────────────────────────────────────
const MORE_GROUPS = (t) => [
    {
        label: 'Главное',
        items: [
            { id: 'dashboard',     icon: LayoutDashboard, label: t('dashboard'), adminOnly: true },
            { id: 'registrations', icon: ClipboardCheck,  label: 'E-mehmon',     badgeKey: 'registrations' },
            { id: 'debts',         icon: AlertCircle,     label: t('debts') },
            { id: 'clients',       icon: Users,           label: t('clients') },
        ],
    },
    {
        label: 'Финансы',
        items: [
            { id: 'reports',  icon: FileText, label: t('reports'),  adminOnly: true },
            { id: 'expenses', icon: Wallet,   label: t('expenses'), adminOnly: true },
        ],
    },
    {
        label: 'Персонал',
        items: [
            { id: 'staff',  icon: UserCog, label: t('staff'),  adminOnly: true },
            { id: 'shifts', icon: Clock,   label: t('shifts'), adminOnly: true },
        ],
    },
    {
        label: 'Прочее',
        items: [
            { id: 'telegram',     icon: BellRing,     label: 'Telegram',  adminOnly: true },
            { id: 'promos',       icon: Tag,           label: 'Промокоды', adminOnly: true },
            { id: 'hostelconfig', icon: Settings,      label: 'Настройки', adminOnly: true },
            { id: 'auditlog',     icon: ClipboardList, label: 'История',   superOnly: true },
        ],
    },
];

// ─── Component ────────────────────────────────────────────────────────────────
const MobileNavigation = ({
    currentUser, activeTab, setActiveTab,
    pendingTasksCount, pendingBookingsCount, lang,
    selectedHostelFilter, hostels, availableHostels, setSelectedHostelFilter,
    onLogout,
    canPerformActions, onOpenCheckIn, onOpenGroupCheckIn, onOpenRoomRental,
    onOpenShiftClosing, onOpenExpense, anyModalOpen,
    registrationsAlertCount = 0,
}) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] ?? k;
    const [drawerOpen, setDrawerOpen]   = useState(false);
    const [checkinOpen, setCheckinOpen] = useState(false);
    const checkinRef = useRef(null);

    const isAdmin  = currentUser?.role === 'admin' || currentUser?.role === 'super';
    const isSuper  = currentUser?.role === 'super';
    const isCashier = !isAdmin;

    const badges = {
        bookings:      pendingBookingsCount   || 0,
        tasks:         pendingTasksCount      || 0,
        registrations: registrationsAlertCount || 0,
    };

    // Close checkin popup on outside interaction
    useEffect(() => {
        if (!checkinOpen) return;
        const handler = (e) => {
            if (checkinRef.current && !checkinRef.current.contains(e.target))
                setCheckinOpen(false);
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
        };
    }, [checkinOpen]);

    const filterItem = (item) => {
        if (item.superOnly) return isSuper;
        if (item.adminOnly) return isAdmin;
        return true;
    };

    const moreGroups   = MORE_GROUPS(t);
    const allMoreIds   = moreGroups.flatMap(g => g.items.map(i => i.id));
    const activeInMore = allMoreIds.includes(activeTab);
    const showHostelBar = availableHostels?.length > 1;

    const NAV_BG     = '#1a3c40';
    const ACTIVE_CLR = '#e88c40';
    const MUTED_CLR  = '#9ecdd0';

    return (
        <>
            <style>{`
                @keyframes mob-glow {
                    0%,100% { box-shadow:0 0 0 0 rgba(232,140,64,0.9); }
                    50%     { box-shadow:0 0 0 5px rgba(232,140,64,0); }
                }
            `}</style>

            {/* Overlay */}
            {drawerOpen && (
                <div
                    className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
                    onClick={() => setDrawerOpen(false)}
                />
            )}

            {/* ── Slide-up drawer ── */}
            <div
                className={`fixed left-0 right-0 z-[110] transition-transform duration-300 ease-out ${
                    drawerOpen ? 'translate-y-0' : 'translate-y-full'
                }`}
                style={{
                    bottom: 0,
                    maxHeight: '76vh',
                    background: '#1e3e3e',
                    borderRadius: '22px 22px 0 0',
                    boxShadow: '0 -8px 48px rgba(0,0,0,0.55)',
                    overflowY: 'auto',
                    overscrollBehavior: 'contain',
                    paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${showHostelBar ? 92 : 68}px)`,
                }}
            >
                {/* Handle bar */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
                </div>

                {/* Title + close */}
                <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <span className="text-white font-black text-base tracking-tight">Меню</span>
                    <button
                        onClick={() => setDrawerOpen(false)}
                        className="w-8 h-8 flex items-center justify-center rounded-full"
                        style={{ background: 'rgba(255,255,255,0.1)', color: MUTED_CLR }}
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* Admin expense quick-action */}
                {canPerformActions && isAdmin && (
                    <div className="px-4 pt-4 pb-1">
                        <div className="text-[10px] font-black uppercase tracking-widest mb-2 px-1" style={{ color: 'rgba(158,205,208,0.5)' }}>
                            Быстрые действия
                        </div>
                        <button
                            onClick={() => { setDrawerOpen(false); onOpenExpense?.(); }}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl font-bold text-xs active:scale-95 transition-transform"
                            style={{ background: 'rgba(232,140,64,0.18)', border: '1px solid rgba(232,140,64,0.35)', color: '#f6ad6b' }}
                        >
                            <Wallet size={15}/> Добавить расход
                        </button>
                    </div>
                )}

                {/* Cashier check-in actions */}
                {canPerformActions && isCashier && (
                    <div className="px-4 pt-4 pb-1">
                        <div className="text-[10px] font-black uppercase tracking-widest mb-2 px-1" style={{ color: 'rgba(158,205,208,0.5)' }}>
                            Заселение
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { label: 'Один гость', icon: UserPlus,  color: '#5eead4', action: () => { setDrawerOpen(false); onOpenCheckIn?.();        } },
                                { label: 'Группа',     icon: Users2,    color: '#a5b4fc', action: () => { setDrawerOpen(false); onOpenGroupCheckIn?.();  } },
                                { label: 'Аренда',     icon: Building2, color: '#6ee7b7', action: () => { setDrawerOpen(false); onOpenRoomRental?.();    } },
                            ].map(({ label, icon: Icon, color, action }) => (
                                <button
                                    key={label} onClick={action}
                                    className="flex flex-col items-center gap-2 py-3 rounded-2xl active:scale-95 transition-transform"
                                    style={{ background: `${color}15`, border: `1px solid ${color}30` }}
                                >
                                    <Icon size={20} style={{ color }} />
                                    <span className="text-[10px] font-bold leading-tight text-center" style={{ color }}>{label}</span>
                                </button>
                            ))}
                        </div>
                        {/* Close shift button for cashiers */}
                        <button
                            onClick={() => { setDrawerOpen(false); onOpenShiftClosing?.(); }}
                            className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-2xl font-bold text-xs active:scale-95 transition-transform"
                            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}
                        >
                            <Lock size={15}/> Закрыть смену
                        </button>
                    </div>
                )}

                {/* Grouped nav items */}
                {moreGroups.map(group => {
                    const visibleItems = group.items.filter(filterItem);
                    if (!visibleItems.length) return null;
                    return (
                        <div key={group.label} className="px-4 pt-4">
                            <div className="text-[10px] font-black uppercase tracking-widest mb-2 px-1" style={{ color: 'rgba(158,205,208,0.5)' }}>
                                {group.label}
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {visibleItems.map(item => {
                                    const Icon = item.icon;
                                    const act  = activeTab === item.id;
                                    const badge = item.badgeKey ? (badges[item.badgeKey] || 0) : 0;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => { setActiveTab(item.id); setDrawerOpen(false); }}
                                            className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all active:scale-95 relative"
                                            style={{
                                                background: act ? 'rgba(232,140,64,0.2)'    : 'rgba(255,255,255,0.05)',
                                                border:     act ? '1px solid rgba(232,140,64,0.45)' : '1px solid transparent',
                                            }}
                                        >
                                            <div className="relative">
                                                <Icon size={19} style={{ color: act ? ACTIVE_CLR : MUTED_CLR }} strokeWidth={act ? 2.5 : 2} />
                                                {badge > 0 && (
                                                    <span
                                                        className="absolute -top-1.5 -right-2 min-w-[14px] h-3.5 px-0.5 rounded-full flex items-center justify-center text-white"
                                                        style={{ background: '#ef4444', fontSize: 7, fontWeight: 900 }}
                                                    >
                                                        {badge > 9 ? '9+' : badge}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[9px] font-bold leading-tight text-center" style={{ color: act ? ACTIVE_CLR : MUTED_CLR }}>
                                                {item.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {/* Logout */}
                <div className="px-4 pt-4">
                    <button
                        onClick={() => { setDrawerOpen(false); onLogout(); }}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-transform"
                        style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}
                    >
                        <LogOut size={17} /> Выйти из аккаунта
                    </button>
                </div>
            </div>

            {/* ── Floating Expense FAB (admins only) ── */}
            {canPerformActions && isAdmin && !anyModalOpen && (
                <div
                    className="fixed z-[90] md:hidden"
                    style={{
                        bottom: `calc(env(safe-area-inset-bottom, 0px) + ${showHostelBar ? 92 : 68}px)`,
                        right: 16,
                    }}
                >
                    <button
                        onClick={() => onOpenExpense?.()}
                        className="w-13 h-13 rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-all"
                        style={{
                            width: 52,
                            height: 52,
                            background: '#1a3c40',
                            border: `2.5px solid ${ACTIVE_CLR}`,
                            color: ACTIVE_CLR,
                            boxShadow: '0 4px 20px rgba(232,140,64,0.4)',
                        }}
                    >
                        <Wallet size={20} strokeWidth={2.5} />
                    </button>
                    <span
                        className="absolute -top-1 left-1/2 -translate-x-1/2 text-[9px] font-black whitespace-nowrap px-1.5 py-0.5 rounded-full"
                        style={{ background: ACTIVE_CLR, color: '#fff', letterSpacing: '0.03em' }}
                    >Расход</span>
                </div>
            )}

            {/* ── Floating Checkin FAB (cashiers only) ── */}
            {canPerformActions && isCashier && !anyModalOpen && (
                <div
                    ref={checkinRef}
                    className="fixed z-[90] md:hidden"
                    style={{
                        bottom: `calc(env(safe-area-inset-bottom, 0px) + ${showHostelBar ? 92 : 68}px)`,
                        left: '50%',
                        transform: 'translateX(-50%)',
                    }}
                >
                    {/* Mini options popup */}
                    {checkinOpen && (
                        <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 flex gap-2.5 animate-in zoom-in-90 fade-in duration-150">
                            {[
                                { label: 'Один',   icon: UserPlus,  color: '#5eead4', bg: '#0f2a2e', action: () => { setCheckinOpen(false); onOpenCheckIn?.();       } },
                                { label: 'Группа', icon: Users2,    color: '#a5b4fc', bg: '#161030', action: () => { setCheckinOpen(false); onOpenGroupCheckIn?.(); } },
                                { label: 'Аренда', icon: Building2, color: '#6ee7b7', bg: '#0e2820', action: () => { setCheckinOpen(false); onOpenRoomRental?.();   } },
                            ].map(({ label, icon: Icon, color, bg, action }) => (
                                <button
                                    key={label} onClick={action}
                                    className="flex flex-col items-center gap-1.5 px-3.5 py-2.5 rounded-2xl active:scale-95 transition-transform"
                                    style={{
                                        background: bg,
                                        border: `1.5px solid ${color}35`,
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                                        minWidth: 68,
                                    }}
                                >
                                    <Icon size={19} style={{ color }} />
                                    <span className="text-[10px] font-bold" style={{ color }}>{label}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* FAB circle */}
                    <button
                        onClick={() => setCheckinOpen(o => !o)}
                        className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-all"
                        style={{
                            background: checkinOpen ? ACTIVE_CLR : NAV_BG,
                            border: `2.5px solid ${ACTIVE_CLR}`,
                            color: '#fff',
                            boxShadow: '0 4px 24px rgba(232,140,64,0.45)',
                        }}
                    >
                        {checkinOpen ? <X size={22} strokeWidth={2.5} /> : <UserPlus size={21} strokeWidth={2.5} />}
                    </button>
                </div>
            )}

            {/* ── Fixed bottom nav bar ── */}
            <div
                className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
                style={{
                    background: NAV_BG,
                    borderTop: '1px solid rgba(255,255,255,0.09)',
                    boxShadow: '0 -2px 20px rgba(0,0,0,0.3)',
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                }}
            >
                {/* Hostel switcher */}
                {showHostelBar && (
                    <div className="flex items-center justify-center gap-2 px-3 pt-2 pb-1">
                        {availableHostels.map(hid => (
                            <button
                                key={hid}
                                onClick={() => setSelectedHostelFilter(hid)}
                                className="px-4 py-1 rounded-full text-xs font-bold transition-all active:scale-95"
                                style={selectedHostelFilter === hid
                                    ? { background: ACTIVE_CLR, color: '#fff' }
                                    : { background: 'rgba(255,255,255,0.1)', color: MUTED_CLR }}
                            >
                                {hostels?.[hid]?.name ?? hid}
                            </button>
                        ))}
                    </div>
                )}

                {/* Tab row */}
                <div className="flex items-stretch" style={{ height: 56 }}>
                    {PRIMARY_TABS.map((tab, idx) => {
                        const Icon    = tab.icon;
                        const badge   = tab.badgeKey ? badges[tab.badgeKey] : 0;
                        const isActive = activeTab === tab.id;
                        // Insert center spacer for cashier FAB between calendar (idx=1) and bookings
                        const insertSpacer = canPerformActions && isCashier && idx === 2;
                        return (
                            <React.Fragment key={tab.id}>
                                {insertSpacer && <div className="flex-1" />}
                                <button
                                    onClick={() => setActiveTab(tab.id)}
                                    className="flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors"
                                    style={{ color: isActive ? ACTIVE_CLR : MUTED_CLR }}
                                >
                                    <div className="relative">
                                        <Icon size={21} strokeWidth={isActive ? 2.5 : 2} />
                                        {badge > 0 && (
                                            <span
                                                className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center text-white"
                                                style={{
                                                    background: ACTIVE_CLR,
                                                    fontSize: 8,
                                                    fontWeight: 900,
                                                    animation: tab.glow ? 'mob-glow 1.5s ease-in-out infinite' : 'none',
                                                }}
                                            >
                                                {badge > 9 ? '9+' : badge}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[9px] font-bold">{tab.label}</span>
                                    {isActive && (
                                        <span
                                            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                                            style={{ background: ACTIVE_CLR }}
                                        />
                                    )}
                                </button>
                            </React.Fragment>
                        );
                    })}

                    {/* Right spacer for FAB */}
                    {canPerformActions && isCashier && <div className="flex-1" />}

                    {/* "Ещё" button */}
                    <button
                        onClick={() => setDrawerOpen(true)}
                        className="flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors"
                        style={{ color: drawerOpen || activeInMore ? ACTIVE_CLR : MUTED_CLR }}
                    >
                        <div className="relative">
                            <MoreHorizontal size={21} strokeWidth={2} />
                            {registrationsAlertCount > 0 && (
                                <span
                                    className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center text-white"
                                    style={{ background: '#ef4444', fontSize: 8, fontWeight: 900 }}
                                >
                                    {registrationsAlertCount > 9 ? '9+' : registrationsAlertCount}
                                </span>
                            )}
                        </div>
                        <span className="text-[9px] font-bold">Ещё</span>
                        {(drawerOpen || activeInMore) && (
                            <span
                                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                                style={{ background: ACTIVE_CLR }}
                            />
                        )}
                    </button>
                </div>
            </div>
        </>
    );
};

export default MobileNavigation;
