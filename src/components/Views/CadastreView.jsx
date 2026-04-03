import React, { useState, useMemo, useCallback } from 'react';
import {
  Home, Plus, Search, Trash2, RefreshCw, UserX, ChevronDown, ChevronUp,
  X, Calendar, MapPin, Building, AlertCircle, User,
  CheckCircle2, Receipt, AlertTriangle, Edit2, Check,
  Link, Copy, ExternalLink,
} from 'lucide-react';
import { HOSTELS } from '../../utils/helpers';

// ─── Status helpers ───────────────────────────────────────────────────────────

const getStatus = (reg) => {
  if (reg.status === 'removed') return 'removed';
  const daysLeft = Math.ceil((new Date(reg.endDate + 'T23:59:59') - Date.now()) / 86400000);
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 3) return 'expiring';
  return 'active';
};
const getDaysLeft = (endDate) =>
  Math.ceil((new Date(endDate + 'T23:59:59') - Date.now()) / 86400000);

const STATUS_CFG = {
  active:   { label: 'Активна',       icon: CheckCircle2,   bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  expiring: { label: 'Истекает',      icon: AlertTriangle,  bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500'   },
  expired:  { label: 'Истекла',       icon: AlertCircle,    bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    dot: 'bg-rose-500'    },
  removed:  { label: 'Снят',          icon: UserX,          bg: 'bg-slate-50',   text: 'text-slate-500',   border: 'border-slate-200',   dot: 'bg-slate-400'   },
};

const calcEndDate = (startDate, days) => {
  try {
    const d = new Date(startDate + 'T12:00:00');
    d.setDate(d.getDate() + parseInt(days || 0));
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  } catch { return ''; }
};

const fmt = (n) => Number(n || 0).toLocaleString();
const inp = 'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium';

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
  const [days, setDays] = useState('30');
  const [regCost, setRegCost] = useState('');
  const [addToExpenses, setAddToExpenses] = useState(false);

  const newEndDate = calcEndDate(reg.endDate, days);

  const submit = () => {
    if (!days || parseInt(days) <= 0) return;
    onSubmit({ days: parseInt(days), newEndDate, regCost, addToExpenses });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-base text-slate-800">🔄 Продление регистрации</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
        </div>
        <div className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 space-y-1">
          <p className="font-semibold text-slate-800">{reg.guestName}</p>
          <p className="text-xs">📍 {reg.cadastreAddress}</p>
          <p className="text-xs">Текущая дата окончания: <b>{reg.endDate}</b></p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Количество дней</label>
            <input className={inp} type="number" min="1" value={days} onChange={e => setDays(e.target.value)} />
          </div>
          {newEndDate && (
            <p className="text-sm text-indigo-700 font-semibold bg-indigo-50 px-3 py-2 rounded-lg">
              📅 Новая дата окончания: <b>{newEndDate}</b>
            </p>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Стоимость регистрации (расход)</label>
            <input className={inp} type="number" placeholder="0 сум" value={regCost} onChange={e => setRegCost(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={addToExpenses} onChange={e => setAddToExpenses(e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-600" />
            <span className="text-sm text-slate-700">Добавить стоимость в расходы</span>
          </label>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Отмена</button>
          <button onClick={submit} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700">Продлить</button>
        </div>
      </div>
    </div>
  );
};

// ─── CadastreModal (новая регистрация) ────────────────────────────────────────

const CadastreModal = ({ clients, cadastres, currentUser, selectedHostelFilter, onClose, onSubmit }) => {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';
  const defaultHostel = (!currentUser.hostelId || currentUser.hostelId === 'all')
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
  const [regLink, setRegLink] = useState('');
  const [addToExpenses, setAddToExpenses] = useState(false);

  const endDate = calcEndDate(startDate, days);

  // Фильтрация кадастров по хостелу
  const filteredCadastres = useMemo(() =>
    cadastres.filter(c => c.active !== false && (isAdmin || c.hostelId === hostelId)),
    [cadastres, hostelId, isAdmin]
  );

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

  const cadastreAddress = selectedCadastre ? selectedCadastre.address : manualAddress;
  const cadastreName    = selectedCadastre ? selectedCadastre.name    : manualName;
  const cadastreOwner   = selectedCadastre ? selectedCadastre.owner   : manualOwner;

  const canSubmit = selectedGuest && cadastreAddress && startDate && parseInt(days) > 0;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      guestId:         selectedGuest.id,
      guestName:       selectedGuest.fullName,
      passport:        selectedGuest.passport || '',
      birthDate:       selectedGuest.birthDate || '',
      country:         selectedGuest.country   || '',
      phone:           selectedGuest.phone     || '',
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Home size={16} className="text-indigo-600" />
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
            {guestResults.length > 0 && !selectedGuest && (
              <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden shadow-lg">
                {guestResults.map(g => (
                  <button key={g.id} onClick={() => selectGuest(g)}
                    className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 transition-colors border-b border-slate-100 last:border-0">
                    <p className="text-sm font-semibold text-slate-800">{g.fullName}</p>
                    <p className="text-xs text-slate-500">{g.passport} · {g.country} · {g.phone}</p>
                  </button>
                ))}
              </div>
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
                  setSelectedCadastre(c || null);
                  if (c) { setManualAddress(''); setManualName(''); setManualOwner(''); }
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
              <input className={inp} type="number" min="1" value={days} onChange={e => setDays(e.target.value)} />
            </div>
          </div>
          {endDate && (
            <p className="text-sm text-indigo-700 font-semibold bg-indigo-50 px-3 py-2 rounded-lg">
              📅 Дата окончания: <b>{endDate}</b>
            </p>
          )}

          {/* Стоимость регистрации */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">Стоимость регистрации (сум)</label>
            <input className={inp} type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={addToExpenses} onChange={e => setAddToExpenses(e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-600" />
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
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Зарегистрировать
          </button>
        </div>
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
  const [dailyRate, setDailyRate] = useState(cadastre?.dailyRate || '');
  const [hostelId, setHostelId] = useState(cadastre?.hostelId || (selectedHostelFilter === 'all' ? 'hostel1' : selectedHostelFilter) || 'hostel1');

  const submit = () => {
    if (!address.trim()) return;
    onSubmit({ name, address, owner, phone, dailyRate: Number(dailyRate) || 0, hostelId });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-base text-slate-800">
            {cadastre ? '✏️ Редактировать кадастр' : '🏠 Добавить кадастр'}
          </h3>
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
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-40">
            {cadastre ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── RegCard ──────────────────────────────────────────────────────────────────

const RegCard = ({ reg, onExtend, onRemove, onDelete, onAddToExpenses, isAdmin }) => {
  const [expanded, setExpanded] = useState(false);
  const status = getStatus(reg);
  const cfg = STATUS_CFG[status];
  const daysLeft = getDaysLeft(reg.endDate);
  const Icon = cfg.icon;

  return (
    <div className={`bg-white rounded-2xl border ${cfg.border} shadow-sm overflow-hidden`}>
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
                {status === 'active' && daysLeft > 0 && ` · ${daysLeft} дн.`}
                {status === 'expiring' && ` · ${daysLeft} дн.`}
                {status === 'expired' && ` · ${Math.abs(daysLeft)} дн. назад`}
              </span>
              {reg.expenseAdded && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                  📊 В расходах
                </span>
              )}
            </div>
            <div className="mt-1.5 space-y-0.5">
              <p className="text-xs text-slate-600 flex items-center gap-1">
                <MapPin size={10} className="text-slate-400 flex-shrink-0" />
                {reg.cadastreAddress}
                {reg.cadastreName && <span className="text-slate-400">· {reg.cadastreName}</span>}
              </p>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Calendar size={10} className="text-slate-400" />
                {reg.startDate} → {reg.endDate}
                <span className="text-slate-400">({reg.days} дн.)</span>
              </p>
              {reg.amount > 0 && (
                <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1">
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
              <Link size={12} className="text-indigo-500 flex-shrink-0" />
              <a href={reg.regLink} target="_blank" rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:underline truncate flex-1 font-medium">
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700">
                  <RefreshCw size={11} /> Продлить
                </button>
                {!reg.expenseAdded && reg.amount > 0 && (
                  <button onClick={() => onAddToExpenses(reg)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700">
                    <Receipt size={11} /> В расходы
                  </button>
                )}
                <button onClick={() => onRemove(reg)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600">
                  <UserX size={11} /> Снять
                </button>
              </>
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
  currentUser,
  selectedHostelFilter,
  onAddReg,
  onExtendReg,
  onRemoveReg,
  onDeleteReg,
  onAddToExpenses,
  onAddAllToExpenses,
  onAddCadastre,
  onUpdateCadastre,
  onDeleteCadastre,
}) {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';

  const [subTab, setSubTab] = useState('regs');
  const [search, setSearch] = useState('');
  // По умолчанию показываем активные + истекающие (обязательная фильтрация)
  const [statusFilter, setStatusFilter] = useState('active_expiring');
  const [showModal, setShowModal] = useState(false);
  const [extendReg, setExtendReg] = useState(null);
  const [cadastreModal, setCadastreModal] = useState(null); // null | 'add' | cadastre object to edit

  // ─── Hostel filtering (cashier sees own only) ───────────────────────
  const visibleRegs = useMemo(
    () => isAdmin ? cadastreRegs : cadastreRegs.filter(r => r.hostelId === currentUser.hostelId),
    [cadastreRegs, isAdmin, currentUser.hostelId]
  );
  const visibleCadastres = useMemo(
    () => isAdmin ? cadastres : cadastres.filter(c => c.hostelId === currentUser.hostelId),
    [cadastres, isAdmin, currentUser.hostelId]
  );

  // ─── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active   = visibleRegs.filter(r => getStatus(r) === 'active').length;
    const expiring = visibleRegs.filter(r => getStatus(r) === 'expiring').length;
    const expired  = visibleRegs.filter(r => getStatus(r) === 'expired').length;
    const totalCost = visibleRegs
      .filter(r => r.status !== 'removed')
      .reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const pendingExpense = visibleRegs
      .filter(r => r.status !== 'removed' && !r.expenseAdded && Number(r.amount) > 0)
      .reduce((s, r) => s + Number(r.amount), 0);
    return { active, expiring, expired, totalCost, pendingExpense };
  }, [visibleRegs]);

  // ─── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = visibleRegs;
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
      list = list.filter(r => ['active', 'expiring'].includes(getStatus(r)));
    } else if (statusFilter !== 'all') {
      list = list.filter(r => getStatus(r) === statusFilter);
    }
    return list;
  }, [cadastreRegs, search, statusFilter]);

  const hostelName = (id) => HOSTELS[id]?.name || id || '—';

  const handleAddAll = useCallback(() => {
    if (!window.confirm(
      `Добавить ${stats.pendingExpense.toLocaleString()} сум в расходы?\n` +
      `(все активные регистрации без учёта в расходах)`
    )) return;
    onAddAllToExpenses(visibleRegs);
  }, [visibleRegs, stats.pendingExpense, onAddAllToExpenses]);

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Home size={18} className="text-indigo-600" />
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
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 shadow-sm shadow-indigo-200"
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
          { label: 'Все расходы', value: fmt(stats.totalCost) + ' сум', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', filter: 'all' },
        ].map(s => (
          <button key={s.label} onClick={() => setStatusFilter(s.filter)}
            className={`${s.bg} border ${s.border} rounded-xl p-3 text-center hover:opacity-80 transition-opacity`}>
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
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${subTab === t.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                placeholder="Поиск по гостю, адресу..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-400 min-w-44"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="active_expiring">Активные + Истекают</option>
              <option value="active">Только активные</option>
              <option value="expiring">Только истекают</option>
              <option value="expired">Истекли</option>
              <option value="removed">Снятые</option>
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
                  onRemove={onRemoveReg}
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700"
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
                    className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-500">
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
      {showModal && (
        <CadastreModal
          clients={clients}
          cadastres={cadastres}
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
