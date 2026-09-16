import React, { useState, useEffect } from 'react';
import { X, KeyRound, Check, ShieldCheck } from 'lucide-react';
import { getEmehmonStatus, getEmehmonLogins, saveEmehmonAccounts } from '../../utils/emehmon';
import TRANSLATIONS from '../../constants/translations';

const HOSTELS = [
  { id: 'hostel1', n: 1 },
  { id: 'hostel2', n: 2 },
];

// Локальное (на машине) шифрованное хранение доступов e-mehmon.
// Пароли не уходят в Firebase и не хранятся в коде.
const EmehmonAccountsModal = ({ onClose, notify, lang = 'ru' }) => {
  const t = k => TRANSLATIONS[lang]?.[k] || k;
  const [form, setForm] = useState({
    hostel1: { login: '', password: '' },
    hostel2: { login: '', password: '' },
  });
  const [status, setStatus] = useState({ hostel1: false, hostel2: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getEmehmonStatus().then(setStatus).catch(() => {});
    // Подставляем сохранённые логины: чтобы сменить только пароль, логин
    // повторно вводить не нужно (раньше при пустом логине ничего не сохранялось).
    getEmehmonLogins().then(l => setForm(f => ({
      hostel1: { ...f.hostel1, login: l.hostel1 || '' },
      hostel2: { ...f.hostel2, login: l.hostel2 || '' },
    }))).catch(() => {});
  }, []);

  const upd = (hid, key, val) => setForm(f => ({ ...f, [hid]: { ...f[hid], [key]: val } }));

  const save = async () => {
    setSaving(true);
    try {
      await saveEmehmonAccounts(form);
      notify?.(t('emmAccountsSaved'), 'success');
      onClose();
    } catch (e) {
      notify?.(t('emmSaveFailed') + (e.message || ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500';

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 font-black text-slate-800">
            <KeyRound size={18} className="text-indigo-600" /> {t('emehmonAccess')}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <ShieldCheck size={15} className="text-amber-500 shrink-0 mt-0.5" />
            <span>{t('emmAccountsInfoPre')}<b>{t('emmAccountsInfoCloud')}</b>{t('emmAccountsInfoPost')}</span>
          </div>

          {HOSTELS.map(h => (
            <div key={h.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-500 uppercase tracking-wide">{t('emmHostel').replace('{n}', h.n)}</span>
                {status[h.id] && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-1">
                    <Check size={10} /> {t('emmSaved')}
                  </span>
                )}
              </div>
              <input className={inp} placeholder={t('emmLoginPlaceholder')}
                value={form[h.id].login} onChange={e => upd(h.id, 'login', e.target.value)} autoComplete="off" />
              <input className={inp} type="password" placeholder={status[h.id] ? t('emmPassKeep') : t('pass')}
                value={form[h.id].password} onChange={e => upd(h.id, 'password', e.target.value)} autoComplete="new-password" />
            </div>
          ))}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50">{t('cancel')}</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
            <Check size={16} /> {saving ? t('emmSaving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmehmonAccountsModal;
