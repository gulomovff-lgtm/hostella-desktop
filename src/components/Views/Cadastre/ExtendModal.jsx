import React, { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { calcEndDate, inp } from './shared';
import TRANSLATIONS from '../../../constants/translations';

const ExtendModal = ({ reg, onClose, onSubmit, lang = 'ru' }) => {
  const t = k => TRANSLATIONS[lang]?.[k] || k;
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
            <h3 className="font-black text-base text-slate-800">{t('cdmExtendTitle')}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
        </div>
        <div className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 space-y-1">
          <p className="font-semibold text-slate-800">{reg.guestName}</p>
          <p className="text-xs">📍 {reg.cadastreAddress}</p>
          <p className="text-xs">{t('cdmCurrentEndDate')}: <b>{reg.endDate}</b></p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('cdmExtendStart')}</label>
            <input className={inp} type="date" value={startFrom} onChange={e => setStartFrom(e.target.value)} />
            {hasGap && (
              <p className="text-xs text-amber-600 mt-1 font-medium">
                ⚠️ {t('cdmGap').replace('{n}', gapDays).replace('{from}', reg.endDate).replace('{to}', startFrom)}
              </p>
            )}
            {startFrom && reg.endDate && startFrom < reg.endDate && (
              <p className="text-xs text-rose-500 mt-1 font-medium">
                ⚠️ {t('cdmDateBeforeEnd')}
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('cadmDaysCount')}</label>
            <input className={inp} type="number" min="1" value={days} onChange={e => handleDaysChange(e.target.value)} />
          </div>
          {newEndDate && (
            <p className="text-sm text-teal-700 font-semibold bg-teal-50 px-3 py-2 rounded-lg">
              📅 {t('cdmNewEndDate')}: <b>{newEndDate}</b>
            </p>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('cdmRegCostExpense')}</label>
            <input className={inp} type="number" placeholder={t('cdmZeroSum')} value={regCost} onChange={e => setRegCost(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={addToExpenses} onChange={e => setAddToExpenses(e.target.checked)}
              className="w-4 h-4 rounded accent-teal-600" />
            <span className="text-sm text-slate-700">{t('cdmAddCostToExpenses')}</span>
          </label>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">{t('cancel')}</button>
          <button onClick={submit} className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700">{t('cdmExtend')}</button>
        </div>
      </div>
    </div>
  );
};

// ─── CadastreModal (новая регистрация) ────────────────────────────────────────

export default ExtendModal;
