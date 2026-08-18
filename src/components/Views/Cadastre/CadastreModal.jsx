import React, { useCallback, useMemo, useState } from 'react';
import { Check, ChevronLeft, Home, Link, MapPin, Search, User, Users, X } from 'lucide-react';
import { Flag } from '../../../utils/helpers';
import { COUNTRY_FLAGS } from '../../../constants/countries';
import { calcEndDate, inp } from './shared';

const CadastreModal = ({ clients, cadastres, guests = [], rooms = [], cadastreRegs = [], currentUser, selectedHostelFilter, onClose, onSubmit }) => {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';
  // Fazliddin регистрирует по выбранному хостелу (а не только по своему hostel2)
  const defaultHostel = (currentUser.login === 'fazliddin' && selectedHostelFilter && selectedHostelFilter !== 'all')
    ? selectedHostelFilter
    : (!currentUser.hostelId || currentUser.hostelId === 'all')
      ? (selectedHostelFilter && selectedHostelFilter !== 'all' ? selectedHostelFilter : 'hostel1')
      : currentUser.hostelId;

  const [hostelId] = useState(defaultHostel);

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

export default CadastreModal;
