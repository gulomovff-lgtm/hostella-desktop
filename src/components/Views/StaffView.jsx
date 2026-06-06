import React, { useState, useMemo } from 'react';
import { Trash2, Plus, Eye, EyeOff, Edit, X, Check, Users, ShieldCheck, Search, Copy, RefreshCw, AlertTriangle, UserCog, Building2, CreditCard, LayoutDashboard, Globe, AlertCircle, FileText, Wallet, ClipboardCheck, MapPin, CheckSquare, Gift } from 'lucide-react';
import { getConfig } from '../../utils/appConfig';

// Проверка пароля по политике из Настроек (#9)
const passwordError = (p) => {
    if (!p) return '';
    const cfg = getConfig();
    const minLen = Number(cfg.passwordMinLength) || 4;
    if (p.length < minLen) return `Минимум ${minLen} символов`;
    if (cfg.passwordRequireMix && !(/[a-zA-Zа-яА-ЯёЁ]/.test(p) && /\d/.test(p))) return 'Нужны буквы и цифры';
    return '';
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const ROLE_META = {
    admin:   { label: 'Администратор', bg: 'bg-indigo-100',  text: 'text-indigo-700',  border: 'border-indigo-200' },
    cashier: { label: 'Кассир',        bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
    super:   { label: 'Супер',          bg: 'bg-rose-100',    text: 'text-rose-700',    border: 'border-rose-200'   },
};
const HOSTEL_META = {
    hostel1: { label: 'Хостел №1',   bg: 'bg-violet-100', text: 'text-violet-700' },
    hostel2: { label: 'Хостел №2',   bg: 'bg-sky-100',    text: 'text-sky-700'    },
    all:     { label: 'Все хостелы', bg: 'bg-slate-100',   text: 'text-slate-600'  },
};
const AV_COLORS = ['bg-indigo-500','bg-emerald-500','bg-violet-500','bg-sky-500','bg-rose-500','bg-amber-500'];
const avColor  = (s = '') => AV_COLORS[(s.charCodeAt(0) || 0) % AV_COLORS.length];
const avInit   = (s = '') => s.trim().split(/\s+/).map(c => c[0]).join('').slice(0, 2).toUpperCase() || '?';

const INP  = "w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all";

// ─── Permissions ─────────────────────────────────────────────────────────────
const PERM_DEFS = [
    { key: 'canPayInHostel1', label: 'Оплата — Хостел №1',  group: 'payment', icon: CreditCard },
    { key: 'canPayInHostel2', label: 'Оплата — Хостел №2',  group: 'payment', icon: CreditCard },
    { key: 'viewStats',       label: 'Дашборд / статистика', group: 'view', icon: LayoutDashboard },
    { key: 'viewBookings',    label: 'Онлайн-брони',         group: 'view', icon: Globe },
    { key: 'viewDebts',       label: 'Долги',                group: 'view', icon: AlertCircle },
    { key: 'viewClients',     label: 'База клиентов',        group: 'view', icon: Users },
    { key: 'viewRegistrations', label: 'E-mehmon (регистрации)', group: 'view', icon: ClipboardCheck },
    { key: 'viewCadastre',    label: 'Кадастр',              group: 'view', icon: MapPin },
    { key: 'viewManualStay',  label: 'Ручной учёт',          group: 'view', icon: Building2 },
    { key: 'viewTasks',       label: 'Задачи',               group: 'view', icon: CheckSquare },
    { key: 'viewReferrals',   label: 'Бонусы / рефералы',    group: 'view', icon: Gift },
    { key: 'viewReports',     label: 'Отчёты',               group: 'finance', icon: FileText },
    { key: 'viewExpenses',    label: 'Расходы',              group: 'finance', icon: Wallet },
];

const defaultPerms = (role) => ({
    canPayInHostel1: role === 'cashier',
    canPayInHostel2: role === 'cashier',
    viewStats:    false,
    viewBookings: true,
    viewDebts:    true,
    viewClients:  true,
    viewRegistrations: true,
    viewCadastre: true,
    viewManualStay: true,
    viewTasks:    true,
    viewReferrals: true,
    viewReports:  role !== 'cashier',
    viewExpenses: role !== 'cashier',
});

const enabledCount = (perms = {}) => PERM_DEFS.filter(d => perms[d.key]).length;

// Фирменный зелёный приложения
const BRAND = '#0f9688';

// ─── Переключатель (toggle) ───────────────────────────────────────────────────
const Toggle = ({ on, onClick }) => (
    <button type="button" onClick={onClick}
        className="w-11 h-6 rounded-full flex items-center px-0.5 shrink-0 transition-colors"
        style={{ background: on ? BRAND : '#cbd5e1', justifyContent: on ? 'flex-end' : 'flex-start' }}>
        <span className="w-5 h-5 bg-white rounded-full shadow-sm" />
    </button>
);

// ─── PermissionsModal (попап) ──────────────────────────────────────────────────
const SECTIONS = [
    { group: 'payment', title: 'Приём оплаты', emoji: '💳', cashierOnly: true },
    { group: 'view',    title: 'Разделы',      emoji: '👁' },
    { group: 'finance', title: 'Финансы',      emoji: '💰' },
];

const PermissionsModal = ({ role, perms, onChange, onClose }) => {
    const p = perms || defaultPerms(role);
    const toggle = (key) => onChange({ ...p, [key]: !p[key] });
    const setAll = (defs, val) => { const np = { ...p }; defs.forEach(d => { np[d.key] = val; }); onChange(np); };

    return (
        <div className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
            <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(15,150,136,0.12)' }}>
                        <ShieldCheck size={20} style={{ color: BRAND }} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-black text-slate-800 leading-tight">Права доступа</h3>
                        <p className="text-xs text-slate-400">Включено {enabledCount(p)} из {PERM_DEFS.length}</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100"><X size={18} /></button>
                </div>
                {/* Body */}
                <div className="overflow-y-auto px-4 py-3 space-y-4">
                    {SECTIONS.map(sec => {
                        if (sec.cashierOnly && role !== 'cashier') return null;
                        const defs = PERM_DEFS.filter(d => d.group === sec.group);
                        if (!defs.length) return null;
                        const allOn = defs.every(d => p[d.key]);
                        return (
                            <div key={sec.group}>
                                <div className="flex items-center justify-between mb-1.5 px-1">
                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wide">{sec.emoji} {sec.title}</span>
                                    <button type="button" onClick={() => setAll(defs, !allOn)}
                                        className="text-[10px] font-bold hover:opacity-80" style={{ color: BRAND }}>{allOn ? 'Снять все' : 'Включить все'}</button>
                                </div>
                                <div className="rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-50">
                                    {defs.map(d => {
                                        const Icon = d.icon;
                                        const on = !!p[d.key];
                                        return (
                                            <div key={d.key} onClick={() => toggle(d.key)}
                                                className="flex items-center gap-3 px-3.5 py-3 cursor-pointer hover:bg-slate-50 transition-colors">
                                                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                                                    style={on ? { background: 'rgba(15,150,136,0.12)', color: BRAND } : { background: '#f1f5f9', color: '#94a3b8' }}>
                                                    <Icon size={16} />
                                                </div>
                                                <span className={`flex-1 text-sm font-semibold ${on ? 'text-slate-800' : 'text-slate-400'}`}>{d.label}</span>
                                                <Toggle on={on} onClick={() => toggle(d.key)} />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
                {/* Footer */}
                <div className="px-4 py-3 border-t border-slate-100">
                    <button onClick={onClose} className="w-full py-3 rounded-2xl text-white font-bold text-sm transition-opacity hover:opacity-90" style={{ background: BRAND }}>Готово</button>
                </div>
            </div>
        </div>
    );
};

// ─── Кнопка-триггер прав ───────────────────────────────────────────────────────
const PermsButton = ({ perms, role, onClick }) => (
    <button type="button" onClick={onClick}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
        <ShieldCheck size={16} className="shrink-0" style={{ color: BRAND }} />
        <span className="text-xs font-bold text-slate-600 flex-1">Права доступа</span>
        <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(15,150,136,0.12)', color: BRAND }}>{enabledCount(perms || defaultPerms(role))} / {PERM_DEFS.length}</span>
    </button>
);

const EMPTY = { name: '', login: '', pass: '', role: 'cashier', hostelId: 'hostel1', allowedHostels: ['hostel1'], canViewHostel1: false, permissions: defaultPerms('cashier') };

// ─── Component ──────────────────────────────────────────────────────────────
const StaffView = ({ users = [], onAdd, onDelete, onUpdate, currentUser, lang }) => {
    const [addForm,     setAddForm]     = useState(EMPTY);
    const [showAddPwd,  setShowAddPwd]  = useState(false);
    const [editId,      setEditId]      = useState(null);
    const [editForm,    setEditForm]    = useState({});
    const [showEditPwd, setShowEditPwd] = useState(false);
    const [search,      setSearch]      = useState('');
    const [roleFilter,  setRoleFilter]  = useState('all');
    const [confirmDel,  setConfirmDel]  = useState(null);
    const [copied,      setCopied]      = useState('');
    const [permModal,   setPermModal]   = useState(null); // 'add' | 'edit'

    const visible = useMemo(() => users.filter(u => u.login !== 'Super'), [users]);
    const isSelf = (u) => currentUser && (u.id === currentUser.id || u.login === currentUser.login);
    const loginExists = (login, exceptId) => users.some(u => (u.login || '').toLowerCase() === (login || '').trim().toLowerCase() && u.id !== exceptId);
    const genPassword = () => {
        const minLen = Number(getConfig().passwordMinLength) || 4;
        let p = Math.random().toString(36).slice(2, 6) + Math.floor(1000 + Math.random() * 9000); // буквы+цифры
        while (p.length < minLen) p += Math.floor(Math.random() * 10);
        return p;
    };
    const copyLogin = (login) => { try { navigator.clipboard.writeText(login); setCopied(login); setTimeout(() => setCopied(''), 1500); } catch { /* ignore */ } };

    const stats = useMemo(() => ({
        total:    visible.length,
        cashiers: visible.filter(u => u.role === 'cashier').length,
        admins:   visible.filter(u => u.role === 'admin').length,
        multi:    visible.filter(u => u.role === 'cashier' && (u.allowedHostels || []).length > 1).length,
    }), [visible]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return visible.filter(u => {
            if (roleFilter !== 'all' && u.role !== roleFilter) return false;
            if (!q) return true;
            return (u.name || '').toLowerCase().includes(q) || (u.login || '').toLowerCase().includes(q);
        });
    }, [visible, search, roleFilter]);

    const addLoginDup = addForm.login.trim() && loginExists(addForm.login);
    const addPassErr  = passwordError(addForm.pass);
    const editPassErr = passwordError(editForm.pass);

    const handleAdd = () => {
        if (!addForm.name.trim() || !addForm.login.trim() || !addForm.pass.trim()) return;
        if (loginExists(addForm.login)) return;
        if (addPassErr) return;
        onAdd({ ...addForm });
        setAddForm(EMPTY);
        setShowAddPwd(false);
    };
    const startEdit = u => {
        setEditId(u.id);
        setEditForm({
            name: u.name, login: u.login, pass: '',
            role: u.role, hostelId: u.hostelId || 'hostel1',
            allowedHostels: u.allowedHostels || [u.hostelId || 'hostel1'],
            canViewHostel1: u.canViewHostel1 || false,
            permissions: { ...defaultPerms(u.role), ...(u.permissions || {}) },
        });
        setShowEditPwd(false);
    };
    const cancelEdit = () => { setEditId(null); setEditForm({}); };
    const saveEdit   = () => { if (passwordError(editForm.pass)) return; if (onUpdate) onUpdate(editId, editForm); cancelEdit(); };

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">

            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center shrink-0">
                        <Users size={20} className="text-teal-600" />
                    </div>
                    <div>
                        <h2 className="font-black text-xl text-slate-800">Персонал</h2>
                        <p className="text-xs text-slate-400 mt-0.5">{stats.total} сотрудников</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100">
                        <UserCog size={14} className="text-emerald-600" />
                        <span className="text-xs font-bold text-emerald-700">{stats.cashiers} кассиров</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100">
                        <ShieldCheck size={14} className="text-indigo-600" />
                        <span className="text-xs font-bold text-indigo-700">{stats.admins} админов</span>
                    </div>
                    {stats.multi > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 border border-violet-100">
                            <Building2 size={14} className="text-violet-600" />
                            <span className="text-xs font-bold text-violet-700">{stats.multi} мульти-хостел</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Toolbar: поиск + фильтр ролей */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по имени или логину…"
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all" />
                    {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"><X size={15} /></button>}
                </div>
                <div className="flex items-center gap-1.5">
                    {[['all', 'Все'], ['cashier', 'Кассиры'], ['admin', 'Админы']].map(([k, l]) => (
                        <button key={k} onClick={() => setRoleFilter(k)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${roleFilter === k ? 'bg-teal-600 text-white shadow-sm shadow-teal-200' : 'bg-white border border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-700'}`}>
                            {l}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

                {/* Cards */}
                <div className="xl:col-span-2 space-y-3">
                    {filtered.length === 0 && (
                        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
                            <Users size={32} className="text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-400 font-medium">{visible.length === 0 ? 'Нет сотрудников' : 'Ничего не найдено'}</p>
                        </div>
                    )}

                    {filtered.map(u => {
                        const role   = ROLE_META[u.role]       || ROLE_META.cashier;
                        const hostel = HOSTEL_META[u.hostelId] || HOSTEL_META.all;
                        const isEditing = editId === u.id;

                        return (
                            <div key={u.id || u.login}
                                className={`bg-white rounded-2xl border shadow-sm transition-all duration-200 overflow-hidden
                                    ${isEditing
                                        ? 'border-teal-300 ring-2 ring-teal-100'
                                        : 'border-slate-200 hover:border-slate-300 hover:shadow-md'}`}>

                                {/* View mode */}
                                {!isEditing && (
                                    <div className="p-4 flex items-center gap-4">
                                        <div className={`w-12 h-12 ${avColor(u.name)} rounded-xl flex items-center justify-center text-white font-black text-lg shrink-0 shadow-sm`}>
                                            {avInit(u.name)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-slate-800 text-[15px]">{u.name}</span>
                                                {isSelf(u) && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Вы</span>}
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${role.bg} ${role.text} ${role.border}`}>
                                                    {role.label}
                                                </span>
                                                {(u.role === 'cashier' && (u.allowedHostels || []).length > 1) ? (
                                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
                                                        🏨 Оба хостела
                                                    </span>
                                                ) : (
                                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${hostel.bg} ${hostel.text}`}>
                                                        {u.canViewHostel1 ? `${hostel.label} + №1` : hostel.label}
                                                    </span>
                                                )}
                                                {u.role === 'cashier' && u.permissions?.canPayInHostel1 === false && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-200">
                                                        🚫 Хостел №1
                                                    </span>
                                                )}
                                                {u.role === 'cashier' && u.permissions?.canPayInHostel2 === false && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-200">
                                                        🚫 Хостел №2
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-1.5 flex items-center gap-1.5">
                                                <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                                                    {u.login}
                                                </span>
                                                <button onClick={() => copyLogin(u.login)} title="Копировать логин"
                                                    className="text-slate-300 hover:text-teal-500 transition-colors">
                                                    {copied === u.login ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button onClick={() => startEdit(u)}
                                                className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-colors"
                                                title="Редактировать">
                                                <Edit size={16} />
                                            </button>
                                            <button onClick={() => setConfirmDel(u)} disabled={isSelf(u)}
                                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                title={isSelf(u) ? 'Нельзя удалить себя' : 'Удалить'}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Edit mode */}
                                {isEditing && (
                                    <div className="p-5 space-y-3">
                                        <div className="flex items-center gap-2 pb-1">
                                            <div className={`w-9 h-9 ${avColor(u.name)} rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0`}>
                                                {avInit(u.name)}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-700 text-sm leading-tight">Редактирование</p>
                                                <p className="text-[11px] text-slate-400 font-mono">{u.login}</p>
                                            </div>
                                            <button onClick={cancelEdit} className="ml-auto p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                                                <X size={15} />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2.5">
                                            <div className="col-span-2">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">ФИО</label>
                                                <input className={INP} value={editForm.name}
                                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Логин</label>
                                                <input className={INP} value={editForm.login}
                                                    onChange={e => setEditForm({ ...editForm, login: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Пароль</label>
                                                <div className="relative">
                                                    <input type={showEditPwd ? 'text' : 'password'} className={INP + ' pr-16'}
                                                        placeholder="не менять"
                                                        value={editForm.pass}
                                                        onChange={e => setEditForm({ ...editForm, pass: e.target.value })} />
                                                    <button type="button" onClick={() => { setEditForm(f => ({ ...f, pass: genPassword() })); setShowEditPwd(true); }} title="Сгенерировать пароль"
                                                        className="absolute right-9 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600">
                                                        <RefreshCw size={15} />
                                                    </button>
                                                    <button type="button" onClick={() => setShowEditPwd(v => !v)}
                                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                        {showEditPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                                                    </button>
                                                </div>
                                                {editPassErr && <p className="text-[10px] text-rose-500 font-semibold mt-1 flex items-center gap-1"><AlertCircle size={11}/>{editPassErr}</p>}
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Роль</label>
                                                <select className={INP} value={editForm.role}
                                                    onChange={e => {
                                                        const r = e.target.value;
                                                        setEditForm(f => ({ ...f, role: r, allowedHostels: r === 'cashier' ? (f.allowedHostels || [f.hostelId || 'hostel1']) : [f.hostelId || 'hostel1'], permissions: { ...defaultPerms(r), ...(f.permissions || {}) } }));
                                                    }}>
                                                    <option value="cashier">Кассир</option>
                                                    <option value="admin">Администратор</option>
                                                </select>
                                            </div>
                                            {editForm.role === 'cashier' ? (
                                                <div className="col-span-2">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Хостелы для работы</label>
                                                    <div className="space-y-1.5 mt-1">
                                                        {[{id:'hostel1',label:'Хостел №1'},{id:'hostel2',label:'Хостел №2'}].map(h => {
                                                            const checked = (editForm.allowedHostels || []).includes(h.id);
                                                            return (
                                                                <label key={h.id} className="flex items-center gap-2.5 cursor-pointer group py-0.5">
                                                                    <div
                                                                        onClick={() => {
                                                                            const cur = editForm.allowedHostels || ['hostel1'];
                                                                            const next = checked ? cur.filter(x => x !== h.id) : [...cur, h.id];
                                                                            if (next.length === 0) return;
                                                                            setEditForm(f => ({ ...f, allowedHostels: next, hostelId: next[0] }));
                                                                        }}
                                                                        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                                                            checked ? 'bg-teal-600 border-teal-600' : 'bg-white border-slate-300 group-hover:border-teal-400'
                                                                        }`}
                                                                    >
                                                                        {checked && <Check size={10} className="text-white" strokeWidth={3}/>}
                                                                    </div>
                                                                    <span className="text-xs text-slate-600 select-none">{h.label}</span>
                                                                </label>
                                                            );
                                                        })}
                                                        {(editForm.allowedHostels || []).length > 1 && (
                                                            <p className="text-[10px] text-teal-600 font-semibold mt-0.5">✓ При входе кассир выбирает хостел</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Хостел</label>
                                                    <select className={INP} value={editForm.hostelId}
                                                        onChange={e => setEditForm({ ...editForm, hostelId: e.target.value })}>
                                                        <option value="hostel1">Хостел №1</option>
                                                        <option value="hostel2">Хостел №2</option>
                                                        <option value="all">Все</option>
                                                    </select>
                                                </div>
                                            )}
                                            <div className="col-span-2">
                                                <label className="flex items-center gap-2.5 cursor-pointer group py-1">
                                                    <div
                                                        onClick={() => setEditForm(f => ({ ...f, canViewHostel1: !f.canViewHostel1 }))}
                                                        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                                            editForm.canViewHostel1
                                                                ? 'bg-teal-600 border-teal-600'
                                                                : 'bg-white border-slate-300 group-hover:border-teal-400'
                                                        }`}>
                                                        {editForm.canViewHostel1 && <Check size={10} className="text-white" strokeWidth={3}/>}
                                                    </div>
                                                    <span className="text-xs text-slate-600 select-none">Просмотр обоих хостелов (только читать)</span>
                                                </label>
                                            </div>
                                        </div>
                                        <PermsButton role={editForm.role} perms={editForm.permissions} onClick={() => setPermModal('edit')} />
                                        <div className="flex gap-2 pt-1">
                                            <button onClick={saveEdit} disabled={!!editPassErr}
                                                className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-colors shadow-sm shadow-teal-200">
                                                <Check size={15} /> Сохранить
                                            </button>
                                            <button onClick={cancelEdit}
                                                className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors">
                                                Отмена
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Add form */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sticky top-4">
                    <div className="flex items-center gap-2 mb-5">
                        <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <Plus size={16} className="text-emerald-600" />
                        </div>
                        <span className="font-black text-slate-800">Новый сотрудник</span>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">ФИО *</label>
                            <input className={INP} placeholder="Иванов Иван" value={addForm.name}
                                onChange={e => setAddForm({ ...addForm, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Логин *</label>
                            <input className={`${INP} ${addLoginDup ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20' : ''}`} placeholder="ivan" value={addForm.login}
                                onChange={e => setAddForm({ ...addForm, login: e.target.value })} />
                            {addLoginDup && <p className="text-[10px] text-rose-500 font-semibold mt-1">Такой логин уже занят</p>}
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Пароль *</label>
                            <div className="relative">
                                <input type={showAddPwd ? 'text' : 'password'} className={INP + ' pr-16'}
                                    placeholder="••••••" value={addForm.pass}
                                    onChange={e => setAddForm({ ...addForm, pass: e.target.value })} />
                                <button type="button" onClick={() => { setAddForm(f => ({ ...f, pass: genPassword() })); setShowAddPwd(true); }} title="Сгенерировать пароль"
                                    className="absolute right-9 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600">
                                    <RefreshCw size={15} />
                                </button>
                                <button type="button" onClick={() => setShowAddPwd(v => !v)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {showAddPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                            {addPassErr && <p className="text-[10px] text-rose-500 font-semibold mt-1 flex items-center gap-1"><AlertCircle size={11}/>{addPassErr}</p>}
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Роль</label>
                            <select className={INP} value={addForm.role}
                                onChange={e => {
                                    const r = e.target.value;
                                    setAddForm(f => ({ ...f, role: r, allowedHostels: r === 'cashier' ? (f.allowedHostels || [f.hostelId || 'hostel1']) : [f.hostelId || 'hostel1'], permissions: defaultPerms(r) }));
                                }}>
                                <option value="cashier">Кассир</option>
                                <option value="admin">Администратор</option>
                            </select>
                        </div>
                        {addForm.role === 'cashier' ? (
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Хостелы для работы</label>
                                <div className="space-y-1.5 mt-1">
                                    {[{id:'hostel1',label:'Хостел №1'},{id:'hostel2',label:'Хостел №2'}].map(h => {
                                        const checked = (addForm.allowedHostels || ['hostel1']).includes(h.id);
                                        return (
                                            <label key={h.id} className="flex items-center gap-2.5 cursor-pointer group py-0.5">
                                                <div
                                                    onClick={() => {
                                                        const cur = addForm.allowedHostels || ['hostel1'];
                                                        const next = checked ? cur.filter(x => x !== h.id) : [...cur, h.id];
                                                        if (next.length === 0) return;
                                                        setAddForm(f => ({ ...f, allowedHostels: next, hostelId: next[0] }));
                                                    }}
                                                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                                        checked ? 'bg-teal-600 border-teal-600' : 'bg-white border-slate-300 group-hover:border-teal-400'
                                                    }`}
                                                >
                                                    {checked && <Check size={10} className="text-white" strokeWidth={3}/>}
                                                </div>
                                                <span className="text-xs text-slate-600 select-none">{h.label}</span>
                                            </label>
                                        );
                                    })}
                                    {(addForm.allowedHostels || []).length > 1 && (
                                        <p className="text-[10px] text-teal-600 font-semibold mt-0.5">✓ При входе кассир выбирает хостел</p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Хостел</label>
                                <select className={INP} value={addForm.hostelId}
                                    onChange={e => setAddForm({ ...addForm, hostelId: e.target.value })}>
                                    <option value="hostel1">Хостел №1</option>
                                    <option value="hostel2">Хостел №2</option>
                                    <option value="all">Все</option>
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="flex items-center gap-2.5 cursor-pointer group py-1">
                                <div
                                    onClick={() => setAddForm(f => ({ ...f, canViewHostel1: !f.canViewHostel1 }))}
                                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                        addForm.canViewHostel1
                                            ? 'bg-teal-600 border-teal-600'
                                            : 'bg-white border-slate-300 group-hover:border-indigo-400'
                                    }`}>
                                    {addForm.canViewHostel1 && <Check size={10} className="text-white" strokeWidth={3}/>}
                                </div>
                                <span className="text-xs text-slate-600 select-none">Просмотр обоих хостелов (только читать)</span>
                            </label>
                        </div>
                        <PermsButton role={addForm.role} perms={addForm.permissions} onClick={() => setPermModal('add')} />
                        <button onClick={handleAdd}
                            disabled={!addForm.name.trim() || !addForm.login.trim() || !addForm.pass.trim() || addLoginDup || !!addPassErr}
                            className="w-full py-3 mt-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm shadow-teal-200">
                            <Plus size={16} /> Добавить
                        </button>
                    </div>

                    {/* Legend */}
                    <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Роли</p>
                        {Object.entries(ROLE_META).filter(([k]) => k !== 'super').map(([k, v]) => (
                            <div key={k} className="flex items-center gap-2">
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${v.bg} ${v.text} ${v.border}`}>
                                    {v.label}
                                </span>
                                <span className="text-[10px] text-slate-400 leading-tight">
                                    {k === 'admin' ? 'просмотр, без заселения' : 'заселение, оплата, смены'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {confirmDel && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setConfirmDel(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                                <AlertTriangle size={18} className="text-rose-500" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">Удалить сотрудника?</h3>
                                <p className="text-sm text-slate-500">{confirmDel.name} · {confirmDel.login}</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-500 mb-5">Действие нельзя отменить. Открытые смены сотрудника будут закрыты.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmDel(null)}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                                Отмена
                            </button>
                            <button onClick={() => { onDelete(confirmDel.id); setConfirmDel(null); }}
                                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold transition-colors">
                                Удалить
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {permModal && (
                <PermissionsModal
                    role={permModal === 'add' ? addForm.role : editForm.role}
                    perms={permModal === 'add' ? (addForm.permissions || defaultPerms(addForm.role)) : (editForm.permissions || defaultPerms(editForm.role))}
                    onChange={p => permModal === 'add' ? setAddForm(f => ({ ...f, permissions: p })) : setEditForm(f => ({ ...f, permissions: p }))}
                    onClose={() => setPermModal(null)}
                />
            )}
        </div>
    );
};

export default StaffView;
