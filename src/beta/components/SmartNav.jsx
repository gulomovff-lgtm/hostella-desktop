import React from 'react';
import {
    Home, BedDouble, Users, Wallet, Settings, ChevronDown, ChevronRight,
    UserPlus, Power,
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

const ROLE_LABEL = { super: 'Супер-админ', admin: 'Админ', cashier: 'Кассир' };

const SmartNav = ({
    currentUser, activeTab, setActiveTab, lang,
    pendingTasksCount = 0, pendingBookingsCount = 0, registrationsAlertCount = 0,
    canPerformActions,
    onOpenExpense, onOpenCheckIn, onOpenShift,
    onOpenProfile,
    shiftActive = false,
    hostelName = '',
}) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] ?? k;
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';
    const isSuper = currentUser.role === 'super';
    const canCheckin = currentUser.role !== 'admin' && currentUser.role !== 'super';

    const [openSec, setOpenSec] = React.useState(null); // null = авто (раздел с активной вкладкой)

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

    const profileActive = activeTab === 'profile';

    return (
        <div className="hidden md:flex shrink-0 flex-col"
            style={{ width: 232, background: 'var(--nav-bg)', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
            <style>{`
                .snv-sec{transition:background .15s,color .15s}
                .snv-sec:not(.act):hover{background:rgba(255,255,255,0.06)!important}
                .snv-item{transition:background .12s,color .12s}
                .snv-item:not(.act):hover{background:rgba(255,255,255,0.05)!important;color:#c8d8da!important}
                .snv-act-teal:hover{background:linear-gradient(160deg,#0f9688,#0d7a6e)!important;color:#fff!important}
                .snv-act-amber:hover{background:rgba(234,179,8,0.32)!important;color:#fff!important}
                .snv-act-red:hover{background:rgba(239,68,68,0.32)!important;color:#fff!important}
                .snv-profile:hover{background:rgba(255,255,255,0.07)!important}
            `}</style>

            {/* Разделы */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden" aria-label="Основное меню"
                style={{ padding: '12px 10px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
                {sections.map(s => {
                    const Icon = s.icon;
                    const open = isOpen(s.id);
                    const hasActive = s.visItems.some(i => i.id === activeTab);
                    const secBadge = s.visItems.reduce((sum, i) => sum + (i.badge ? badgeValue(i.badge) : 0), 0);
                    return (
                        <div key={s.id} style={{ marginBottom: 4 }}>
                            <button onClick={() => handleSection(s)}
                                className={`snv-sec ${hasActive ? 'act' : ''}`}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                                    padding: '8px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
                                    background: hasActive ? 'rgba(232,140,64,0.12)' : 'transparent',
                                    color: hasActive ? '#f5b574' : 'var(--nav-muted)',
                                }}>
                                <span style={{
                                    width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: hasActive ? 'rgba(232,140,64,0.22)' : 'rgba(255,255,255,0.06)',
                                    color: hasActive ? '#f5b574' : 'var(--nav-muted)',
                                    transition: 'background .15s,color .15s',
                                }}>
                                    <Icon size={16} strokeWidth={hasActive ? 2.5 : 2} />
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 800, flex: 1, textAlign: 'left' }}>{s.label}</span>
                                {!open && secBadge > 0 && (
                                    <span style={{ background: '#e88c40', color: '#fff', fontSize: 10, fontWeight: 900, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{secBadge}</span>
                                )}
                                {open ? <ChevronDown size={13} style={{ opacity: 0.45, flexShrink: 0 }} /> : <ChevronRight size={13} style={{ opacity: 0.45, flexShrink: 0 }} />}
                            </button>
                            {open && (
                                <div style={{ margin: '2px 0 6px 24px', borderLeft: '2px solid rgba(232,140,64,0.2)', paddingLeft: 6 }}>
                                    {s.visItems.map(item => {
                                        const act = activeTab === item.id;
                                        const bv = item.badge ? badgeValue(item.badge) : 0;
                                        return (
                                            <button key={item.id} onClick={() => setActiveTab(item.id)}
                                                className={`snv-item ${act ? 'act' : ''}`}
                                                style={{
                                                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                                                    padding: '6.5px 10px', borderRadius: 9, border: 'none', cursor: 'pointer',
                                                    background: act ? 'rgba(232,140,64,0.15)' : 'transparent',
                                                    color: act ? '#f5b574' : 'var(--nav-muted)',
                                                    fontSize: 12.5, fontWeight: act ? 800 : 600, textAlign: 'left',
                                                }}>
                                                {act && <span style={{ width: 5, height: 5, borderRadius: 3, background: '#e88c40', flexShrink: 0 }} />}
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
            </nav>

            {/* Быстрые действия */}
            {canPerformActions && (
                <div style={{ padding: '10px 10px 8px', borderTop: '1px solid rgba(255,255,255,0.09)' }}>
                    {canCheckin && (
                        <button onClick={onOpenCheckIn}
                            className="snv-act-teal"
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                padding: '10px', borderRadius: 12, cursor: 'pointer', marginBottom: 6,
                                background: 'rgba(20,184,166,0.18)', color: '#5eead4',
                                border: '1.5px solid rgba(20,184,166,0.3)', fontSize: 12.5, fontWeight: 800,
                                transition: 'all .15s',
                            }}>
                            <UserPlus size={16} strokeWidth={2.5} /> {t('checkin')}
                        </button>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={onOpenExpense}
                            className="snv-act-amber"
                            style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                                background: 'rgba(234,179,8,0.14)', color: '#fde047',
                                border: '1px solid rgba(234,179,8,0.22)', fontSize: 11.5, fontWeight: 800,
                                transition: 'all .15s',
                            }}>
                            <Wallet size={14} strokeWidth={2.5} /> {t('expense')}
                        </button>
                        {canCheckin && (
                            <button onClick={onOpenShift}
                                className="snv-act-red"
                                style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                    padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                                    background: 'rgba(239,68,68,0.14)', color: '#fca5a5',
                                    border: '1px solid rgba(239,68,68,0.22)', fontSize: 11.5, fontWeight: 800,
                                    transition: 'all .15s',
                                }}>
                                <Power size={14} strokeWidth={2.5} /> {t('shift')}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Карточка профиля → экран профиля */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.09)', padding: 8 }}>
                <button onClick={() => onOpenProfile?.()}
                    className="snv-profile"
                    aria-label="Открыть профиль"
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
                        background: profileActive ? 'rgba(232,140,64,0.13)' : 'transparent',
                        transition: 'background .15s',
                    }}>
                    <span style={{ position: 'relative', flexShrink: 0 }}>
                        <span style={{
                            width: 34, height: 34, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'linear-gradient(140deg,#e88c40,#c86a20)', color: '#fff', fontSize: 14, fontWeight: 900,
                        }}>
                            {(currentUser.name || '?')[0].toUpperCase()}
                        </span>
                        <span style={{
                            position: 'absolute', bottom: -2, right: -2, width: 11, height: 11, borderRadius: 6,
                            background: shiftActive ? '#34d399' : 'rgba(148,163,184,0.6)',
                            border: '2px solid var(--nav-bg)',
                        }} title={shiftActive ? 'Смена открыта' : 'Смена не открыта'} />
                    </span>
                    <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
                        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: profileActive ? '#f5b574' : '#c8d8da', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {(currentUser.name || '?').split(' ')[0]}
                        </span>
                        <span style={{ display: 'block', fontSize: 10, color: 'var(--nav-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ROLE_LABEL[currentUser.role] || currentUser.role}{hostelName ? ` · ${hostelName}` : ''}
                        </span>
                    </span>
                    <ChevronRight size={14} style={{ opacity: 0.4, flexShrink: 0, color: 'var(--nav-muted)' }} />
                </button>
            </div>
        </div>
    );
};

export default SmartNav;
