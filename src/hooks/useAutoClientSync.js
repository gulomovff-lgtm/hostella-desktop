import { useEffect, useRef } from 'react';

/**
 * useAutoClientSync — плановое пополнение базы клиентов из карточек гостей.
 *
 * Каждый филиал включает синхронизацию сам (hostelConfig[hostelId].autoSync) и
 * задаёт частоту: daily / weekly / monthly. Дата последнего прогона хранится в
 * localStorage на устройстве, а не в базе: задача идемпотентна, и гонять её с
 * каждой кассы отдельно безвредно.
 *
 * Данные гостей читаются через ref — иначе таймер пересоздавался бы при каждом
 * изменении Firestore, и синхронизация не наступала бы никогда.
 *
 * @param {object[]} guests — все гости
 * @param {object}   hostelConfig — настройки филиалов
 * @param {boolean}  isDataReady — данные загружены
 * @param {function} onSync — что делать с отобранными гостями (handleSyncClientsFromGuests)
 */
const FREQ_MS = {
  daily:   24 * 60 * 60 * 1000,
  weekly:  7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

const FIRST_CHECK_MS = 5 * 60 * 1000;   // даём данным устояться после запуска
const RECHECK_MS     = 60 * 60 * 1000;  // дальше проверяем раз в час

export function useAutoClientSync({ guests, hostelConfig, isDataReady, onSync }) {
  const guestsRef = useRef(guests);
  useEffect(() => { guestsRef.current = guests; }, [guests]);

  const onSyncRef = useRef(onSync);
  useEffect(() => { onSyncRef.current = onSync; }, [onSync]);

  useEffect(() => {
    if (!isDataReady || !hostelConfig) return;

    const checkAndSync = () => {
      ['hostel1', 'hostel2'].forEach(hostelKey => {
        const cfg = hostelConfig?.[hostelKey]?.autoSync;
        if (!cfg?.enabled) return;
        const freq = FREQ_MS[cfg.frequency] || FREQ_MS.daily;
        const lastSync = parseInt(localStorage.getItem(`autoSync_${hostelKey}`) || '0');
        if (Date.now() - lastSync < freq) return;
        // Гости без филиала считаются первым хостелом — как и везде в приложении
        const hostelGuests = guestsRef.current.filter(g => (g.hostelId || 'hostel1') === hostelKey);
        if (!hostelGuests.length) return;
        localStorage.setItem(`autoSync_${hostelKey}`, Date.now().toString());
        onSyncRef.current?.(hostelGuests);
      });
    };

    const initial  = setTimeout(checkAndSync, FIRST_CHECK_MS);
    const interval = setInterval(checkAndSync, RECHECK_MS);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [hostelConfig, isDataReady]);
}
