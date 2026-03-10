import React, { useState, useMemo } from 'react';
import { ClipboardList, Search, Download, ChevronDown } from 'lucide-react';

// ── Action metadata ──────────────────────────────────────────────────────────
const ACTION_META = {
    checkin:         { icon: '🏨', label: 'Заселение',         color: 'emerald' },
    checkout:        { icon: '🚪', label: 'Выселение',          color: 'blue'    },
    auto_checkout:   { icon: '🏁', label: 'Авто-выселение',    color: 'amber'   },
    booking_add:     { icon: '📋', label: 'Бронь добавлена',   color: 'purple'  },
    booking_accept:  { icon: '✅', label: 'Бронь принята',      color: 'emerald' },
    booking_reject:  { icon: '❌', label: 'Бронь отклонена',   color: 'rose'    },
    expense_add:     { icon: '💳', label: 'Расход добавлен',   color: 'amber'   },
    debt_add:        { icon: '💸', label: 'Долг добавлен',     color: 'rose'    },
    debt_paid:       { icon: '💰', label: 'Долг погашен',      color: 'emerald' },
    payment_add:     { icon: '💵', label: 'Оплата',             color: 'green'   },
    guest_delete:    { icon: '🗑️', label: 'Гость удалён',      color: 'rose'    },
    guest_move:      { icon: '🔄', label: 'Гость перемещён',   color: 'blue'    },
    shift_start:     { icon: '🟢', label: 'Смена начата',      color: 'emerald' },
    shift_end:       { icon: '🔴', label: 'Смена закрыта',     color: 'slate'   },
    promo_create:    { icon: '🏷️', label: 'Промокод создан',   color: 'orange'  },
    promo_delete:    { icon: '🗑️', label: 'Промокод удалён',   color: 'rose'    },
    promo_used:      { icon: '✂️', label: 'Промокод применён', color: 'purple'  },
    login:               { icon: '🔑', label: 'Вход в систему',          color: 'blue'    },
    logout:              { icon: '👋', label: 'Выход из системы',        color: 'slate'   },
    force_logout:        { icon: '🔒', label: 'Принудительный выход',    color: 'rose'    },
    session_revoked:     { icon: '🚫', label: 'Сессия завершена (адм.)', color: 'orange'  },
    error:               { icon: '⚠️', label: 'Ошибка системы',          color: 'rose'    },
    system_error:        { icon: '🚨', label: 'Системная ошибка JS',     color: 'rose'    },
    version_check:       { icon: '🔄', label: 'Проверка версии',         color: 'blue'    },
    registration_add:    { icon: '🪪', label: 'Регистрация E-mehmon',    color: 'purple'  },
    registration_extend: { icon: '🔄', label: 'Продление E-mehmon',   color: 'indigo'  },
    registration_remove: { icon: '🔴', label: 'Вывод из E-mehmon',    color: 'slate'   },
};

const HOSTELS = { hostel1: 'Хостел №1', hostel2: 'Хостел №2', all: 'Оба' };

const COLOR_MAP = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue:    'bg-blue-50 text-blue-700 border-blue-200',
    purple:  'bg-purple-50 text-purple-700 border-purple-200',
    rose:    'bg-rose-50 text-rose-700 border-rose-200',
    amber:   'bg-amber-50 text-amber-700 border-amber-200',
    green:   'bg-green-50 text-green-700 border-green-200',
    orange:  'bg-orange-50 text-orange-700 border-orange-200',
    slate:   'bg-slate-100 text-slate-600 border-slate-200',
};

// ── Component ────────────────────────────────────────────────────────────────
const AuditLogView = ({ auditLog = [], currentUser }) => {
    const [search,        setSearch       ] = useState('');
    const [filterAction,  setFilterAction ] = useState('');
    const [filterUser,    setFilterUser   ] = useState('');
    const [filterDate,    setFilterDate   ] = useState('');
    const [filterHostel,  setFilterHostel ] = useState('');
    const [pageSize,      setPageSize     ] = useState(100);

    // Unique users from log
    const uniqueUsers = useMemo(() => {
        const seen = new Map();
        auditLog.forEach(e => { if (e.userId && !seen.has(e.userId)) seen.set(e.userId, e.userName || e.userId); });
        return Array.from(seen, ([id, name]) => ({ id, name }));
    }, [auditLog]);

    const filtered = useMemo(() => {
        const s = search.toLowerCase();
        return auditLog.filter(e => {
            if (filterAction && e.action !== filterAction) return false;
            if (filterUser  && e.userId !== filterUser)   return false;
            if (filterHostel && e.hostelId !== filterHostel) return false;
            if (filterDate) {
                const d = e.timestamp ? e.timestamp.slice(0, 10) : '';
                if (d !== filterDate) return false;
            }
            if (s) {
                return (
                    (e.userName || '').toLowerCase().includes(s) ||
                    (ACTION_META[e.action]?.label || e.action || '').toLowerCase().includes(s) ||
                    (e.details?.guestName || '').toLowerCase().includes(s) ||
                    (e.details?.amount    || '').toString().includes(s)
                );
            }
            return true;
        });
    }, [auditLog, filterAction, filterUser, filterDate, filterHostel, search]);

    const handleExport = () => {
        const rows = [['Дата/Время', 'Пользователь', 'Роль', 'Хостел', 'Действие', 'Гость/Детали', 'Сумма']];
        filtered.forEach(e => {
            rows.push([
                new Date(e.timestamp).toLocaleString('ru'),
                e.userName || '',
                e.userRole || '',
                HOSTELS[e.hostelId] || e.hostelId || '',
                ACTION_META[e.action]?.label || e.action || '',
                e.details?.guestName || e.details?.comment || '',
                e.details?.amount || '',
            ]);
        });
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `audit_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    return (
        <div className="space-y-4 animate-in fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <ClipboardList size={20} className="text-indigo-500"/> История изменений
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {filtered.length} из {auditLog.length} записей
                    </p>
                </div>
                <button onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors shadow-sm">
                    <Download size={14}/> CSV
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="relative col-span-2 md:col-span-1">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..."
                            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"/>
                    </div>
                    <select value={filterHostel} onChange={e => setFilterHostel(e.target.value)}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-700">
                        <option value="">Все хостелы</option>
                        <option value="hostel1">Хостел №1</option>
                        <option value="hostel2">Хостел №2</option>
                    </select>
                    <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-700">
                        <option value="">Все действия</option>
                        {Object.entries(ACTION_META).map(([k, v]) => (
                            <option key={k} value={k}>{v.icon} {v.label}</option>
                        ))}
                    </select>
                    <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-700">
                        <option value="">Все пользователи</option>
                        {uniqueUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                    <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"/>
                </div>
                {(search || filterAction || filterUser || filterDate || filterHostel) && (
                    <button onClick={() => { setSearch(''); setFilterAction(''); setFilterUser(''); setFilterDate(''); setFilterHostel(''); }}
                        className="mt-2 text-xs text-indigo-600 hover:text-indigo-700 font-bold">
                        × Сбросить фильтры
                    </button>
                )}
            </div>

            {/* Log entries */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                {filtered.length === 0 ? (
                    <div className="py-16 text-center">
                        <div className="text-4xl mb-2">📋</div>
                        <div className="text-slate-400 font-medium">Нет записей</div>
                        <div className="text-slate-300 text-xs mt-1">История действий появится после первых операций</div>
                    </div>
                ) : (
                    <>
                        <div className="divide-y divide-slate-50">
                            {filtered.slice(0, pageSize).map((entry, i) => {
                                const meta = ACTION_META[entry.action] || { icon: '📝', label: entry.action || '—', color: 'slate' };
                                const badge = COLOR_MAP[meta.color] || COLOR_MAP.slate;
                                const det = entry.details || {};
                                return (
                                    <div key={entry.id || i} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors">
                                        <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-sm shrink-0 mt-0.5 select-none">
                                            {meta.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badge}`}>
                                                    {meta.label}
                                                </span>
                                                {det.guestName && (
                                                    <span className="text-sm font-semibold text-slate-700 truncate">{det.guestName}</span>
                                                )}
                                                {det.amount && parseInt(det.amount) > 0 && (
                                                    <span className="text-sm font-bold text-emerald-600">{parseInt(det.amount).toLocaleString()} сум</span>
                                                )}
                                                {det.code && (
                                                    <span className="text-xs font-black text-orange-600 tracking-wider">{det.code}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
                                                <span className="font-semibold text-slate-600">{entry.userName}</span>
                                                {entry.hostelId && HOSTELS[entry.hostelId] && (
                                                    <span>{HOSTELS[entry.hostelId]}</span>
                                                )}
                                                {det.roomNumber && <span>Комн. {det.roomNumber}</span>}
                                                {det.bedId      && <span>Место {det.bedId}</span>}
                                                {det.category   && <span>{det.category}</span>}
                                                {det.comment    && <span className="truncate max-w-[160px]">{det.comment}</span>}
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-400 shrink-0 text-right leading-tight">
                                            <div className="font-medium">
                                                {new Date(entry.timestamp).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
                                            </div>
                                            <div className="font-black text-slate-500">
                                                {new Date(entry.timestamp).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {filtered.length > pageSize && (
                            <div className="py-4 text-center border-t border-slate-100">
                                <button onClick={() => setPageSize(p => p + 100)}
                                    className="flex items-center gap-2 mx-auto px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                                    <ChevronDown size={15}/> Показать ещё ({filtered.length - pageSize} записей)
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default AuditLogView;
