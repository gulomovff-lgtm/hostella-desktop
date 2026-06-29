import React, { useState, useMemo } from 'react';
import {
    ClipboardCheck, Search, AlertTriangle, CheckCircle2, Clock,
    Trash2, RefreshCw, Plus, Calendar, Wallet, User, Phone,
    FileText, ChevronDown, ChevronUp, X, Download,
    AlertCircle, UserX, CheckSquare, Eye, Plane
} from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COUNTRY_FLAGS = {
    "Узбекистан": "UZ", "Россия": "RU", "Казахстан": "KZ", "Таджикистан": "TJ",
    "Кыргызстан": "KG", "Туркмения": "TM", "Германия": "DE", "США": "US",
    "Великобритания": "GB", "Китай": "CN", "Индия": "IN", "Турция": "TR",
    "Украина": "UA", "Белоруссия": "BY", "Азербайджан": "AZ", "Армения": "AM",
    "Грузия": "GE", "Монголия": "MN", "Афганистан": "AF", "Иран": "IR",
};

const Flag = ({ country, size = 18 }) => {
    const code = COUNTRY_FLAGS[country];
    if (!code) return null;
    return <span className={`fi fi-${code.toLowerCase()}`} style={{ width: size, height: Math.round(size * 0.75), display: 'inline-block', objectFit: 'cover', borderRadius: 2, verticalAlign: 'middle', flexShrink: 0, backgroundSize: 'cover' }} />;
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

const STATUS_CFG = {
    active:   { label: 'Активна',        bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
    expiring: { label: 'Истекает',        bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500'   },
    expired:  { label: 'Истекла',         bg: 'bg-rose-100',    text: 'text-rose-700',    border: 'border-rose-200',    dot: 'bg-rose-500'    },
    removed:  { label: 'Выведен из E-mehmona', bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200', dot: 'bg-slate-400'  },
};

// ─── ExtendModal (inline) ────────────────────────────────────────────────────
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

    const inp = "w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium";

    return (
        <div className="modal-centered fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 pb-[84px] sm:pb-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-black text-base text-slate-800">
                        🔄 {lang === 'ru' ? 'Продление регистрации' : 'Ro\'yxatni uzaytirish'}
                    </h3>
                    <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><X size={14} /></button>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600">
                    <p className="font-bold text-slate-800">{reg.fullName}</p>
                    <p className="text-xs">{lang === 'ru' ? 'Текущий конец:' : 'Joriy tugash:'} <span className="font-semibold text-rose-600">{reg.endDate}</span></p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wide">
                            {lang === 'ru' ? 'Продлить на дней' : 'Kun uzaytirish'}
                        </label>
                        <input type="number" className={inp} value={days} min="1" onChange={e => setDays(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wide">
                            {lang === 'ru' ? 'Новый конец' : 'Yangi tugash'}
                        </label>
                        <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-bold text-emerald-700">{newEndDate || '—'}</div>
                    </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{lang === 'ru' ? 'Оплата' : 'To\'lov'}</p>
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Нал.</label>
                            <input type="number" className={inp} value={paidCash} onChange={e => setPaidCash(e.target.value)} placeholder="0" />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Терм.</label>
                            <input type="number" className={inp} value={paidCard} onChange={e => setPaidCard(e.target.value)} placeholder="0" />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">QR</label>
                            <input type="number" className={inp} value={paidQR} onChange={e => setPaidQR(e.target.value)} placeholder="0" />
                        </div>
                    </div>
                    {total > 0 && (
                        <p className="text-sm font-black text-emerald-600">
                            {lang === 'ru' ? 'Итого:' : 'Jami:'} {total.toLocaleString()} сум
                        </p>
                    )}
                </div>
                <div className="flex gap-2 pt-1">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                        {lang === 'ru' ? 'Отмена' : 'Bekor'}
                    </button>
                    <button
                        onClick={() => onSubmit({ days: parseInt(days), newEndDate, paidCash: Number(paidCash) || 0, paidCard: Number(paidCard) || 0, paidQR: Number(paidQR) || 0, amount: total })}
                        className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 flex items-center justify-center gap-1"
                    >
                        <RefreshCw size={14} /> {lang === 'ru' ? 'Продлить' : 'Uzaytirish'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Registration Card ────────────────────────────────────────────────────────
const RegCard = ({ reg, currentUser, lang, onRemove, onExtend, onDelete }) => {
    const status = getRegStatus(reg);
    const cfg = STATUS_CFG[status];
    const daysLeft = getDaysLeft(reg.endDate);
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super';

    const daysLeftLabel = () => {
        if (status === 'removed') return lang === 'ru' ? 'Выведен из системы' : 'Tizimdan chiqarildi';
        if (daysLeft < 0) return lang === 'ru' ? `${Math.abs(daysLeft)} дн. назад истекла` : `${Math.abs(daysLeft)} kun oldin tugadi`;
        if (daysLeft === 0) return lang === 'ru' ? 'Последний день' : 'Oxirgi kun';
        return lang === 'ru' ? `Осталось ${daysLeft} дн.` : `${daysLeft} kun qoldi`;
    };

    return (
        <div className={`bg-white rounded-xl border ${cfg.border} shadow-sm overflow-hidden transition-all hover:shadow-md`}>
            {/* Color header strip */}
            <div className={`${cfg.bg} px-4 py-2 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <span className={`text-xs font-bold ${cfg.text}`}>{cfg.label}</span>
                    {(status === 'expired' || status === 'expiring') && (
                        <span className={`text-xs font-bold ${cfg.text}`}>— {daysLeftLabel()}</span>
                    )}
                    {status === 'active' && (
                        <span className="text-xs text-slate-500">— {daysLeftLabel()}</span>
                    )}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">
                    {new Date(reg.createdAt).toLocaleDateString('ru')}
                </span>
            </div>

            {/* Body */}
            <div className="px-4 py-3 flex flex-col gap-2">
                {/* Name row */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <Flag country={reg.country} size={16} />
                            <p className="font-black text-sm text-slate-800 truncate">{reg.fullName}</p>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                            <p className="text-xs text-slate-400 font-mono">{reg.passport}</p>
                            {reg.country && <p className="text-xs text-slate-400">{reg.country}</p>}
                            {reg.phone && <p className="text-xs text-slate-400">{reg.phone}</p>}
                        </div>
                    </div>
                    {/* Amount */}
                    <div className="text-right shrink-0">
                        <p className="text-sm font-black text-emerald-600">{(reg.amount || 0).toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400">сум</p>
                    </div>
                </div>

                {/* Period row */}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar size={12} />
                    <span className="font-medium">{reg.startDate}</span>
                    <span>→</span>
                    <span className={`font-bold ${daysLeft < 0 ? 'text-rose-600' : daysLeft <= 3 ? 'text-amber-600' : 'text-slate-700'}`}>
                        {reg.endDate}
                    </span>
                    <span className="text-slate-400">({reg.days} дн.)</span>
                </div>

                {/* Payment breakdown */}
                {(reg.paidCash > 0 || reg.paidCard > 0 || reg.paidQR > 0) && (
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        {reg.paidCash > 0 && <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">Нал: {reg.paidCash.toLocaleString()}</span>}
                        {reg.paidCard > 0 && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold">Терм: {reg.paidCard.toLocaleString()}</span>}
                        {reg.paidQR > 0 && <span className="bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded font-semibold">QR: {reg.paidQR.toLocaleString()}</span>}
                    </div>
                )}

                {reg.note && (
                    <p className="text-xs text-slate-400 italic">{reg.note}</p>
                )}

                {/* Staff */}
                <p className="text-[10px] text-slate-400">
                    {lang === 'ru' ? 'Кассир:' : 'Kassir:'} {reg.staffName || reg.staffId || '—'}
                </p>
            </div>

            {/* Actions */}
            {status !== 'removed' && (
                <div className={`px-4 py-3 border-t ${cfg.border} flex gap-2`}>
                    {status === 'expired' && (
                        <button
                            onClick={() => onRemove(reg)}
                            className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                            <UserX size={13} />
                            {lang === 'ru' ? 'Вывести из E-mehmon' : 'E-mehmondan chiqarish'}
                        </button>
                    )}
                    {status === 'expiring' && (
                        <button
                            onClick={() => onRemove(reg)}
                            className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                            <AlertTriangle size={13} />
                            {lang === 'ru' ? 'Вывести из E-mehmon' : 'E-mehmondan chiqarish'}
                        </button>
                    )}
                    <button
                        onClick={() => onExtend(reg)}
                        className="flex-1 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center gap-1.5 border border-indigo-200 transition-colors"
                    >
                        <RefreshCw size={13} />
                        {lang === 'ru' ? 'Продлить' : 'Uzaytirish'}
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => onDelete(reg)}
                            className="w-9 py-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center border border-slate-200 transition-colors"
                        >
                            <Trash2 size={13} />
                        </button>
                    )}
                </div>
            )}

            {/* Removed state actions */}
            {status === 'removed' && isAdmin && (
                <div className={`px-4 py-3 border-t ${cfg.border}`}>
                    <button
                        onClick={() => onDelete(reg)}
                        className="w-full py-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-200 transition-colors"
                    >
                        <Trash2 size={13} /> {lang === 'ru' ? 'Удалить запись' : 'Yozuvni o\'chirish'}
                    </button>
                </div>
            )}
        </div>
    );
};

// ─── Статус проживающих в e-mehmon (информационная подвкладка) ────────────────
// Чисто справочно: кто из активных иностранцев есть/нет в регистрации e-mehmon
// и кто выселен, но ещё не выведен. Статус «есть» приходит из фоновой синхронизации
// (guest.emehmonReg авто-ставится). Кнопка «Обновить» дёргает синхронизацию вручную.
const EmehmonStatusPanel = ({ guests = [], cadastreRegs = [], lang, onSync, syncing, onRegister, onDepart }) => {
    const canEmehmon = !!window.electronAPI?.openEmehmon;
    const normP = s => (s || '').replace(/\s/g, '').toUpperCase();
    const hasCadastre = (g) => cadastreRegs.some(r =>
        r.status !== 'removed' &&
        (r.guestId === g.id || (r.passport && g.passport && normP(r.passport) === normP(g.passport))));
    const residents = useMemo(
        () => guests.filter(g => g.status === 'active'),
        [guests]);
    const registered = useMemo(() => residents.filter(g => g.emehmonReg), [residents]);
    const notRegistered = useMemo(() => residents.filter(g => !g.emehmonReg), [residents]);
    const departedNotRemoved = useMemo(
        () => guests.filter(g => g.status === 'checked_out' && g.emehmonReg && !g.emehmonOut),
        [guests]);

    const Row = ({ g, badge }) => (
        <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-100 px-3 py-2">
            <Flag country={g.country} size={16} />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{g.fullName}</p>
                <p className="text-[11px] text-slate-400">
                    {g.roomNumber ? `ком. ${g.roomNumber}` : ''}{g.passport ? ` · ${g.passport}` : ''}{g.country ? ` · ${g.country}` : ''}
                </p>
            </div>
            {badge}
        </div>
    );

    const Section = ({ title, color, icon: Icon, list, renderBadge, empty }) => (
        <div>
            <div className={`flex items-center gap-2 mb-2 text-sm font-black text-${color}-700`}>
                <Icon size={16} /> {title}
                <span className={`px-1.5 py-0.5 rounded-full text-[11px] bg-${color}-100`}>{list.length}</span>
            </div>
            {list.length === 0 ? (
                <p className="text-xs text-slate-400 italic px-1">{empty}</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {list.map(g => <Row key={g.id} g={g} badge={renderBadge ? renderBadge(g) : null} />)}
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Eye size={22} className="text-indigo-600" />
                        {lang === 'ru' ? 'Статус в e-mehmon' : 'e-mehmon holati'}
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === 'ru' ? 'Кто из проживающих есть в регистрации e-mehmon' : 'Yashayotganlardan kim e-mehmonda ro\'yxatda'}
                    </p>
                </div>
                {onSync && (
                    <button onClick={onSync} disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50">
                        <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? (lang === 'ru' ? 'Проверка…' : 'Tekshirilmoqda…') : (lang === 'ru' ? 'Обновить' : 'Yangilash')}
                    </button>
                )}
            </div>

            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: lang === 'ru' ? 'В регистрации' : 'Ro\'yxatda', value: registered.length, color: 'emerald' },
                    { label: lang === 'ru' ? 'Нет регистрации' : 'Ro\'yxatda yo\'q', value: notRegistered.length, color: 'amber' },
                    { label: lang === 'ru' ? 'Выселен, не выведен' : 'Chiqgan, chiqarilmagan', value: departedNotRemoved.length, color: 'rose' },
                ].map(({ label, value, color }) => (
                    <div key={label} className={`bg-white rounded-xl border border-${color}-200 p-3 ring-1 ring-${color}-100`}>
                        <p className={`text-2xl font-black text-${color}-600`}>{value}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            <Section
                title={lang === 'ru' ? 'Без регистрации e-mehmon' : 'e-mehmonsiz'}
                color="amber" icon={AlertCircle} list={notRegistered}
                empty={lang === 'ru' ? 'Все проживающие зарегистрированы' : 'Hammasi ro\'yxatda'}
                renderBadge={(g) => {
                    const cad = hasCadastre(g);
                    return (
                        <div className="flex items-center gap-1.5 shrink-0">
                            {cad
                                ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 flex items-center gap-1">🏠 {lang === 'ru' ? 'кадастр' : 'kadastr'}</span>
                                : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{lang === 'ru' ? 'нет' : 'yo\'q'}</span>}
                            {/* В кадастре — кнопку «Оформить» не показываем, пока он там */}
                            {!cad && canEmehmon && onRegister && (
                                <button onClick={() => onRegister(g)}
                                    className="text-[10px] font-bold px-2 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1">
                                    <Plus size={11} /> {lang === 'ru' ? 'Оформить' : 'Ro\'yxat'}
                                </button>
                            )}
                        </div>
                    );
                }}
            />
            <Section
                title={lang === 'ru' ? 'Выселены, но не выведены' : 'Chiqgan, lekin chiqarilmagan'}
                color="rose" icon={Plane} list={departedNotRemoved}
                empty={lang === 'ru' ? 'Нет «хвостов» по убытию' : 'Yo\'q'}
                renderBadge={(g) => (canEmehmon && onDepart)
                    ? <button onClick={() => onDepart(g)}
                        className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 flex items-center gap-1">
                        <Plane size={11} /> {lang === 'ru' ? 'Вывести' : 'Chiqarish'}
                      </button>
                    : <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">{lang === 'ru' ? 'вывести' : 'chiqarish'}</span>}
            />
            <Section
                title={lang === 'ru' ? 'В регистрации e-mehmon' : 'e-mehmonda ro\'yxatda'}
                color="emerald" icon={CheckCircle2} list={registered}
                empty={lang === 'ru' ? 'Пока никто не отмечен' : 'Hozircha yo\'q'}
                renderBadge={() => <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓</span>}
            />
        </div>
    );
};

// ─── Main View ────────────────────────────────────────────────────────────────
const RegistrationsView = ({
    registrations = [],
    guests = [],
    cadastreRegs = [],
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
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super';

    const [subView, setSubView] = useState('registrations'); // 'registrations' | 'status'
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [extendModal, setExtendModal] = useState(null);

    // Enrich registrations with status and staff name
    const enriched = useMemo(() => registrations.map(r => {
        const staff = users.find(u => u.id === r.staffId || u.login === r.staffId);
        return { ...r, computedStatus: getRegStatus(r), staffName: staff?.name || r.staffId };
    }), [registrations, users]);

    // Stats summary
    const stats = useMemo(() => ({
        total: enriched.length,
        active: enriched.filter(r => r.computedStatus === 'active').length,
        expiring: enriched.filter(r => r.computedStatus === 'expiring').length,
        expired: enriched.filter(r => r.computedStatus === 'expired').length,
        removed: enriched.filter(r => r.computedStatus === 'removed').length,
    }), [enriched]);

    const filtered = useMemo(() => {
        let list = enriched;
        if (activeFilter !== 'all') list = list.filter(r => r.computedStatus === activeFilter);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(r =>
                r.fullName?.toLowerCase().includes(q) ||
                r.passport?.toLowerCase().includes(q) ||
                r.phone?.includes(q) ||
                r.country?.toLowerCase().includes(q)
            );
        }
        // Sort: expired first, then expiring, then active, then removed
        const order = { expired: 0, expiring: 1, active: 2, removed: 3 };
        return [...list].sort((a, b) => (order[a.computedStatus] || 3) - (order[b.computedStatus] || 3));
    }, [enriched, activeFilter, search]);

    const handleExtendSubmit = (extData) => {
        if (extendModal) {
            onExtend(extendModal, extData);
            setExtendModal(null);
        }
    };

    // Alert section: expired registrations that need to be removed
    const needsRemoval = enriched.filter(r => r.computedStatus === 'expired');

    const filters = [
        { id: 'all',      label: lang === 'ru' ? 'Все' : 'Barchasi',         count: stats.total },
        { id: 'active',   label: lang === 'ru' ? 'Активные' : 'Faol',         count: stats.active },
        { id: 'expiring', label: lang === 'ru' ? 'Истекают' : 'Tugaydi',      count: stats.expiring },
        { id: 'expired',  label: lang === 'ru' ? 'Истекли' : 'Tugadi',        count: stats.expired },
        { id: 'removed',  label: lang === 'ru' ? 'Выведены' : 'Chiqarildi',   count: stats.removed },
    ];

    return (
        <div className="space-y-4">

            {/* ── Подвкладки: Регистрации | Статус проживающих ── */}
            <div className="flex gap-1.5">
                {[
                    { id: 'registrations', label: lang === 'ru' ? 'Регистрации' : 'Ro\'yxatlar' },
                    { id: 'status', label: lang === 'ru' ? 'Статус проживающих' : 'Yashayotganlar holati' },
                ].map(s => (
                    <button key={s.id} onClick={() => setSubView(s.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                            subView === s.id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}>
                        {s.label}
                    </button>
                ))}
            </div>

            {subView === 'status' ? (
                <EmehmonStatusPanel guests={guests} cadastreRegs={cadastreRegs} lang={lang} onSync={onSyncEmehmon} syncing={emehmonSyncing} onRegister={onRegisterEmehmon} onDepart={onDepartEmehmon} />
            ) : (
            <>
            {/* ── Top: header + add btn ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <ClipboardCheck size={22} className="text-indigo-600" />
                        {lang === 'ru' ? 'Регистрации (E-mehmon)' : 'Ro\'yxatga olish (E-mehmon)'}
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === 'ru' ? 'Учёт регистраций гостей в системе E-mehmon' : 'E-mehmon tizimida mehmonlarni ro\'yxatga olish hisobi'}
                    </p>
                </div>
                <button
                    onClick={onOpenRegister}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus size={16} /> {lang === 'ru' ? 'Зарегистрировать' : 'Ro\'yxatga olish'}
                </button>
            </div>

            {/* ── Alert: expired / needs removal ── */}
            {needsRemoval.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
                    <div className="mt-0.5 w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                        <AlertTriangle size={16} className="text-rose-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-rose-700">
                            {lang === 'ru'
                                ? `⚠️ ${needsRemoval.length} гостей нужно вывести из E-mehmon!`
                                : `⚠️ ${needsRemoval.length} mehmon E-mehmondan chiqarilishi kerak!`
                            }
                        </p>
                        <p className="text-xs text-rose-500 mt-0.5">
                            {needsRemoval.map(r => r.fullName).join(', ')}
                        </p>
                    </div>
                    <button
                        onClick={() => setActiveFilter('expired')}
                        className="shrink-0 px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition-colors"
                    >
                        {lang === 'ru' ? 'Показать' : 'Ko\'rsatish'}
                    </button>
                </div>
            )}

            {/* ── Stats cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: lang === 'ru' ? 'Всего' : 'Jami',          value: stats.total,    color: 'indigo' },
                    { label: lang === 'ru' ? 'Активных' : 'Faol',        value: stats.active,   color: 'emerald' },
                    { label: lang === 'ru' ? 'Истекают (≤3 дн.)' : 'Tugaydi (≤3 kun)', value: stats.expiring, color: 'amber' },
                    { label: lang === 'ru' ? 'Истекли (вывести!)' : 'Tugadi (chiqarish!)', value: stats.expired, color: 'rose' },
                ].map(({ label, value, color }) => (
                    <div key={label} className={`bg-white rounded-xl border border-${color}-200 p-3 ring-1 ring-${color}-100`}>
                        <p className={`text-2xl font-black text-${color}-600`}>{value}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {/* ── Filters + Search ── */}
            <div className="flex flex-wrap gap-2 items-center">
                <div className="flex flex-wrap gap-1.5">
                    {filters.map(f => (
                        <button
                            key={f.id}
                            onClick={() => setActiveFilter(f.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                                activeFilter === f.id
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {f.label}
                            {f.count > 0 && (
                                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                                    activeFilter === f.id
                                        ? 'bg-white/20 text-white'
                                        : f.id === 'expired' ? 'bg-rose-100 text-rose-700'
                                        : f.id === 'expiring' ? 'bg-amber-100 text-amber-700'
                                        : 'bg-slate-100 text-slate-500'
                                }`}>
                                    {f.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="flex-1 min-w-[200px] relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        placeholder={lang === 'ru' ? 'Поиск по ФИО, паспорту...' : 'FIO, pasport bo\'yicha qidirish...'}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* ── Cards grid ── */}
            {filtered.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                    <ClipboardCheck size={40} className="text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 font-semibold text-sm">
                        {search
                            ? (lang === 'ru' ? 'Нет результатов по запросу' : 'So\'rov bo\'yicha natija topilmadi')
                            : (lang === 'ru' ? 'Нет регистраций' : 'Ro\'yxatga olinganlar yo\'q')
                        }
                    </p>
                    {!search && (
                        <button
                            onClick={onOpenRegister}
                            className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors"
                        >
                            <Plus size={16} /> {lang === 'ru' ? 'Первая регистрация' : 'Birinchi ro\'yxat'}
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filtered.map(reg => (
                        <RegCard
                            key={reg.id}
                            reg={reg}
                            currentUser={currentUser}
                            lang={lang}
                            onRemove={(r) => onRemove(r)}
                            onExtend={(r) => setExtendModal(r)}
                            onDelete={(r) => onDelete(r)}
                        />
                    ))}
                </div>
            )}

            {/* ── Extend modal ── */}
            {extendModal && (
                <ExtendModal
                    reg={extendModal}
                    lang={lang}
                    onClose={() => setExtendModal(null)}
                    onSubmit={handleExtendSubmit}
                />
            )}
            </>
            )}
        </div>
    );
};

export default RegistrationsView;
