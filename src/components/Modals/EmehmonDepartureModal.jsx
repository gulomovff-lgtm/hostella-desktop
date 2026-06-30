import React, { useState } from 'react';
import { X, Plane, Printer } from 'lucide-react';

// Подтверждение перед фоновым выселением из e-mehmon. Только собирает параметры
// (TO‘LOV / тип оплаты / печать) и сразу закрывается — само выселение идёт в фоне
// на уровне App (onConfirm), чтобы окно не висело с лоадером.
const PAY_TYPES = [
  { value: '1', label: 'Boshqa (другое)' },
  { value: '2', label: 'Naqd pul (наличные)' },
  { value: '3', label: 'Humo' },
  { value: '4', label: 'Uzcard' },
  { value: '5', label: 'O‘tkazma (перевод)' },
  { value: '6', label: 'Shartnoma (договор)' },
];

const EmehmonDepartureModal = ({ guests = [], onClose, onConfirm }) => {
  const list = Array.isArray(guests) ? guests : [guests];
  const bulk = list.length > 1;
  const guest = list[0] || {};
  const [amount, setAmount] = useState('1');
  const [payType, setPayType] = useState('1');
  const [print, setPrint] = useState(false);
  const busy = false;

  const submit = () => { onConfirm?.({ amount, payType, print }); };

  const inp = 'w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500';

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 font-black text-slate-800">
            <Plane size={18} className="text-rose-600" /> {bulk ? `Выселение из e-mehmon (${list.length})` : 'Выселение из e-mehmon'}
          </div>
          <button onClick={onClose} disabled={busy} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 disabled:opacity-40"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {bulk ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm max-h-40 overflow-y-auto space-y-1">
              {list.map((g, i) => (
                <div key={g.id || g.passport || i} className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 truncate">{g.fullName}</span>
                  <span className="text-xs text-slate-400 shrink-0">{g.roomNumber ? `ком. ${g.roomNumber}` : ''}{g.passport ? ` · ${g.passport}` : ''}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm">
              <div className="font-bold text-slate-800">{guest?.fullName}</div>
              <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                {guest?.roomNumber && <span>ком. {guest.roomNumber}</span>}
                {guest?.passport && <span>{guest.passport}</span>}
                {guest?.country && <span>{guest.country}</span>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wide">TO‘LOV (сумма)</label>
              <input className={inp} value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wide">Тип оплаты</label>
              <select className={inp} value={payType} onChange={e => setPayType(e.target.value)}>
                {PAY_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4 rounded accent-rose-600" checked={print} onChange={e => setPrint(e.target.checked)} />
            <Printer size={15} className="text-slate-400" /> Распечатать лист убытия
          </label>
          <p className="text-xs text-slate-400 -mt-2">
            {print
              ? 'Окно e-mehmon откроется с диалогом печати листа.'
              : 'Выселение пройдёт в фоне без печати и без окна.'}
          </p>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} disabled={busy} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 disabled:opacity-50">Отмена</button>
          <button onClick={submit} disabled={busy}
            className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2">
            <Plane size={16} /> {busy ? 'Выселяю…' : 'Выселить в фоне'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmehmonDepartureModal;
