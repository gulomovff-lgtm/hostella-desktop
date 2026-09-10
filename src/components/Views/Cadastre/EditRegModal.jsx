import React, { useState } from 'react';
import { Edit2, X } from 'lucide-react';
import { calcEndDate, inp } from './shared';
import TRANSLATIONS from '../../../constants/translations';

const EditRegModal = ({ reg, onClose, onSubmit, lang = 'ru' }) => {
  const t = k => TRANSLATIONS[lang]?.[k] || k;
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
            <h3 className="font-black text-base text-slate-800">{t('cdmEditRegTitle')}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
        </div>
        <div className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
          📍 {reg.cadastreAddress}
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('guest')}</label>
            <input className={inp} value={guestName} onChange={e => setGuestName(e.target.value)} placeholder={t('cdmGuestNamePlaceholder')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('cadmStartDate')}</label>
              <input className={inp} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('cadmDaysCount')}</label>
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
              📅 {t('cadmEndDate')}: <b>{endDate}</b>
            </p>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('cdmDailyPrice')}</label>
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
            <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('cadmRegCost')}</label>
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
            <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('cdmRegLinkPlain')}</label>
            <input className={inp} type="url" placeholder="https://..." value={regLink} onChange={e => setRegLink(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">{t('cancel')}</button>
          <button onClick={submit} disabled={!guestName.trim() || !startDate || parseInt(days) <= 0}
            className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-40">
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── ExtendModal ──────────────────────────────────────────────────────────────

// ─── CopyButton ───────────────────────────────────────────────────────────────

export default EditRegModal;
