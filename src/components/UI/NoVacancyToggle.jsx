import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, deleteField } from 'firebase/firestore';
import { BedDouble } from 'lucide-react';
import { db, PUBLIC_DATA_PATH } from '../../firebase';
import { isNoVacancy, noVacancyEntry } from '../../utils/noVacancy';

const ref = () => doc(db, ...PUBLIC_DATA_PATH, 'settings', 'noVacancy');
const SHORT = { hostel1: '№1', hostel2: '№2' };

/**
 * «Мест нет» по филиалу — для сайта и бота (utils/noVacancy.js). Кассир включает,
 * когда филиал заполнен; утром в 9:00 отметка снимается сама.
 */
const NoVacancyToggle = ({ hostelIds, currentUser, t }) => {
  const [data, setData] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => onSnapshot(ref(), (s) => setData(s.exists() ? s.data() : {}),
    (e) => console.warn('[noVacancy]', e.message)), []);
  // Раз в минуту: в 9:00 кнопка гаснет сама, без новой записи в базу
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(id); }, []);

  const toggle = async (h) => {
    setBusy(h); setError('');
    try {
      await setDoc(ref(), { [h]: isNoVacancy(data[h], Date.now()) ? deleteField() : noVacancyEntry(currentUser) }, { merge: true });
    } catch (e) {
      console.warn('[noVacancy]', e.message);
      setError(t('nvError'));
    } finally { setBusy(''); }
  };

  // Кассир — только свой филиал (владелец 2026-11-07; то же в правиле базы)
  const own = currentUser?.role === 'cashier'
    ? new Set([currentUser.hostelId, ...(currentUser.allowedHostels || [])].filter(Boolean))
    : null;
  const ids = hostelIds.filter((h) => SHORT[h] && (!own || own.has(h)));
  if (!ids.length) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {ids.map((h) => {
        const on = isNoVacancy(data[h], now);
        const label = ids.length > 1 ? `${SHORT[h]}: ` : '';
        return (
          <button key={h} onClick={() => toggle(h)} disabled={busy === h}
            title={on ? t('nvOnHint').replace('{name}', data[h]?.byName || '—') : t('nvOffHint')}
            className={`flex items-center gap-1 text-[11px] font-bold rounded-full px-2.5 py-1 border transition-colors disabled:opacity-60 ${on
              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'}`}>
            <BedDouble size={11} />
            {on ? <>{label}{t('nvOn')} · <span className="underline">{t('nvRemove')}</span></> : <>{label}{t('nvOff')}</>}
          </button>
        );
      })}
      {error && <span className="text-[11px] font-semibold text-rose-600">{error}</span>}
    </div>
  );
};

export default NoVacancyToggle;
