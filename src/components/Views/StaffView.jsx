import React, { useState } from 'react';
import { Trash2, Plus, Eye, EyeOff, Edit, X, Check, Users, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';

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

const INP  = "w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all";

// ─── Permissions ─────────────────────────────────────────────────────────────
const PERM_DEFS = [
    { key: 'canPayInHostel1', label: 'Принимать оплату — Хостел №1', group: 'payment' },
    { key: 'canPayInHostel2', label: 'Принимать оплату — Хостел №2', group: 'payment' },
    { key: 'viewStats',       label: 'Статистика (дашборд)',          group: 'view'    },
    { key: 'viewBookings',    label: 'Онлайн-брони',                  group: 'view'    },
    { key: 'viewDebts',       label: 'Долги',                         group: 'view'    },
    { key: 'viewClients',     label: 'База клиентов',                 group: 'view'    },
    { key: 'viewReports',     label: 'Отчёты',                        group: 'view'    },
    { key: 'viewExpenses',    label: 'Расходы',                       group: 'view'    },
];

const defaultPerms = (role) => ({
    canPayInHostel1: role === 'cashier',
    canPayInHostel2: role === 'cashier',
    viewStats:    false,
    viewBookings: true,
    viewDebts:    true,
    viewClients:  true,
    viewReports:  role !== 'cashier',
    viewExpenses: role !== 'cashier',
});

// ─── PermissionsPanel ─────────────────────────────────────────────────────────
const PermissionsPanel = ({ role, perms, onChange }) => {
    const [open, setOpen] = useState(false);
    const isCashier = role === 'cashier';
    const payDefs  = PERM_DEFS.filter(d => d.group === 'payment');
    const viewDefs = PERM_DEFS.filter(d => d.group === 'view');

    const toggle = (key) => onChange({ ...perms, [key]: !perms[key] });

    const PermRow = ({ d }) => (
        <label className="flex items-center gap-2.5 cursor-pointer group py-1">
            <div
                onClick={() => toggle(d.key)}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                    ${perms[d.key]
                        ? 'bg-indigo-600 border-indigo-600'
                        : 'bg-white border-slate-300 group-hover:border-indigo-400'}`}
            >
                {perms[d.key] && <Check size={10} className="text-white" strokeWidth={3}/>}
            </div>
            <span className="text-xs text-slate-600 select-none">{d.label}</span>
        </label>
    );

    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
                <ShieldCheck size={14} className="text-indigo-500" />
                <span className="text-xs font-bold text-slate-600 flex-1">Права доступа</span>
                {open ? <ChevronUp size={13} className="text-slate-400"/> : <ChevronDown size={13} className="text-slate-400"/>}
            </button>
            {open && (
                <div className="px-3 pb-3 pt-1 space-y-3 bg-white">
                    {isCashier && (
                        <div>
                            <p className="text-[10px] font-bold text-rose-400 uppercase mb-1">🔒 Оплаты</p>
                            {payDefs.map(d => <PermRow key={d.key} d={d}/>)}
                        </div>
                    )}
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">👁 Видимость разделов</p>
                        {viewDefs.map(d => <PermRow key={d.key} d={d}/>)}
                    </div>
                </div>
            )}
        </div>
    );
};

const EMPTY = { name: '', login: '', pass: '', role: 'cashier', hostelId: 'hostel1', permissions: defaultPerms('cashier') };

// ─── Component ──────────────────────────────────────────────────────────────
const StaffView = ({ users = [], onAdd, onDelete, onUpdate, lang }) => {
    const [addForm,     setAddForm]     = useState(EMPTY);
    const [showAddPwd,  setShowAddPwd]  = useState(false);
    const [editId,      setEditId]      = useState(null);
    const [editForm,    setEditForm]    = useState({});
    const [showEditPwd, setShowEditPwd] = useState(false);

    const visible = users.filter(u => u.login !== 'Super');

    const handleAdd = () => {
        if (!addForm.name.trim() || !addForm.login.trim() || !addForm.pass.trim()) return;
        onAdd({ ...addForm });
        setAddForm(EMPTY);
        setShowAddPwd(false);
    };
    const startEdit = u => {
        setEditId(u.id);
        setEditForm({
            name: u.name, login: u.login, pass: u.pass || '',
            role: u.role, hostelId: u.hostelId || 'hostel1',
            permissions: { ...defaultPerms(u.role), ...(u.permissions || {}) },
        });
        setShowEditPwd(false);
    };
    const cancelEdit = () => { setEditId(null); setEditForm({}); };
    const saveEdit   = () => { if (onUpdate) onUpdate(editId, editForm); cancelEdit(); };

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">

            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                    <Users size={20} className="text-indigo-600" />
                </div>
                <div>
                    <h2 className="font-black text-xl text-slate-800">Персонал</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{visible.length} сотрудников</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

                {/* Cards */}
                <div className="xl:col-span-2 space-y-3">
                    {visible.length === 0 && (
                        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
                            <Users size={32} className="text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-400 font-medium">Нет сотрудников</p>
                        </div>
                    )}

                    {visible.map(u => {
                        const role   = ROLE_META[u.role]       || ROLE_META.cashier;
                        const hostel = HOSTEL_META[u.hostelId] || HOSTEL_META.all;
                        const isEditing = editId === u.id;

                        return (
                            <div key={u.id || u.login}
                                className={`bg-white rounded-2xl border shadow-sm transition-all duration-200 overflow-hidden
                                    ${isEditing
                                        ? 'border-indigo-300 ring-2 ring-indigo-100'
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
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${role.bg} ${role.text} ${role.border}`}>
                                                    {role.label}
                                                </span>
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${hostel.bg} ${hostel.text}`}>
                                                    {u.canViewHostel1 ? `${hostel.label} + №1` : hostel.label}
                                                </span>
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
                                            <div className="mt-1.5">
                                                <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                                                    {u.login}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button onClick={() => startEdit(u)}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                                                title="Редактировать">
                                                <Edit size={16} />
                                            </button>
                                            <button onClick={() => { if (confirm(`Удалить ${u.name}?`)) onDelete(u.id); }}
                                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                                                title="Удалить">
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
                                                    <input type={showEditPwd ? 'text' : 'password'} className={INP + ' pr-9'}
                                                        value={editForm.pass}
                                                        onChange={e => setEditForm({ ...editForm, pass: e.target.value })} />
                                                    <button type="button" onClick={() => setShowEditPwd(v => !v)}
                                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                        {showEditPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Роль</label>
                                                <select className={INP} value={editForm.role}
                                                    onChange={e => {
                                                        const r = e.target.value;
                                                        setEditForm(f => ({ ...f, role: r, permissions: { ...defaultPerms(r), ...(f.permissions || {}) } }));
                                                    }}>
                                                    <option value="cashier">Кассир</option>
                                                    <option value="admin">Администратор</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Хостел</label>
                                                <select className={INP} value={editForm.hostelId}
                                                    onChange={e => setEditForm({ ...editForm, hostelId: e.target.value })}>
                                                    <option value="hostel1">Хостел №1</option>
                                                    <option value="hostel2">Хостел №2</option>
                                                    <option value="all">Все</option>
                                                </select>
                                            </div>
                                        </div>
                                        <PermissionsPanel
                                            role={editForm.role}
                                            perms={editForm.permissions || defaultPerms(editForm.role)}
                                            onChange={p => setEditForm(f => ({ ...f, permissions: p }))}
                                        />
                                        <div className="flex gap-2 pt-1">
                                            <button onClick={saveEdit}
                                                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-colors shadow-sm shadow-indigo-200">
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
                            <input className={INP} placeholder="ivan" value={addForm.login}
                                onChange={e => setAddForm({ ...addForm, login: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Пароль *</label>
                            <div className="relative">
                                <input type={showAddPwd ? 'text' : 'password'} className={INP + ' pr-9'}
                                    placeholder="••••••" value={addForm.pass}
                                    onChange={e => setAddForm({ ...addForm, pass: e.target.value })} />
                                <button type="button" onClick={() => setShowAddPwd(v => !v)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {showAddPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Роль</label>
                            <select className={INP} value={addForm.role}
                                onChange={e => {
                                    const r = e.target.value;
                                    setAddForm(f => ({ ...f, role: r, permissions: defaultPerms(r) }));
                                }}>
                                <option value="cashier">Кассир</option>
                                <option value="admin">Администратор</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Хостел</label>
                            <select className={INP} value={addForm.hostelId}
                                onChange={e => setAddForm({ ...addForm, hostelId: e.target.value })}>
                                <option value="hostel1">Хостел №1</option>
                                <option value="hostel2">Хостел №2</option>
                                <option value="all">Все</option>
                            </select>
                        </div>
                        <PermissionsPanel
                            role={addForm.role}
                            perms={addForm.permissions || defaultPerms(addForm.role)}
                            onChange={p => setAddForm(f => ({ ...f, permissions: p }))}
                        />
                        <button onClick={handleAdd}
                            disabled={!addForm.name.trim() || !addForm.login.trim() || !addForm.pass.trim()}
                            className="w-full py-3 mt-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm shadow-indigo-200">
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
        </div>
    );
};

export default StaffView;
