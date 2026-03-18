import React from 'react';

const HOSTEL_OPTIONS = [
    {
        id: 'hostel1',
        label: 'Хостел №1',
        emoji: '🏨',
        gradient: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
        light: '#f5f3ff',
        border: '#c4b5fd',
    },
    {
        id: 'hostel2',
        label: 'Хостел №2',
        emoji: '🏩',
        gradient: 'linear-gradient(135deg, #0284c7, #0369a1)',
        light: '#f0f9ff',
        border: '#7dd3fc',
    },
];

const C = {
    primary:   '#1a3c40',
    secondary: '#2a5c60',
    accent:    '#e88c40',
    light:     '#f4f1ea',
};

const HostelPickerScreen = ({ user, onPick, onLogout, lang }) => {
    const allowedIds = user?.allowedHostels || ['hostel1', 'hostel2'];
    const options = HOSTEL_OPTIONS.filter(h => allowedIds.includes(h.id));

    return (
        <div className="fixed inset-0 w-screen h-screen z-[100] flex">

            {/* ── Left brand panel ── */}
            <div
                className="hidden lg:flex lg:w-[52%] flex-col items-center justify-center p-12 relative overflow-hidden"
                style={{ background: `linear-gradient(145deg, ${C.primary} 0%, ${C.secondary} 60%, #1f4e53 100%)` }}
            >
                {/* Subtle rings */}
                <div className="absolute inset-0 pointer-events-none">
                    {[200, 340, 480, 620].map((s, i) => (
                        <div
                            key={i}
                            className="absolute rounded-full border border-white/5"
                            style={{ width: s, height: s, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}
                        />
                    ))}
                </div>
                {/* Accent blob */}
                <div
                    className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-20"
                    style={{ background: C.accent, filter: 'blur(60px)' }}
                />
                {/* Content */}
                <div className="relative text-center flex flex-col items-center">
                    <div
                        className="w-36 h-36 rounded-full overflow-hidden border-4 mb-8 shadow-2xl"
                        style={{ borderColor: C.accent }}
                    >
                        <img src="https://hostella.uz/logo.png" alt="Hostella" className="w-full h-full object-cover" />
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tight mb-2">Hostella</h1>
                    <p className="text-lg font-medium mb-10" style={{ color: '#a8cdd0' }}>Система управления хостелом</p>
                    <div className="grid grid-cols-3 gap-4 text-center w-full max-w-xs">
                        {[['🏨', 'Номера'], ['👥', 'Гости'], ['💰', 'Финансы']].map(([emoji, label]) => (
                            <div
                                key={label}
                                className="rounded-2xl p-4 border border-white/10"
                                style={{ background: 'rgba(255,255,255,0.07)' }}
                            >
                                <div className="text-2xl mb-1">{emoji}</div>
                                <div className="text-xs font-semibold" style={{ color: '#a8cdd0' }}>{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Right panel ── */}
            <div
                className="flex-1 flex flex-col items-center justify-center p-8 relative"
                style={{ background: C.light }}
            >
                {/* Mobile logo */}
                <div className="lg:hidden flex items-center gap-3 mb-10">
                    <img
                        src="https://hostella.uz/logo.png"
                        alt="Hostella"
                        className="w-12 h-12 rounded-full object-cover border-2"
                        style={{ borderColor: C.accent }}
                    />
                    <span className="text-2xl font-black" style={{ color: C.primary }}>Hostella</span>
                </div>

                <div className="w-full max-w-sm">
                    {/* Greeting */}
                    <div className="mb-8">
                        <p className="text-sm font-semibold mb-1" style={{ color: '#7a9498' }}>
                            Привет, <strong>{user?.name}</strong>!
                        </p>
                        <h2 className="text-3xl font-black mb-2" style={{ color: C.primary }}>
                            Выберите хостел
                        </h2>
                        <p className="text-base" style={{ color: '#7a9498' }}>
                            В каком хостеле вы работаете сегодня?
                        </p>
                    </div>

                    {/* Hostel cards */}
                    <div className="space-y-4">
                        {options.map(h => (
                            <button
                                key={h.id}
                                onClick={() => onPick(h.id)}
                                className="w-full p-5 rounded-2xl border-2 text-left transition-all
                                           bg-white hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                                style={{ borderColor: '#d5e2e3' }}
                                onMouseOver={e => {
                                    e.currentTarget.style.borderColor = h.border;
                                    e.currentTarget.style.background = h.light;
                                }}
                                onMouseOut={e => {
                                    e.currentTarget.style.borderColor = '#d5e2e3';
                                    e.currentTarget.style.background = '#fff';
                                }}
                            >
                                <div className="flex items-center gap-4">
                                    <div
                                        className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shadow-md flex-shrink-0"
                                        style={{ background: h.gradient }}
                                    >
                                        {h.emoji}
                                    </div>
                                    <div>
                                        <p className="font-black text-xl text-slate-800">{h.label}</p>
                                        <p className="text-sm text-slate-400 mt-0.5">Начать работу здесь →</p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Logout link */}
                    <div className="mt-8 text-center">
                        <button
                            onClick={onLogout}
                            className="text-xs transition-colors"
                            style={{ color: '#bbb' }}
                            onMouseOver={e => e.currentTarget.style.color = C.secondary}
                            onMouseOut={e => e.currentTarget.style.color = '#bbb'}
                        >
                            Выйти из аккаунта
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HostelPickerScreen;
