import React, { useState, useRef, useMemo, useCallback } from 'react';
import { X, Camera, Trash2, ChevronLeft, CalendarClock, Plus } from 'lucide-react';
import { fmtSum } from '../../utils/helpers';
import { getConfig } from '../../utils/appConfig';
import TRANSLATIONS from '../../constants/translations';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';

// Встроенные категории — тот же набор, что в разделе «Расходы» (ExpensesView.CAT_META,
// кроме служебных «Аванс»/«Возврат» — они создаются своими потоками).
const BUILTIN_CATS = [
    { key: 'Аренда',              icon: '🏠', bg: '#ede9fe', text: '#6d28d9' },
    { key: 'Коммунальные услуги', icon: '💡', bg: '#e0f2fe', text: '#0369a1' },
    { key: 'Зарплата',            icon: '💼', bg: '#eef2ff', text: '#4338ca' },
    { key: 'Продукты',            icon: '🛒', bg: '#dcfce7', text: '#15803d' },
    { key: 'Налоги',              icon: '🏛️', bg: '#f1f5f9', text: '#475569' },
    { key: 'Регистрация',          icon: '📋', bg: '#ffedd5', text: '#c2410c' },
    { key: 'Интернет',            icon: '🌐', bg: '#ccfbf1', text: '#0f766e' },
    { key: 'Реклама',             icon: '📣', bg: '#fce7f3', text: '#be185d' },
    { key: 'Газ',                 icon: '🔥', bg: '#fff7ed', text: '#c2410c' },
    { key: 'Электричество',       icon: '⚡', bg: '#fefce8', text: '#ca8a04' },
    { key: 'Вода',                icon: '💧', bg: '#eff6ff', text: '#1d4ed8' },
    { key: 'Ремонт',              icon: '🔧', bg: '#f8fafc', text: '#475569' },
    { key: 'Другое',              icon: '📦', bg: '#f8fafc', text: '#64748b' },
];

// Палитра для пользовательских категорий (циклично)
const CUSTOM_PALETTE = [
    { bg: '#ede9fe', text: '#6d28d9' }, { bg: '#e0f2fe', text: '#0369a1' },
    { bg: '#dcfce7', text: '#15803d' }, { bg: '#ffedd5', text: '#c2410c' },
    { bg: '#fce7f3', text: '#be185d' }, { bg: '#ccfbf1', text: '#0f766e' },
];

// Подбор иконки по названию (копия эвристики раздела «Расходы»)
const guessIcon = (name) => {
    const n = (name || '').toLowerCase().replace(/ё/g, 'е');
    const map = [
        ['газ', '🔥'], ['свет', '⚡'], ['электр', '⚡'], ['вода', '💧'],
        ['аренд', '🏠'], ['помещен', '🏢'], ['офис', '🏢'],
        ['интернет', '🌐'], ['связ', '📡'], ['телефон', '📱'],
        ['зарплат', '💼'], ['аванс', '💰'], ['налог', '🏛️'], ['штраф', '⚠️'],
        ['еда', '🍽️'], ['продукт', '🛒'], ['магазин', '🛍️'],
        ['реклам', '📣'], ['ремонт', '🔧'], ['строит', '🏗️'], ['матери', '🧱'],
        ['уборк', '🧹'], ['регистрац', '📋'], ['докумен', '📄'],
        ['медиц', '💊'], ['транспорт', '🚗'], ['бензин', '⛽'], ['топлив', '⛽'],
        ['банк', '🏦'], ['кредит', '💳'], ['охран', '🛡️'], ['мебел', '🪑'],
        ['техник', '🖥️'], ['принтер', '🖨️'], ['канцеляр', '✏️'], ['посуд', '🍽️'],
        ['бель', '🛏️'], ['стирк', '🧺'], ['прачеч', '🧺'], ['мыл', '🧼'], ['химия', '🧴'],
        ['такси', '🚕'], ['доставк', '📦'], ['подарк', '🎁'], ['праздник', '🎉'],
        ['обучен', '📚'], ['курс', '📚'], ['подписк', '📱'], ['программ', '💻'],
    ];
    const hit = map.find(([k]) => n.includes(k));
    if (hit) return hit[1];
    // Не нашли по смыслу — детерминированно выбираем уникальную иконку по названию,
    // чтобы у каждой категории была СВОЯ (а не общий 📦 на всех).
    const POOL = ['🧾','🗂️','📌','🎯','🧰','🔩','🪣','🧯','🔌','🚪','🪟','🧲','⚙️','🗜️','🛠️','📎','🏷️','🎒','⏰','🔑','💡','🎨','🧿','🌿'];
    let h = 0;
    for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
    return POOL[h % POOL.length];
};

// Читаем пользовательские категории раздела «Расходы» (localStorage, per-hostel)
const readLsJson = (key, fb) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch { return fb; }
};

const QUICK_SUMS = [10000, 50000, 100000, 500000];

const MODAL_STYLE = `
    @keyframes exp-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes exp-card-in { from { opacity: 0; transform: scale(0.96) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    @keyframes exp-step-in { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes exp-step-back { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: translateX(0); } }
    .exp-backdrop { animation: exp-backdrop-in 0.2s ease forwards; }
    .exp-card { animation: exp-card-in 0.28s cubic-bezier(0.34,1.3,0.64,1) forwards; will-change: transform, opacity; }
    .exp-step-fwd { animation: exp-step-in 0.22s cubic-bezier(0.4,0,0.2,1) forwards; }
    .exp-step-bwd { animation: exp-step-back 0.22s cubic-bezier(0.4,0,0.2,1) forwards; }
    .exp-input:focus { border-color: #0f9688 !important; box-shadow: 0 0 0 3px rgba(15,150,136,0.12); }
    .exp-tile { transition: all .16s cubic-bezier(.4,0,.2,1); }
    .exp-tile:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(15,30,32,0.08); }
    .exp-tile:active { transform: translateY(0) scale(.96); }
    .exp-chip { transition: all .15s; }
    .exp-chip:hover { transform: translateY(-1px); }
    .exp-chip:active { transform: scale(.94); }
`;

// ── Калькулятор поля суммы: "73000+33000" → 106000 ──
// Разрешены только цифры и операторы + - * / ( ) . — безопасно вычисляем.
const evalExpr = (raw) => {
    if (raw == null) return NaN;
    const s = String(raw).replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '.');
    if (!s || !/[0-9]/.test(s)) return NaN;
    if (!/^[0-9+\-*/().]+$/.test(s)) return NaN;
    try {
        // eslint-disable-next-line no-new-func
        const val = Function(`"use strict"; return (${s});`)();
        return (typeof val === 'number' && isFinite(val)) ? val : NaN;
    } catch { return NaN; }
};
// есть ли в строке арифметический оператор (игнорируем ведущий минус)
const hasOperator = (s) => /[+\-*/×÷]/.test(String(s || '').slice(1));

const ExpenseModal = ({ onClose, onSubmit, lang, currentUser, initialCategory = '', usersList = [], selectedHostelFilter = '' }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super';

    // Полный список категорий — как в разделе «Расходы»: встроенные + центральные
    // (Настройки) + пользовательские, минус архив. У каждого хостела СВОИ категории
    // (ключ localStorage per-hostel), сюда же подмешиваются общие (ключ 'all').
    // Хостелы между собой НЕ смешиваются; админ с фильтром «все» видит всё.
    const hostelKey = ((isAdmin ? selectedHostelFilter : currentUser?.hostelId) || 'all');
    const allCats = useMemo(() => {
        let central = [];
        try { central = (getConfig().expenseCategories || []).filter(c => c && c.name); } catch { /* ignore */ }
        const keys = hostelKey === 'all' ? ['all', 'hostel1', 'hostel2'] : ['all', hostelKey];
        const custom = [], icons = {}, archived = [];
        keys.forEach(k => {
            readLsJson(`exp_custom_cats_${k}`, []).forEach(n => { if (n && !custom.includes(n)) custom.push(n); });
            Object.assign(icons, readLsJson(`exp_custom_icons_${k}`, {}));
            readLsJson(`exp_archived_cats_${k}`, []).forEach(n => { if (!archived.includes(n)) archived.push(n); });
        });
        const extras = [...new Set([...custom, ...central.map(c => c.name)])]
            .filter(n => n && !BUILTIN_CATS.some(b => b.key === n));
        const extraCats = extras.map((n, i) => ({
            key: n,
            icon: icons[n] || (central.find(c => c.name === n)?.icon) || guessIcon(n),
            ...CUSTOM_PALETTE[i % CUSTOM_PALETTE.length],
        }));
        return [...BUILTIN_CATS, ...extraCats].filter(c => !archived.includes(c.key));
    }, [hostelKey]);
    const getLocalDateTimeValue = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${d}T${hh}:${mm}`;
    };

    const [step, setStep] = useState(initialCategory ? 2 : 1); // 1 = категория, 2 = сумма и детали
    const [stepDir, setStepDir] = useState('fwd');
    const [category, setCategory] = useState(initialCategory);
    const [targetStaffId, setTargetStaffId] = useState('');
    const [amount, setAmount] = useState('');
    const [comment, setComment] = useState('');
    const [expenseDate, setExpenseDate] = useState(() => getLocalDateTimeValue());
    const [currency, setCurrency] = useState('uzs'); // 'uzs' | 'usd'
    const [usdAmount, setUsdAmount] = useState('');
    const [usdRate, setUsdRate] = useState(() => getConfig().defaultUsdRate || '');
    const [skipCashbox, setSkipCashbox] = useState(false);
    const [loading, setLoading] = useState(false);
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [showDate, setShowDate] = useState(false);
    const fileRef = useRef();
    const amountRef = useRef();
    const isDark = useMemo(() => document.documentElement.dataset.theme === 'dark', []);
    const maxExpenseDate = useMemo(() => getLocalDateTimeValue(), []);
    const canBackdate = isAdmin || currentUser?.login === 'fazliddin';
    const canSkipCashbox = currentUser?.login === 'fazliddin';

    const catMeta = allCats.find(c => c.key === category)
        || (category ? { key: category, icon: guessIcon(category), ...CUSTOM_PALETTE[0] } : null);

    // Вычисляем итоговую сумму в сумах
    const computedUzs = useMemo(() => {
        if (currency === 'usd') {
            const d = parseFloat(usdAmount);
            const r = parseFloat(usdRate);
            if (d > 0 && r > 0) return Math.round(d * r);
            return 0;
        }
        const v = evalExpr(amount);
        return isFinite(v) && v > 0 ? Math.round(v) : 0;
    }, [currency, usdAmount, usdRate, amount]);

    const pickCategory = (key) => {
        setCategory(key);
        setStepDir('fwd');
        setStep(2);
        setTimeout(() => amountRef.current?.focus(), 250);
    };
    const goBack = () => { setStepDir('bwd'); setStep(1); };

    // Быстрые суммы: прибавляем к текущему значению
    const addQuick = (v) => {
        const cur = evalExpr(amount);
        const base = isFinite(cur) && cur > 0 ? Math.round(cur) : 0;
        setAmount(String(base + v));
        amountRef.current?.focus();
    };

    const handlePhotoSelect = (file) => {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert('Файл слишком большой (макс. 5 МБ)'); return; }
        setPhotoFile(file);
        const reader = new FileReader();
        reader.onload = (e) => setPhotoPreview(e.target.result);
        reader.readAsDataURL(file);
    };

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) handlePhotoSelect(file);
    }, []);

    const uploadPhoto = async (file) => {
        try {
            const path = `expenses/${Date.now()}_${file.name}`;
            const sRef = storageRef(storage, path);
            await uploadBytes(sRef, file);
            return await getDownloadURL(sRef);
        } catch {
            return photoPreview;
        }
    };

    // Вычислить выражение в поле суммы и подставить результат (по Enter)
    const evaluateAmount = () => {
        const v = evalExpr(amount);
        if (isFinite(v) && v > 0) setAmount(String(Math.round(v)));
    };

    const canSubmit = category && computedUzs > 0 && !loading;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const finalAmount = currency === 'usd' ? computedUzs : Math.round(evalExpr(amount) || 0);
        if (!category || !finalAmount || finalAmount <= 0) { alert('Заполните все обязательные поля (сумма должна быть больше 0)'); return; }
        if (currency === 'usd' && (!parseFloat(usdAmount) || !parseFloat(usdRate))) {
            alert('Укажите сумму в USD и курс обмена');
            return;
        }
        const parsedDate = expenseDate ? new Date(expenseDate) : null;
        if (canBackdate && (!parsedDate || Number.isNaN(parsedDate.getTime()))) {
            alert('Укажите корректную дату расхода');
            return;
        }
        setLoading(true);
        try {
            let photoUrl = null;
            if (photoFile) {
                setPhotoUploading(true);
                photoUrl = await uploadPhoto(photoFile);
                setPhotoUploading(false);
            }
            const usdNote = currency === 'usd' ? `$${usdAmount} × ${usdRate} = ${finalAmount.toLocaleString()} сум` : '';
            const finalComment = usdNote ? (comment ? `${usdNote} | ${comment}` : usdNote) : comment;
            await onSubmit({
                category, amount: finalAmount, comment: finalComment,
                ...(currency === 'usd' ? { usdAmount: parseFloat(usdAmount), usdRate: parseFloat(usdRate) } : {}),
                date: canBackdate ? parsedDate.toISOString() : new Date().toISOString(),
                staffId: currentUser.id || currentUser.login,
                ...(category === 'Зарплата' && targetStaffId ? { targetStaffId } : {}),
                hostelId: currentUser.hostelId,
                ...(skipCashbox ? { skipCashbox: true } : {}),
                ...(photoUrl ? { photoUrl } : {}),
            });
        } finally {
            setLoading(false);
            setPhotoUploading(false);
        }
    };

    // ── Общие цвета темы ──
    const cardBg   = isDark ? '#162a2e' : '#fff';
    const fieldBg  = isDark ? '#1e3a3e' : '#f8fafc';
    const fieldBrd = isDark ? 'rgba(94,234,212,0.18)' : '#e2e8f0';
    const txtMain  = isDark ? '#e2f7f8' : '#0f172a';
    const txtMuted = isDark ? '#9ecdd0' : '#64748b';
    const lbl = { display: 'block', fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 };

    // Пилюля-переключатель дополнительного поля
    const TogglePill = ({ active, onClick, Icon, label }) => (
        <button type="button" onClick={onClick} className="exp-chip"
            style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 99,
                cursor: 'pointer', outline: 'none', fontSize: 12, fontWeight: 700,
                background: active ? 'rgba(15,150,136,0.12)' : fieldBg,
                border: `1.5px solid ${active ? '#0f9688' : fieldBrd}`,
                color: active ? '#0f9688' : txtMuted,
            }}>
            <Icon size={13}/> {label}
        </button>
    );

    return (
        <>
            <style>{MODAL_STYLE}</style>
            <div className="exp-backdrop fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" style={{ background: 'rgba(15,30,32,0.7)' }}>
                <div className="exp-card sm:rounded-2xl rounded-t-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden" style={{ maxHeight: '92dvh', boxShadow: '0 32px 80px rgba(0,0,0,0.35)', background: cardBg }}>

                    {/* Dark header */}
                    <div style={{ background: '#1a3c40', padding: '18px 22px 16px', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: -30, right: -30, width: 110, height: 110, borderRadius: '50%', background: 'rgba(94,234,212,0.06)', pointerEvents: 'none' }}/>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {step === 2 && !initialCategory ? (
                                <button type="button" onClick={goBack}
                                    style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 11, padding: 9, cursor: 'pointer', color: '#9ecdd0', display: 'flex', transition: 'background .15s' }}
                                    onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.14)'}
                                    onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.07)'}
                                    title="Назад к категориям">
                                    <ChevronLeft size={18}/>
                                </button>
                            ) : (
                                <div style={{ width: 42, height: 42, borderRadius: 13, background: 'rgba(94,234,212,0.12)', border: '1px solid rgba(94,234,212,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                                    {step === 2 && catMeta ? catMeta.icon : '💸'}
                                </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: '#e2f7f8', fontSize: 15, fontWeight: 800 }}>
                                    {step === 1 ? 'Новый расход' : (category || 'Новый расход')}
                                </div>
                                <div style={{ color: 'rgba(158,205,208,0.6)', fontSize: 11, marginTop: 2 }}>
                                    {step === 1 ? 'Выберите категорию' : (currentUser?.name || currentUser?.login)}
                                </div>
                            </div>
                            {/* Step dots */}
                            <div style={{ display: 'flex', gap: 5, marginRight: 4 }}>
                                {[1, 2].map(s => (
                                    <span key={s} style={{ width: s === step ? 18 : 7, height: 7, borderRadius: 99, transition: 'all .25s cubic-bezier(.4,0,.2,1)',
                                        background: s === step ? '#5eead4' : 'rgba(94,234,212,0.25)' }}/>
                                ))}
                            </div>
                            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 9, padding: 8, cursor: 'pointer', color: '#9ecdd0', display: 'flex', transition: 'background .15s' }}
                                onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.12)'}
                                onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.07)'}>
                                <X size={16}/>
                            </button>
                        </div>
                    </div>

                    {/* ── ШАГ 1: категория ── */}
                    {step === 1 && (
                        <div className={stepDir === 'bwd' ? 'exp-step-bwd' : ''} style={{ padding: 20, overflowY: 'auto' }}>
                            <div className="grid grid-cols-3 gap-2.5">
                                {allCats.map(c => (
                                    <button key={c.key} type="button" className="exp-tile"
                                        onClick={() => pickCategory(c.key)}
                                        style={{
                                            outline: 'none', cursor: 'pointer',
                                            background: fieldBg, border: `2px solid ${fieldBrd}`,
                                            borderRadius: 16, padding: '16px 6px 12px',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                                        }}>
                                        <span style={{ width: 44, height: 44, borderRadius: 14, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{c.icon}</span>
                                        <span style={{ fontSize: 11, lineHeight: 1.25, textAlign: 'center', fontWeight: 700, color: isDark ? '#9ecdd0' : '#475569' }}>{c.key}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── ШАГ 2: сумма и детали ── */}
                    {step === 2 && (
                    <form onSubmit={handleSubmit} className="exp-step-fwd flex flex-col flex-1 overflow-hidden" style={{ background: cardBg }}>
                        <div className="p-5 space-y-4 overflow-y-auto flex-1">

                            {/* Сумма — главный элемент */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <label style={{ ...lbl, marginBottom: 0 }}>{currency === 'uzs' ? 'Сумма *' : 'Сумма (USD) *'}</label>
                                    <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: fieldBg, border: `1px solid ${fieldBrd}` }}>
                                        {[['uzs','UZS'],['usd','USD']].map(([v,l]) => (
                                            <button key={v} type="button" onClick={() => setCurrency(v)}
                                                style={{ padding: '3px 10px', fontSize: 11, fontWeight: 700, border: 'none', borderRadius: 7, cursor: 'pointer', transition: 'all 0.15s',
                                                    background: currency === v ? '#0f9688' : 'transparent',
                                                    boxShadow: currency === v ? '0 2px 6px rgba(15,150,136,0.35)' : 'none',
                                                    color: currency === v ? '#fff' : txtMuted }}>
                                                {l}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {currency === 'uzs' ? (
                                    <>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                ref={amountRef}
                                                type="text" inputMode="text" autoCapitalize="off" autoCorrect="off" spellCheck={false} className="exp-input"
                                                value={hasOperator(amount) ? amount : fmtSum(amount)}
                                                onChange={e => setAmount(e.target.value.replace(/[^0-9+\-*/.×÷]/g, ''))}
                                                onKeyDown={e => { if (e.key === 'Enter' && hasOperator(amount)) { e.preventDefault(); evaluateAmount(); } }}
                                                placeholder="0" required autoFocus={!!initialCategory}
                                                style={{ width: '100%', padding: '16px 64px 16px 18px', border: `2px solid ${fieldBrd}`, borderRadius: 16, outline: 'none',
                                                    fontSize: 28, fontWeight: 900, letterSpacing: '0.02em', color: txtMain, background: isDark ? '#1e3a3e' : '#fff',
                                                    boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums', textAlign: 'center', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                                            />
                                            <span style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 800, color: txtMuted, pointerEvents: 'none' }}>сум</span>
                                        </div>
                                        {hasOperator(amount) && isFinite(evalExpr(amount)) && evalExpr(amount) > 0 && (
                                            <div style={{ marginTop: 6, textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#0f9688', fontVariantNumeric: 'tabular-nums' }}>
                                                = {fmtSum(String(Math.round(evalExpr(amount))))} сум · Enter
                                            </div>
                                        )}
                                        {/* Быстрые суммы */}
                                        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                                            {QUICK_SUMS.map(v => (
                                                <button key={v} type="button" className="exp-chip" onClick={() => addQuick(v)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '6px 11px', borderRadius: 99, cursor: 'pointer', outline: 'none',
                                                        fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                                                        background: fieldBg, border: `1.5px solid ${fieldBrd}`, color: txtMuted }}>
                                                    <Plus size={11}/>{fmtSum(String(v))}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                            <div>
                                                <label style={{ ...lbl, marginBottom: 4 }}>Сумма $</label>
                                                <input type="text" inputMode="decimal" className="exp-input" autoFocus
                                                    value={usdAmount} onChange={e => setUsdAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                                                    placeholder="0.00" required
                                                    style={{ width: '100%', padding: '12px 14px', border: `2px solid ${fieldBrd}`, borderRadius: 14, outline: 'none', fontSize: 22, fontWeight: 900, color: txtMain, background: isDark ? '#1e3a3e' : '#fff', boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums', textAlign: 'center', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ ...lbl, marginBottom: 4 }}>Курс (сум/$)</label>
                                                <input type="text" inputMode="decimal" className="exp-input"
                                                    value={usdRate} onChange={e => setUsdRate(e.target.value.replace(/[^0-9.]/g, ''))}
                                                    placeholder="12900" required
                                                    style={{ width: '100%', padding: '12px 14px', border: `2px solid ${fieldBrd}`, borderRadius: 14, outline: 'none', fontSize: 22, fontWeight: 900, color: txtMain, background: isDark ? '#1e3a3e' : '#fff', boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums', textAlign: 'center', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                                                />
                                            </div>
                                        </div>
                                        {computedUzs > 0 && (
                                            <div style={{ background: isDark ? 'rgba(15,150,136,0.15)' : '#f0fdfa', border: '1.5px solid #99f6e4', borderRadius: 12, padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: 11, color: '#0f9688', fontWeight: 600 }}>Итого в сумах:</span>
                                                <span style={{ fontSize: 18, fontWeight: 900, color: '#0f9688', fontVariantNumeric: 'tabular-nums' }}>{computedUzs.toLocaleString()} сум</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Сотрудник для Зарплаты */}
                            {category === 'Зарплата' && usersList.length > 0 && (
                                <div>
                                    <label style={lbl}>Сотрудник</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                                        {[...usersList.filter(u => u.role !== 'super'), { id: '__cleaning__', name: '🧹 Уборка' }].map(u => {
                                            const sel = targetStaffId === (u.id || u.login);
                                            return (
                                                <button key={u.id || u.login} type="button" className="exp-chip"
                                                    onClick={() => setTargetStaffId(sel ? '' : (u.id || u.login))}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 12, cursor: 'pointer', outline: 'none',
                                                        border: sel ? '2px solid #4338ca' : `2px solid ${fieldBrd}`,
                                                        background: sel ? '#eef2ff' : fieldBg,
                                                    }}>
                                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: sel ? '#4338ca' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                                                        {(u.name || u.login || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                    <span style={{ fontSize: 12, fontWeight: sel ? 800 : 600, color: sel ? '#4338ca' : txtMuted, lineHeight: 1.2 }}>
                                                        {u.name || u.login}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Комментарий — всегда открыт */}
                            <div>
                                <label style={lbl}>Комментарий <span style={{ opacity: 0.6, textTransform: 'none', letterSpacing: 0 }}>(не обязательно)</span></label>
                                <textarea
                                    value={comment} onChange={e => setComment(e.target.value)}
                                    placeholder="Дополнительная информация..." rows={2} className="exp-input"
                                    style={{ width: '100%', padding: '11px 14px', border: `2px solid ${fieldBrd}`, borderRadius: 12, outline: 'none', fontSize: 13, color: txtMuted, background: isDark ? '#1e3a3e' : '#fff', resize: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s', fontFamily: 'inherit' }}
                                />
                            </div>

                            {/* Детали — по требованию */}
                            <div>
                                <label style={lbl}>Детали</label>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    <TogglePill active={!!photoPreview} onClick={() => fileRef.current?.click()} Icon={Camera} label={photoPreview ? 'Фото ✓' : 'Фото чека'}/>
                                    {canBackdate && <TogglePill active={showDate} onClick={() => setShowDate(v => !v)} Icon={CalendarClock} label="Дата"/>}
                                </div>
                                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                                    onChange={e => handlePhotoSelect(e.target.files[0])}/>

                                {photoPreview && (
                                    <div style={{ position: 'relative', marginTop: 8, borderRadius: 12, overflow: 'hidden', border: '2px solid #99f6e4' }}
                                        onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
                                        <img src={photoPreview} alt="чек" style={{ width: '100%', maxHeight: 130, objectFit: 'cover', display: 'block' }}/>
                                        <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                                            style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: '50%', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Trash2 size={13}/>
                                        </button>
                                    </div>
                                )}

                                {showDate && canBackdate && (
                                    <input
                                        type="datetime-local" className="exp-input"
                                        value={expenseDate} max={maxExpenseDate}
                                        onChange={e => setExpenseDate(e.target.value)}
                                        style={{ width: '100%', marginTop: 8, padding: '11px 14px', border: `2px solid ${fieldBrd}`, borderRadius: 12, outline: 'none', fontSize: 13, fontWeight: 600, color: txtMain, background: isDark ? '#1e3a3e' : '#fff', boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                                    />
                                )}

                                {canSkipCashbox && (
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: isDark ? '#d1f5f3' : '#334155', marginTop: 10 }}>
                                        <input type="checkbox" checked={skipCashbox} onChange={e => setSkipCashbox(e.target.checked)}
                                            style={{ width: 16, height: 16, accentColor: '#0f9688' }} />
                                        <span>Не вычитать с кассы</span>
                                    </label>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '12px 20px 16px', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9'}`, display: 'flex', gap: 8, flexShrink: 0, background: cardBg }}>
                            <button type="button" onClick={onClose}
                                style={{ flex: 1, padding: '12px', background: fieldBg, border: `1px solid ${fieldBrd}`, borderRadius: 13, color: txtMuted, fontWeight: 600, fontSize: 13, cursor: 'pointer', outline: 'none', transition: 'background .15s' }}
                                onMouseEnter={e => e.currentTarget.style.background= isDark ? '#2d4e52' : '#f1f5f9'}
                                onMouseLeave={e => e.currentTarget.style.background= fieldBg}>
                                Отмена
                            </button>
                            <button type="submit" disabled={!canSubmit}
                                style={{ flex: 2, padding: '12px', background: !canSubmit ? (isDark ? '#1e3a3e' : '#e2e8f0') : 'linear-gradient(135deg,#0f9688,#0d7a6e)',
                                    border: 'none', borderRadius: 13, color: !canSubmit ? '#94a3b8' : '#fff', fontWeight: 800, fontSize: 14,
                                    cursor: !canSubmit ? 'not-allowed' : 'pointer', outline: 'none',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.15s',
                                    fontVariantNumeric: 'tabular-nums',
                                    boxShadow: !canSubmit ? 'none' : '0 4px 14px rgba(15,150,136,0.35)' }}>
                                {photoUploading ? '📸 Загрузка…' : loading ? '⏳ Сохранение…'
                                    : computedUzs > 0 ? `Добавить · ${computedUzs.toLocaleString()} сум` : 'Добавить расход'}
                            </button>
                        </div>
                    </form>
                    )}

                </div>
            </div>
        </>
    );
};

export default ExpenseModal;
