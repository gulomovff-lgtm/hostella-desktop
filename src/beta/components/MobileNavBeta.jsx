import React from 'react';
import { Home, BedDouble, Users, Wallet, UserPlus, CircleUser } from 'lucide-react';

/**
 * Нижняя навигация беты для телефона (< md). На десктопе скрыта — там SmartNav.
 * Кассир: Сегодня · Комнаты · [Заселить] · Гости · Профиль
 * Админ:  Сегодня · Комнаты · Деньги · Гости · Профиль
 */
const MobileNavBeta = ({ currentUser, activeTab, setActiveTab, onOpenCheckIn, badge = 0 }) => {
    const isCashier = currentUser?.role !== 'admin' && currentUser?.role !== 'super';

    const Tab = ({ id, icon: Icon, label, dot = 0 }) => {
        const act = activeTab === id;
        return (
            <button onClick={() => setActiveTab(id)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 0', color: act ? '#f5b574' : 'var(--nav-muted)' }}>
                <Icon size={20} strokeWidth={act ? 2.5 : 2} />
                <span style={{ fontSize: 10, fontWeight: act ? 800 : 600 }}>{label}</span>
                {dot > 0 && (
                    <span className="absolute top-0.5 right-1/2 translate-x-4 min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center">
                        {dot}
                    </span>
                )}
            </button>
        );
    };

    return (
        <nav className="md:hidden flex items-stretch flex-shrink-0"
            aria-label="Навигация"
            style={{
                background: 'var(--nav-bg)', borderTop: '1px solid rgba(255,255,255,0.09)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)', height: 'calc(58px + env(safe-area-inset-bottom, 0px))',
            }}>
            <Tab id="today" icon={Home} label="Сегодня" dot={badge} />
            <Tab id="rooms" icon={BedDouble} label="Комнаты" />
            {isCashier ? (
                <div className="flex-1 flex items-center justify-center">
                    <button onClick={() => onOpenCheckIn?.()}
                        aria-label="Заселить гостя"
                        className="w-12 h-12 -mt-5 rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                        style={{ background: 'linear-gradient(140deg,#14b8a6,#0d9488)', color: '#fff', border: '3px solid var(--nav-bg)', cursor: 'pointer' }}>
                        <UserPlus size={20} strokeWidth={2.5} />
                    </button>
                </div>
            ) : (
                <Tab id="expenses" icon={Wallet} label="Деньги" />
            )}
            <Tab id="clients" icon={Users} label="Гости" />
            <Tab id="profile" icon={CircleUser} label="Профиль" />
        </nav>
    );
};

export default MobileNavBeta;
