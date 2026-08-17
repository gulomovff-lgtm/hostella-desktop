import React, { useState, useMemo } from 'react';
import {
    ClipboardCheck, Search, CheckCircle2,
    Trash2, RefreshCw, Plus, X,
    UserX, Plane, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { isStaleSince, STALE_TASK_DAYS } from '../../utils/helpers';

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

// 'archived' — срок истёк больше STALE_TASK_DAYS назад: гость давно уехал,
// это уже не задача «вывести», а история. В счётчики и плитки не попадает,
// но остаётся в поиске и в списке «Все регистрации».
const getRegStatus = (reg) => {
    if (reg.status === 'removed') return 'removed';
    const now = Date.now();
    const end = new Date(reg.endDate + 'T23:59:59').getTime();
    const daysLeft = Math.ceil((end - now) / 86400000);
    if (daysLeft < 0) return isStaleSince(reg.endDate) ? 'archived' : 'expired';
    if (daysLeft <= 3) return 'expiring';
    return 'active';
};

const getDaysLeft = (endDate) => {
    const end = new Date(endDate + 'T00:00:00').getTime();
    return Math.ceil((end - Date.now()) / 86400000);
};

/** «только что» / «5 мин назад» / «в 14:30» — возраст снимка списка e-mehmon */
const minutesAgo = (ts) => {
    const min = Math.floor((Date.now() - ts) / 60000);
    if (min < 1) return 'только что';
    if (min < 60) return `${min} мин назад`;
    return `в ${new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
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
// onClick — открыть карточку гостя (как в «Номерах»); имя подсвечивается при наведении.
const PersonRow = ({ flag, name, line2, line3, actions, tone = 'white', onClick }) => {
    const tones = {
        white:   'bg-white border-slate-200',
        rose:    'bg-rose-50/60 border-rose-200',
        amber:   'bg-amber-50/60 border-amber-200',
        emerald: 'bg-emerald-50/40 border-emerald-200',
    };
    const Info = onClick ? 'button' : 'div';
    return (
        <div className={`flex items-center gap-3 border rounded-2xl px-4 py-3 shadow-sm transition-all ${tones[tone]} ${onClick ? 'hover:shadow-md hover:border-indigo-300' : ''}`}>
            <div className="shrink-0">{flag}</div>
            <Info onClick={onClick} className={`flex-1 min-w-0 text-left ${onClick ? 'cursor-pointer group' : ''}`} type={onClick ? 'button' : undefined}>
                <p className={`text-[15px] font-black text-slate-800 truncate ${onClick ? 'group-hover:text-indigo-700 transition-colors' : ''}`}>
                    {name}{onClick && <span className="ml-1.5 text-[11px] font-bold text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">открыть →</span>}
                </p>
                {line2 && <p className="text-sm text-slate-500 truncate mt-0.5">{line2}</p>}
                {line3 && <p className="text-sm font-semibold truncate mt-0.5">{line3}</p>}
            </Info>
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

// ─── Итог задекларированных в e-mehmon сумм (сверка с налоговой) ─────────────
// Считаем по гостям, у которых есть дата регистрации в e-mehmon. Сумма берётся
// из emehmonAmount (что реально указали в портале). У старых записей поля нет —
// тогда там стояла 1, показываем их отдельной строкой, чтобы итог был честным.
const TaxTotals = ({ guests = [] }) => {
    const [offset, setOffset] = useState(0); // 0 — текущий месяц, -1 — прошлый…
    const [open, setOpen] = useState(false);

    const period = useMemo(() => {
        const d = new Date();
        d.setDate(1); d.setHours(0, 0, 0, 0);
        d.setMonth(d.getMonth() + offset);
        const from = new Date(d);
        const to = new Date(d); to.setMonth(to.getMonth() + 1);
        return { from, to, label: from.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) };
    }, [offset]);

    const stats = useMemo(() => {
        const s = { local: 0, localSum: 0, foreign: 0, foreignSum: 0, legacy: 0, byHostel: {} };
        (guests || []).forEach(g => {
            if (!g.emehmonRegAt) return;
            const t = new Date(g.emehmonRegAt);
            if (!(t >= period.from && t < period.to)) return;
            const amt = Number(g.emehmonAmount);
            const isLocal = (g.country || '') === 'Узбекистан';
            if (!Number.isFinite(amt) || amt <= 1) { s.legacy++; return; }
            if (isLocal) { s.local++; s.localSum += amt; } else { s.foreign++; s.foreignSum += amt; }
            const h = g.hostelId || '—';
            s.byHostel[h] = (s.byHostel[h] || 0) + amt;
        });
        s.total = s.localSum + s.foreignSum;
        s.count = s.local + s.foreign;
        return s;
    }, [guests, period]);

    const fmt = n => Number(n || 0).toLocaleString('ru-RU');
    const hostelName = h => h === 'hostel1' ? 'Хостел №1' : h === 'hostel2' ? 'Хостел №2' : h;

    return (
        <div className="mt-4 bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
                <span className="text-2xl">🧾</span>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-black text-slate-800">Показано в e-mehmon за месяц</div>
                    <div className="text-xs text-slate-400">Сумма по всем регистрациям — для сверки с налоговой</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setOffset(o => o - 1)} title="Предыдущий месяц"
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronLeft size={16} /></button>
                    <span className="text-xs font-black text-slate-600 min-w-[110px] text-center capitalize">{period.label}</span>
                    <button onClick={() => setOffset(o => Math.min(0, o + 1))} disabled={offset >= 0} title="Следующий месяц"
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30"><ChevronRight size={16} /></button>
                </div>
                <div className="text-right shrink-0 pl-2 border-l-2 border-slate-100">
                    <div className="text-xl font-black text-emerald-600 tabular-nums">{fmt(stats.total)}</div>
                    <div className="text-[11px] font-bold text-slate-400">{stats.count} регистр.</div>
                </div>
                <button onClick={() => setOpen(o => !o)}
                    className="shrink-0 p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                    {open ? <ChevronLeft size={16} className="rotate-90" /> : <ChevronRight size={16} className="rotate-90" />}
                </button>
            </div>

            {open && (
                <div className="border-t border-slate-100 px-4 py-3 space-y-2 bg-slate-50/60">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">🇺🇿 Местные — <b>{stats.local}</b> чел.</span>
                        <span className="font-black text-slate-800 tabular-nums">{fmt(stats.localSum)} сум</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">🌍 Иностранцы — <b>{stats.foreign}</b> чел.</span>
                        <span className="font-black text-slate-800 tabular-nums">{fmt(stats.foreignSum)} сум</span>
                    </div>
                    {Object.keys(stats.byHostel).length > 1 && (
                        <div className="pt-2 border-t border-slate-200 space-y-1">
                            {Object.entries(stats.byHostel).map(([h, sum]) => (
                                <div key={h} className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500">{hostelName(h)}</span>
                                    <span className="font-bold text-slate-600 tabular-nums">{fmt(sum)} сум</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t-2 border-slate-200 text-base">
                        <span className="font-black text-slate-700">Итого за {period.label}</span>
                        <span className="font-black text-emerald-600 tabular-nums">{fmt(stats.total)} сум</span>
                    </div>
                    {stats.legacy > 0 && (
                        <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                            ⚠️ Ещё {stats.legacy} регистр. оформлены до перехода на новые ставки (в портале стояла сумма 1) — в итог не включены.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Турсбор: отчёт с портала e-mehmon (/tursborpays) ────────────────────────
// Портал считает сбор сам: гости × прожитые сутки × % от БРВ. Тянем готовые
// цифры по трём типам (иностранцы / местные / самостоятельные) за период.
const TURSBOR_TYPES = [
    { key: 'HT', label: 'Иностранцы',      emoji: '🌍', portalLabel: 'Туристический сбор с иностранных граждан' },
    { key: 'LT', label: 'Местные',         emoji: '🇺🇿', portalLabel: 'Туристический сбор с местных граждан' },
    { key: 'ST', label: 'Самост. туристы', emoji: '🎒', portalLabel: 'Самостоятельные туристы' },
];

// Периоды — те же пресеты, что в daterangepicker портала
const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
const TURSBOR_RANGES = [
    { key: 'prevMonth', label: 'За прошлый месяц', calc: () => { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth() - 1, 1), new Date(n.getFullYear(), n.getMonth(), 0)]; } },
    { key: 'thisMonth', label: 'В этом месяце',    calc: () => { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth(), 1), new Date(n.getFullYear(), n.getMonth() + 1, 0)]; } },
    { key: 'last30',    label: '30 дней ранее',    calc: () => { const n = new Date(); const f = new Date(n); f.setDate(f.getDate() - 29); return [f, n]; } },
    { key: 'last7',     label: '7 дней ранее',     calc: () => { const n = new Date(); const f = new Date(n); f.setDate(f.getDate() - 6); return [f, n]; } },
    { key: 'thisYear',  label: 'За текущий год',   calc: () => { const n = new Date(); return [new Date(n.getFullYear(), 0, 1), n]; } },
    { key: 'prevYear',  label: 'За прошедший год', calc: () => { const n = new Date(); return [new Date(n.getFullYear() - 1, 0, 1), new Date(n.getFullYear() - 1, 11, 31)]; } },
    { key: 'custom',    label: 'Другой период',    calc: null },
];

const TursborPanel = ({ hostelId }) => {
    const [rangeKey, setRangeKey] = useState('prevMonth'); // как на портале
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [typeKey, setTypeKey] = useState('all');         // фильтр «Тип» как на портале
    const [res, setRes] = useState(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    const period = useMemo(() => {
        if (rangeKey === 'custom') {
            if (!customFrom || !customTo) return { range: '', label: 'выберите даты' };
            return { range: `${customFrom} ~ ${customTo}`, label: `${customFrom} — ${customTo}` };
        }
        const preset = TURSBOR_RANGES.find(r => r.key === rangeKey) || TURSBOR_RANGES[0];
        const [from, to] = preset.calc();
        return { range: `${iso(from)} ~ ${iso(to)}`, label: preset.label };
    }, [rangeKey, customFrom, customTo]);

    const load = async () => {
        if (!window.electronAPI?.emehmonTursbor) return;
        if (!period.range) return;
        setLoading(true);
        try {
            const { fetchTursbor } = await import('../../utils/emehmon');
            // Филиал обязателен: у каждого своя сессия e-mehmon и свои цифры
            setRes(await fetchTursbor(period.range, hostelId));
        } catch (e) {
            setRes({ status: 'error', message: e?.message || String(e) });
        } finally {
            setLoading(false);
        }
    };
    // Смена фильтров сбрасывает результат — цифры не должны «отставать» от периода
    const changeRange = (k) => { setRangeKey(k); setRes(null); };

    const fmt = n => Number(n || 0).toLocaleString('ru-RU');
    const sumOf = (tp) => (res?.data?.[tp]?.rows || []).reduce((s, r) => s + (r.total || 0), 0);
    const guestsOf = (tp) => (res?.data?.[tp]?.rows || []).reduce((s, r) => s + (r.guests || 0), 0);
    const livedOf = (tp) => (res?.data?.[tp]?.rows || []).reduce((s, r) => s + (r.lived || 0), 0);
    const grand = res?.status === 'ok' ? TURSBOR_TYPES.reduce((s, t) => s + sumOf(t.key), 0) : 0;
    // Какие типы показываем: «все» или один выбранный (фильтр как на портале)
    const shownTypes = typeKey === 'all' ? TURSBOR_TYPES : TURSBOR_TYPES.filter(t => t.key === typeKey);
    const shownTotal = res?.status === 'ok' ? shownTypes.reduce((s, t) => s + sumOf(t.key), 0) : 0;

    if (!window.electronAPI?.emehmonTursbor) return null;

    return (
        <div className="mt-3 bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
                <span className="text-2xl">🏛</span>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-black text-slate-800">Турсбор — к оплате</div>
                    <div className="text-xs text-slate-400">Данные с портала e-mehmon за выбранный месяц</div>
                </div>
                {res?.status === 'ok' && (
                    <div className="text-right shrink-0 pl-2 border-l-2 border-slate-100">
                        <div className="text-xl font-black text-indigo-600 tabular-nums">{fmt(shownTotal)}</div>
                        <div className="text-[11px] font-bold text-slate-400">сум к оплате</div>
                    </div>
                )}
            </div>

            {/* Фильтры — как на портале: Тип + Период */}
            <div className="px-4 pb-3 flex items-end gap-3 flex-wrap border-t border-slate-100 pt-3">
                <div className="min-w-[210px]">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Тип</label>
                    <select value={typeKey} onChange={e => setTypeKey(e.target.value)}
                        className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500">
                        <option value="all">Все типы (итого)</option>
                        {TURSBOR_TYPES.map(t => <option key={t.key} value={t.key}>{t.portalLabel}</option>)}
                    </select>
                </div>
                <div className="min-w-[180px]">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Период</label>
                    <select value={rangeKey} onChange={e => changeRange(e.target.value)}
                        className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500">
                        {TURSBOR_RANGES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                    </select>
                </div>
                {rangeKey === 'custom' && (
                    <div className="flex items-end gap-2">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">С</label>
                            <input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); setRes(null); }}
                                className="px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">По</label>
                            <input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); setRes(null); }}
                                className="px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" />
                        </div>
                    </div>
                )}
                <button onClick={() => { setOpen(true); load(); }} disabled={loading || !period.range}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black shadow-sm transition-all active:scale-95 disabled:opacity-50">
                    <Search size={15} className={loading ? 'animate-pulse' : ''} />
                    {loading ? 'Загружаю…' : res ? 'Обновить' : 'Показать'}
                </button>
                {period.range && <span className="text-[11px] text-slate-400 pb-2">{period.range}</span>}
            </div>

            {open && res && (
                <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/60">
                    {res.status === 'need_login' && (
                        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                            ⚠️ Нужен вход в e-mehmon. Откройте любую регистрацию или вывод, войдите — затем нажмите «Показать» снова.
                        </div>
                    )}
                    {res.status === 'error' && (
                        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                            Не удалось получить данные: {res.message || 'ошибка портала'}
                        </div>
                    )}
                    {res.status === 'ok' && (
                        <div className="space-y-2">
                            {res.brvText && <div className="text-[11px] text-slate-400">{res.brvText}</div>}
                            {shownTypes.map(t => {
                                const rows = res.data?.[t.key]?.rows || [];
                                const err = res.data?.[t.key]?.error;
                                return (
                                    <div key={t.key} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5">
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <span className="text-sm font-black text-slate-700">{t.emoji} {t.label}</span>
                                            {err ? <span className="text-xs text-rose-500">{err}</span> : (
                                                <span className="text-base font-black text-slate-800 tabular-nums">{fmt(sumOf(t.key))} сум</span>
                                            )}
                                        </div>
                                        {!err && rows.length > 0 && (
                                            <>
                                                <div className="text-xs text-slate-500 mt-1 flex gap-4 flex-wrap">
                                                    <span>гостей: <b className="text-slate-700">{fmt(guestsOf(t.key))}</b></span>
                                                    <span>суток: <b className="text-slate-700">{fmt(livedOf(t.key))}</b></span>
                                                    {rows[0]?.rate > 0 && <span>ставка: <b className="text-slate-700">{fmt(rows[0].rate)}</b></span>}
                                                    {rows.length > 1 && <span className="text-slate-400">строк: {rows.length}</span>}
                                                </div>
                                                {/* Как прислал портал — для сверки, если цифра выглядит не так */}
                                                <details className="mt-1.5">
                                                    <summary className="text-[11px] text-slate-400 cursor-pointer hover:text-slate-600">как в портале</summary>
                                                    <div className="mt-1 space-y-0.5">
                                                        {rows.map((r, i) => (
                                                            <div key={i} className="text-[11px] text-slate-500 flex gap-2 flex-wrap border-b border-slate-100 pb-0.5">
                                                                <span className="font-semibold text-slate-600">{r.hotel || r.company || '—'}</span>
                                                                <span>гостей «{r.rawGuests}»</span>
                                                                <span>суток «{r.rawLived}»</span>
                                                                <span>итого «{r.rawTotal}»</span>
                                                                <span className="text-slate-400">→ {fmt(r.total)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </details>
                                            </>
                                        )}
                                        {!err && rows.length === 0 && <div className="text-xs text-slate-400 mt-1">за период записей нет</div>}
                                    </div>
                                );
                            })}
                            <div className="flex items-center justify-between pt-2 border-t-2 border-slate-200 text-base">
                                <span className="font-black text-slate-700">
                                    Итого · {period.label}{typeKey !== 'all' && <span className="text-xs font-bold text-slate-400"> (только выбранный тип)</span>}
                                </span>
                                <span className="font-black text-indigo-600 tabular-nums">{fmt(shownTotal)} сум</span>
                            </div>
                            {typeKey !== 'all' && grand !== shownTotal && (
                                <div className="text-xs text-slate-500 text-right">По всем типам: <b>{fmt(grand)} сум</b></div>
                            )}
                            {res.depositText && (
                                <div className="text-xs text-slate-500 bg-slate-100 rounded-lg px-2.5 py-1.5">{res.depositText}</div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

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
    onOpenGuest,
    users = [],
    emehmonSnapshot = { status: 'none', at: null },
    onEmehmonLogin,
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

    // Долговые записи (DEBT_ONLY) — не реальные проживающие, из статуса e-mehmon исключаем.
    const residents = useMemo(() => guests.filter(g => g.status === 'active' && g.roomId !== 'DEBT_ONLY'), [guests]);
    const registered = useMemo(() => residents.filter(g => g.emehmonReg), [residents]);
    // Нужно оформить: активные, без e-mehmon и без кадастра (кадастр = уже зарегистрирован по-другому)
    const needRegister = useMemo(() => residents.filter(g => !g.emehmonReg && !hasCadastre(g)), [residents, cadastreRegs]); // eslint-disable-line
    const inCadastre = useMemo(() => residents.filter(g => !g.emehmonReg && hasCadastre(g)), [residents, cadastreRegs]); // eslint-disable-line

    // ── Кого выводить из портала ─────────────────────────────────────────────
    // Источник правды — сам список e-mehmon (/listok). Всё, что есть в портале, но
    // НЕ живёт сейчас, нужно вывести: и незнакомые записи, и гости, которых уже
    // выселили. Раньше сверка шла со всеми гостями за всю историю, поэтому
    // выселенный «находился» в системе и в задачу не попадал вовсе.
    // Список получен именно из портала (а не «пусто, потому что не спросили»)
    const portalLoaded = emehmonSnapshot?.status === 'ok';
    // Сессии этого филиала нет — портал попросил вход (или не ответил)
    const needsEmehmonLogin = emehmonSnapshot?.status === 'need_login' || emehmonSnapshot?.status === 'error';

    const livingByPassport = useMemo(() => new Set(residents.map(g => normP(g.passport)).filter(Boolean)), [residents]);
    const livingByName     = useMemo(() => new Set(residents.map(g => normP(g.fullName)).filter(Boolean)), [residents]);

    const inPortalToRemove = useMemo(() => (!portalLoaded ? [] : (emehmonList || [])
        .filter(r => !((r.passport && livingByPassport.has(normP(r.passport))) ||
                       (r.name && livingByName.has(normP(r.name)))))
        .map(r => {
            // Нашего гостя отдаём целиком: у него есть id, комната и отметки e-mehmon.
            // Паспорт — надёжный ключ; по одному имени связываем, только если паспорта
            // нет ни у нас, ни в портале, иначе полный тёзка из архива подменит человека.
            const known = guests.find(g => g.status === 'checked_out' && (
                (r.passport && g.passport && normP(g.passport) === normP(r.passport)) ||
                (!r.passport && !g.passport && r.name && g.fullName && normP(g.fullName) === normP(r.name))
            ));
            if (known) return { ...known, _inPortal: true };
            return {
                passport: r.passport, fullName: r.displayName || r.name, country: r.country,
                roomNumber: r.room, days: r.days, hostelId: emehmonHostelId, _orphan: true,
            };
        })), [portalLoaded, emehmonList, guests, livingByPassport, livingByName, emehmonHostelId]);

    const departedInPortal = useMemo(() => inPortalToRemove.filter(g => !g._orphan), [inPortalToRemove]);
    const orphans          = useMemo(() => inPortalToRemove.filter(g =>  g._orphan), [inPortalToRemove]);

    // Запасной список — когда портал недоступен (веб-версия, нет сессии e-mehmon):
    // судим по своим отметкам. Записи старше STALE_TASK_DAYS не показываем, иначе
    // копятся гости из далёкого прошлого, которых портал давно закрыл сам.
    const departedNotRemoved = useMemo(() => portalLoaded ? [] : guests.filter(g =>
        g.status === 'checked_out' && g.emehmonReg && !g.emehmonOut && !isStaleSince(g.checkOutDate)),
        [guests, portalLoaded]);

    const archivedCount = useMemo(() => {
        if (portalLoaded) return 0;   // портал показывает реальное положение дел
        const departedOld = guests.filter(g =>
            g.status === 'checked_out' && g.emehmonReg && !g.emehmonOut && isStaleSince(g.checkOutDate)).length;
        const regsOld = enriched.filter(r => r.computedStatus === 'archived').length;
        return departedOld + regsOld;
    }, [guests, enriched, portalLoaded]);

    const toDepart = useMemo(() => [...departedInPortal, ...departedNotRemoved, ...orphans],
        [departedInPortal, departedNotRemoved, orphans]);

    const removeCount = toDepart.length + expiredRegs.length;

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
            : status === 'archived' ? `🗄 Архив · истекла ${Math.abs(dl)} дн. назад`
            : status === 'expiring' ? (dl === 0 ? '⏰ Сегодня последний день' : `⏰ Осталось ${dl} дн.`)
            : status === 'removed' ? '✓ Выведен'
            : `До ${r.endDate}`;
        const cls = status === 'expired' ? 'text-rose-600' : status === 'expiring' ? 'text-amber-600' : (status === 'removed' || status === 'archived') ? 'text-slate-400' : 'text-emerald-600';
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
                                    {/* Неприметная отметка сессии филиала: если входа нет —
                                        рядом появляется маленькая кнопка «Войти» */}
                                    <div className="flex items-center gap-1.5 text-sm text-slate-400">
                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                            emehmonSyncing ? 'bg-indigo-400 animate-pulse'
                                            : portalLoaded ? 'bg-emerald-400'
                                            : needsEmehmonLogin ? 'bg-amber-400' : 'bg-slate-300'}`} />
                                        <span>
                                            {emehmonSyncing ? 'Проверяю…'
                                                : portalLoaded ? `На связи${emehmonSnapshot?.at ? ` · ${minutesAgo(emehmonSnapshot.at)}` : ''}`
                                                : needsEmehmonLogin ? 'Нет входа в портал'
                                                : 'Регистрация гостей'}
                                        </span>
                                        {needsEmehmonLogin && onEmehmonLogin && (
                                            <button onClick={onEmehmonLogin}
                                                className="ml-0.5 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-black hover:bg-amber-100 transition-colors">
                                                Войти
                                            </button>
                                        )}
                                    </div>
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

                        {/* Итог задекларированных сумм — сверка с налоговой */}
                        <TaxTotals guests={guests} />

                        {/* Турсбор к оплате — с портала e-mehmon (сессия своего филиала) */}
                        {/* key по филиалу: при переключении панель перемонтируется, иначе
                            на экране остаются цифры турсбора прошлого хостела */}
                        <TursborPanel key={emehmonHostelId} hostelId={emehmonHostelId} />

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
                                                {(r.computedStatus === 'expired' || r.computedStatus === 'expiring' || r.computedStatus === 'archived') && (
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
                        {/* Откуда взят список — чтобы наши отметки не читались как данные портала */}
                        {portalLoaded ? (
                            <p className="text-sm text-slate-400 -mt-1 mb-3">
                                ✅ По списку E-mehmon{emehmonSnapshot?.at ? `, обновлён ${minutesAgo(emehmonSnapshot.at)}` : ''}.
                                Если только что вывели кого-то на портале вручную — нажмите «Обновить».
                            </p>
                        ) : (
                            <p className="text-sm text-amber-600 -mt-1 mb-3">
                                ⚠️ Список E-mehmon не получен{emehmonSnapshot?.status === 'need_login' ? ' — нужен вход в портал' : ''}.
                                Показываю по нашим отметкам: часть этих гостей могла быть выведена вручную.
                                Нажмите «Обновить», чтобы свериться с порталом.
                            </p>
                        )}
                        {archivedCount > 0 && (
                            <p className="text-sm text-slate-400 -mt-1 mb-3">
                                🗄 Скрыто старых записей: {archivedCount} — прошло больше {STALE_TASK_DAYS} дн.
                                Они остались в поиске и в списке «Все регистрации».
                            </p>
                        )}
                        {removeCount === 0 ? <AllDone text="Никого выводить не нужно" /> : (
                            <>
                                {/* Массовый вывод одним нажатием */}
                                {canEmehmon && toDepart.length > 1 && (
                                    <button
                                        onClick={() => onDepartEmehmon?.(toDepart)}
                                        className="w-full mb-4 flex items-center justify-center gap-2 py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-base font-black shadow-md shadow-rose-200 transition-all active:scale-[0.99]">
                                        <Plane size={20} /> Вывести всех сразу ({toDepart.length})
                                    </button>
                                )}

                                {(departedInPortal.length + departedNotRemoved.length) > 0 && (
                                    <>
                                        <GroupTitle emoji="🏠">
                                            {portalLoaded ? 'Выселились из хостела — выведите их' : 'Выселились — по нашим отметкам, сверьтесь с порталом'}
                                        </GroupTitle>
                                        <div className="space-y-2">
                                            {[...departedInPortal, ...departedNotRemoved].map(g => (
                                                <PersonRow key={g.id} tone="rose"
                                                    flag={<Flag country={g.country} />}
                                                    name={g.fullName}
                                                    line2={guestLine(g)}
                                                    line3={g.checkOutDate
                                                        ? <span className="text-rose-600">Выселен {new Date(g.checkOutDate).toLocaleDateString('ru-RU')} · до сих пор в E-mehmon</span>
                                                        : null}
                                                    onClick={onOpenGuest ? () => onOpenGuest(g) : undefined}
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
                                        onClick={onOpenGuest ? () => onOpenGuest(g) : undefined}
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
                                            onClick={onOpenGuest ? () => onOpenGuest(g) : undefined}
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
                                            onClick={onOpenGuest ? () => onOpenGuest(g) : undefined}
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
