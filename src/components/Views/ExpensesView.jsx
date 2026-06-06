import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
    Download, Plus, Search, Trash2, ToggleLeft, ToggleRight, Play,
    ChevronDown, ChevronUp, Pencil, X, Check, LayoutGrid, List,
    ArrowRightLeft, FileText, Save, Loader2, Archive, ArchiveRestore, Wallet,
    Home, Lightbulb, Briefcase, Coins, ShoppingCart, Landmark, ClipboardList,
    Globe, Megaphone, Flame, Zap, Droplets, Wrench, Package, RotateCcw,
} from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import { getConfig } from '../../utils/appConfig';

// ─── Category metadata ────────────────────────────────────────────────────────
const CAT_META = [
    { key: 'Аренда',              icon: '🏠', bg: '#ede9fe', text: '#6d28d9', bar: '#7c3aed', darkBg: 'rgba(124,58,237,0.2)',  darkText: '#c4b5fd' },
    { key: 'Коммунальные услуги', icon: '💡', bg: '#e0f2fe', text: '#0369a1', bar: '#0284c7', darkBg: 'rgba(2,132,199,0.2)',   darkText: '#7dd3fc' },
    { key: 'Зарплата',            icon: '💼', bg: '#eef2ff', text: '#4338ca', bar: '#4f46e5', darkBg: 'rgba(79,70,229,0.2)',   darkText: '#a5b4fc' },
    { key: 'Аванс',               icon: '💰', bg: '#fef9c3', text: '#a16207', bar: '#ca8a04', darkBg: 'rgba(202,138,4,0.2)',   darkText: '#fcd34d' },
    { key: 'Продукты',            icon: '🛒', bg: '#dcfce7', text: '#15803d', bar: '#16a34a', darkBg: 'rgba(22,163,74,0.2)',   darkText: '#86efac' },
    { key: 'Налоги',              icon: '🏛️', bg: '#f1f5f9', text: '#475569', bar: '#94a3b8', darkBg: 'rgba(100,116,139,0.2)', darkText: '#94a3b8' },
    { key: 'Регистрация',         icon: '📋', bg: '#ffedd5', text: '#c2410c', bar: '#ea580c', darkBg: 'rgba(234,88,12,0.2)',   darkText: '#fdba74' },
    { key: 'Интернет',            icon: '🌐', bg: '#ccfbf1', text: '#0f766e', bar: '#0d9488', darkBg: 'rgba(13,148,136,0.2)',  darkText: '#5eead4' },
    { key: 'Реклама',             icon: '📣', bg: '#fce7f3', text: '#be185d', bar: '#db2777', darkBg: 'rgba(219,39,119,0.2)',  darkText: '#f9a8d4' },
    { key: 'Газ',                 icon: '🔥', bg: '#fff7ed', text: '#c2410c', bar: '#f97316', darkBg: 'rgba(249,115,22,0.2)',  darkText: '#fdba74' },
    { key: 'Электричество',       icon: '⚡', bg: '#fefce8', text: '#ca8a04', bar: '#eab308', darkBg: 'rgba(234,179,8,0.2)',   darkText: '#fde047' },
    { key: 'Вода',                icon: '💧', bg: '#eff6ff', text: '#1d4ed8', bar: '#3b82f6', darkBg: 'rgba(59,130,246,0.2)',  darkText: '#93c5fd' },
    { key: 'Ремонт',              icon: '🔧', bg: '#f8fafc', text: '#475569', bar: '#64748b', darkBg: 'rgba(100,116,139,0.2)', darkText: '#94a3b8' },
    { key: 'Другое',              icon: '📦', bg: '#f8fafc', text: '#64748b', bar: '#94a3b8', darkBg: 'rgba(100,116,139,0.2)', darkText: '#94a3b8' },
];
const CAT_FALLBACK = { icon: '📦', bg: '#f8fafc', text: '#64748b', bar: '#94a3b8', darkBg: 'rgba(100,116,139,0.2)', darkText: '#94a3b8' };

const ymdLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const getCat = (c) => {
    if (!c) return CAT_FALLBACK;
    const norm = c.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
    const ns = norm.replace(/\s/g, '');
    return CAT_META.find(m => m.key.toLowerCase().replace(/ё/g, 'е') === norm)
        || CAT_META.find(m => m.key.toLowerCase().replace(/ё/g, 'е').replace(/\s/g, '') === ns)
        || CAT_META.find(m => { const mk = m.key.toLowerCase().replace(/ё/g, 'е'); return norm.includes(mk) || mk.includes(norm); })
        || CAT_META.find(m => { const mk = m.key.toLowerCase().replace(/ё/g, 'е').replace(/\s/g, ''); return ns.includes(mk) || mk.includes(ns); })
        || CAT_FALLBACK;
};

const CATS = ['Аренда', 'Коммунальные услуги', 'Зарплата', 'Продукты', 'Налоги', 'Регистрация', 'Интернет', 'Реклама', 'Другое'];
const fmt = n => Number(n).toLocaleString('ru');

// ─── Векторные иконки категорий (под бренд) ───────────────────────────────────
// Известные категории → чёткая lucide-иконка в фирменном цвете категории.
// Кастомные/неизвестные категории откатываются на выбранный emoji.
const CAT_ICON_MAP = {
    'Аренда': Home,
    'Коммунальные услуги': Lightbulb,
    'Зарплата': Briefcase,
    'Аванс': Coins,
    'Продукты': ShoppingCart,
    'Налоги': Landmark,
    'Регистрация': ClipboardList,
    'Интернет': Globe,
    'Реклама': Megaphone,
    'Газ': Flame,
    'Электричество': Zap,
    'Вода': Droplets,
    'Ремонт': Wrench,
    'Другое': Package,
    'Возврат': RotateCcw,
};
// Иконки под лого (public/icons/<file>). Значение = имя файла с расширением.
// Ключи — нормализованные имена категорий (в т.ч. кастомные вроде «Свет»).
const CAT_FILE = {
    'коммунальные услуги': 'utilities.png',
    'электричество':       'electricity.svg',
    'свет':                'electricity.svg',
    'другое':              'box.svg',
};
const ICON_BASE = import.meta.env.BASE_URL;
const normCatName = (c) => (c || '').trim().toLowerCase().replace(/ё/g, 'е');
const CatIcon = ({ cat, emoji, size = 18, color }) => {
    const meta = getCat(cat);
    const key = meta && meta.key;
    const file = CAT_FILE[normCatName(cat)] || (key ? CAT_FILE[normCatName(key)] : null);
    const [imgFailed, setImgFailed] = useState(false);
    if (file && !imgFailed) {
        const isSvg = file.endsWith('.svg');
        return (
            <span style={{ display: 'inline-flex', width: size + 4, height: size + 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 6, flexShrink: 0 }}>
                <img src={`${ICON_BASE}icons/${file}`} alt="" draggable={false}
                     onError={() => setImgFailed(true)}
                     style={{ width: '100%', height: '100%', objectFit: isSvg ? 'contain' : 'cover' }} />
            </span>
        );
    }
    const Icon = key ? CAT_ICON_MAP[key] : null;
    if (Icon) {
        return <Icon size={size} strokeWidth={2.2} style={{ color: color || meta.bar || '#0f9688' }} />;
    }
    return <span style={{ fontSize: Math.round(size * 0.95), lineHeight: 1 }}>{emoji ?? (meta && meta.icon) ?? '📦'}</span>;
};

const guessIcon = (name) => {
    const n = (name || '').toLowerCase().replace(/ё/g, 'е');
    const map = [
        ['газ', '🔥'], ['плит', '🔥'],
        ['свет', '⚡'], ['электр', '⚡'],
        ['вода', '💧'], ['водопровод', '💧'],
        ['аренд', '🏠'], ['квартир', '🏠'], ['помещен', '🏢'], ['офис', '🏢'],
        ['интернет', '🌐'], ['связ', '📡'], ['телефон', '📱'],
        ['зарплат', '💼'], ['аванс', '💰'],
        ['налог', '🏛️'], ['штраф', '⚠️'], ['пеня', '⚠️'],
        ['еда', '🍽️'], ['продукт', '🛒'], ['магазин', '🛍️'],
        ['реклам', '📣'], ['маркетинг', '📊'],
        ['ремонт', '🔧'], ['строит', '🏗️'], ['матери', '🧱'],
        ['уборк', '🧹'], ['чистк', '🧽'],
        ['регистрац', '📋'], ['докумен', '📄'],
        ['медиц', '💊'], ['врач', '🏥'], ['здоров', '💊'],
        ['транспорт', '🚗'], ['бензин', '⛽'], ['топлив', '⛽'],
        ['страховк', '🛡️'], ['банк', '🏦'], ['кредит', '💳'],
        ['оборудован', '🖥️'], ['техник', '🔌'],
        ['коммунал', '💡'], ['жкх', '🏢'],
        ['мусор', '🗑️'], ['вывоз', '🗑️'],
        ['охран', '🔐'], ['безопасн', '🔐'],
        ['питан', '🍽️'], ['кофе', '☕'],
        ['кондицион', '❄️'], ['отоплен', '🌡️'],
        ['лицензи', '📜'], ['сертифик', '📜'],
        ['хозтовар', '🧴'], ['инвентар', '📦'],
        ['бель', '🛏️'], ['постель', '🛏️'], ['матрас', '🛏️'], ['полотенц', '🧺'],
        ['прачечн', '🧺'], ['стирк', '🧺'], ['порош', '🧴'],
        ['мебел', '🪑'], ['посуд', '🍽️'], ['кух', '🍽️'],
        ['зеркал', '🪞'], ['лампочк', '💡'], ['розетк', '🔌'],
        ['садовник', '🌳'], ['озелен', '🌳'], ['цвет', '🌿'],
        ['бухгалт', '🧾'], ['юрист', '⚖️'], ['консульт', '💬'],
        ['комисси', '💳'], ['эквайр', '💳'], ['процент', '💳'],
        ['сантехник', '🚿'], ['электрик', '⚡'], ['мастер', '🛠️'],
        ['ключ', '🔑'], ['замок', '🔑'], ['домофон', '🔔'],
        ['канцел', '✏️'], ['бумаг', '📄'], ['печат', '🖨️'],
        ['подар', '🎁'], ['премь', '🏆'], ['бонус', '🎁'],
        ['доставк', '🚚'], ['логист', '🚚'], ['курьер', '🛵'],
        ['кадастр', '🏘️'], ['e-mehmon', '📋'], ['эмехмон', '📋'], ['миграц', '🛂'],
        ['чай', '🍵'], ['сахар', '🍬'], ['буфет', '🥪'],
        ['видеонаблюд', '📹'], ['камер', '📹'], ['wifi', '📶'], ['вайфай', '📶'],
        ['вентиляц', '🌀'], ['обогрев', '🌡️'], ['котёл', '🔥'], ['котел', '🔥'],
    ];
    for (const [kw, em] of map) { if (n.includes(kw)) return em; }
    return '📦';
};

// Отдельный компонент — локальный стейт не перерисовывает весь список
const ExpenseEditForm = ({ expense, onSave, onCancel, saving }) => {
    const toLocal = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    const [comment, setComment] = useState(expense.comment || '');
    const [amount, setAmount] = useState(expense.amount || '');
    const [date, setDate] = useState(() => toLocal(expense.date));

    const handleSubmit = (ev) => {
        ev.preventDefault();
        const patch = {};
        if (comment !== (expense.comment || '')) patch.comment = comment;
        if (amount && String(amount) !== String(expense.amount)) patch.amount = Number(amount);
        if (date) {
            const newDate = new Date(date).toISOString();
            if (newDate !== expense.date) patch.date = newDate;
        }
        onSave(patch);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 px-5 py-3 bg-indigo-50 border-t border-indigo-100">
            <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                <label className="text-[10px] font-bold text-indigo-500 uppercase tracking-wide">Описание</label>
                <input value={comment} onChange={e => setComment(e.target.value)}
                    placeholder="Комментарий…" autoFocus
                    className="text-sm px-3 py-1.5 border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
            </div>
            <div className="flex flex-col gap-1 w-32">
                <label className="text-[10px] font-bold text-indigo-500 uppercase tracking-wide">Сумма</label>
                <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)}
                    className="text-sm px-3 py-1.5 border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
            </div>
            <div className="flex flex-col gap-1 w-44">
                <label className="text-[10px] font-bold text-indigo-500 uppercase tracking-wide">Дата</label>
                <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)}
                    className="text-sm px-3 py-1.5 border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
            </div>
            <button type="submit" disabled={saving}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white transition-colors">
                {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14} />}
            </button>
            <button type="button" onClick={onCancel}
                className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-100">
                <X size={14} />
            </button>
        </form>
    );
};

export default function ExpensesView({
    filteredExpenses = [],
    expenseCatFilter,
    setExpenseCatFilter,
    expSearch,
    setExpSearch,
    usersList = [],
    onDownloadCSV,
    onAddExpense,
    onDeleteExpense,
    onEditExpenseCategory,
    recurringExpenses = [],
    onAddRecurring,
    onUpdateRecurring,
    onDeleteRecurring,
    onToggleActive,
    onFireNow,
    onAddAdvance,
    onAddRecurringAdvance,
    recurringAdvances = {},
    onBackfillComments,
    onUpdateExpense,
    currentUser,
    selectedHostelFilter,
    lang = 'ru',
}) {
    const t = k => TRANSLATIONS[lang]?.[k] || k;
    const isDark = document.documentElement.dataset.theme === 'dark';
    const locale = lang === 'uz' ? 'uz-UZ' : 'ru-RU';
    const now = new Date();
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super' || currentUser?.login === 'fazliddin';
    const catBg  = m => m ? (isDark ? m.darkBg  : m.bg)   : '#f8fafc';
    const catClr = m => m ? (isDark ? m.darkText : m.text) : '#64748b';

    // ── Per-hostel хранилище категорий/иконок/порядка/архива ──
    // Категории привязаны к выбранному хостелу: создание/удаление/архив
    // действуют только для текущего хостела, не для обоих.
    const hostelKey = ((currentUser?.role === 'admin' || currentUser?.role === 'super')
        ? selectedHostelFilter
        : currentUser?.hostelId) || 'all';
    const lsKey = (base) => `${base}_${hostelKey}`;
    const readLS = (base, fb) => {
        try { const v = localStorage.getItem(lsKey(base)); return v ? JSON.parse(v) : fb; }
        catch { return fb; }
    };

    // ── View & UI state ───────────────────────────────────────────────────────
    const [viewMode, setViewMode] = useState('dashboard');
    const [expandedCard, setExpandedCard] = useState(null);
    const [movingId, setMovingId] = useState(null);
    const [moveTarget, setMoveTarget] = useState('');
    const [moveStaff, setMoveStaff] = useState(''); // кассир для перемещения в «Зарплата»
    const [addingCat, setAddingCat] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [customCategories, setCustomCategories] = useState(() => readLS('exp_custom_cats', []));
    const [customCatIcons, setCustomCatIcons]     = useState(() => readLS('exp_custom_icons', {}));
    const [cardOrder, setCardOrder]               = useState(() => readLS('exp_card_order', null));
    const [archivedCategories, setArchivedCategories] = useState(() => readLS('exp_archived_cats', []));
    const [showArchive, setShowArchive] = useState(false);
    const [showCatBreakdown, setShowCatBreakdown] = useState(false);
    const [confirmArchiveCat, setConfirmArchiveCat] = useState(null);

    // При переключении хостела перечитываем его настройки категорий.
    useEffect(() => {
        setCustomCategories(readLS('exp_custom_cats', []));
        setCustomCatIcons(readLS('exp_custom_icons', {}));
        setCardOrder(readLS('exp_card_order', null));
        setArchivedCategories(readLS('exp_archived_cats', []));
        setExpandedCard(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hostelKey]);
    const [dragOverIdx, setDragOverIdx] = useState(null);
    const dragIdx = useRef(null);
    const [salaryOpenStaff, setSalaryOpenStaff] = useState(null);
    const [confirmDeleteCat, setConfirmDeleteCat] = useState(null);
    const [confirmDeleteExp, setConfirmDeleteExp] = useState(null); // запись расхода для подтверждения удаления
    const [editCat, setEditCat] = useState(null); // { old, name, icon } — редактирование подгруппы

    // ── Recurring state ───────────────────────────────────────────────────────
    const [recurringOpen, setRecurringOpen] = useState(false);
    const [addForm, setAddForm] = useState(false);
    const [form, setForm] = useState({ name: '', category: 'Аренда', amount: '', comment: '', dayOfMonth: 1, hostelId: 'all' });
    const [editId, setEditId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [advanceTargetId, setAdvanceTargetId] = useState(null);
    const [advanceAmt, setAdvanceAmt] = useState('');
    const [recurringAdvanceTargetId, setRecurringAdvanceTargetId] = useState(null);
    const [recurringAdvanceAmt, setRecurringAdvanceAmt] = useState('');

    // ── List view state ───────────────────────────────────────────────────────
    const [expDateFrom, setExpDateFrom] = useState('');
    const [expDateTo, setExpDateTo] = useState('');
    const [editingExpId, setEditingExpId] = useState(null);
    const [editExpSaving, setEditExpSaving] = useState(false);

    // ── Core data ─────────────────────────────────────────────────────────────
    const amtFn = e => e.category === 'Аванс' ? -(Number(e.amount) || 0) : (Number(e.amount) || 0);
    const mainExpenses = useMemo(() => filteredExpenses.filter(e => e.category !== 'Возврат' && e.category !== 'Аванс'), [filteredExpenses]);
    const refunds = useMemo(() => filteredExpenses.filter(e => e.category === 'Возврат'), [filteredExpenses]);
    const prevMonthDate = useMemo(() => new Date(now.getFullYear(), now.getMonth() - 1, 1), []);

    const thisMonth = useMemo(() =>
        filteredExpenses.filter(e => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && e.category !== 'Возврат'; })
            .reduce((s, e) => s + amtFn(e), 0), [filteredExpenses]);

    const prevMonthExp = useMemo(() =>
        filteredExpenses.filter(e => { const d = new Date(e.date); return d.getMonth() === prevMonthDate.getMonth() && d.getFullYear() === prevMonthDate.getFullYear() && e.category !== 'Возврат'; }),
        [filteredExpenses]);

    const prevMonth = useMemo(() => prevMonthExp.reduce((s, e) => s + amtFn(e), 0), [prevMonthExp]);
    const monthDiff = prevMonth ? Math.round((thisMonth - prevMonth) / prevMonth * 100) : null;
    const totalAll = useMemo(() => filteredExpenses.filter(e => e.category !== 'Возврат').reduce((s, e) => s + amtFn(e), 0), [filteredExpenses]);
    const totalRefunds = useMemo(() => refunds.reduce((s, e) => s + (Number(e.amount) || 0), 0), [refunds]);

    // Общий список категорий из Настроек (применяется ко всем хостелам)
    const centralCats = useMemo(() => {
        try { return (getConfig().expenseCategories || []).filter(c => c && c.name); } catch { return []; }
    }, []);

    // ── Dashboard cards ───────────────────────────────────────────────────────
    const allCatNames = useMemo(() => {
        const fromData = [...new Set(mainExpenses.map(e => e.category).filter(Boolean))];
        const all = [...new Set([...fromData, ...customCategories, ...centralCats.map(c => c.name)])];
        return all.filter(c => !archivedCategories.includes(c));
    }, [mainExpenses, customCategories, archivedCategories, centralCats]);

    // Кассиры — для назначения расхода в зарплату конкретному сотруднику
    // + синтетический получатель «Уборка» (уборщицы — не пользователи приложения)
    const cashierList = useMemo(
        () => [
            ...usersList.filter(u => u.role === 'cashier' || u.role === 'admin').map(u => ({ id: u.id || u.login, name: u.name || u.login })),
            { id: '__cleaning__', name: '🧹 Уборка' },
        ],
        [usersList]
    );

    const cardData = useMemo(() => {
        const pm = prevMonthDate;
        return allCatNames.map(cat => {
            const thisMonthItems = mainExpenses.filter(e => { const d = new Date(e.date); return e.category === cat && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
            const lastMonthItems = mainExpenses.filter(e => { const d = new Date(e.date); return e.category === cat && d.getFullYear() === pm.getFullYear() && d.getMonth() === pm.getMonth(); });
            const thisMonthTotal = thisMonthItems.reduce((s, e) => s + (Number(e.amount) || 0), 0);
            const lastMonthTotal = lastMonthItems.reduce((s, e) => s + (Number(e.amount) || 0), 0);
            const allRecent = mainExpenses.filter(e => e.category === cat).sort((a, b) => new Date(b.date) - new Date(a.date));
            return { cat, thisMonthTotal, lastMonthTotal, allRecent };
        }).sort((a, b) => b.thisMonthTotal - a.thisMonthTotal);
    }, [allCatNames, mainExpenses, prevMonthDate]);

    const orderedCardData = useMemo(() => {
        if (!cardOrder || cardOrder.length === 0) return cardData;
        const ordered = [];
        cardOrder.forEach(cat => { const item = cardData.find(d => d.cat === cat); if (item) ordered.push(item); });
        cardData.forEach(d => { if (!cardOrder.includes(d.cat)) ordered.push(d); });
        return ordered;
    }, [cardData, cardOrder]);

    const getEffectiveIcon = useCallback((cat) => {
        const m = getCat(cat);
        if (m !== CAT_FALLBACK) return m.icon;
        const central = centralCats.find(c => c.name === cat);
        return customCatIcons[cat] || (central && central.icon) || guessIcon(cat);
    }, [customCatIcons, centralCats]);

    // ── Custom category management ────────────────────────────────────────────
    const handleAddCustomCat = useCallback(() => {
        const name = newCatName.trim();
        if (!name) return;
        const icon = guessIcon(name);
        const updated = [...new Set([...customCategories, name])];
        setCustomCategories(updated);
        localStorage.setItem(lsKey('exp_custom_cats'), JSON.stringify(updated));
        const updatedIcons = { ...customCatIcons, [name]: icon };
        setCustomCatIcons(updatedIcons);
        localStorage.setItem(lsKey('exp_custom_icons'), JSON.stringify(updatedIcons));
        setNewCatName(''); setAddingCat(false); setExpandedCard(name);
    }, [newCatName, customCategories, customCatIcons, hostelKey]);

    const handleRemoveCustomCat = useCallback((cat) => {
        const updated = customCategories.filter(c => c !== cat);
        setCustomCategories(updated);
        localStorage.setItem(lsKey('exp_custom_cats'), JSON.stringify(updated));
        if (expandedCard === cat) setExpandedCard(null);
    }, [customCategories, expandedCard, hostelKey]);

    // ── Архив категорий (per-hostel) ──
    const handleArchiveCat = useCallback((cat) => {
        const updated = [...new Set([...archivedCategories, cat])];
        setArchivedCategories(updated);
        localStorage.setItem(lsKey('exp_archived_cats'), JSON.stringify(updated));
        if (expandedCard === cat) setExpandedCard(null);
    }, [archivedCategories, expandedCard, hostelKey]);

    const handleUnarchiveCat = useCallback((cat) => {
        const updated = archivedCategories.filter(c => c !== cat);
        setArchivedCategories(updated);
        localStorage.setItem(lsKey('exp_archived_cats'), JSON.stringify(updated));
    }, [archivedCategories, hostelKey]);

    // Редактирование подгруппы (кастомной категории): переименование + значок + перетег расходов
    const handleEditCustomCat = useCallback(async (oldName, newNameRaw, newIcon) => {
        const newName = (newNameRaw || '').trim() || oldName;
        const renamed = newName !== oldName;
        let cats = customCategories;
        if (renamed) cats = [...new Set(customCategories.map(c => c === oldName ? newName : c))];
        setCustomCategories(cats);
        localStorage.setItem(lsKey('exp_custom_cats'), JSON.stringify(cats));
        const icons = { ...customCatIcons };
        if (renamed) delete icons[oldName];
        icons[newName] = newIcon || guessIcon(newName);
        setCustomCatIcons(icons);
        localStorage.setItem(lsKey('exp_custom_icons'), JSON.stringify(icons));
        if (renamed && onEditExpenseCategory) {
            const toRetag = filteredExpenses.filter(e => e.category === oldName);
            for (const e of toRetag) { try { await onEditExpenseCategory(e.id, newName); } catch { /* skip */ } }
        }
        if (expandedCard === oldName) setExpandedCard(newName);
    }, [customCategories, customCatIcons, filteredExpenses, onEditExpenseCategory, expandedCard, hostelKey]);

    const ICON_CHOICES = ['📦','🏠','🏢','💡','⚡','💧','🔥','🌐','📱','💼','💰','🛒','🍽️','☕','🧺','🛏️','🪑','🔧','🛠️','🧹','🧴','🚗','⛽','🏦','💳','📣','📊','📋','📄','🖨️','🔑','🔐','📹','🌳','💊','🏥','🎁','🚚','🧾','⚖️','❄️','🌡️','🗑️'];

    const handleMove = useCallback(async (expenseId) => {
        if (!moveTarget) return;
        // Перемещение в «Зарплата» — назначаем расход конкретному кассиру (взял ЗП / вычет).
        if (moveTarget === 'Зарплата') {
            if (!moveStaff || !onUpdateExpense) return;
            await onUpdateExpense(expenseId, { category: 'Зарплата', targetStaffId: moveStaff });
        } else if (onEditExpenseCategory) {
            await onEditExpenseCategory(expenseId, moveTarget);
        }
        setMovingId(null); setMoveTarget(''); setMoveStaff('');
    }, [moveTarget, moveStaff, onEditExpenseCategory, onUpdateExpense]);

    // ── List view helpers ─────────────────────────────────────────────────────
    const cats = useMemo(() => Array.from(new Set(filteredExpenses.filter(e => e.category !== 'Возврат').map(e => e.category).filter(Boolean))), [filteredExpenses]);
    const byCategory = useMemo(() => cats.map(c => ({ name: c, total: filteredExpenses.filter(e => e.category === c).reduce((s, e) => s + (Number(e.amount) || 0), 0) })).sort((a, b) => b.total - a.total), [cats, filteredExpenses]);

    const displayed = expenseCatFilter === 'Все'
        ? filteredExpenses.filter(e => e.category !== 'Возврат')
        : filteredExpenses.filter(e => e.category === expenseCatFilter && e.category !== 'Возврат');
    const sorted = [...displayed].sort((a, b) => new Date(b.date) - new Date(a.date));
    const dateSorted = (expDateFrom || expDateTo)
        ? sorted.filter(e => { const d = new Date(e.date); if (expDateFrom && d < new Date(expDateFrom)) return false; if (expDateTo && d > new Date(expDateTo + 'T23:59:59')) return false; return true; })
        : sorted;

    const byMonth = {};
    dateSorted.forEach(e => {
        const d = new Date(e.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!byMonth[key]) byMonth[key] = { items: [], total: 0 };
        byMonth[key].items.push(e);
        byMonth[key].total += amtFn(e);
    });

    const searchLow = expSearch.toLowerCase();
    const matchFn = e => !searchLow || (e.category || '').toLowerCase().includes(searchLow) || (e.comment || '').toLowerCase().includes(searchLow);

    // ── Recurring helpers ─────────────────────────────────────────────────────
    const startEdit = (tmpl) => { setEditId(tmpl.id); setEditForm({ name: tmpl.name, category: tmpl.category || 'Аренда', amount: tmpl.amount, comment: tmpl.comment || '', dayOfMonth: tmpl.dayOfMonth || 1, hostelId: tmpl.hostelId || 'all' }); setAddForm(false); };
    const handleAddForm = async (e) => { e.preventDefault(); if (!form.name || !form.amount) return; await onAddRecurring?.(form); setForm({ name: '', category: 'Аренда', amount: '', comment: '', dayOfMonth: 1, hostelId: 'all' }); setAddForm(false); };
    const handleEditForm = async (e) => { e.preventDefault(); if (!editForm.name || !editForm.amount) return; await onUpdateRecurring?.(editId, { ...editForm, amount: Number(editForm.amount), dayOfMonth: Number(editForm.dayOfMonth) }); setEditId(null); setEditForm({}); };

    const allCatsForSelect = [...CATS, ...customCategories.filter(c => !CATS.includes(c))];

    // ── Recurring block (shared) ──────────────────────────────────────────────
    const now_today = now.getDate();
    const RecurringSection = () => isAdmin ? (
        <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden">
            <button onClick={() => setRecurringOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-3.5 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                <div className="flex items-center gap-2.5">
                    <span className="text-base">🔄</span>
                    <span className="text-sm font-black text-indigo-700">{t('expRecurring')}</span>
                    {recurringExpenses.length > 0 && <span className="text-xs bg-indigo-200 text-indigo-700 rounded-full px-2 py-0.5 font-bold">{recurringExpenses.length}</span>}
                </div>
                {recurringOpen ? <ChevronUp size={16} className="text-indigo-400" /> : <ChevronDown size={16} className="text-indigo-400" />}
            </button>
            {recurringOpen && (
                <div className="divide-y divide-slate-50">
                    {recurringExpenses.length === 0 && !addForm && <div className="py-8 text-center text-slate-400 text-sm">{t('expNoTemplates')}</div>}
                    {recurringExpenses.map(tmpl => {
                        const m = getCat(tmpl.category);
                        const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                        const firedThisMonth = tmpl.lastFiredMonth === curMonthKey;
                        const isEditing = editId === tmpl.id;
                        const isSalaryTemplate = tmpl.category === 'Зарплата';
                        const advancedThisMonth = recurringAdvances[tmpl.id] || 0;
                        const isAdvanceOpen = recurringAdvanceTargetId === tmpl.id;
                        return (
                            <div key={tmpl.id}>
                                <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0" style={{ background: m.bg }}><CatIcon cat={tmpl.category} emoji={m.icon} size={18} /></div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-bold text-slate-700">{tmpl.name}</span>
                                            <span className="text-xs font-semibold" style={{ color: m.text }}>{tmpl.category}</span>
                                            {firedThisMonth && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">✓ {t('expCharged')}</span>}
                                            {advancedThisMonth > 0 && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">{t('expAdvanceBadge')} {fmt(advancedThisMonth)}</span>}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            <span className="text-xs text-slate-400">📅 {tmpl.dayOfMonth}-го числа</span>
                                            {tmpl.hostelId !== 'all' && <span className="text-xs text-slate-400">· {tmpl.hostelId === 'hostel1' ? 'Хостел №1' : tmpl.hostelId === 'hostel2' ? 'Хостел №2' : tmpl.hostelId}</span>}
                                            {tmpl.comment && <span className="text-xs text-slate-400 truncate">· {tmpl.comment}</span>}
                                            {isSalaryTemplate && advancedThisMonth > 0 && <span className="text-xs text-indigo-500">· к выплате: {fmt(Math.max(0, Number(tmpl.amount) - advancedThisMonth))}</span>}
                                        </div>
                                    </div>
                                    <span className="text-sm font-black text-rose-600 shrink-0">{fmt(tmpl.amount)}</span>
                                    {isSalaryTemplate && (
                                        <button onClick={() => { setRecurringAdvanceTargetId(isAdvanceOpen ? null : tmpl.id); setRecurringAdvanceAmt(''); }} title="Выдать аванс"
                                            className={`p-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0 text-xs font-bold ${isAdvanceOpen ? 'bg-amber-300 text-amber-900' : 'bg-amber-100 hover:bg-amber-200'}`}>💰</button>
                                    )}
                                    <button onClick={() => onToggleActive?.(tmpl.id, tmpl.active)} title={tmpl.active ? 'Выключить' : 'Включить'} style={{ color: tmpl.active ? '#6366f1' : '#94a3b8' }} className="p-0 shrink-0">
                                        {tmpl.active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                    </button>
                                    <button onClick={() => isEditing ? setEditId(null) : startEdit(tmpl)} title={isEditing ? 'Отмена' : 'Редактировать'} style={{ color: isEditing ? '#4f46e5' : '#334155' }}
                                        className={`p-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0 ${isEditing ? 'bg-indigo-100' : 'bg-slate-100 hover:bg-indigo-100'}`}>
                                        {isEditing ? <X size={16} /> : <Pencil size={16} />}
                                    </button>
                                    <button onClick={() => onFireNow?.(tmpl)} title="Внести сейчас" className="p-0 w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-100 hover:bg-emerald-200 transition-colors shrink-0 text-emerald-700"><Play size={16} /></button>
                                    <button onClick={() => onDeleteRecurring?.(tmpl.id)} className="p-0 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-rose-100 transition-colors shrink-0 text-slate-600"><Trash2 size={16} /></button>
                                </div>
                                {isAdvanceOpen && (
                                    <div className="px-5 py-3 bg-amber-50 border-t border-amber-100 flex items-center gap-3 flex-wrap">
                                        <span className="text-xs font-bold text-amber-700 shrink-0">💰 {t('expAdvanceBadge')} ({tmpl.name}):</span>
                                        {advancedThisMonth > 0 && <span className="text-xs text-amber-600">уже выдано {fmt(advancedThisMonth)}</span>}
                                        <input type="number" min="1" max={tmpl.amount} value={recurringAdvanceAmt} onChange={e => setRecurringAdvanceAmt(e.target.value)} placeholder="Сумма…" autoFocus
                                            className="w-36 px-3 py-1.5 text-sm border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-200" />
                                        <button disabled={!recurringAdvanceAmt} onClick={async () => { if (!recurringAdvanceAmt) return; await onAddRecurringAdvance?.({ template: tmpl, amount: Number(recurringAdvanceAmt) }); setRecurringAdvanceTargetId(null); setRecurringAdvanceAmt(''); }}
                                            className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-bold transition-colors">{t('done')}</button>
                                        <button onClick={() => setRecurringAdvanceTargetId(null)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-100 transition-colors">{t('cancel')}</button>
                                    </div>
                                )}
                                {isEditing && (
                                    <form onSubmit={handleEditForm} className="px-5 py-4 bg-indigo-50 border-t border-indigo-100 space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="col-span-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">{t('expName')} *</label>
                                                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">{t('category')}</label>
                                                <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200">
                                                    {allCatsForSelect.map(c => <option key={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">{t('amount')} *</label>
                                                <input type="number" min="1" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} required className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">{t('expDayOfMonth')}</label>
                                                <input type="number" min="1" max="28" value={editForm.dayOfMonth} onChange={e => setEditForm(f => ({ ...f, dayOfMonth: parseInt(e.target.value) || 1 }))} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">{t('expHostel')}</label>
                                                <select value={editForm.hostelId} onChange={e => setEditForm(f => ({ ...f, hostelId: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200">
                                                    <option value="all">{t('expAllHostels')}</option>
                                                    <option value="hostel1">{t('expHostel1')}</option>
                                                    <option value="hostel2">{t('expHostel2')}</option>
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">{t('comment')}</label>
                                                <input value={editForm.comment} onChange={e => setEditForm(f => ({ ...f, comment: e.target.value }))} placeholder="Необязательно…" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button type="submit" className="flex-1 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold transition-colors">{t('save')}</button>
                                            <button type="button" onClick={() => setEditId(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-100 transition-colors">{t('cancel')}</button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        );
                    })}
                    {addForm ? (
                        <form onSubmit={handleAddForm} className="px-5 py-4 bg-slate-50 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">{t('expName')} *</label>
                                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Аренда офиса…" required className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">{t('category')}</label>
                                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200">
                                        {allCatsForSelect.map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">{t('amount')} *</label>
                                    <input type="number" min="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" required className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">{t('expDayOfMonth')}</label>
                                    <input type="number" min="1" max="28" value={form.dayOfMonth} onChange={e => setForm(f => ({ ...f, dayOfMonth: parseInt(e.target.value) || 1 }))} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">{t('expHostel')}</label>
                                    <select value={form.hostelId} onChange={e => setForm(f => ({ ...f, hostelId: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200">
                                        <option value="all">{t('expAllHostels')}</option>
                                        <option value="hostel1">{t('expHostel1')}</option>
                                        <option value="hostel2">{t('expHostel2')}</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">{t('comment')}</label>
                                    <input value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))} placeholder="Необязательно…" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button type="submit" className="flex-1 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold transition-colors">Сохранить</button>
                                <button type="button" onClick={() => setAddForm(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-100 transition-colors">Отмена</button>
                            </div>
                        </form>
                    ) : (
                        <div className="px-5 py-3">
                            <button onClick={() => setAddForm(true)} className="flex items-center gap-2 text-sm font-semibold text-indigo-500 hover:text-indigo-700 transition-colors">
                                <Plus size={15} /> {t('expAddTemplate')}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    ) : null;

    // ── Move inline UI ────────────────────────────────────────────────────────
    const MoveForm = ({ expId, currentCat }) => (
        <div className="flex items-center gap-1.5 px-2 py-2 bg-indigo-50 rounded-lg my-0.5 flex-wrap">
            <span className="text-[11px] text-indigo-600 font-semibold shrink-0">→</span>
            <select value={moveTarget} onChange={ev => { setMoveTarget(ev.target.value); setMoveStaff(''); }}
                className="flex-1 min-w-[120px] text-xs px-2 py-1 border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                <option value="">— выберите —</option>
                {allCatNames.filter(c => c !== currentCat).map(c => <option key={c} value={c}>{getCat(c).icon} {c}</option>)}
            </select>
            {moveTarget === 'Зарплата' && (
                <select value={moveStaff} onChange={ev => setMoveStaff(ev.target.value)}
                    className="flex-1 min-w-[120px] text-xs px-2 py-1 border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                    <option value="">— кассир —</option>
                    {cashierList.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
            )}
            <button onClick={() => handleMove(expId)} disabled={!moveTarget || (moveTarget === 'Зарплата' && !moveStaff)}
                className="w-6 h-6 flex items-center justify-center rounded-lg bg-indigo-500 disabled:opacity-40 hover:bg-indigo-600 text-white transition-colors">
                <Check size={11} />
            </button>
            <button onClick={() => { setMovingId(null); setMoveTarget(''); setMoveStaff(''); }}
                className="w-6 h-6 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-100 transition-colors">
                <X size={11} />
            </button>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                        <Wallet size={20} className="text-rose-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800">{t('expenses')}</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {filteredExpenses.filter(e => e.category !== 'Возврат').length} записей{refunds.length > 0 ? ` · ${refunds.length} возвратов` : ''}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                    <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
                        <button onClick={() => setViewMode('dashboard')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'dashboard' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            <LayoutGrid size={12} /> Дашборд
                        </button>
                        <button onClick={() => setViewMode('list')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            <List size={12} /> Список
                        </button>
                    </div>
                    <button onClick={onDownloadCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
                        <Download size={15} /> CSV
                    </button>
                    {isAdmin && (
                        <button onClick={() => onBackfillComments?.()} title="Заполнить пустые описания расходов за текущий месяц"
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
                            <FileText size={15} /> Описания
                        </button>
                    )}
                    <button onClick={() => onAddExpense?.()} className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-sm shadow-rose-200 transition-colors">
                        <Plus size={16} /> {t('addExpense2')}
                    </button>
                </div>
            </div>

            {/* ── KPI row (модерн) ── */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { icon: '📅', label: 'Этот месяц', value: thisMonth, valColor: '#b45309', chipBg: '#fef3c7', circle: 'rgba(245,158,11,0.12)',
                      badge: monthDiff !== null ? { up: monthDiff > 0, pct: Math.abs(monthDiff) } : null, sub: null },
                    { icon: '📆', label: 'Прошлый месяц', value: prevMonth, valColor: '#334155', chipBg: '#f1f5f9', circle: 'rgba(148,163,184,0.14)',
                      badge: null, sub: `${prevMonthExp.length} записей` },
                    { icon: '💸', label: 'Всего', value: totalAll, valColor: '#e11d48', chipBg: '#ffe4e6', circle: 'rgba(244,63,94,0.12)',
                      badge: null, sub: `${cats.length} категорий` },
                ].map(c => (
                    <div key={c.label} className="relative bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                        <div className="absolute -right-5 -top-5 w-20 h-20 rounded-full" style={{ background: isDark ? 'rgba(148,163,184,0.1)' : c.circle }} />
                        <div className="relative">
                            <div className="flex items-center justify-between mb-3">
                                <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm" style={{ background: isDark ? 'rgba(148,163,184,0.15)' : c.chipBg }}>{c.icon}</span>
                                {c.badge ? (
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${c.badge.up ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-600'}`}>
                                        {c.badge.up ? '↑' : '↓'} {c.badge.pct}%
                                    </span>
                                ) : c.sub ? (
                                    <span className="text-[10px] font-bold text-slate-400 bg-white/80 border border-slate-100 px-2 py-0.5 rounded-full">{c.sub}</span>
                                ) : null}
                            </div>
                            <div className="text-2xl font-black tabular-nums" style={{ color: c.valColor }}>{fmt(c.value)}</div>
                            <div className="text-[11px] font-semibold text-slate-400 mt-0.5 uppercase tracking-wide">{c.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ══ DASHBOARD VIEW ══════════════════════════════════════════════ */}
            {viewMode === 'dashboard' && (
                <div className="space-y-4">
                    <RecurringSection />

                    {/* Category cards grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {orderedCardData.map(({ cat, thisMonthTotal, lastMonthTotal, allRecent }, idx) => {
                            const m = getCat(cat);
                            const effectiveIcon = getEffectiveIcon(cat);
                            const isExpanded = expandedCard === cat;
                            const delta = lastMonthTotal > 0 ? Math.round((thisMonthTotal - lastMonthTotal) / lastMonthTotal * 100) : null;
                            const barPct = lastMonthTotal > 0 ? Math.min(100, Math.round(thisMonthTotal / lastMonthTotal * 100)) : (thisMonthTotal > 0 ? 100 : 0);
                            const displayItems = isExpanded ? allRecent : allRecent.slice(0, 4);
                            const isCustom = customCategories.includes(cat) && !CAT_META.find(x => x.key === cat);
                            const isDraggingOver = dragOverIdx === idx;

                            // ── Salary breakdown: by month → by staff ─────────
                            const isSalaryCard = cat === 'Зарплата';
                            const salaryByMonth = isSalaryCard ? (() => {
                                const byMonth = {};
                                allRecent.forEach(e => {
                                    const d = new Date(e.date);
                                    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                                    if (!byMonth[mk]) byMonth[mk] = { mk, total: 0, byStaff: {} };
                                    const sid = e.targetStaffId || e.staffId || '__unknown__';
                                    if (!byMonth[mk].byStaff[sid]) byMonth[mk].byStaff[sid] = { sid, total: 0 };
                                    byMonth[mk].byStaff[sid].total += Number(e.amount) || 0;
                                    byMonth[mk].total += Number(e.amount) || 0;
                                });
                                return Object.values(byMonth).sort((a, b) => b.mk.localeCompare(a.mk));
                            })() : null;

                            return (
                                <div key={cat}
                                    draggable
                                    onDragStart={() => { dragIdx.current = idx; }}
                                    onDragOver={(e) => { e.preventDefault(); if (dragIdx.current !== idx) setDragOverIdx(idx); }}
                                    onDragLeave={() => setDragOverIdx(null)}
                                    onDrop={() => {
                                        if (dragIdx.current === null || dragIdx.current === idx) { setDragOverIdx(null); return; }
                                        const newOrder = orderedCardData.map(d => d.cat);
                                        const [removed] = newOrder.splice(dragIdx.current, 1);
                                        newOrder.splice(idx, 0, removed);
                                        setCardOrder(newOrder);
                                        localStorage.setItem(lsKey('exp_card_order'), JSON.stringify(newOrder));
                                        dragIdx.current = null;
                                        setDragOverIdx(null);
                                    }}
                                    onDragEnd={() => { dragIdx.current = null; setDragOverIdx(null); }}
                                    className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col transition-all cursor-grab active:cursor-grabbing select-none
                                        ${isDraggingOver ? 'border-teal-400 shadow-lg shadow-teal-100 scale-[1.01]' : 'border-slate-200 hover:shadow-md'}`}>
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100" style={{ background: isDark ? m.darkBg : m.bg }}>
                                        <div className="flex items-center gap-2">
                                            <CatIcon cat={cat} emoji={effectiveIcon} size={22} />
                                            <span className="font-black text-sm" style={{ color: catClr(m) }}>{cat}</span>
                                            {allRecent.length > 0 && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.6)', color: catClr(m) }}>{allRecent.length}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {isCustom && (
                                                <button onClick={() => setEditCat({ old: cat, name: cat, icon: effectiveIcon })} title="Редактировать подгруппу"
                                                    className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors">
                                                    <Pencil size={12} />
                                                </button>
                                            )}
                                            {isCustom && (
                                                <button onClick={() => setConfirmDeleteCat(cat)} title="Удалить карту"
                                                    className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                                                    <X size={12} />
                                                </button>
                                            )}
                                            <button onClick={() => setConfirmArchiveCat(cat)} title="Убрать раздел в архив"
                                                className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                                                <Archive size={12} />
                                            </button>
                                            <button onClick={() => setExpandedCard(isExpanded ? null : cat)}
                                                className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:bg-white/50 transition-colors">
                                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Monthly total */}
                                    <div className="px-4 pt-3 pb-2">
                                        <div className="flex items-end justify-between mb-2">
                                            <div>
                                                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Этот месяц</div>
                                                <div className="text-2xl font-black" style={{ color: catClr(m) }}>{fmt(thisMonthTotal)}</div>
                                            </div>
                                            {delta !== null && (
                                                <div className={`text-xs font-bold px-2 py-1 rounded-lg ${delta > 0 ? 'bg-rose-50 text-rose-600' : delta < 0 ? 'bg-teal-50 text-teal-600' : 'bg-slate-50 text-slate-400'}`}>
                                                    {delta > 0 ? '↑' : delta < 0 ? '↓' : '='} {Math.abs(delta)}%
                                                </div>
                                            )}
                                        </div>
                                        {lastMonthTotal > 0 && (
                                            <div className="space-y-1">
                                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${barPct}%`, background: m.bar }} />
                                                </div>
                                                <div className="text-[10px] text-slate-400">пред. {fmt(lastMonthTotal)}</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Payment rows */}
                                    {isSalaryCard && salaryByMonth && salaryByMonth.length > 0 ? (
                                        <div className="px-4 pb-2">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">По месяцам</div>
                                            <div className="space-y-1.5">
                                                {salaryByMonth.map(({ mk, total, byStaff }) => {
                                                    const [yr, mo] = mk.split('-');
                                                    const label = new Date(Number(yr), Number(mo) - 1, 1).toLocaleDateString('ru', { month: 'long', year: 'numeric' });
                                                    const isOpen = salaryOpenStaff === mk;
                                                    const staffEntries = Object.values(byStaff).sort((a, b) => b.total - a.total);
                                                    return (
                                                        <div key={mk} className="rounded-xl border border-slate-100 overflow-hidden">
                                                            <button onClick={() => setSalaryOpenStaff(isOpen ? null : mk)}
                                                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 transition-colors text-left">
                                                                <span className="text-base">📅</span>
                                                                <span className="flex-1 text-sm font-bold text-slate-700 capitalize">{label}</span>
                                                                <span className="text-sm font-black text-indigo-600 tabular-nums shrink-0">{fmt(total)}</span>
                                                                <span className="text-slate-300 text-xs shrink-0">{isOpen ? '▲' : '▼'}</span>
                                                            </button>
                                                            {isOpen && (
                                                                <div className="bg-indigo-50 divide-y divide-indigo-100">
                                                                    {staffEntries.map(({ sid, total: amt }) => {
                                                                        const staff = usersList.find(u => u.id === sid || u.login === sid);
                                                                        const name = sid === '__unknown__' ? 'Без сотрудника' : sid === '__cleaning__' ? '🧹 Уборка' : (staff?.name || staff?.login || sid);
                                                                        const initial = name.charAt(0).toUpperCase();
                                                                        return (
                                                                            <div key={sid} className="flex items-center gap-2 px-4 py-2">
                                                                                <div className="w-6 h-6 rounded-full bg-indigo-400 flex items-center justify-center text-white text-[10px] font-black shrink-0">{initial}</div>
                                                                                <span className="flex-1 text-[12px] text-indigo-700 truncate">{name}</span>
                                                                                <span className="text-[12px] font-black text-indigo-600 tabular-nums">{fmt(amt)}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : allRecent.length > 0 ? (
                                        <div className="px-4 pb-2">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                                                {isExpanded ? 'Все платежи' : 'Последние платежи'}
                                            </div>
                                            <div className="space-y-0">
                                                {displayItems.map(e => {
                                                    const d = new Date(e.date);
                                                    const dateStr = `${d.getDate()} ${d.toLocaleDateString('ru', { month: 'short' })}`;
                                                    const isMovingThis = movingId === e.id;
                                                    return (
                                                        <div key={e.id}>
                                                            <div className="group flex items-center gap-1.5 py-1 px-1 rounded-lg hover:bg-slate-50 transition-colors">
                                                                <span className="text-[11px] text-slate-400 shrink-0 w-10 tabular-nums">{dateStr}</span>
                                                                <span className="flex-1 text-[12px] text-slate-600 truncate min-w-0">{e.comment || '—'}</span>
                                                                <span className="text-[12px] font-black shrink-0 tabular-nums" style={{ color: catClr(m) }}>{fmt(e.amount)}</span>
                                                                {onEditExpenseCategory && (
                                                                    <button onClick={() => { setMovingId(isMovingThis ? null : e.id); setMoveTarget(''); setMoveStaff(''); }} title="Переместить"
                                                                        className={`w-5 h-5 shrink-0 flex items-center justify-center rounded transition-colors opacity-0 group-hover:opacity-100
                                                                            ${isMovingThis ? 'opacity-100 bg-indigo-100 text-indigo-600' : 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-50'}`}>
                                                                        <ArrowRightLeft size={10} />
                                                                    </button>
                                                                )}
                                                                <button onClick={() => setConfirmDeleteExp(e)}
                                                                    className="w-5 h-5 shrink-0 flex items-center justify-center rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100">
                                                                    <Trash2 size={10} />
                                                                </button>
                                                            </div>
                                                            {isMovingThis && <MoveForm expId={e.id} currentCat={cat} />}
                                                        </div>
                                                    );
                                                })}
                                                {!isExpanded && allRecent.length > 4 && (
                                                    <button onClick={() => setExpandedCard(cat)} className="text-[11px] text-indigo-500 font-bold hover:underline pl-1 pt-1">
                                                        + ещё {allRecent.length - 4} платежей
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="px-4 pb-2 text-[11px] text-slate-400 italic">Нет записей</div>
                                    )}

                                    {/* Footer */}
                                    <div className="px-4 py-2.5 border-t border-slate-100 mt-auto">
                                        <button onClick={() => onAddExpense?.(cat)}
                                            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                                            <Plus size={11} /> Добавить расход
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Add custom category */}
                        {addingCat ? (
                            <div className="bg-white rounded-2xl border-2 border-dashed border-indigo-300 p-5 flex flex-col items-center justify-center gap-3 min-h-[180px]">
                                <div className="flex items-center gap-2">
                                    <span className="text-3xl transition-all duration-200">{newCatName.trim() ? guessIcon(newCatName) : '📦'}</span>
                                    <span className="text-sm font-bold text-indigo-600">Новая подгруппа</span>
                                </div>
                                <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddCustomCat(); if (e.key === 'Escape') setAddingCat(false); }}
                                    placeholder="Газ, Свет, Вода…" autoFocus
                                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                                {newCatName.trim() && (
                                    <div className="text-[11px] text-slate-400 text-center">
                                        Иконка: <span className="text-base">{guessIcon(newCatName)}</span>
                                        {guessIcon(newCatName) === '📦' && ' — не распознана, будет 📦'}
                                    </div>
                                )}
                                <div className="flex gap-2 w-full">
                                    <button onClick={handleAddCustomCat} disabled={!newCatName.trim()}
                                        className="flex-1 py-2 rounded-xl bg-indigo-500 disabled:opacity-40 hover:bg-indigo-600 text-white text-xs font-bold transition-colors">Создать карту</button>
                                    <button onClick={() => { setAddingCat(false); setNewCatName(''); }}
                                        className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-100 transition-colors">Отмена</button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setAddingCat(true)}
                                className="bg-white rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 p-5 flex flex-col items-center justify-center gap-2 transition-all min-h-[180px] group">
                                <div className="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
                                    <Plus size={22} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                                </div>
                                <span className="text-xs font-bold text-slate-400 group-hover:text-indigo-500 transition-colors">Новая подгруппа</span>
                                <span className="text-[10px] text-slate-300 group-hover:text-indigo-400 transition-colors text-center">Газ, Свет, Вода…</span>
                            </button>
                        )}
                    </div>

                    {/* Архив разделов (per-hostel) */}
                    {archivedCategories.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <button onClick={() => setShowArchive(v => !v)} className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100">
                                <span className="text-sm font-black text-slate-600 flex items-center gap-2"><Archive size={15} /> Архив разделов · {archivedCategories.length}</span>
                                {showArchive ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                            </button>
                            {showArchive && (
                                <div className="divide-y divide-slate-50">
                                    {archivedCategories.map(cat => (
                                        <div key={cat} className="flex items-center gap-3 px-5 py-3">
                                            <CatIcon cat={cat} emoji={getEffectiveIcon(cat)} size={18} />
                                            <span className="flex-1 text-sm font-semibold text-slate-600">{cat}</span>
                                            <button onClick={() => handleUnarchiveCat(cat)}
                                                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
                                                <ArchiveRestore size={14} /> Вернуть
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Refunds in dashboard */}
                    {refunds.length > 0 && (
                        <div className="bg-white rounded-2xl border border-teal-200 overflow-hidden shadow-sm">
                            <div className="flex items-center justify-between px-5 py-3 bg-teal-50 border-b border-teal-100">
                                <span className="text-sm font-black text-teal-700">💚 Возвраты гостям</span>
                                <span className="text-sm font-black text-teal-600">{fmt(totalRefunds)} сум · {refunds.length} записей</span>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {[...refunds].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5).map(e => {
                                    const d = new Date(e.date);
                                    return (
                                        <div key={e.id} className="group flex items-center gap-3 px-5 py-3 hover:bg-teal-50 transition-colors">
                                            <span className="text-base">💚</span>
                                            <span className="flex-1 text-sm text-teal-700 font-semibold">{e.comment || 'Возврат'}</span>
                                            <span className="text-xs text-slate-400">{d.getDate()} {d.toLocaleDateString('ru', { month: 'short' })}</span>
                                            <span className="text-sm font-black text-teal-600 tabular-nums">↩ {fmt(e.amount)}</span>
                                            <button onClick={() => setConfirmDeleteExp(e)}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-rose-100 transition-colors shrink-0 opacity-0 group-hover:opacity-100 text-slate-500">
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ══ LIST VIEW ═══════════════════════════════════════════════════ */}
            {viewMode === 'list' && (
                <div className="space-y-3">
                    {/* Залипающие чипы быстрого перехода по разделам */}
                    {byCategory.length > 0 && (
                        <div className="sticky top-0 z-20 -mx-3 md:-mx-6 -mb-1 px-3 md:px-6 py-2 border-b border-slate-200"
                            style={{ background: isDark ? 'rgba(15,23,42,0.96)' : 'rgba(240,242,245,0.96)', backdropFilter: 'blur(6px)' }}>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <button onClick={() => setExpenseCatFilter('Все')}
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${expenseCatFilter === 'Все' ? 'bg-rose-500 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
                                    Все
                                </button>
                                {byCategory.filter(c => !archivedCategories.includes(c.name)).map(c => {
                                    const m = getCat(c.name);
                                    const active = expenseCatFilter === c.name;
                                    return (
                                        <button key={c.name} onClick={() => setExpenseCatFilter(active ? 'Все' : c.name)}
                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border ${active ? 'text-white shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                            style={active ? { background: m.bar || '#f43f5e', borderColor: 'transparent' } : {}}>
                                            <CatIcon cat={c.name} emoji={getEffectiveIcon(c.name)} size={13} color={active ? '#fff' : undefined} />{c.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {/* Category breakdown bar — компактный, сворачиваемый */}
                    {byCategory.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <button onClick={() => setShowCatBreakdown(v => !v)} className="w-full flex items-center justify-between px-4 py-3">
                                <span className="text-sm font-black text-slate-600 uppercase tracking-wide">{t('expByCategory')}</span>
                                <span className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400">{fmt(totalAll)} сум</span>
                                    {showCatBreakdown ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                </span>
                            </button>
                            {showCatBreakdown && (
                                <div className="px-3 pb-3 max-h-72 overflow-y-auto">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
                                        {byCategory.map(c => {
                                            const m = getCat(c.name);
                                            const pct = totalAll ? Math.round(c.total / totalAll * 100) : 0;
                                            const active = expenseCatFilter === c.name;
                                            return (
                                                <button key={c.name} onClick={() => setExpenseCatFilter(active ? 'Все' : c.name)}
                                                    className={`flex items-center gap-2 py-1 px-2 rounded-lg text-left transition-colors ${active ? 'bg-slate-100' : 'hover:bg-slate-50'}`} style={{ outline: 'none' }}>
                                                    <CatIcon cat={c.name} emoji={getEffectiveIcon(c.name)} size={16} />
                                                    <span className="text-xs font-semibold flex-1 truncate" style={{ color: active ? catClr(m) : '#475569' }}>{c.name}</span>
                                                    <span className="text-xs font-bold tabular-nums" style={{ color: catClr(m) }}>{fmt(c.total)}</span>
                                                    <span className="text-[10px] font-normal text-slate-400 w-8 text-right tabular-nums">{pct}%</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Search + date filters */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="relative flex-1 min-w-48">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input value={expSearch} onChange={e => setExpSearch(e.target.value)} placeholder={t('expSearchPlaceholder')}
                                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-200 transition-all" />
                        </div>
                        {[
                            { label: 'Этот месяц', f: () => { const n = new Date(); setExpDateFrom(ymdLocal(new Date(n.getFullYear(), n.getMonth(), 1))); setExpDateTo(ymdLocal(new Date(n.getFullYear(), n.getMonth() + 1, 0))); } },
                            { label: 'Прошлый',    f: () => { const n = new Date(); setExpDateFrom(ymdLocal(new Date(n.getFullYear(), n.getMonth() - 1, 1))); setExpDateTo(ymdLocal(new Date(n.getFullYear(), n.getMonth(), 0))); } },
                            { label: '7 дней',     f: () => { const n = new Date(); const s = new Date(n); s.setDate(s.getDate() - 6); setExpDateFrom(ymdLocal(s)); setExpDateTo(ymdLocal(n)); } },
                        ].map(q => (
                            <button key={q.label} onClick={q.f}
                                className="px-2.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors shrink-0">
                                {q.label}
                            </button>
                        ))}
                        <input type="date" value={expDateFrom} onChange={e => setExpDateFrom(e.target.value)}
                            className="px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-200 w-36" />
                        <span className="text-xs text-slate-400 shrink-0">—</span>
                        <input type="date" value={expDateTo} onChange={e => setExpDateTo(e.target.value)}
                            className="px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-200 w-36" />
                        {(expDateFrom || expDateTo) && (
                            <button onClick={() => { setExpDateFrom(''); setExpDateTo(''); }} className="text-xs font-bold text-slate-400 hover:text-rose-500 px-2 py-1 rounded-lg border border-slate-200 bg-white">
                                × {t('expResetFilter')}
                            </button>
                        )}
                        {expenseCatFilter !== 'Все' && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold shrink-0" style={{ background: catBg(getCat(expenseCatFilter)), color: catClr(getCat(expenseCatFilter)) }}>
                                {getCat(expenseCatFilter).icon} {expenseCatFilter}
                                <button onClick={() => setExpenseCatFilter('Все')} className="ml-1 opacity-60 hover:opacity-100">✕</button>
                            </div>
                        )}
                        <span className="text-sm text-slate-400 shrink-0">{dateSorted.filter(matchFn).length} записей</span>
                    </div>

                    <RecurringSection />

                    {/* Grouped by month */}
                    {Object.keys(byMonth).length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center text-slate-400 text-sm">{t('expNoExpenses')}</div>
                    ) : (
                        <div className="space-y-4">
                            {Object.entries(byMonth).map(([mk, mg]) => {
                                const monthItems = mg.items.filter(matchFn);
                                if (monthItems.length === 0) return null;
                                const monthLabel = new Date(mk + '-01').toLocaleDateString(locale, { month: 'long', year: 'numeric' });
                                return (
                                    <div key={mk} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                        <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100">
                                            <span className="text-sm font-black text-slate-700 capitalize">{monthLabel}</span>
                                            <span className="text-sm font-black text-rose-600">₊{fmt(monthItems.reduce((s, e) => s + amtFn(e), 0))}</span>
                                        </div>
                                        <div className="divide-y divide-slate-50">
                                            {(() => {
                                                const byCat = {};
                                                monthItems.forEach(x => { const c = x.category || 'Другое'; (byCat[c] = byCat[c] || []).push(x); });
                                                const catGroups = Object.entries(byCat).map(([c, items]) => ({ c, items, catSum: items.reduce((s, x) => s + amtFn(x), 0) })).sort((a, b) => b.catSum - a.catSum);
                                                const out = [];
                                                catGroups.forEach(({ c, items, catSum }) => {
                                                    const cm = getCat(c); const cicon = getEffectiveIcon(c);
                                                    out.push(
                                                        <div key={'cat-' + mk + '-' + c} className="flex items-center gap-2 px-5 py-2" style={{ background: isDark ? 'rgba(148,163,184,0.08)' : '#f8fafc' }}>
                                                            <span className="w-6 h-6 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ background: catBg(cm) }}><CatIcon cat={c} emoji={cicon} size={14} /></span>
                                                            <span className="text-xs font-black" style={{ color: catClr(cm) }}>{c}</span>
                                                            <span className="text-[10px] text-slate-400 font-semibold">· {items.length}</span>
                                                            <span className="ml-auto text-sm font-black text-slate-700 tabular-nums">{fmt(catSum)}</span>
                                                        </div>
                                                    );
                                                    items.forEach(e => {
                                                const m = getCat(e.category);
                                                const staff = usersList.find(u => u.id === e.staffId || u.login === e.staffId);
                                                const d = new Date(e.date);
                                                const dateStr = `${d.getDate()} ${d.toLocaleDateString(locale, { month: 'short' })}`;
                                                const isSalary = e.category === 'Зарплата';
                                                const isAdvanceRow = e.category === 'Аванс';
                                                const staffAdvances = isSalary ? monthItems.filter(x => x.category === 'Аванс' && x.staffId === e.staffId) : [];
                                                const totalAdvances = staffAdvances.reduce((s, x) => s + (Number(x.amount) || 0), 0);
                                                const remaining = (Number(e.amount) || 0) - totalAdvances;
                                                const isAdvanceOpen = advanceTargetId === e.id;
                                                const isMovingThis = movingId === e.id;
                                                out.push(
                                                    <div key={e.id} className={`group flex flex-col gap-0 ${isAdvanceRow ? 'bg-amber-50/40' : ''}`}>
                                                        <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                                                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 font-bold" style={{ background: catBg(m) }}><CatIcon cat={e.category} emoji={m.icon} size={18} /></div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-bold" style={{ color: catClr(m) }}>{e.category}</span>
                                                                    {staff && <span className="text-xs text-slate-400">{staff.name.split(' ')[0]}</span>}
                                                                    {isAdvanceRow && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">{t('expAdvanceBadge')}</span>}
                                                                </div>
                                                                {e.comment && <div className="text-xs text-slate-500 truncate mt-0.5">{e.comment}</div>}
                                                                {isSalary && totalAdvances > 0 && (
                                                                    <div className="text-xs text-amber-700 mt-0.5 font-semibold">
                                                                        аванс: −{fmt(totalAdvances)} · <span className="text-indigo-600">к выплате: {fmt(remaining < 0 ? 0 : remaining)}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className="text-xs text-slate-400 shrink-0 hidden sm:block">{dateStr}</span>
                                                            {isAdvanceRow
                                                                ? <span className="text-base font-black text-amber-600 shrink-0 tabular-nums">−{fmt(e.amount)}</span>
                                                                : <span className="text-base font-black text-rose-600 shrink-0 tabular-nums">₊{fmt(e.amount)}</span>
                                                            }
                                                            {isAdmin && (
                                                                <button onClick={() => {
                                                                    if (editingExpId === e.id) { setEditingExpId(null); return; }
                                                                    setEditingExpId(e.id);
                                                                    setMovingId(null);
                                                                }} title="Редактировать"
                                                                    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors shrink-0
                                                                        ${editingExpId === e.id ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 hover:bg-indigo-50 text-slate-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100'}`}>
                                                                    <Pencil size={13} />
                                                                </button>
                                                            )}
                                                            {onEditExpenseCategory && (
                                                                <button onClick={() => { setMovingId(isMovingThis ? null : e.id); setMoveTarget(''); setMoveStaff(''); setEditingExpId(null); }} title="Переместить"
                                                                    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors shrink-0
                                                                        ${isMovingThis ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 hover:bg-indigo-50 text-slate-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100'}`}>
                                                                    <ArrowRightLeft size={14} />
                                                                </button>
                                                            )}
                                                            {isSalary && !isAdvanceOpen && (
                                                                <button onClick={() => { setAdvanceTargetId(e.id); setAdvanceAmt(''); }} title="Выдать аванс"
                                                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-amber-400 hover:bg-amber-50 transition-colors shrink-0 text-base">💰</button>
                                                            )}
                                                            <button onClick={() => setConfirmDeleteExp(e)}
                                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-rose-100 transition-all shrink-0 text-slate-500">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                        {editingExpId === e.id && (
                                                            <ExpenseEditForm
                                                                expense={e}
                                                                saving={editExpSaving}
                                                                onCancel={() => setEditingExpId(null)}
                                                                onSave={async (patch) => {
                                                                    if (Object.keys(patch).length > 0) {
                                                                        setEditExpSaving(true);
                                                                        try { await onUpdateExpense?.(e.id, patch); } finally { setEditExpSaving(false); }
                                                                    }
                                                                    setEditingExpId(null);
                                                                }}
                                                            />
                                                        )}
                                                        {isMovingThis && (
                                                            <div className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 border-t border-indigo-100 flex-wrap">
                                                                <span className="text-xs font-semibold text-indigo-600 shrink-0">Переместить в:</span>
                                                                <select value={moveTarget} onChange={ev => { setMoveTarget(ev.target.value); setMoveStaff(''); }}
                                                                    className="flex-1 min-w-[140px] text-xs px-2 py-1.5 border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                                                                    <option value="">— выберите —</option>
                                                                    {allCatNames.filter(c => c !== e.category).map(c => <option key={c} value={c}>{getCat(c).icon} {c}</option>)}
                                                                </select>
                                                                {moveTarget === 'Зарплата' && (
                                                                    <select value={moveStaff} onChange={ev => setMoveStaff(ev.target.value)}
                                                                        className="flex-1 min-w-[140px] text-xs px-2 py-1.5 border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                                                                        <option value="">— кассир (взял ЗП) —</option>
                                                                        {cashierList.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                                    </select>
                                                                )}
                                                                <button onClick={() => handleMove(e.id)} disabled={!moveTarget || (moveTarget === 'Зарплата' && !moveStaff)}
                                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-500 disabled:opacity-40 hover:bg-indigo-600 text-white"><Check size={14} /></button>
                                                                <button onClick={() => { setMovingId(null); setMoveTarget(''); setMoveStaff(''); }}
                                                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-100"><X size={14} /></button>
                                                            </div>
                                                        )}
                                                        {isAdvanceOpen && (
                                                            <form onSubmit={async (ev) => { ev.preventDefault(); if (!advanceAmt) return; await onAddAdvance?.({ staffExpense: e, amount: Number(advanceAmt) }); setAdvanceTargetId(null); setAdvanceAmt(''); }}
                                                                className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 border-t border-amber-100">
                                                                <span className="text-xs font-semibold text-amber-700 shrink-0">💰 Сумма аванса:</span>
                                                                <input type="number" min="1" autoFocus value={advanceAmt} onChange={ev => setAdvanceAmt(ev.target.value)} placeholder="0"
                                                                    className="flex-1 min-w-0 text-sm px-3 py-1.5 border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                                                                <button type="submit" className="w-8 h-8 flex items-center justify-center rounded-xl bg-amber-400 hover:bg-amber-500 text-white"><Check size={14} /></button>
                                                                <button type="button" onClick={() => setAdvanceTargetId(null)} className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-100"><X size={14} /></button>
                                                            </form>
                                                        )}
                                                    </div>
                                                );
                                                    });
                                                });
                                                return out;
                                            })()}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Refunds */}
                    {refunds.length > 0 && (
                        <div className="bg-white rounded-2xl border border-teal-200 overflow-hidden shadow-sm">
                            <div className="flex items-center justify-between px-5 py-3 bg-teal-50 border-b border-teal-100">
                                <span className="text-sm font-black text-teal-700">💚 Возвраты гостям</span>
                                <span className="text-sm font-black text-teal-600">{fmt(totalRefunds)} сум · {refunds.length} записей</span>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {[...refunds].sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => {
                                    const staff = usersList.find(u => u.id === e.staffId || u.login === e.staffId);
                                    const d = new Date(e.date);
                                    return (
                                        <div key={e.id} className="group flex items-center gap-3 px-5 py-3.5 hover:bg-teal-50 transition-colors">
                                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 bg-teal-100">💚</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-teal-700">{t('expRefund')}</span>
                                                    {staff && <span className="text-xs text-slate-400">{staff.name.split(' ')[0]}</span>}
                                                </div>
                                                {e.comment && <div className="text-xs text-slate-500 truncate mt-0.5">{e.comment}</div>}
                                            </div>
                                            <span className="text-xs text-slate-400 shrink-0 hidden sm:block">{d.getDate()} {d.toLocaleDateString('ru', { month: 'short' })}</span>
                                            <span className="text-base font-black text-teal-600 shrink-0 tabular-nums">↩ {fmt(e.amount)}</span>
                                            <button onClick={() => setConfirmDeleteExp(e)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-rose-100 transition-all shrink-0 text-slate-500"><Trash2 size={16} /></button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
            {confirmArchiveCat && (
                <div className="modal-centered fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pb-[84px] sm:pb-4" onClick={() => setConfirmArchiveCat(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                                <Archive size={18} className="text-amber-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">Убрать раздел в архив?</h3>
                                <p className="text-sm text-slate-500">«{confirmArchiveCat}»</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-500 mb-5">Раздел скроется из списка. Записи расходов останутся, раздел можно вернуть из архива.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmArchiveCat(null)}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                                Отмена
                            </button>
                            <button onClick={() => { handleArchiveCat(confirmArchiveCat); setConfirmArchiveCat(null); }}
                                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors">
                                В архив
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmDeleteExp && (
                <div className="modal-centered fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pb-[84px] sm:pb-4" onClick={() => setConfirmDeleteExp(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                                <Trash2 size={18} className="text-rose-500" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">Удалить расход?</h3>
                                <p className="text-sm text-slate-500">{getCat(confirmDeleteExp.category).icon} {confirmDeleteExp.category} · {fmt(confirmDeleteExp.amount)} сум</p>
                            </div>
                        </div>
                        {confirmDeleteExp.comment && <p className="text-sm text-slate-500 mb-3 truncate">💬 {confirmDeleteExp.comment}</p>}
                        <p className="text-sm text-slate-500 mb-5">Действие нельзя отменить.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmDeleteExp(null)}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                                Отмена
                            </button>
                            <button onClick={() => { onDeleteExpense(confirmDeleteExp.id, confirmDeleteExp); setConfirmDeleteExp(null); }}
                                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold transition-colors">
                                Удалить
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmDeleteCat && (
                <div className="modal-centered fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pb-[84px] sm:pb-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                                <Trash2 size={18} className="text-rose-500" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">Удалить подгруппу?</h3>
                                <p className="text-sm text-slate-500">«{confirmDeleteCat}»</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-500 mb-5">Карточка будет удалена. Записи расходов останутся.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmDeleteCat(null)}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                                Отмена
                            </button>
                            <button onClick={() => { handleRemoveCustomCat(confirmDeleteCat); setConfirmDeleteCat(null); }}
                                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold transition-colors">
                                Удалить
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editCat && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setEditCat(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 text-2xl">{editCat.icon}</div>
                            <div>
                                <h3 className="font-bold text-slate-800">Редактировать подгруппу</h3>
                                <p className="text-xs text-slate-400">Название и значок</p>
                            </div>
                        </div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Название</label>
                        <input value={editCat.name} autoFocus
                            onChange={e => setEditCat(s => ({ ...s, name: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') { handleEditCustomCat(editCat.old, editCat.name, editCat.icon); setEditCat(null); } }}
                            className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 mb-3" />
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">Значок</label>
                        <div className="grid grid-cols-9 gap-1 max-h-40 overflow-y-auto mb-4 p-1 rounded-xl bg-slate-50">
                            {ICON_CHOICES.map(ic => (
                                <button key={ic} onClick={() => setEditCat(s => ({ ...s, icon: ic }))}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-all ${editCat.icon === ic ? 'bg-indigo-500 scale-110' : 'hover:bg-slate-200'}`}>
                                    {ic}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setEditCat(null)}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Отмена</button>
                            <button onClick={() => { handleEditCustomCat(editCat.old, editCat.name, editCat.icon); setEditCat(null); }}
                                disabled={!editCat.name.trim()}
                                className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-bold transition-colors">Сохранить</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
