import React, { useState, useMemo } from 'react';
import { ClipboardList, Search, Download, ChevronDown, X, Filter } from 'lucide-react';

// ── Action metadata — только те, что реально логируются в коде ───────────────
const ACTION_META = {
    // Гости
    checkin:              { icon: '🏨', label: 'Заселение',              color: 'emerald', group: 'Гости' },
    checkout:             { icon: '🚪', label: 'Выселение (ручное)',      color: 'blue',    group: 'Гости' },
    auto_checkout:        { icon: '🏁', label: 'Авто-выселение',          color: 'amber',   group: 'Гости' },
    undo:                 { icon: '↩️', label: 'Отмена действия',         color: 'indigo',  group: 'Гости' },
    trim_days:            { icon: '✂️', label: 'Срез дней',               color: 'orange',  group: 'Гости' },
    // Брони
    booking_add:          { icon: '📋', label: 'Бронь добавлена',         color: 'purple',  group: 'Брони' },
    booking_accept:       { icon: '✅', label: 'Бронь принята',            color: 'emerald', group: 'Брони' },
    booking_reject:       { icon: '❌', label: 'Бронь отклонена',          color: 'rose',    group: 'Брони' },
    // Финансы
    expense_add:          { icon: '💳', label: 'Расход добавлен',          color: 'amber',   group: 'Финансы' },
    payment_add:          { icon: '💵', label: 'Оплата',                   color: 'green',   group: 'Финансы' },
    debt_add:             { icon: '💸', label: 'Долг добавлен',            color: 'rose',    group: 'Финансы' },
    debt_paid:            { icon: '💰', label: 'Долг погашен',             color: 'emerald', group: 'Финансы' },
    // Промокоды
    promo_create:         { icon: '🏷️', label: 'Промокод создан',         color: 'orange',  group: 'Промокоды' },
    promo_delete:         { icon: '🗑️', label: 'Промокод удалён',         color: 'rose',    group: 'Промокоды' },
    promo_used:           { icon: '✂️', label: 'Промокод применён',        color: 'purple',  group: 'Промокоды' },
    // Сессии / Вход
    login:                { icon: '🔑', label: 'Вход в систему',           color: 'blue',    group: 'Сессии' },
    logout:               { icon: '👋', label: 'Выход из системы',         color: 'slate',   group: 'Сессии' },
    force_logout:         { icon: '🔒', label: 'Принудительный выход',     color: 'rose',    group: 'Сессии' },
    session_revoked:      { icon: '🚫', label: 'Сессия завершена (адм.)',  color: 'orange',  group: 'Сессии' },
    // E-mehmon
    registration_add:     { icon: '🪪', label: 'Регистрация E-mehmon',    color: 'purple',  group: 'E-mehmon' },
    registration_extend:  { icon: '🔄', label: 'Продление E-mehmon',      color: 'indigo',  group: 'E-mehmon' },
    registration_remove:  { icon: '🔴', label: 'Вывод из E-mehmon',       color: 'slate',   group: 'E-mehmon' },
    // Клиенты
    sync_clients:         { icon: '🔄', label: 'Синхронизация клиентов',  color: 'blue',    group: 'Клиенты' },
    // Система
    auto_shift_start:     { icon: '🟢', label: 'Смена начата (авто)',      color: 'emerald', group: 'Система' },
    error:                { icon: '⚠️', label: 'Ошибка системы',           color: 'rose',    group: 'Система' },
    system_error:         { icon: '🚨', label: 'Системная ошибка JS',      color: 'rose',    group: 'Система' },
    version_check:        { icon: '🔄', label: 'Проверка версии',          color: 'blue',    group: 'Система' },
};

const HOSTELS = { hostel1: 'Хостел №1', hostel2: 'Хостел №2', all: 'Оба' };

const COLOR_MAP = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue:    'bg-blue-50 text-blue-700 border-blue-200',
    indigo:  'bg-indigo-50 text-indigo-700 border-indigo-200',
    purple:  'bg-purple-50 text-purple-700 border-purple-200',
    rose:    'bg-rose-50 text-rose-700 border-rose-200',
    amber:   'bg-amber-50 text-amber-700 border-amber-200',
    orange:  'bg-orange-50 text-orange-700 border-orange-200',
    green:   'bg-green-50 text-green-700 border-green-200',
    slate:   'bg-slate-100 text-slate-600 border-slate-200',
};

// Группы для select с optgroup
const ACTION_GROUPS = Object.entries(ACTION_META).reduce((acc, [k, v]) => {
    if (!acc[v.group]) acc[v.group] = [];
    acc[v.group].push({ key: k, ...v });
    return acc;
}, {});

// ── Component ────────────────────────────────────────────────────────────────
const AuditLogView = ({ auditLog = [], currentUser }) => {
    const [search,        setSearch       ] = useState('');
    const [filterAction,  setFilterAction ] = useState('');
    const [filterUser,    setFilterUser   ] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo,   setFilterDateTo  ] = useState('');
    const [filterHostel,  setFilterHostel ] = useState('');
    const [pageSize,      setPageSize     ] = useState(200);

    const uniqueUsers = useMemo(() => {
        const seen = new Map();
        auditLog.forEach(e => {
            if (e.userId && !seen.has(e.userId)) seen.set(e.userId, e.userName || e.userId);
        });
        return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [auditLog]);

    // Уникальные действия, которые реально есть в базе
    const presentActions = useMemo(() => {
        const found = new Set(auditLog.map(e => e.action).filter(Boolean));
        return found;
    }, [auditLog]);

    const filtered = useMemo(() => {
        const s = search.toLowerCase();
        return auditLog.filter(e => {
            if (filterAction && e.action !== filterAction) return false;
            if (filterUser   && e.userId !== filterUser)   return false;
            if (filterHostel && e.hostelId !== filterHostel) return false;
            if (filterDateFrom) {
                const d = e.timestamp ? e.timestamp.slice(0, 10) : '';
                if (d < filterDateFrom) return false;
            }
            if (filterDateTo) {
                const d = e.timestamp ? e.timestamp.slice(0, 10) : '';
                if (d > filterDateTo) return false;
            }
            if (s) {
                return (
                    (e.userName || '').toLowerCase().includes(s) ||
                    (ACTION_META[e.action]?.label || e.action || '').toLowerCase().includes(s) ||
                    (e.details?.guestName  || '').toLowerCase().includes(s) ||
                    (e.details?.fullName   || '').toLowerCase().includes(s) ||
                    (e.details?.comment    || '').toLowerCase().includes(s) ||
                    (e.details?.code       || '').toLowerCase().includes(s) ||
                    String(e.details?.amount || '').includes(s)
                );
            }
            return true;
        });
    }, [auditLog, filterAction, filterUser, filterDateFrom, filterDateTo, filterHostel, search]);

    const hasFilter = search || filterAction || filterUser || filterDateFrom || filterDateTo || filterHostel;

    const resetFilters = () => {
        setSearch(''); setFilterAction(''); setFilterUser('');
        setFilterDateFrom(''); setFilterDateTo(''); setFilterHostel('');
    };

    const handleExport = () => {
        const rows = [['Дата/Время', 'Пользователь', 'Роль', 'Хостел', 'Действие', 'Гость/Детали', 'Сумма', 'Доп. инфо']];
        filtered.forEach(e => {
            const det = e.details || {};
            rows.push([
                new Date(e.timestamp).toLocaleString('ru'),
                e.userName || '',
                e.userRole || '',
                HOSTELS[e.hostelId] || e.hostelId || '',
                ACTION_META[e.action]?.label || e.action || '',
                det.guestName || det.fullName || det.comment || '',
                det.amount || '',
                [det.roomNumber && `Комн.${det.roomNumber}`, det.bedId && `Место ${det.bedId}`, det.category, det.code].filter(Boolean).join(' | '),
            ]);
        });
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `audit_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    const fmtDate = (ts) => {
        const d = new Date(ts);
        const now = new Date();
        const sameYear = d.getFullYear() === now.getFullYear();
        return {
            date: d.toLocaleDateString('ru', { day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' }),
            time: d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }),
        };
    };

    const INP = "px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-700 transition-all";

    return (
        <div className="space-y-4 animate-in fade-in">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <ClipboardList size={20} className="text-indigo-500"/> История изменений
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {filtered.length.toLocaleString()} из {auditLog.length.toLocaleString()} записей
                        {auditLog.length > 0 && (() => {
                            const oldest = auditLog[auditLog.length - 1]?.timestamp;
                            if (!oldest) return null;
                            return <span className="text-slate-400"> · с {new Date(oldest).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}</span>;
                        })()}
                    </p>
                </div>
                <button onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors shadow-sm">
                    <Download size={14}/> Экспорт CSV
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
                    <Filter size={12}/> Фильтры
                </div>
                {/* Row 1: Search + Hostel + Action */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Поиск по имени, гостю, сумме…"
                            className={INP + ' w-full pl-8'}/>
                    </div>
                    <select value={filterHostel} onChange={e => setFilterHostel(e.target.value)} className={INP + ' w-full'}>
                        <option value="">Все хостелы</option>
                        <option value="hostel1">Хостел №1</option>
                        <option value="hostel2">Хостел №2</option>
                    </select>
                    <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className={INP + ' w-full'}>
                        <option value="">Все пользователи</option>
                        {uniqueUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                </div>
                {/* Row 2: Action + Date from/to */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className={INP + ' w-full'}>
                        <option value="">Все действия</option>
                        {Object.entries(ACTION_GROUPS).map(([group, items]) => (
                            <optgroup key={group} label={group}>
                                {items
                                    .filter(item => presentActions.has(item.key))
                                    .map(item => (
                                        <option key={item.key} value={item.key}>{item.icon} {item.label}</option>
                                    ))
                                }
                            </optgroup>
                        ))}
                    </select>
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <label className="absolute -top-2 left-2 text-[10px] font-bold text-slate-400 bg-white px-1">От</label>
                            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                                className={INP + ' w-full'}/>
                        </div>
                        <span className="text-slate-300 font-bold shrink-0">—</span>
                        <div className="relative flex-1">
                            <label className="absolute -top-2 left-2 text-[10px] font-bold text-slate-400 bg-white px-1">До</label>
                            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                                className={INP + ' w-full'}/>
                        </div>
                    </div>
                    <div className="flex items-center">
                        {hasFilter && (
                            <button onClick={resetFilters}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors">
                                <X size={12}/> Сбросить фильтры
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Log entries */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                {filtered.length === 0 ? (
                    <div className="py-16 text-center">
                        <div className="text-4xl mb-3">📋</div>
                        <div className="text-slate-500 font-bold text-base">Нет записей</div>
                        <div className="text-slate-300 text-xs mt-1">
                            {hasFilter ? 'Попробуйте изменить фильтры' : 'История действий появится после первых операций'}
                        </div>
                        {hasFilter && (
                            <button onClick={resetFilters} className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700">
                                Сбросить фильтры
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="divide-y divide-slate-50">
                            {filtered.slice(0, pageSize).map((entry, i) => {
                                const meta = ACTION_META[entry.action] || { icon: '📝', label: entry.action || '—', color: 'slate' };
                                const badge = COLOR_MAP[meta.color] || COLOR_MAP.slate;
                                const det = entry.details || {};
                                const { date, time } = fmtDate(entry.timestamp);
                                const guestLabel = det.guestName || det.fullName || null;
                                const extraParts = [
                                    det.roomNumber && `Комн. ${det.roomNumber}`,
                                    det.bedId      && `Место ${det.bedId}`,
                                    det.category,
                                    det.comment && det.comment.length > 40 ? det.comment.slice(0, 40) + '…' : det.comment,
                                    det.code,
                                    det.label,
                                    det.reason && `Причина: ${det.reason}`,
                                    det.count  && `×${det.count}`,
                                    det.daysToRemove && `-${det.daysToRemove} дн.`,
                                    det.newEndDate && `→ ${new Date(det.newEndDate).toLocaleDateString('ru')}`,
                                ].filter(Boolean);
                                return (
                                    <div key={entry.id || i}
                                        className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors">
                                        <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-sm shrink-0 mt-0.5 select-none">
                                            {meta.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badge}`}>
                                                    {meta.label}
                                                </span>
                                                {guestLabel && (
                                                    <span className="text-sm font-semibold text-slate-700 truncate">{guestLabel}</span>
                                                )}
                                                {det.amount && parseInt(det.amount) > 0 && (
                                                    <span className="text-sm font-bold text-emerald-600">{parseInt(det.amount).toLocaleString()} сум</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 flex-wrap">
                                                <span className="font-semibold text-slate-600">{entry.userName || '—'}</span>
                                                {entry.userRole && entry.userRole !== 'system' && (
                                                    <span className="text-slate-300">·</span>
                                                )}
                                                {entry.hostelId && HOSTELS[entry.hostelId] && (
                                                    <span className="text-slate-400">{HOSTELS[entry.hostelId]}</span>
                                                )}
                                                {extraParts.length > 0 && (
                                                    <>
                                                        <span className="text-slate-200">|</span>
                                                        <span className="text-slate-400">{extraParts.join(' · ')}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-400 shrink-0 text-right leading-tight">
                                            <div className="font-medium whitespace-nowrap">{date}</div>
                                            <div className="font-black text-slate-500">{time}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {filtered.length > pageSize && (
                            <div className="py-4 text-center border-t border-slate-100">
                                <button onClick={() => setPageSize(p => p + 200)}
                                    className="flex items-center gap-2 mx-auto px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                                    <ChevronDown size={15}/> Показать ещё ({(filtered.length - pageSize).toLocaleString()} записей)
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