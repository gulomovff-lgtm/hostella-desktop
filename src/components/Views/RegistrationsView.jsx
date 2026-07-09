import React, { useState, useMemo } from 'react';
import {
    ClipboardCheck, Search, CheckCircle2,
    Trash2, RefreshCw, Plus, X,
    UserX, Plane, ChevronLeft, ChevronRight,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COUNTRY_FLAGS = {
    "Узбекистан": "UZ", "Россия": "RU", "Казахстан": "KZ", "Таджикистан": "TJ",
    "Кыргызстан": "KG", "Туркмения": "TM", "Германия": "DE", "США": "US",
    "Великобритания": "GB", "Китай": "CN", "Индия": "IN", "Турция": "TR",
    "Украина": "UA", "Белоруссия": "BY", "Азербайджан": "AZ", "Армения": "AM",
    "Грузия": "GE", "Монголия": "MN", "Афганистан": "AF", "Иран": "IR",
};

const Flag = ({ country, size = 20 }) => {
    const code = COUNTRY_FLAGS[country];
    if (!code) return null;
    return <span className={`fi fi-${code.toLowerCase()}`} style={{ width: size, height: Math.round(size * 0.75), display: 'inline-block', objectFit: 'cover', borderRadius: 3, verticalAlign: 'middle', flexShrink: 0, backgroundSize: 'cover' }} />;
};

const getRegStatus = (reg) => {
    if (reg.status === 'removed') return 'removed';
    const now = Date.now();
    const end = new Date(reg.endDate + 'T23:59:59').getTime();
    const daysLeft = Math.ceil((end - now) / 86400000);
    if (daysLeft < 0) return 'expired';
    if (daysLeft <= 3) return 'expiring';
    return 'active';
};

const getDaysLeft = (endDate) => {
    const end = new Date(endDate + 'T00:00:00').getTime();
    return Math.ceil((end - Date.now()) / 86400000);
};

// ─── ExtendModal ─────────────────────────────────────────────────────────────
const ExtendModal = ({ reg, onClose, onSubmit, lang }) => {
    const [days, setDays] = useState('30');
    const [paidCash, setPaidCash] = useState('');
    const [paidCard, setPaidCard] = useState('');
    const [paidQR, setPaidQR] = useState('');

    const newEndDate = (() => {
        try {
            const d = new Date(reg.endDate + 'T12:00:00');
            d.setDate(d.getDate() + parseInt(days || 0));
            return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        } catch { return ''; }
    })();

    const total = (Number(paidCash) || 0) + (Number(paidCard) || 0) + (Number(paidQR) || 0);

    const inp = "w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-base focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-semibold";

    return (
        <div className="modal-centered fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 pb-[84px] sm:pb-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-black text-lg text-slate-800">
                        🔄 {lang === 'ru' ? 'Продление' : 'Uzaytirish'}
                    </h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><X size={16} /></button>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600">
                    <p className="font-bold text-slate-800 text-base">{reg.fullName}</p>
                    <p className="text-sm mt-0.5">{lang === 'ru' ? 'Действует до:' : 'Muddati:'} <span className="font-bold text-rose-600">{reg.endDate}</span></p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">
                            {lang === 'ru' ? 'На сколько дней' : 'Necha kun'}
                        </label>
                        <input type="number" className={inp} value={days} min="1" onChange={e => setDays(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">
                            {lang === 'ru' ? 'Будет до' : 'Yangi muddat'}
                        </label>
                        <div className="px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-base font-bold text-emerald-700">{newEndDate || '—'}</div>
                    </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-bold text-slate-500">{lang === 'ru' ? 'Оплата' : 'To\'lov'}</p>
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="text-xs text-slate-500 font-bold block mb-1">Нал.</label>
                            <input type="number" className={inp} value={paidCash} onChange={e => setPaidCash(e.target.value)} placeholder="0" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 font-bold block mb-1">Терм.</label>
                            <input type="number" className={inp} value={paidCard} onChange={e => setPaidCard(e.target.value)} placeholder="0" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 font-bold block mb-1">QR</label>
                            <input type="number" className={inp} value={paidQR} onChange={e => setPaidQR(e.target.value)} placeholder="0" />
                        </div>
                    </div>
                    {total > 0 && (
                        <p className="text-base font-black text-emerald-600">
                            {lang === 'ru' ? 'Итого:' : 'Jami:'} {total.toLocaleString()} сум
                        </p>
                    )}
                </div>
                <div className="flex gap-2 pt-1">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-base font-bold text-slate-600 hover:bg-slate-50">
                        {lang === 'ru' ? 'Отмена' : 'Bekor'}
                    </button>
                    <button
                        onClick={() => onSubmit({ days: parseInt(days), newEndDate, paidCash: Number(paidCash) || 0, paidCard: Number(paidCard) || 0, paidQR: Number(paidQR) || 0, amount: total })}
                        className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-base font-bold hover:bg-indigo-700 flex items-center justify-center gap-1.5"
                    >
                        <RefreshCw size={16} /> {lang === 'ru' ? 'Продлить' : 'Uzaytirish'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Большая кнопка действия (для кассиров: крупно, с текстом) ───────────────
const BigBtn = ({ onClick, color, children, disabled }) => {
    const colors = {
        rose:   'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-200',
        indigo: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-200',
        amber:  'bg-amber-500 hover:bg-amber-400 text-white shadow-amber-200',
        gray:   'bg-slate-100 hover:bg-slate-200 text-slate-600',
    };
    return (
        <button onClick={onClick} disabled={disabled}
            className={`shrink-0 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-black shadow-sm transition-all active:scale-95 disabled:opacity-50 ${colors[color]}`}>
            {children}
        </button>
    );
};

// ─── Строка человека: крупное имя + понятная инфа + одна-две больших кнопки ──
const PersonRow = ({ flag, name, line2, line3, actions, tone = 'white' }) => {
    const tones = {
        white:   'bg-white border-slate-200',
        rose:    'bg-rose-50/60 border-rose-200',
        amber:   'bg-amber-50/60 border-amber-200',
        emerald: 'bg-emerald-50/40 border-emerald-200',
    };
    return (
        <div className={`flex items-center gap-3 border rounded-2xl px-4 py-3 shadow-sm ${tones[tone]}`}>
            <div className="shrink-0">{flag}</div>
            <div className="flex-1 min-w-0">
                <p className="text-[15px] font-black text-slate-800 truncate">{name}</p>
                {line2 && <p className="text-sm text-slate-500 truncate mt-0.5">{line2}</p>}
                {line3 && <p className="text-sm font-semibold truncate mt-0.5">{line3}</p>}
            </div>
            <div className="shrink-0 flex items-center gap-2">{actions}</div>
        </div>
    );
};

// ─── Заголовок группы внутри экрана ──────────────────────────────────────────
const GroupTitle = ({ emoji, children }) => (
    <p className="text-sm font-black text-slate-500 mt-5 mb-2 first:mt-0">{emoji} {children}</p>
);

// ─── Пустой экран ─────────────────────────────────────────────────────────────
const AllDone = ({ text }) => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="text-6xl mb-4">✅</span>
        <p className="text-lg font-black text-slate-700">{text || 'Всё сделано!'}</p>
        <p className="text-sm text-slate-400 mt-1">Здесь пока пусто</p>
    </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
const RegistrationsView = ({
    registrations = [],
    guests = [],
    cadastreRegs = [],
    emehmonList = [],
    emehmonHostelId = '',
    emehmonDepartingIds = null,
    currentUser,
    lang,
    onRemove,
    onExtend,
    onDelete,
    onOpenRegister,
    onSyncEmehmon,
    emehmonSyncing = false,
    onRegisterEmehmon,
    onDepartEmehmon,
    users = [],
}) => {
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super';
    const canEmehmon = !!window.electronAPI?.openEmehmon;
    const isDeparting = (g) => emehmonDepartingIds && typeof emehmonDepartingIds.has === 'function' && g.id && emehmonDepartingIds.has(g.id);

    const [screen, setScreen] = useState('home'); // home | remove | register | expiring | all | ok
    const [search, setSearch] = useState('');
    const [extendModal, setExtendModal] = useState(null);

    // ── Данные ──
    const normP = s => (s || '').replace(/\s/g, '').toUpperCase();
    const hasCadastre = (g) => cadastreRegs.some(r =>
        r.status !== 'removed' &&
        (r.guestId === g.id || (r.passport && g.passport && normP(r.passport) === normP(g.passport))));

    const enriched = useMemo(() => registrations.map(r => {
        const staff = users.find(u => u.id === r.staffId || u.login === r.staffId);
        return { ...r, computedStatus: getRegStatus(r), staffName: staff?.name || r.staffId };
    }), [registrations, users]);

    const expiredRegs  = useMemo(() => enriched.filter(r => r.computedStatus === 'expired'), [enriched]);
    const expiringRegs = useMemo(() => enriched.filter(r => r.computedStatus === 'expiring'), [enriched]);

    const residents = useMemo(() => guests.filter(g => g.status === 'active'), [guests]);
    const registered = useMemo(() => residents.filter(g => g.emehmonReg), [residents]);
    // Нужно оформить: активные, без e-mehmon и без кадастра (кадастр = уже зарегистрирован по-другому)
    const needRegister = useMemo(() => residents.filter(g => !g.emehmonReg && !hasCadastre(g)), [residents, cadastreRegs]); // eslint-disable-line
    const inCadastre = useMemo(() => residents.filter(g => !g.emehmonReg && hasCadastre(g)), [residents, cadastreRegs]); // eslint-disable-line

    const departedNotRemoved = useMemo(
        () => guests.filter(g => g.status === 'checked_out' && g.emehmonReg && !g.emehmonOut),
        [guests]);

    const orphans = useMemo(() => {
        const pset = new Set(), nset = new Set();
        guests.forEach(g => { if (g.passport) pset.add(normP(g.passport)); if (g.fullName) nset.add(normP(g.fullName)); });
        return (emehmonList || [])
            .filter(r => !((r.passport && pset.has(r.passport)) || (r.name && nset.has(r.name))))
            .map(r => ({
                passport: r.passport, fullName: r.displayName || r.name, country: r.country,
                roomNumber: r.room, days: r.days, hostelId: emehmonHostelId, _orphan: true,
            }));
    }, [emehmonList, guests, emehmonHostelId]);

    const removeCount = departedNotRemoved.length + orphans.length + expiredRegs.length;

    // ── Поиск по всем регистрациям ──
    const searched = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return enriched;
        return enriched.filter(r =>
            r.fullName?.toLowerCase().includes(q) ||
            r.passport?.toLowerCase().includes(q) ||
            r.phone?.includes(q));
    }, [enriched, search]);

    const handleExtendSubmit = (extData) => {
        if (extendModal) { onExtend(extendModal, extData); setExtendModal(null); }
    };

    // ── Кнопки-действия для строк ──
    const departBtn = (g) => canEmehmon && (
        <BigBtn color="rose" onClick={() => onDepartEmehmon?.(g)} disabled={isDeparting(g)}>
            <Plane size={16} className={isDeparting(g) ? 'animate-pulse' : ''} />
            {isDeparting(g) ? 'Вывожу…' : 'Вывести'}
        </BigBtn>
    );

    const regRowInfo = (r) => {
        const dl = getDaysLeft(r.endDate);
        const status = r.computedStatus;
        const when = status === 'expired' ? `❗ Истекла ${Math.abs(dl)} дн. назад`
            : status === 'expiring' ? (dl === 0 ? '⏰ Сегодня последний день' : `⏰ Осталось ${dl} дн.`)
            : status === 'removed' ? '✓ Выведен'
            : `До ${r.endDate}`;
        const cls = status === 'expired' ? 'text-rose-600' : status === 'expiring' ? 'text-amber-600' : status === 'removed' ? 'text-slate-400' : 'text-emerald-600';
        return <span className={cls}>{when}</span>;
    };

    // ── Плитка задачи на главном экране ──
    const TaskTile = ({ emoji, count, title, hint, color, target, disabled }) => {
        const colors = {
            rose:    { ring: 'border-rose-200 hover:border-rose-400', num: 'text-rose-600', badge: 'bg-rose-500' },
            amber:   { ring: 'border-amber-200 hover:border-amber-400', num: 'text-amber-600', badge: 'bg-amber-500' },
            indigo:  { ring: 'border-indigo-200 hover:border-indigo-400', num: 'text-indigo-600', badge: 'bg-indigo-500' },
            emerald: { ring: 'border-emerald-200 hover:border-emerald-400', num: 'text-emerald-600', badge: 'bg-emerald-500' },
        }[color];
        return (
            <button onClick={() => !disabled && setScreen(target)} disabled={disabled}
                className={`relative bg-white border-2 rounded-3xl p-5 text-left shadow-sm transition-all duration-200 active:scale-[0.98]
                    ${disabled ? 'opacity-60 cursor-default border-slate-200' : `${colors.ring} hover:shadow-lg hover:-translate-y-0.5 cursor-pointer`}`}>
                <div className="flex items-start justify-between">
                    <span className="text-4xl">{emoji}</span>
                    <span className={`text-4xl font-black ${count > 0 ? colors.num : 'text-slate-300'}`}>{count}</span>
                </div>
                <p className="text-base font-black text-slate-800 mt-3 leading-tight">{title}</p>
                <p className="text-sm text-slate-400 mt-1 leading-snug">{hint}</p>
                {!disabled && (
                    <span className="absolute bottom-4 right-4 text-slate-300"><ChevronRight size={20} /></span>
                )}
            </button>
        );
    };

    // ── Шапка внутреннего экрана с большой кнопкой «Назад» ──
    const ScreenHeader = ({ title, emoji }) => (
        <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setScreen('home')}
                className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-white border-2 border-slate-200 hover:border-slate-400 text-slate-600 text-sm font-black shadow-sm transition-all active:scale-95">
                <ChevronLeft size={18} /> Назад
            </button>
            <h2 className="text-xl font-black text-slate-800">{emoji} {title}</h2>
        </div>
    );

    const guestLine = (g) => [g.roomNumber ? `Комната ${g.roomNumber}` : '', g.passport || ''].filter(Boolean).join(' · ');

    return (
        <div className="min-h-full bg-slate-50">
            <div className="max-w-3xl mx-auto px-4 py-5">

                {/* ═══ ГЛАВНЫЙ ЭКРАН ═══ */}
                {screen === 'home' && (
                    <>
                        {/* Заголовок + главные кнопки */}
                        <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
                            <div className="flex items-center gap-3">
                                <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-200">
                                    <ClipboardCheck size={22} className="text-white" />
                                </span>
                                <div>
                                    <h1 className="text-xl font-black text-slate-800">E-mehmon</h1>
                                    <p className="text-sm text-slate-400">Регистрация гостей</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {onSyncEmehmon && (
                                    <button onClick={onSyncEmehmon} disabled={emehmonSyncing}
                                        className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white border-2 border-slate-200 hover:border-indigo-300 text-slate-600 text-sm font-black shadow-sm transition-all active:scale-95 disabled:opacity-50">
                                        <RefreshCw size={16} className={emehmonSyncing ? 'animate-spin' : ''} />
                                        {emehmonSyncing ? 'Проверяю…' : 'Обновить'}
                                    </button>
                                )}
                                <button onClick={onOpenRegister}
                                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black shadow-md shadow-indigo-200 transition-all active:scale-95">
                                    <Plus size={18} /> Зарегистрировать
                                </button>
                            </div>
                        </div>

                        {/* Плитки задач */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <TaskTile emoji="✈️" count={removeCount} color="rose" target="remove"
                                title="Вывести из E-mehmon"
                                hint={removeCount > 0 ? 'Выселились или истёк срок — нажмите и выведите' : 'Никого выводить не нужно'}
                                disabled={removeCount === 0} />
                            <TaskTile emoji="📝" count={needRegister.length} color="indigo" target="register"
                                title="Оформить регистрацию"
                                hint={needRegister.length > 0 ? 'Проживают, но не зарегистрированы' : 'Все проживающие оформлены'}
                                disabled={needRegister.length === 0} />
                            <TaskTile emoji="⏰" count={expiringRegs.length} color="amber" target="expiring"
                                title="Скоро истекают"
                                hint={expiringRegs.length > 0 ? 'Продлите или выведите заранее' : 'Ничего не истекает'}
                                disabled={expiringRegs.length === 0} />
                            <TaskTile emoji="✅" count={registered.length + inCadastre.length} color="emerald" target="ok"
                                title="Всё в порядке"
                                hint="Зарегистрированы и проживают"
                                disabled={registered.length + inCadastre.length === 0} />
                        </div>

                        {/* Поиск по всем регистрациям */}
                        <div className="mt-6">
                            <div className="relative">
                                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-base font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none shadow-sm"
                                    placeholder="Найти гостя по имени или паспорту…"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                                {search && (
                                    <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={18} /></button>
                                )}
                            </div>

                            {/* Результаты поиска сразу под полем */}
                            {search.trim() && (
                                <div className="mt-3 space-y-2">
                                    {searched.length === 0 && <p className="text-center text-slate-400 text-sm py-6">Никого не нашли 🤷</p>}
                                    {searched.slice(0, 10).map(r => (
                                        <PersonRow key={r.id}
                                            flag={<Flag country={r.country} />}
                                            name={r.fullName}
                                            line2={`${r.passport || ''} · ${r.startDate} → ${r.endDate}`}
                                            line3={regRowInfo(r)}
                                            actions={<>
                                                {r.computedStatus !== 'removed' && (
                                                    <BigBtn color="indigo" onClick={() => setExtendModal(r)}><RefreshCw size={15} /> Продлить</BigBtn>
                                                )}
                                                {(r.computedStatus === 'expired' || r.computedStatus === 'expiring') && (
                                                    <BigBtn color="rose" onClick={() => onRemove(r)}><UserX size={15} /> Вывести</BigBtn>
                                                )}
                                            </>} />
                                    ))}
                                </div>
                            )}

                            {!search.trim() && (
                                <button onClick={() => setScreen('all')}
                                    className="mt-3 w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white border-2 border-slate-200 hover:border-slate-400 text-slate-700 shadow-sm transition-all active:scale-[0.99]">
                                    <span className="text-base font-black">📋 Все регистрации</span>
                                    <span className="flex items-center gap-2 text-sm text-slate-400 font-bold">{enriched.length} <ChevronRight size={18} /></span>
                                </button>
                            )}
                        </div>
                    </>
                )}

                {/* ═══ ЭКРАН: ВЫВЕСТИ ═══ */}
                {screen === 'remove' && (
                    <>
                        <ScreenHeader emoji="✈️" title="Вывести из E-mehmon" />
                        {removeCount === 0 ? <AllDone text="Никого выводить не нужно" /> : (
                            <>
                                {/* Массовый вывод одним нажатием */}
                                {canEmehmon && (departedNotRemoved.length + orphans.length) > 1 && (
                                    <button
                                        onClick={() => onDepartEmehmon?.([...departedNotRemoved, ...orphans])}
                                        className="w-full mb-4 flex items-center justify-center gap-2 py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-base font-black shadow-md shadow-rose-200 transition-all active:scale-[0.99]">
                                        <Plane size={20} /> Вывести всех сразу ({departedNotRemoved.length + orphans.length})
                                    </button>
                                )}

                                {departedNotRemoved.length > 0 && (
                                    <>
                                        <GroupTitle emoji="🏠">Выселились из хостела — выведите их</GroupTitle>
                                        <div className="space-y-2">
                                            {departedNotRemoved.map(g => (
                                                <PersonRow key={g.id} tone="rose"
                                                    flag={<Flag country={g.country} />}
                                                    name={g.fullName}
                                                    line2={guestLine(g)}
                                                    actions={departBtn(g)} />
                                            ))}
                                        </div>
                                    </>
                                )}

                                {expiredRegs.length > 0 && (
                                    <>
                                        <GroupTitle emoji="❗">Истёк срок регистрации</GroupTitle>
                                        <div className="space-y-2">
                                            {expiredRegs.map(r => (
                                                <PersonRow key={r.id} tone="rose"
                                                    flag={<Flag country={r.country} />}
                                                    name={r.fullName}
                                                    line2={`${r.passport || ''} · до ${r.endDate}`}
                                                    line3={regRowInfo(r)}
                                                    actions={<>
                                                        <BigBtn color="indigo" onClick={() => setExtendModal(r)}><RefreshCw size={15} /> Продлить</BigBtn>
                                                        <BigBtn color="rose" onClick={() => onRemove(r)}><UserX size={15} /> Вывести</BigBtn>
                                                    </>} />
                                            ))}
                                        </div>
                                    </>
                                )}

                                {orphans.length > 0 && (
                                    <>
                                        <GroupTitle emoji="❓">Есть в E-mehmon, но нет в программе</GroupTitle>
                                        <div className="space-y-2">
                                            {orphans.map((g, i) => (
                                                <PersonRow key={g.passport || i}
                                                    flag={<Flag country={g.country} />}
                                                    name={g.fullName}
                                                    line2={guestLine(g)}
                                                    actions={departBtn(g)} />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </>
                )}

                {/* ═══ ЭКРАН: ОФОРМИТЬ ═══ */}
                {screen === 'register' && (
                    <>
                        <ScreenHeader emoji="📝" title="Оформить регистрацию" />
                        <p className="text-sm text-slate-400 -mt-1 mb-3">Местных система регистрирует сама (проверка каждые 5 минут). Здесь остаются иностранцы и гости с ошибками в данных.</p>
                        {needRegister.length === 0 ? <AllDone text="Все проживающие оформлены" /> : (
                            <div className="space-y-2">
                                {needRegister.map(g => (
                                    <PersonRow key={g.id}
                                        tone={g.emehmonRegError ? 'rose' : 'white'}
                                        flag={<Flag country={g.country} />}
                                        name={g.fullName}
                                        line2={guestLine(g)}
                                        line3={g.emehmonRegError ? <span className="text-rose-600">⚠️ {g.emehmonRegError}</span> : null}
                                        actions={canEmehmon && onRegisterEmehmon && (
                                            <BigBtn color="indigo" onClick={() => onRegisterEmehmon(g)}>
                                                <Plus size={16} /> Оформить
                                            </BigBtn>
                                        )} />
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* ═══ ЭКРАН: СКОРО ИСТЕКАЮТ ═══ */}
                {screen === 'expiring' && (
                    <>
                        <ScreenHeader emoji="⏰" title="Скоро истекают" />
                        {expiringRegs.length === 0 ? <AllDone text="Ничего не истекает" /> : (
                            <div className="space-y-2">
                                {expiringRegs.map(r => (
                                    <PersonRow key={r.id} tone="amber"
                                        flag={<Flag country={r.country} />}
                                        name={r.fullName}
                                        line2={`${r.passport || ''} · до ${r.endDate}`}
                                        line3={regRowInfo(r)}
                                        actions={<>
                                            <BigBtn color="indigo" onClick={() => setExtendModal(r)}><RefreshCw size={15} /> Продлить</BigBtn>
                                            <BigBtn color="rose" onClick={() => onRemove(r)}><UserX size={15} /> Вывести</BigBtn>
                                        </>} />
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* ═══ ЭКРАН: ВСЁ В ПОРЯДКЕ ═══ */}
                {screen === 'ok' && (
                    <>
                        <ScreenHeader emoji="✅" title="Всё в порядке" />
                        {registered.length > 0 && (
                            <>
                                <GroupTitle emoji="🌐">Зарегистрированы в E-mehmon</GroupTitle>
                                <div className="space-y-2">
                                    {registered.map(g => (
                                        <PersonRow key={g.id} tone="emerald"
                                            flag={<Flag country={g.country} />}
                                            name={g.fullName}
                                            line2={guestLine(g)}
                                            actions={<CheckCircle2 size={22} className="text-emerald-500" />} />
                                    ))}
                                </div>
                            </>
                        )}
                        {inCadastre.length > 0 && (
                            <>
                                <GroupTitle emoji="🏠">Зарегистрированы по кадастру</GroupTitle>
                                <div className="space-y-2">
                                    {inCadastre.map(g => (
                                        <PersonRow key={g.id} tone="emerald"
                                            flag={<Flag country={g.country} />}
                                            name={g.fullName}
                                            line2={guestLine(g)}
                                            actions={<span className="text-sm font-black text-indigo-600">🏠 кадастр</span>} />
                                    ))}
                                </div>
                            </>
                        )}
                        {registered.length + inCadastre.length === 0 && <AllDone text="Пока никого нет" />}
                    </>
                )}

                {/* ═══ ЭКРАН: ВСЕ РЕГИСТРАЦИИ ═══ */}
                {screen === 'all' && (
                    <>
                        <ScreenHeader emoji="📋" title="Все регистрации" />
                        <div className="relative mb-3">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-200 rounded-2xl text-base font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none shadow-sm"
                                placeholder="Найти…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        {searched.length === 0 ? <AllDone text="Регистраций нет" /> : (
                            <div className="space-y-2">
                                {searched.map(r => (
                                    <PersonRow key={r.id}
                                        tone={r.computedStatus === 'expired' ? 'rose' : r.computedStatus === 'expiring' ? 'amber' : 'white'}
                                        flag={<Flag country={r.country} />}
                                        name={r.fullName}
                                        line2={`${r.passport || ''} · ${r.startDate} → ${r.endDate} · ${(r.amount || 0).toLocaleString()} сум${r.staffName ? ` · ${r.staffName}` : ''}`}
                                        line3={regRowInfo(r)}
                                        actions={<>
                                            {r.computedStatus !== 'removed' && (
                                                <BigBtn color="indigo" onClick={() => setExtendModal(r)}><RefreshCw size={15} /> Продлить</BigBtn>
                                            )}
                                            {(r.computedStatus === 'expired' || r.computedStatus === 'expiring') && (
                                                <BigBtn color="rose" onClick={() => onRemove(r)}><UserX size={15} /> Вывести</BigBtn>
                                            )}
                                            {isAdmin && (
                                                <button onClick={() => onDelete(r)} title="Удалить запись"
                                                    className="p-3 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all active:scale-95">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </>} />
                                ))}
                            </div>
                        )}
                    </>
                )}

            </div>

            {/* Продление */}
            {extendModal && (
                <ExtendModal reg={extendModal} lang={lang}
                    onClose={() => setExtendModal(null)} onSubmit={handleExtendSubmit} />
            )}
        </div>
    );
};

export default RegistrationsView;
