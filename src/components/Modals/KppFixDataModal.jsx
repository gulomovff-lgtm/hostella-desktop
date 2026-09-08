import React, { useState } from 'react';
import { X, RefreshCw, SkipForward } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import { COUNTRIES } from '../../constants/countries';

const inputCls = 'w-full p-3 border-2 border-slate-200 rounded-xl font-bold bg-white text-slate-800 text-sm';
const labelCls = 'text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block';

/**
 * «Госбаза гостя не нашла». Появляется, когда e-mehmon на первом шаге мастера
 * ответил «topilmadi»: паспорт или дата рождения записаны с ошибкой. Как и
 * окно брони, закрывается только кнопкой — кассир должен решить: исправить
 * и проверить снова, отложить, или оформлять без регистрации.
 */
const KppFixDataModal = ({ guest, notFoundText = '', lang = 'ru', onSave, onRetry, onLater, onSkip }) => {
    const t = k => TRANSLATIONS[lang]?.[k] || k;
    const toDateInput = (v) => (v ? String(v).slice(0, 10) : '');
    const [form, setForm] = useState({
        fullName: guest?.fullName || '',
        passport: guest?.passport || '',
        birthDate: toDateInput(guest?.birthDate),
        passportIssueDate: toDateInput(guest?.passportIssueDate),
        country: guest?.country || '',
    });
    const [busy, setBusy] = useState(false);
    if (!guest) return null;
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const saveAndRetry = async () => {
        if (busy) return;
        setBusy(true);
        try {
            const updates = {
                fullName: (form.fullName || '').toUpperCase().trim(),
                passport: (form.passport || '').replace(/\s/g, '').toUpperCase(),
                birthDate: form.birthDate || '',
                passportIssueDate: form.passportIssueDate || '',
                country: form.country || guest.country || '',
            };
            await onSave?.(guest.id, updates);
            await onRetry?.({ ...guest, ...updates, emehmonRegError: undefined });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[350] flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '92vh' }}>
                <div className="shrink-0 px-6 py-5 flex items-center gap-4" style={{ background: 'linear-gradient(135deg,#7f1d1d,#e11d48)' }}>
                    <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-3xl shrink-0">🪪</div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-black text-white leading-tight">{t('kppFixTitle')}</h2>
                        <p className="text-sm text-rose-100/85 mt-0.5">{t('kppFixSubtitle')}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50">
                    <div className="text-base font-black text-slate-800">{guest.fullName}</div>
                    {notFoundText && (
                        <div className="text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2">
                            <span className="font-bold text-slate-400 uppercase text-[10px]">{t('kppFixPortalSaid')}: </span>{notFoundText}
                        </div>
                    )}
                    <div>
                        <label className={labelCls}>{t('fullNameLabel')}</label>
                        <input className={inputCls} value={form.fullName} onChange={e => set('fullName', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>{t('passport')}</label>
                            <input className={inputCls} value={form.passport} onChange={e => set('passport', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelCls}>{t('birthDateShort')}</label>
                            <input type="date" className={inputCls} value={form.birthDate} onChange={e => set('birthDate', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelCls}>{t('issuedLabel')}</label>
                            <input type="date" className={inputCls} value={form.passportIssueDate} onChange={e => set('passportIssueDate', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelCls}>{t('country')}</label>
                            <select className={inputCls} value={form.country} onChange={e => set('country', e.target.value)}>
                                {!COUNTRIES.includes(form.country) && form.country && <option value={form.country}>{form.country}</option>}
                                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="shrink-0 px-5 py-4 bg-white border-t border-slate-200 flex flex-col gap-2">
                    <button onClick={saveAndRetry} disabled={busy}
                        className="w-full py-3 rounded-xl text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg,#0f9688,#0d7a6e)' }}>
                        <RefreshCw size={15} className={busy ? 'animate-spin' : ''} /> {t('kppFixSaveRetry')}
                    </button>
                    <div className="flex gap-2">
                        <button onClick={onLater} disabled={busy}
                            className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 flex items-center justify-center gap-2">
                            <X size={14} /> {t('kppFixLater')}
                        </button>
                        <button onClick={() => onSkip?.(guest)} disabled={busy}
                            className="flex-1 py-2.5 rounded-xl border-2 border-rose-200 text-rose-600 font-bold text-sm hover:bg-rose-50 flex items-center justify-center gap-2">
                            <SkipForward size={14} /> {t('kppFixSkip')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KppFixDataModal;
