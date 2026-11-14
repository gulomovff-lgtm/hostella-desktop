import React, { useState, useMemo, useCallback } from 'react';
import {
  Home, Plus, Search, Trash2, RefreshCw, UserX, ChevronDown, ChevronUp, ChevronLeft,
  X, Calendar, MapPin, Building, AlertCircle, User, Users,
  CheckCircle2, Receipt, AlertTriangle, Edit2, Check,
  Link, Copy, ExternalLink, Settings,
} from 'lucide-react';
import { KadastrSetupModal } from '../UI/KadastrCardPicker';
import KadastrStages, { KADASTR_LOGIN_STEPS } from '../UI/KadastrStages';
import { vaultArg } from '../../utils/kadastrVault';
import { HOSTELS, Flag } from '../../utils/helpers';
import { COUNTRY_FLAGS } from '../../constants/countries';
import TRANSLATIONS from '../../constants/translations';

// ─── Status helpers ───────────────────────────────────────────────────────────

import { getStatus, STATUS_CFG, fmt } from './Cadastre/shared';
import CopyButton from './Cadastre/CopyButton';
import ExtendModal from './Cadastre/ExtendModal';
import CadastreManageModal from './Cadastre/CadastreManageModal';
import RegCard from './Cadastre/RegCard';
import { cadastreLimitFor } from '../../utils/kadastrPortal';
import { normPass } from '../../utils/registrationStatus';

// Число плавно набирается до значения (≈0,6 с), при смене — от прежнего
function CountUp({ value }) {
  const [shown, setShown] = React.useState(0);
  const from = React.useRef(0);
  React.useEffect(() => {
    const start = from.current, end = Number(value) || 0, t0 = performance.now();
    let raf;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 600);
      const v = Math.round(start + (end - start) * (1 - Math.pow(1 - k, 3)));
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step); else from.current = end;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{fmt(shown)}</>;
}

export default function CadastreView({
  cadastreRegs = [],
  cadastres = [],
  clients = [],
  guests = [],
  rooms = [],
  currentUser,
  selectedHostelFilter,
  onExtendReg,
  onPay,
  onAddCadastre,
  onUpdateCadastre,
  onDeleteCadastre,
  lang = 'ru',
}) {
  const t = k => TRANSLATIONS[lang]?.[k] || k;
  // Fazliddin полностью управляет кадастром выбранного хостела (наравне с админом)
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super' || currentUser.login === 'fazliddin';

  const [subTab, setSubTab] = useState('regs');
  const [search, setSearch] = useState('');
  // По умолчанию показываем активные + истекающие (обязательная фильтрация)
  const [statusFilter, setStatusFilter] = useState('active_expiring');
  const [monthFilter, setMonthFilter] = useState('');
  const [extendReg, setExtendReg] = useState(null);
  // Предел кадастра человека (30 дней от въезда) — из листков сайта
  const maxEndOf = (reg) => {
    const same = (cadastreRegs || []).filter(r => normPass(r.passport) && normPass(r.passport) === normPass(reg.passport));
    const guest = (guests || []).find(g => (reg.guestId && g.id === reg.guestId) || (normPass(g.passport) && normPass(g.passport) === normPass(reg.passport)) && g.status === 'active')
      || (guests || []).find(g => reg.guestId && g.id === reg.guestId);
    return cadastreLimitFor(guest, same);
  };
  // Вход в кадастр (сайт reg.emehmon.uz): кнопка, если не вошли
  const [kadLogin, setKadLogin] = useState(null);   // { loggedIn, hasPassword, busy, error }
  // Пароль ЭЦП и карты меняет админ прямо здесь (13.11.2026)
  const canKadSetup = currentUser.role === 'admin' || currentUser.role === 'super';
  const [kadSetupOpen, setKadSetupOpen] = useState(false);
  const kadAvail = typeof window !== 'undefined' && !!window.electronAPI?.kadastrStatus;
  const refreshKad = () => window.electronAPI?.kadastrStatus?.().then(st => setKadLogin(s => ({ ...(s || {}), ...st, busy: false }))).catch(() => {});
  React.useEffect(() => { if (kadAvail) refreshKad(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Филиал, чьим паролем ЭЦП входить: кассир — свой, админ — выбранный сверху
  const kadHostel = (!isAdmin ? currentUser.hostelId : (selectedHostelFilter && selectedHostelFilter !== 'all' ? selectedHostelFilter : currentUser.hostelId)) || 'hostel1';
  const doKadLogin = async () => {
    setKadLogin(s => ({ ...(s || {}), busy: true, error: '' }));
    const r = await vaultArg(kadHostel)
      .then((vault) => window.electronAPI.kadastrLogin({ vault }))
      .catch(e => ({ status: 'error', reason: e.message }));
    if (r?.status === 'ok') {
      // Успех: все этапы с галочками и «Вход выполнен», потом блок сворачивается
      setKadLogin(s => ({ ...(s || {}), busy: false, justDone: true, error: '' }));
      setTimeout(() => setKadLogin(s => ({ ...(s || {}), justDone: false, loggedIn: true })), 1400);
      // Сразу сверка с сайтом: листки, оформленные до автоматики, — в Hostella
      window.dispatchEvent(new Event('hostella:kadastr-sync'));
    } else {
      setKadLogin(s => ({ ...(s || {}), busy: false, loggedIn: false, error: r?.reason || 'error' }));
    }
  };
  // Блок этапов: открыт во время входа и на миг после успеха; содержимое
  // держим ещё 350 мс, пока блок сворачивается по высоте (иначе — рывок)
  const stagesOpen = !!(kadLogin?.busy || kadLogin?.justDone);
  const [stagesMounted, setStagesMounted] = useState(false);
  React.useEffect(() => {
    if (stagesOpen) { setStagesMounted(true); return undefined; }
    const tm = setTimeout(() => setStagesMounted(false), 350);
    return () => clearTimeout(tm);
  }, [stagesOpen]);
  const [cadastreModal, setCadastreModal] = useState(null);

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
    const names = t('monthsFull');
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

  // Смена фильтра/поиска: прежние карточки уходят, затем приходят новые.
  // Обновление данных при том же фильтре — без анимации ухода.
  const filterKey = statusFilter + '|' + monthFilter + '|' + search.trim();
  const [shown, setShown] = useState({ list: filtered, key: filterKey, gen: 0, leaving: false, first: true });
  React.useEffect(() => {
    if (shown.key === filterKey) { if (shown.list !== filtered && !shown.leaving) setShown(s => ({ ...s, list: filtered })); return undefined; }
    setShown(s => ({ ...s, leaving: true }));
    const tm = setTimeout(() => setShown(s => ({ list: filtered, key: filterKey, gen: s.gen + 1, leaving: false, first: false })), 180);
    return () => clearTimeout(tm);
  }, [filterKey, filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      {/* Шапка (13.11.2026, по просьбе владельца — минимализм, без тёмных
          обложек, приглушённые цвета): заголовок, вход на сайт, счётчики-фильтры */}
      <div className="kad-rise flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-black text-slate-800 leading-tight">{t('cadTitle')}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{t('cadSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {kadAvail && canKadSetup && (
            <button onClick={() => setKadSetupOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors">
              <Settings size={13} /> {t('cadPortalSetup')}
            </button>
          )}
          {kadAvail && kadLogin && (kadLogin.loggedIn ? (
            <span className="kad-slide flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 kad-breathe" /> {t('cadLoggedIn')}
            </span>
          ) : (
            <button onClick={doKadLogin} disabled={kadLogin.busy}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-teal-200 bg-teal-50/60 text-xs font-bold text-teal-700 hover:bg-teal-50 disabled:opacity-60 transition-colors">
              {kadLogin.busy ? <span className="w-3 h-3 rounded-full border-2 border-teal-200 border-t-teal-600 animate-spin" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
              {t('cadLoginBtn')}
            </button>
          ))}
        </div>
      </div>
      {kadLogin?.error && !kadLogin.busy && !kadLogin.loggedIn && (
        <p className="kad-slide -mt-2 text-[11px] text-rose-500 text-right" title={kadLogin.error}>
          {t('cadLoginFail')} <span className="font-mono opacity-70">({String(kadLogin.error).slice(0, 80)})</span>
        </p>
      )}
      {/* Этапы входа — раскрываются и сворачиваются по высоте */}
      <div className={`kad-collapse ${stagesOpen ? 'open' : ''}`} style={{ marginTop: stagesOpen ? undefined : 0 }}>
        <div>
          <div className={`rounded-2xl border bg-white p-4 max-w-sm ml-auto transition-colors duration-500 ${kadLogin?.justDone ? 'border-emerald-200' : 'border-teal-100'}`}>
            {stagesMounted && <KadastrStages steps={KADASTR_LOGIN_STEPS} t={t} done={!!kadLogin?.justDone} doneText={t('cadLoggedIn')} />}
          </div>
        </div>
      </div>
      {/* Счётчики — фильтры списка (таймлайн: 80–260 мс) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: t('activeCount'),  value: stats.active,   filter: 'active',   num: 'text-emerald-600', dot: 'bg-emerald-400', on: 'bg-emerald-50/70 border-emerald-200', bar: 'bg-emerald-300' },
          { label: t('cadExpiring'),  value: stats.expiring, filter: 'expiring', num: 'text-amber-600',   dot: 'bg-amber-400',   on: 'bg-amber-50/70 border-amber-200',     bar: 'bg-amber-300' },
          { label: t('cadExpired'),   value: stats.expired,  filter: 'expired',  num: 'text-rose-500',    dot: 'bg-rose-400',    on: 'bg-rose-50/70 border-rose-200',       bar: 'bg-rose-300' },
          { label: t('cadAllExpenses'), value: stats.totalCost, money: true, filter: 'all', num: 'text-slate-700', dot: 'bg-teal-400', on: 'bg-teal-50/60 border-teal-200', bar: 'bg-teal-300' },
        ].map((s, i) => {
          const sel = statusFilter === s.filter;
          const share = s.money ? 1 : (stats.active + stats.expiring + stats.expired) ? s.value / (stats.active + stats.expiring + stats.expired) : 0;
          return (
            <button key={s.filter} onClick={() => setStatusFilter(f => f === s.filter ? 'active_expiring' : s.filter)}
              className={'kad-rise relative text-left px-4 pt-3 pb-3.5 rounded-2xl border bg-white transition-colors duration-300 overflow-hidden ' + (sel ? s.on : 'border-slate-200/80 hover:border-slate-300')}
              style={{ animationDelay: (80 + i * 60) + 'ms' }}>
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span className={'w-1.5 h-1.5 rounded-full ' + s.dot} /> {s.label}
              </p>
              <p className={'text-2xl font-black tabular-nums mt-1 leading-none ' + s.num}>
                <CountUp value={s.value} />{s.money && <span className="text-[11px] font-semibold text-slate-400 ml-1">{t('cadSum')}</span>}
              </p>
              <span className="absolute left-0 bottom-0 h-0.5 bg-slate-100 w-full" />
              <span className={'kad-fill absolute left-0 bottom-0 h-0.5 ' + s.bar} style={{ width: Math.round(share * 100) + '%', animationDelay: (300 + i * 60) + 'ms' }} />
            </button>
          );
        })}
      </div>
      {kadSetupOpen && <KadastrSetupModal t={t} hostelId={kadHostel} onClose={() => { setKadSetupOpen(false); refreshKad(); }} />}

      {/* Sub tabs */}
      {isAdmin && (
        <div className="kad-rise flex gap-1 bg-slate-100 rounded-xl p-1 self-start w-fit" style={{ animationDelay: '300ms' }}>
          {[
            { id: 'regs', label: t('registrations') },
            { id: 'cadastres', label: t('cadCadastres') },
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
          <div className="kad-rise flex gap-2 flex-wrap" style={{ animationDelay: '340ms' }}>
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20"
                placeholder={t('cadSearchPlaceholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-teal-400 min-w-36"
              value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)}
            >
              <option value="">{t('cadAllMonths')}</option>
              {availableMonths.map(ym => (
                <option key={ym} value={ym}>{formatMonth(ym)}</option>
              ))}
            </select>
            <select
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-teal-400 min-w-44"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="active_expiring">{t('cadActiveExpiring')}</option>
              <option value="active">{t('cadOnlyActive')}</option>
              <option value="expiring">{t('cadOnlyExpiring')}</option>
              <option value="expired">{t('cadExpired')}</option>
              <option value="removed">{t('cadRemovedFilter')}</option>
              <option value="all">{t('cadAllRecords')}</option>
            </select>
          </div>

          {/* List — карточки лесенкой после фильтров (≈400 мс); смена фильтра:
              старые уходят (kad-leave 180 мс), новые приходят с начала лесенки */}
          {shown.list.length === 0 ? (
            <div className={(shown.leaving ? 'kad-leave' : 'kad-rise') + ' py-16 text-center text-slate-400'} style={{ animationDelay: shown.first ? '400ms' : '0ms' }}>
              <Home size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">{t('expNoRecords')}</p>
              <p className="text-xs mt-1">
                {statusFilter === 'active_expiring' ? t('cadNoActiveRegs') : t('cadTryChangeFilter')}
              </p>
            </div>
          ) : (
            <div className="space-y-3" key={shown.gen}>
              {shown.list.map((reg, i) => (
                <RegCard
                  key={reg.id}
                  index={i}
                  baseDelay={shown.first ? 400 : 0}
                  leaving={shown.leaving}
                  reg={reg}
                  maxEnd={maxEndOf(reg)}
                  onExtend={onExtendReg ? (r => setExtendReg(r)) : null}
                  onPay={onPay}
                  lang={lang}
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
              <Plus size={14} /> {t('cadAddCadastre')}
            </button>
          </div>

          {visibleCadastres.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Building size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">{t('cadNoCadastres')}</p>
              <p className="text-xs mt-1">{t('cadAddHousesHint')}</p>
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
                    <p className="text-xs text-slate-400">{hostelName(c.hostelId)} {c.dailyRate > 0 && `· ${fmt(c.dailyRate)} ${t('rrSumPerDay')}`}</p>
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
      {extendReg && (
        <ExtendModal
          reg={extendReg}
          maxEnd={maxEndOf(extendReg)}
          onClose={() => setExtendReg(null)}
          onSubmit={data => onExtendReg(extendReg, data)}
          lang={lang}
        />
      )}
      {cadastreModal && (
        <CadastreManageModal
          cadastre={cadastreModal === 'add' ? null : cadastreModal}
          selectedHostelFilter={selectedHostelFilter}
          onClose={() => setCadastreModal(null)}
          lang={lang}
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
