import React, { useState, useMemo, useCallback } from 'react';
import {
  Home, Plus, Search, Trash2, RefreshCw, UserX, ChevronDown, ChevronUp, ChevronLeft,
  X, Calendar, MapPin, Building, AlertCircle, User, Users,
  CheckCircle2, Receipt, AlertTriangle, Edit2, Check,
  Link, Copy, ExternalLink,
} from 'lucide-react';
import { HOSTELS, Flag } from '../../utils/helpers';
import { COUNTRY_FLAGS } from '../../constants/countries';
import { getConfig } from '../../utils/appConfig';

// ─── Status helpers ───────────────────────────────────────────────────────────

import { getLocalDateStr, getDaysLeft, getStatus, STATUS_CFG, calcEndDate, fmt, inp } from './Cadastre/shared';
import EditRegModal from './Cadastre/EditRegModal';
import CopyButton from './Cadastre/CopyButton';
import ExtendModal from './Cadastre/ExtendModal';
import CadastreModal from './Cadastre/CadastreModal';
import CadastreManageModal from './Cadastre/CadastreManageModal';
import RemoveConfirmModal from './Cadastre/RemoveConfirmModal';
import RegCard from './Cadastre/RegCard';

export default function CadastreView({
  cadastreRegs = [],
  cadastres = [],
  clients = [],
  guests = [],
  rooms = [],
  currentUser,
  selectedHostelFilter,
  onAddReg,
  onExtendReg,
  onUpdateReg,
  onRemoveReg,
  onDeleteReg,
  onAddToExpenses,
  onAddAllToExpenses,
  onAddCadastre,
  onUpdateCadastre,
  onDeleteCadastre,
}) {
  // Fazliddin полностью управляет кадастром выбранного хостела (наравне с админом)
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super' || currentUser.login === 'fazliddin';

  const [subTab, setSubTab] = useState('regs');
  const [search, setSearch] = useState('');
  // По умолчанию показываем активные + истекающие (обязательная фильтрация)
  const [statusFilter, setStatusFilter] = useState('active_expiring');
  const [monthFilter, setMonthFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [extendReg, setExtendReg] = useState(null);
  const [editReg, setEditReg] = useState(null);
  const [cadastreModal, setCadastreModal] = useState(null);
  const [removeConfirmReg, setRemoveConfirmReg] = useState(null);
  const [addAllConfirm, setAddAllConfirm] = useState(false);
  const [busyAddAll, setBusyAddAll] = useState(false);

  // ─── Hostel filtering (cashier sees own only) ───────────────────────
  const visibleRegs = useMemo(() => {
    if (!isAdmin) return cadastreRegs.filter(r => r.hostelId === currentUser.hostelId);
    if (selectedHostelFilter && selectedHostelFilter !== 'all') return cadastreRegs.filter(r => r.hostelId === selectedHostelFilter);
    return cadastreRegs;
  }, [cadastreRegs, isAdmin, currentUser.hostelId, selectedHostelFilter]);

  const visibleCadastres = useMemo(() => {
    if (!isAdmin) return cadastres.filter(c => c.hostelId === currentUser.hostelId);
    if (selectedHostelFilter && selectedHostelFilter !== 'all') return cadastres.filter(c => c.hostelId === selectedHostelFilter);
    return cadastres;
  }, [cadastres, isAdmin, currentUser.hostelId, selectedHostelFilter]);

  const toNum = (v) => Number(v) || 0;
  const monthKey = (dateLike) => {
    if (!dateLike) return '';
    const s = String(dateLike);
    if (s.length >= 7 && s[4] === '-') return s.slice(0, 7);
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return '';
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}`;
  };

  const getRegExpenseByMonth = useCallback((reg) => {
    const explicit = reg?.expenseByMonth && typeof reg.expenseByMonth === 'object' ? { ...reg.expenseByMonth } : {};
    if (Object.keys(explicit).length > 0) return explicit;
    const total = toNum(reg?.amount);
    const mk = monthKey(reg?.createdAt) || monthKey(reg?.startDate);
    return (total > 0 && mk) ? { [mk]: Math.round(total) } : {};
  }, []);

  const getRegExpensedByMonth = useCallback((reg, expenseByMonth) => {
    const explicit = reg?.expensedByMonth && typeof reg.expensedByMonth === 'object' ? { ...reg.expensedByMonth } : {};
    if (Object.keys(explicit).length > 0) return explicit;
    const totalExpensed = toNum(reg?.totalExpensed ?? (reg?.expenseAdded ? reg?.amount : 0));
    if (totalExpensed <= 0) return {};
    const next = {};
    let rest = totalExpensed;
    const months = Object.keys(expenseByMonth).sort();
    for (const m of months) {
      if (rest <= 0) break;
      const cap = toNum(expenseByMonth[m]);
      if (cap <= 0) continue;
      const take = Math.min(cap, rest);
      next[m] = take;
      rest -= take;
    }
    return next;
  }, []);

  const getRegMonthAccrued = useCallback((reg, month) => {
    const map = getRegExpenseByMonth(reg);
    if (!month) return Object.values(map).reduce((s, v) => s + toNum(v), 0);
    return toNum(map[month]);
  }, [getRegExpenseByMonth]);

  const getRegMonthPending = useCallback((reg, month) => {
    const expenseByMonth = getRegExpenseByMonth(reg);
    const expensedByMonth = getRegExpensedByMonth(reg, expenseByMonth);
    if (!month) {
      return Object.keys(expenseByMonth).reduce((sum, m) => (
        sum + Math.max(0, toNum(expenseByMonth[m]) - toNum(expensedByMonth[m]))
      ), 0);
    }
    return Math.max(0, toNum(expenseByMonth[month]) - toNum(expensedByMonth[month]));
  }, [getRegExpenseByMonth, getRegExpensedByMonth]);

  // ─── Available months for month filter ──────────────────────────────────────
  const availableMonths = useMemo(() => {
    const months = new Set();
    visibleRegs.forEach(r => {
      const map = getRegExpenseByMonth(r);
      Object.keys(map).forEach(m => months.add(m));
    });
    return [...months].sort().reverse();
  }, [visibleRegs, getRegExpenseByMonth]);

  const formatMonth = (ym) => {
    const [y, m] = ym.split('-');
    const names = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    return `${names[parseInt(m, 10) - 1]} ${y}`;
  };

  // ─── Month-filtered (before search/status filter) ─────────────────────────
  const monthFilteredRegs = useMemo(() => {
    if (!monthFilter) return visibleRegs;
    return visibleRegs.filter(r => getRegMonthAccrued(r, monthFilter) > 0);
  }, [visibleRegs, monthFilter, getRegMonthAccrued]);

  // ─── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active   = monthFilteredRegs.filter(r => getStatus(r) === 'active').length;
    const expiring = monthFilteredRegs.filter(r => getStatus(r) === 'expiring').length;
    const expired  = monthFilteredRegs.filter(r => getStatus(r) === 'expired').length;
    const totalCost = monthFilteredRegs
      .reduce((s, r) => s + getRegMonthAccrued(r, monthFilter), 0);
    // Завершённые (removed) с неучтённым расходом тоже считаем — getRegMonthPending вернёт 0, если всё учтено
    const pendingExpense = monthFilteredRegs
      .reduce((s, r) => s + getRegMonthPending(r, monthFilter), 0);
    return { active, expiring, expired, totalCost, pendingExpense };
  }, [monthFilteredRegs, monthFilter, getRegMonthAccrued, getRegMonthPending]);

  // ─── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = monthFilteredRegs;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.guestName || '').toLowerCase().includes(q) ||
        (r.cadastreAddress || '').toLowerCase().includes(q) ||
        (r.passport || '').toLowerCase().includes(q) ||
        (r.cadastreName || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter === 'active_expiring') {
      list = list.filter(r => {
        const st = getStatus(r);
        if (st === 'active' || st === 'expiring') return true;
        // завершённые с неучтённым расходом тоже показываем — чтобы не забыть добавить в расходы
        if (st === 'removed') return getRegMonthPending(r, monthFilter) > 0;
        return false;
      });
    } else if (statusFilter !== 'all') {
      list = list.filter(r => getStatus(r) === statusFilter);
    }
    return list;
  }, [monthFilteredRegs, search, statusFilter, monthFilter, getRegMonthPending]);

  const hostelName = (id) => HOSTELS[id]?.name || id || '—';

  const handleAddAll = useCallback(() => {
    setAddAllConfirm(true);
  }, []);

  const handleAddAllConfirmed = useCallback(async () => {
    if (busyAddAll) return;
    setBusyAddAll(true);
    await onAddAllToExpenses(monthFilteredRegs);
    setBusyAddAll(false);
    setAddAllConfirm(false);
  }, [monthFilteredRegs, onAddAllToExpenses, busyAddAll]);

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center">
            <Home size={18} className="text-teal-600" />
          </div>
          <div>
            <h2 className="font-black text-slate-800 text-lg leading-tight">Кадастр-регистрация</h2>
            <p className="text-xs text-slate-500">Регистрация гостей в частных домах</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {stats.pendingExpense > 0 && (
            <button
              onClick={handleAddAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 shadow-sm"
            >
              <Receipt size={13} />
              В расходы ({fmt(stats.pendingExpense)} сум)
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 shadow-sm shadow-teal-200"
          >
            <Plus size={14} /> Регистрация
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Активных',  value: stats.active,   color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', filter: 'active' },
          { label: 'Истекают',  value: stats.expiring, color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   filter: 'expiring' },
          { label: 'Истекли',   value: stats.expired,  color: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-200',    filter: 'expired' },
          { label: 'Все расходы', value: fmt(stats.totalCost) + ' сум', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200', filter: 'all' },
        ].map(s => (
          <button key={s.label} onClick={() => setStatusFilter(f => f === s.filter ? 'active_expiring' : s.filter)}
            className={`${s.bg} border-2 ${statusFilter === s.filter ? s.border + ' ring-2 ring-offset-1 ring-current opacity-100' : s.border + ' opacity-70'} rounded-xl p-3 text-center hover:opacity-90 transition-all`}>
            <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Sub tabs */}
      {isAdmin && (
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 self-start w-fit">
          {[
            { id: 'regs', label: 'Регистрации' },
            { id: 'cadastres', label: 'Кадастры' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${subTab === t.id ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ─── TAB: Регистрации ─── */}
      {subTab === 'regs' && (
        <>
          {/* Фильтры — всегда видимы */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20"
                placeholder="Поиск по гостю, адресу..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-teal-400 min-w-36"
              value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)}
            >
              <option value="">Все месяцы</option>
              {availableMonths.map(ym => (
                <option key={ym} value={ym}>{formatMonth(ym)}</option>
              ))}
            </select>
            <select
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-teal-400 min-w-44"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="active_expiring">Активные + Истекают</option>
              <option value="active">Только активные</option>
              <option value="expiring">Только истекают</option>
              <option value="expired">Истекли</option>
              <option value="removed">Завершённые</option>
              <option value="all">Все записи</option>
            </select>
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Home size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">Нет записей</p>
              <p className="text-xs mt-1">
                {statusFilter === 'active_expiring' ? 'Нет активных регистраций' : 'Попробуйте изменить фильтр'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(reg => (
                <RegCard
                  key={reg.id}
                  reg={reg}
                  isAdmin={isAdmin}
                  onExtend={r => setExtendReg(r)}
                  onEdit={r => setEditReg(r)}
                  onRemove={r => setRemoveConfirmReg(r)}
                  onDelete={onDeleteReg}
                  onAddToExpenses={onAddToExpenses}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── TAB: Кадастры ─── */}
      {subTab === 'cadastres' && isAdmin && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setCadastreModal('add')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700"
            >
              <Plus size={14} /> Добавить кадастр
            </button>
          </div>

          {visibleCadastres.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Building size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">Кадастры не добавлены</p>
              <p className="text-xs mt-1">Добавьте частные дома для быстрого выбора при регистрации</p>
            </div>
          ) : (
            visibleCadastres.map(c => (
              <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Building size={18} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800">{c.name || '—'}</p>
                    <p className="text-xs text-slate-600">📍 {c.address}</p>
                    {c.owner && <p className="text-xs text-slate-500">👤 {c.owner} {c.phone && `· ${c.phone}`}</p>}
                    <p className="text-xs text-slate-400">{hostelName(c.hostelId)} {c.dailyRate > 0 && `· ${fmt(c.dailyRate)} сум/день`}</p>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => setCadastreModal(c)}
                    className="p-2 rounded-lg hover:bg-teal-50 text-teal-500">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => onDeleteCadastre(c.id)}
                    className="p-2 rounded-lg hover:bg-rose-50 text-rose-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modals */}
      {removeConfirmReg && (
        <RemoveConfirmModal
          reg={removeConfirmReg}
          onClose={() => setRemoveConfirmReg(null)}
          onConfirm={onRemoveReg}
        />
      )}
      {addAllConfirm && (
        <div className="modal-centered fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pb-[84px] sm:pb-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="h-1.5 bg-violet-500 w-full" />
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <Receipt size={20} className="text-violet-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Добавить все в расходы</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Будет добавлено <b className="text-violet-700">{fmt(stats.pendingExpense)} сум</b> по всем регистрациям с неучтённым расходом (включая завершённые). Дата расхода — день создания регистрации.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setAddAllConfirm(false)} disabled={busyAddAll}
                  className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 disabled:opacity-40">
                  Отмена
                </button>
                <button onClick={handleAddAllConfirmed} disabled={busyAddAll}
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-700 disabled:opacity-40 flex items-center justify-center gap-2">
                  {busyAddAll
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Receipt size={14} />
                  }
                  Добавить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showModal && (
        <CadastreModal
          clients={clients}
          cadastres={cadastres}
          guests={guests}
          rooms={rooms}
          cadastreRegs={cadastreRegs}
          currentUser={currentUser}
          selectedHostelFilter={selectedHostelFilter}
          onClose={() => setShowModal(false)}
          onSubmit={onAddReg}
        />
      )}
      {extendReg && (
        <ExtendModal
          reg={extendReg}
          onClose={() => setExtendReg(null)}
          onSubmit={data => onExtendReg(extendReg, data)}
        />
      )}
      {editReg && (
        <EditRegModal
          reg={editReg}
          onClose={() => setEditReg(null)}
          onSubmit={data => onUpdateReg(editReg, data)}
        />
      )}
      {cadastreModal && (
        <CadastreManageModal
          cadastre={cadastreModal === 'add' ? null : cadastreModal}
          selectedHostelFilter={selectedHostelFilter}
          onClose={() => setCadastreModal(null)}
          onSubmit={data =>
            cadastreModal === 'add'
              ? onAddCadastre(data)
              : onUpdateCadastre(cadastreModal.id, data)
          }
        />
      )}
    </div>
  );
}
