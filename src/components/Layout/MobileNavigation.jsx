import React from 'react';
import {
    LayoutDashboard,
    BedDouble,
    Calendar,
    AlertCircle,
    CheckSquare,
    LogOut,
    Globe,
    Tag,
    ClipboardList,
    Settings,
} from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';

const MobileNavigation = ({
    currentUser, activeTab, setActiveTab, pendingTasksCount, pendingBookingsCount, lang,
    selectedHostelFilter, hostels, availableHostels, setSelectedHostelFilter,
    onLogout,
}) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] ?? k;

    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super';
    const isSuper = currentUser?.role === 'super';

    const tabs = [
        { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard, role: 'admin' },
        { id: 'rooms',     label: t('rooms'),     icon: BedDouble,       role: 'all' },
        { id: 'calendar',  label: t('calendar'),  icon: Calendar,        role: 'all' },
        { id: 'bookings',  label: 'Брони',        icon: Globe,           role: 'all', badge: pendingBookingsCount, glow: (pendingBookingsCount||0) > 0 },
        { id: 'tasks',     label: t('tasks'),     icon: CheckSquare,     role: 'all', badge: pendingTasksCount },
        { id: 'debts',     label: t('debts'),     icon: AlertCircle,     role: 'all' },
        { id: 'promos',       label: 'Промокоды', icon: Tag,           role: 'admin' },
        { id: 'hostelconfig', label: 'Настройки', icon: Settings,      role: 'admin' },
        { id: 'auditlog',     label: 'История',  icon: ClipboardList, role: 'super' },
    ];

    const roleCheck = (role) => {
        if (isSuper) return true;
        if (role === 'all') return true;
        if (role === 'admin') return isAdmin;
        return false;
    };

    const visibleTabs = tabs.filter(tab => roleCheck(tab.role));
    const showHostelBar = availableHostels?.length > 1;

    return (
        <div
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
            style={{
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                background: 'var(--mob-nav-bg, #ffffff)',
                borderTop: '1px solid var(--mob-nav-border, #e2e8f0)',
                boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
            }}
        >
            {/* Hostel switcher — только когда доступно > 1 хостела */}
            {showHostelBar && (
                <div className="flex items-center justify-center gap-2 px-3 pt-2 pb-1">
                    {availableHostels.map(hid => (
                        <button
                            key={hid}
                            onClick={() => setSelectedHostelFilter(hid)}
                            className="px-4 py-1 rounded-full text-xs font-bold transition-all"
                            style={selectedHostelFilter === hid
                                ? { background: '#e88c40', color: '#fff' }
                                : { background: 'var(--mob-nav-chip, #f1f5f9)', color: 'var(--mob-nav-muted, #64748b)' }
                            }
                        >
                            {hostels?.[hid]?.name ?? hid}
                        </button>
                    ))}
                </div>
            )}

            {/* Tab bar — scrollable */}
            <div
                className="flex items-center overflow-x-auto scrollbar-hide pt-2 pb-1 px-1"
                style={{ minHeight: 56 }}
            >
                <style>{`@keyframes mob-booking-glow{0%,100%{box-shadow:0 0 0 0 rgba(232,140,64,0.9)}50%{box-shadow:0 0 0 5px rgba(232,140,64,0)}}`}</style>
                {visibleTabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="flex-shrink-0 flex flex-col items-center justify-center py-1 relative"
                        style={{
                            minWidth: 64,
                            color: activeTab === tab.id ? '#6366f1' : 'var(--mob-nav-muted, #94a3b8)',
                        }}
                    >
                        <tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                        <span className="text-[9px] font-bold mt-1 truncate max-w-[60px]">{tab.label}</span>
                        {(tab.badge ?? 0) > 0 && (
                            <span className="absolute top-0.5 right-3 w-2 h-2 rounded-full"
                                style={{
                                    background: '#e88c40',
                                    animation: tab.glow ? 'mob-booking-glow 1.5s ease-in-out infinite' : 'none',
                                }}
                            />
                        )}
                    </button>
                ))}

                {/* Разделитель */}
                <div className="w-px h-8 mx-1 flex-shrink-0" style={{ background: 'var(--mob-nav-border, #e2e8f0)' }} />

                {/* Logout */}
                <button
                    onClick={onLogout}
                    className="flex-shrink-0 flex flex-col items-center justify-center py-1"
                    style={{ minWidth: 58, color: 'var(--mob-nav-muted, #94a3b8)' }}
                >
                    <LogOut size={22} strokeWidth={2} />
                    <span className="text-[9px] font-bold mt-1">Выход</span>
                </button>
            </div>
        </div>
    );
};

export default MobileNavigation;
