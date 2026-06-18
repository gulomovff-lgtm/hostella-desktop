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

// Возвращает локальную дату в формате YYYY-MM-DD
const getLocalDateStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Разность в днях: endDate (YYYY-MM-DD) минус сегодня (локальное время)
// Регистрация 6–16: последний день 16-е → daysLeft=0 когда сегодня 16-е
const getDaysLeft = (endDate) => {
  const todayStr = getLocalDateStr();
  const endMs   = new Date(endDate   + 'T12:00:00').getTime();
  const todayMs = new Date(todayStr  + 'T12:00:00').getTime();
  return Math.round((endMs - todayMs) / 86400000);
};

const getStatus = (reg) => {
  if (reg.status === 'removed') return 'removed';
  const daysLeft = getDaysLeft(reg.endDate);
  if (daysLeft <= 0) return 'expired';
  if (daysLeft <= 3) return 'expiring';
  return 'active';
};

const STATUS_CFG = {
  active:   { label: 'Активна',       icon: CheckCircle2,   bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  expiring: { label: 'Истекает',      icon: AlertTriangle,  bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500'   },
  expired:  { label: 'Истекла',       icon: AlertCircle,    bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    dot: 'bg-rose-500'    },
  removed:  { label: 'Завершён',       icon: UserX,          bg: 'bg-slate-50',   text: 'text-slate-500',   border: 'border-slate-200',   dot: 'bg-slate-400'   },
};

const calcEndDate = (startDate, days) => {
  try {
    const d = new Date(startDate + 'T12:00:00');
    d.setDate(d.getDate() + parseInt(days || 0));
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  } catch { return ''; }
};

const fmt = (n) => Number(n || 0).toLocaleString();
const inp = 'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none font-medium';

// ─── EditRegModal ─────────────────────────────────────────────────────────────

const EditRegModal = ({ reg, onClose, onSubmit }) => {
  const [guestName, setGuestName] = useState(reg.guestName || '');
  const [startDate, setStartDate] = useState(reg.startDate || '');
  const [days, setDays] = useState(String(reg.days || 1));
  const [dailyPrice, setDailyPrice] = useState(() => {
    const regDays = Number(reg.days) || 0;
    const regAmount = Number(reg.amount) || 0;
    return regDays > 0 ? String(Math.round(regAmount / regDays)) : '';
  });
  const [amount, setAmount] = useState(String(reg.amount || ''));
  const [regLink, setRegLink] = useState(reg.regLink || '');

  const endDate = calcEndDate(startDate, days);

  const submit = () => {
    if (!guestName.trim() || !startDate || parseInt(days) <= 0) return;
    onSubmit({ guestName: guestName.trim(), startDate, endDate, days: parseInt(days), amount: Number(amount) || 0, regLink: regLink.trim() });
    onClose();
  };

  const recalcAmount = (priceVal, daysVal) => {
    const d = parseInt(daysVal, 10);
    const p = Number(priceVal);
    if (d > 0 && p >= 0) {
      setAmount(String(Math.round(p * d)));
    }
  };

  return (
    <div className="modal-centered fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 pb-[84px] sm:pb-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center"><Edit2 size={15} className="text-teal-600" /></div>
            <h3 className="font-black text-base text-slate-800">Изменить регистрацию</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
        </div>
        <div className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
          📍 {reg.cadastreAddress}
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Гость</label>
            <input className={inp} value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Имя гостя" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Дата начала</label>
              <input className={inp} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Количество дней</label>
              <input
                className={inp}
                type="number"
                min="1"
                value={days}
                onChange={e => {
                  const v = e.target.value;
                  setDays(v);
                  recalcAmount(dailyPrice, v);
                }}
              />
            </div>
          </div>
          {endDate && (
            <p className="text-sm text-teal-700 font-semibold bg-teal-50 px-3 py-2 rounded-lg">
              📅 Дата окончания: <b>{endDate}</b>
            </p>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Цена за день (сум)</label>
            <input
              className={inp}
              type="number"
              min="0"
              placeholder="0"
              value={dailyPrice}
              onChange={e => {
                const v = e.target.value;
                setDailyPrice(v);
                recalcAmount(v, days);
              }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Стоимость регистрации (сум)</label>
            <input
              className={inp}
              type="number"
              placeholder="0"
              value={amount}
              onChange={e => {
                const v = e.target.value;
                setAmount(v);
                const d = parseInt(days, 10);
                const total = Number(v);
                if (d > 0 && total >= 0) {
                  setDailyPrice(String(Math.round(total / d)));
                }
              }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Ссылка на регистрацию</label>
            <input className={inp} type="url" placeholder="https://..." value={regLink} onChange={e => setRegLink(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Отмена</button>
          <button onClick={submit} disabled={!guestName.trim() || !startDate || parseInt(days) <= 0}
            className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-40">
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── ExtendModal ──────────────────────────────────────────────────────────────

// ─── CopyButton ───────────────────────────────────────────────────────────────
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={copy} title="Скопировать"
      className="p-1 rounded-md hover:bg-slate-200 transition-colors text-slate-400 hover:text-slate-700">
      {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
    </button>
  );
};

const ExtendModal = ({ reg, onClose, onSubmit }) => {
  // Цена за день из текущей регистрации (для автоподстановки)
  const pricePerDay = (reg.amount > 0 && reg.days > 0) ? reg.amount / reg.days : 0;

  const [days, setDays] = useState('30');
  const [startFrom, setStartFrom] = useState(reg.endDate || '');
  const [regCost, setRegCost] = useState(() =>
    pricePerDay > 0 ? String(Math.round(pricePerDay * 30)) : ''
  );
  const [addToExpenses, setAddToExpenses] = useState(false);

  const newEndDate = calcEndDate(startFrom || reg.endDate, days);

  const handleDaysChange = (val) => {
    setDays(val);
    if (pricePerDay > 0 && parseInt(val) > 0) {
      setRegCost(String(Math.round(pricePerDay * parseInt(val))));
    }
  };

  const submit = () => {
    if (!days || parseInt(days) <= 0) return;
    onSubmit({ days: parseInt(days), newEndDate, startFrom, regCost, addToExpenses });
    onClose();
  };

  const hasGap = startFrom && reg.endDate && startFrom > reg.endDate;
  const gapDays = hasGap ? Math.round((new Date(startFrom + 'T12:00:00') - new Date(reg.endDate + 'T12:00:00')) / 86400000) : 0;

  return (
    <div className="modal-centered fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 pb-[84px] sm:pb-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center"><RefreshCw size={15} className="text-teal-600" /></div>
            <h3 className="font-black text-base text-slate-800">Продление регистрации</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
        </div>
        <div className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 space-y-1">
          <p className="font-semibold text-slate-800">{reg.guestName}</p>
          <p className="text-xs">📍 {reg.cadastreAddress}</p>
          <p className="text-xs">Текущая дата окончания: <b>{reg.endDate}</b></p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Начало продления</label>
            <input className={inp} type="date" value={startFrom} onChange={e => setStartFrom(e.target.value)} />
            {hasGap && (
              <p className="text-xs text-amber-600 mt-1 font-medium">
                ⚠️ Пробел {gapDays} дн. (с {reg.endDate} по {startFrom})
              </p>
            )}
            {startFrom && reg.endDate && startFrom < reg.endDate && (
              <p className="text-xs text-rose-500 mt-1 font-medium">
                ⚠️ Дата раньше окончания текущей регистрации
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Количество дней</label>
            <input className={inp} type="number" min="1" value={days} onChange={e => handleDaysChange(e.target.value)} />
          </div>
          {newEndDate && (
            <p className="text-sm text-teal-700 font-semibold bg-teal-50 px-3 py-2 rounded-lg">
              📅 Новая дата окончания: <b>{newEndDate}</b>
            </p>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Стоимость регистрации (расход)</label>
            <input className={inp} type="number" placeholder="0 сум" value={regCost} onChange={e => setRegCost(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={addToExpenses} onChange={e => setAddToExpenses(e.target.checked)}
              className="w-4 h-4 rounded accent-teal-600" />
            <span className="text-sm text-slate-700">Добавить стоимость в расходы</span>
          </label>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Отмена</button>
          <button onClick={submit} className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700">Продлить</button>
        </div>
      </div>
    </div>
  );
};

// ─── CadastreModal (новая регистрация) ────────────────────────────────────────

const CadastreModal = ({ clients, cadastres, guests = [], rooms = [], cadastreRegs = [], currentUser, selectedHostelFilter, onClose, onSubmit }) => {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';
  // Fazliddin регистрирует по выбранному хостелу (а не только по своему hostel2)
  const defaultHostel = (currentUser.login === 'fazliddin' && selectedHostelFilter && selectedHostelFilter !== 'all')
    ? selectedHostelFilter
    : (!currentUser.hostelId || currentUser.hostelId === 'all')
      ? (selectedHostelFilter && selectedHostelFilter !== 'all' ? selectedHostelFilter : 'hostel1')
      : currentUser.hostelId;

  const [hostelId, setHostelId] = useState(defaultHostel);

  const [guestSearch, setGuestSearch] = useState('');
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [selectedCadastre, setSelectedCadastre] = useState(null);
  const [manualAddress, setManualAddress] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualOwner, setManualOwner] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState('30');
  const [amount, setAmount] = useState('');
  const [amountManual, setAmountManual] = useState(false); // true если пользователь вручную изменил сумму
  const [regLink, setRegLink] = useState('');
  const [addToExpenses, setAddToExpenses] = useState(false);
  const [showResidents, setShowResidents] = useState(false);
  const [residentSearch, setResidentSearch] = useState('');

  const endDate = calcEndDate(startDate, days);

  // Фильтрация кадастров по хостелу
  const filteredCadastres = useMemo(() =>
    cadastres.filter(c => c.active !== false && (isAdmin || c.hostelId === hostelId)),
    [cadastres, hostelId, isAdmin]
  );

  // Авто-расчёт суммы из dailyRate кадастра × дни (если не редактировалось вручную)
  const autoCalcAmount = useCallback((cadastre, daysVal) => {
    if (!amountManual && cadastre && Number(cadastre.dailyRate) > 0 && parseInt(daysVal) > 0) {
      setAmount(String(Math.round(Number(cadastre.dailyRate) * parseInt(daysVal))));
    }
  }, [amountManual]);

  const handleSelectCadastre = (c) => {
    setSelectedCadastre(c || null);
    if (c) { setManualAddress(''); setManualName(''); setManualOwner(''); }
    if (!amountManual) autoCalcAmount(c, days);
  };

  const handleDaysChange = (val) => {
    setDays(val);
    if (!amountManual) autoCalcAmount(selectedCadastre, val);
  };

  // Поиск гостей
  const guestResults = useMemo(() => {
    if (!guestSearch.trim() || guestSearch.length < 2) return [];
    const q = guestSearch.toLowerCase();
    return clients.filter(c =>
      (c.fullName || '').toLowerCase().includes(q) ||
      (c.passport || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q)
    ).slice(0, 8);
  }, [guestSearch, clients]);

  const selectGuest = (g) => {
    setSelectedGuest(g);
    setGuestSearch(g.fullName || '');
  };

  // ─── Быстрый выбор из текущих проживающих (не Узбекистан) ──────────────────
  const isResidentRegistered = (g) =>
    (cadastreRegs || []).some(r => r.status !== 'removed' && (r.guestId === g.id || r.guestName === g.fullName));

  const selectResident = (g) => {
    setSelectedGuest({
      id:                g.id,
      fullName:          g.fullName,
      passport:          g.passport || '',
      birthDate:         g.birthDate || '',
      passportIssueDate: g.passportIssueDate || '',
      country:           g.country || '',
      phone:             g.phone || '',
    });
    setGuestSearch(g.fullName || '');
    setShowResidents(false);
    setResidentSearch('');
  };

  // Активные гости не из Узбекистана, сгруппированные по комнате
  const residentsByRoom = useMemo(() => {
    const matchHostel = (g) =>
      (hostelId === 'hostel1' || hostelId === 'hostel2') ? g.hostelId === hostelId : true;
    let list = (guests || []).filter(g =>
      g.status === 'active' &&
      g.country && g.country !== 'Узбекистан' &&
      matchHostel(g)
    );
    if (residentSearch.trim()) {
      const q = residentSearch.toLowerCase();
      list = list.filter(g =>
        (g.fullName || '').toLowerCase().includes(q) ||
        (g.country  || '').toLowerCase().includes(q) ||
        (g.passport || '').toLowerCase().includes(q)
      );
    }
    const groups = {};
    for (const g of list) {
      const room = rooms.find(r => r.id === g.roomId);
      const key = room?.id || g.roomId || '__none__';
      if (!groups[key]) groups[key] = { key, room, guests: [] };
      groups[key].guests.push(g);
    }
    return Object.values(groups).sort((a, b) => {
      const an = parseInt(a.room?.number, 10);
      const bn = parseInt(b.room?.number, 10);
      return (isNaN(an) ? Infinity : an) - (isNaN(bn) ? Infinity : bn);
    });
  }, [guests, rooms, hostelId, residentSearch]);

  const cadastreAddress = selectedCadastre ? selectedCadastre.address : manualAddress;
  const cadastreName    = selectedCadastre ? selectedCadastre.name    : manualName;
  const cadastreOwner   = selectedCadastre ? selectedCadastre.owner   : manualOwner;

  const canSubmit = (selectedGuest || guestSearch.trim().length >= 2) && cadastreAddress && startDate && parseInt(days) > 0;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      guestId:          selectedGuest?.id || null,
      guestName:        selectedGuest?.fullName || guestSearch.trim(),
      passport:         selectedGuest?.passport         || '',
      birthDate:        selectedGuest?.birthDate        || '',
      passportIssueDate:selectedGuest?.passportIssueDate|| '',
      country:          selectedGuest?.country          || '',
      phone:            selectedGuest?.phone            || '',
      cadastreId:      selectedCadastre?.id || null,
      cadastreAddress, cadastreName, cadastreOwner,
      startDate, endDate, days: parseInt(days),
      amount: Number(amount) || 0,
      regLink: regLink.trim(),
      addToExpenses,
    });
    onClose();
  };

  return (
    <div className="modal-centered fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 pb-[84px] sm:pb-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {showResidents ? (
          <>
            {/* Вкладка: выбор из проживающих */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setShowResidents(false); setResidentSearch(''); }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><ChevronLeft size={18} /></button>
                <h3 className="font-black text-base text-slate-800">Проживающие (не Узбекистан)</h3>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto p-4 space-y-4">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className={inp + ' pl-8'} placeholder="Поиск по имени, стране, паспорту..."
                  value={residentSearch} onChange={e => setResidentSearch(e.target.value)} />
              </div>
              {residentsByRoom.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <User size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-semibold">Нет подходящих проживающих</p>
                  <p className="text-xs mt-1">Активные гости не из Узбекистана не найдены</p>
                </div>
              ) : residentsByRoom.map(group => (
                <div key={group.key} className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    <MapPin size={11} className="text-teal-500" />
                    {group.room ? `Комната ${group.room.number}` : 'Без комнаты'}
                    <span className="text-slate-300 font-normal normal-case">· {group.guests.length}</span>
                  </div>
                  <div className="grid gap-1.5">
                    {group.guests.map(g => {
                      const registered = isResidentRegistered(g);
                      return (
                        <button key={g.id} type="button" onClick={() => selectResident(g)}
                          className="group w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50 transition-colors">
                          <Flag code={COUNTRY_FLAGS[g.country]} size={16} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{g.fullName}</p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {g.country}{g.bedId ? ` · место ${g.bedId}` : ''}{g.passport ? ` · ${g.passport}` : ''}
                            </p>
                          </div>
                          {registered && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200 shrink-0">в кадастре</span>
                          )}
                          <Check size={14} className="text-teal-500 opacity-0 group-hover:opacity-100 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
        <>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center">
              <Home size={16} className="text-teal-600" />
            </div>
            <h3 className="font-black text-base text-slate-800">Новая кадастр-регистрация</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {/* Гость */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1 uppercase tracking-wide">
              <User size={11} /> Гость
            </label>
            <div className="relative">
              <input
                className={inp + ' pr-8'}
                placeholder="Поиск по имени, паспорту, телефону..."
                value={guestSearch}
                onChange={e => { setGuestSearch(e.target.value); if (!e.target.value) setSelectedGuest(null); }}
              />
              {selectedGuest && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500"><Check size={14} /></div>
              )}
            </div>
            <button type="button" onClick={() => setShowResidents(true)}
              className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-sm font-bold hover:bg-teal-100 transition-colors">
              <Users size={15} /> Выбрать из проживающих
            </button>
            {guestResults.length > 0 && !selectedGuest && (
              <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden shadow-lg">
                {guestResults.map(g => (
                  <button key={g.id} onClick={() => selectGuest(g)}
                    className="w-full text-left px-3 py-2.5 hover:bg-teal-50 transition-colors border-b border-slate-100 last:border-0">
                    <p className="text-sm font-semibold text-slate-800">{g.fullName}</p>
                    <p className="text-xs text-slate-500">{g.passport} · {g.country} · {g.phone}</p>
                  </button>
                ))}
              </div>
            )}
            {!selectedGuest && guestSearch.trim().length >= 2 && guestResults.length === 0 && (
              <p className="mt-1.5 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                Гость не найден в базе — будет сохранено введённое имя: <b className="text-slate-600">{guestSearch.trim()}</b>
              </p>
            )}
            {selectedGuest && (
              <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-emerald-800">{selectedGuest.fullName}</p>
                  <p className="text-xs text-emerald-600">{selectedGuest.passport} · {selectedGuest.country} · {selectedGuest.phone}</p>
                </div>
                <button onClick={() => { setSelectedGuest(null); setGuestSearch(''); }} className="text-emerald-400 hover:text-emerald-600">
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Кадастр */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1 uppercase tracking-wide">
              <MapPin size={11} /> Кадастр (частный дом)
            </label>
            {filteredCadastres.length > 0 && (
              <select
                className={inp + ' mb-2'}
                value={selectedCadastre?.id || ''}
                onChange={e => {
                  const c = filteredCadastres.find(x => x.id === e.target.value);
                  handleSelectCadastre(c);
                }}
              >
                <option value="">— Выбрать из списка или ввести вручную —</option>
                {filteredCadastres.map(c => (
                  <option key={c.id} value={c.id}>{c.name} — {c.address}</option>
                ))}
              </select>
            )}
            {!selectedCadastre && (
              <div className="space-y-2">
                <input className={inp} placeholder="Адрес (обязательно)" value={manualAddress} onChange={e => setManualAddress(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <input className={inp} placeholder="Название / кадастр №" value={manualName} onChange={e => setManualName(e.target.value)} />
                  <input className={inp} placeholder="Владелец" value={manualOwner} onChange={e => setManualOwner(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* Даты */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">Дата начала</label>
              <input className={inp} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">Количество дней</label>
              <input className={inp} type="number" min="1" value={days} onChange={e => handleDaysChange(e.target.value)} />
            </div>
          </div>
          {endDate && (
            <p className="text-sm text-teal-700 font-semibold bg-teal-50 px-3 py-2 rounded-lg">
              📅 Дата окончания: <b>{endDate}</b>
            </p>
          )}

          {/* Стоимость регистрации */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">Стоимость регистрации (сум){selectedCadastre?.dailyRate > 0 && !amountManual ? <span className="ml-1 text-teal-500 font-normal normal-case">(авто: {Number(selectedCadastre.dailyRate).toLocaleString()} × {days} дн.)</span> : null}</label>
            <input className={inp} type="number" placeholder="0" value={amount} onChange={e => { setAmountManual(true); setAmount(e.target.value); }} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={addToExpenses} onChange={e => setAddToExpenses(e.target.checked)}
              className="w-4 h-4 rounded accent-teal-600" />
            <span className="text-sm text-slate-700">Добавить стоимость регистрации в расходы</span>
          </label>

          {/* Ссылка на регистрацию */}
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1 uppercase tracking-wide">
              <Link size={11} /> Ссылка на регистрацию (для гостя)
            </label>
            <input
              className={inp}
              type="url"
              placeholder="https://..."
              value={regLink}
              onChange={e => setRegLink(e.target.value)}
            />
            <p className="text-[10px] text-slate-400 mt-1">Постоянная ссылка на документ — можно отправить гостю по запросу</p>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Отмена</button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Зарегистрировать
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
};

// ─── CadastreManageModal ──────────────────────────────────────────────────────

const CadastreManageModal = ({ cadastre, onClose, onSubmit, selectedHostelFilter }) => {
  const [name, setName] = useState(cadastre?.name || '');
  const [address, setAddress] = useState(cadastre?.address || '');
  const [owner, setOwner] = useState(cadastre?.owner || '');
  const [phone, setPhone] = useState(cadastre?.phone || '');
  const [dailyRate, setDailyRate] = useState(cadastre?.dailyRate || getConfig().registrationDailyRate || '');
  const [hostelId, setHostelId] = useState(cadastre?.hostelId || (selectedHostelFilter === 'all' ? 'hostel1' : selectedHostelFilter) || 'hostel1');

  const submit = () => {
    if (!address.trim()) return;
    onSubmit({ name, address, owner, phone, dailyRate: Number(dailyRate) || 0, hostelId });
    onClose();
  };

  return (
    <div className="modal-centered fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 pb-[84px] sm:pb-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center"><Building size={15} className="text-teal-600" /></div>
            <h3 className="font-black text-base text-slate-800">{cadastre ? 'Редактировать кадастр' : 'Добавить кадастр'}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Название / Кадастр №</label>
            <input className={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Дом Алишера, Кадастр №5..." />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Адрес *</label>
            <input className={inp} value={address} onChange={e => setAddress(e.target.value)} placeholder="Ташкент, ул. Навои, 12" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Владелец</label>
            <input className={inp} value={owner} onChange={e => setOwner(e.target.value)} placeholder="ФИО владельца" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Телефон владельца</label>
            <input className={inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+998..." />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Суточная ставка регистрации (сум)</label>
            <input className={inp} type="number" value={dailyRate} onChange={e => setDailyRate(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Хостел</label>
            <select className={inp} value={hostelId} onChange={e => setHostelId(e.target.value)}>
              {Object.entries(HOSTELS).map(([k, v]) => (
                <option key={k} value={k}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Отмена</button>
          <button onClick={submit} disabled={!address.trim()}
            className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-40">
            {cadastre ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── RemoveConfirmModal ──────────────────────────────────────────────────────

const RemoveConfirmModal = ({ reg, onClose, onConfirm }) => {
  const [addToExpenses, setAddToExpenses] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasAmount = Number(reg.amount) > 0 && !reg.expenseAdded;

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    await onConfirm(reg, { addToExpenses: hasAmount && addToExpenses });
    onClose();
  };

  return (
    <div className="modal-centered fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pb-[84px] sm:pb-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="h-1.5 bg-amber-400 w-full" />
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <UserX size={20} className="text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Завершить регистрацию</h3>
              <p className="text-sm text-slate-500 mt-1">
                Регистрация <b>{reg.guestName}</b> будет завершена.
              </p>
            </div>
          </div>

          {hasAmount && (
            <label className="flex items-center gap-3 cursor-pointer bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
              <input type="checkbox" checked={addToExpenses} onChange={e => setAddToExpenses(e.target.checked)}
                className="w-4 h-4 rounded accent-violet-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-violet-800">Добавить сумму в расходы</p>
                <p className="text-xs text-violet-600">{fmt(reg.amount)} сум</p>
              </div>
            </label>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} disabled={busy}
              className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 disabled:opacity-40">
              Отмена
            </button>
            <button onClick={handleConfirm} disabled={busy}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 disabled:opacity-40 flex items-center justify-center gap-2">
              {busy
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <UserX size={14} />
              }
              Завершить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── RegCard ──────────────────────────────────────────────────────────────────

const RegCard = ({ reg, onExtend, onEdit, onRemove, onDelete, onAddToExpenses, isAdmin }) => {
  const [expanded, setExpanded] = useState(false);
  const [busyExpense, setBusyExpense] = useState(false);

  // Сколько уже в расходах (backward-compatible: старые записи без totalExpensed)
  const alreadyExpensed = reg.totalExpensed ?? (reg.expenseAdded ? (Number(reg.amount) || 0) : 0);
  const unexpensed = Math.max(0, (Number(reg.amount) || 0) - alreadyExpensed);

  const handleAddToExpenses = async () => {
    if (busyExpense) return;
    setBusyExpense(true);
    await onAddToExpenses(reg);
    setBusyExpense(false);
  };
  const status = getStatus(reg);
  const cfg = STATUS_CFG[status];
  const daysLeft = getDaysLeft(reg.endDate);
  const Icon = cfg.icon;

  return (
    <div className={`bg-white rounded-2xl border ${cfg.border} shadow-sm overflow-hidden transition-all hover:shadow-md`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center flex-shrink-0`}>
            <Icon size={18} className={cfg.text} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-slate-800 text-sm">{reg.guestName}</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                {cfg.label}
                {status === 'active'   && daysLeft > 0 && ` · ${daysLeft} дн.`}
                {status === 'expiring' && (
                  daysLeft === 0 ? ' · сегодня!' :
                  daysLeft === 1 ? ' · завтра' :
                  ` · ${daysLeft} дн.`
                )}
                {status === 'expired'  && (daysLeft === 0 ? ' · сегодня' : ` · ${Math.abs(daysLeft)} дн. назад`)}
              </span>
              {reg.expenseAdded && unexpensed <= 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                  📊 В расходах
                </span>
              )}
              {unexpensed > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  ⚠️ Не в расходах: {fmt(unexpensed)} сум
                </span>
              )}
            </div>
            <div className="mt-1.5 space-y-0.5">
              <p className="text-xs text-slate-600 flex items-center gap-1">
                <MapPin size={10} className="text-slate-400 flex-shrink-0" />
                {reg.cadastreAddress}
                {reg.cadastreName && reg.cadastreName !== reg.cadastreAddress && <span className="text-slate-400">· {reg.cadastreName}</span>}
              </p>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Calendar size={10} className="text-slate-400" />
                {reg.startDate} → {reg.endDate}
                <span className="text-slate-400">({reg.days} дн.)</span>
              </p>
              {reg.amount > 0 && (
                <p className="text-xs font-semibold text-teal-700 flex items-center gap-1">
                  <Receipt size={10} /> Стоимость рег.: {fmt(reg.amount)} сум
                </p>
              )}
            </div>
          </div>
          <button onClick={() => setExpanded(x => !x)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 flex-shrink-0">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
          {/* Доп. инфо */}
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            {reg.passport && <p>🪪 <b>{reg.passport}</b></p>}
            {reg.country  && <p>🌍 {reg.country}</p>}
            {reg.phone    && <p>📞 {reg.phone}</p>}
            {reg.cadastreOwner && <p>👤 Владелец: {reg.cadastreOwner}</p>}
          </div>
          {/* Ссылка на регистрацию */}
          {reg.regLink && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <Link size={12} className="text-teal-500 flex-shrink-0" />
              <a href={reg.regLink} target="_blank" rel="noopener noreferrer"
                className="text-xs text-teal-600 hover:underline truncate flex-1 font-medium">
                {reg.regLink}
              </a>
              <CopyButton text={reg.regLink} />
              <a href={reg.regLink} target="_blank" rel="noopener noreferrer"
                className="p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-700">
                <ExternalLink size={12} />
              </a>
            </div>
          )}
          {/* Кнопки */}
          <div className="flex flex-wrap gap-2">
            {status !== 'removed' && (
              <>
                <button onClick={() => onExtend(reg)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700">
                  <RefreshCw size={11} /> Продлить
                </button>
                <button onClick={() => onEdit(reg)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-600 text-white text-xs font-bold hover:bg-slate-700">
                  <Edit2 size={11} /> Изменить
                </button>
                <button onClick={() => onRemove(reg)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600">
                  <UserX size={11} /> Завершить
                </button>
              </>
            )}
            {unexpensed > 0 && (
              <button onClick={handleAddToExpenses} disabled={busyExpense}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50">
                {busyExpense
                  ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Receipt size={11} />
                }
                В расходы {fmt(unexpensed)} сум
              </button>
            )}
            {isAdmin && (
              <button onClick={() => onDelete(reg)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-bold hover:bg-rose-600">
                <Trash2 size={11} /> Удалить
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

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
