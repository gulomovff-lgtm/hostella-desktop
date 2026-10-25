import { useEffect, useState } from 'react';
import { disableNetwork, enableNetwork } from 'firebase/firestore';
import { db } from '../firebase';
import { pendingWrites, onPendingChange } from '../utils/fsWrite';

const SHOW_AFTER_MS = 30 * 1000;   // полоска кассиру
const KICK_AFTER_MS = 45 * 1000;   // переподключение базы
const KICK_EVERY_MS = 2 * 60 * 1000;

/**
 * Сторож связи с базой. Записи кассы применяются локально сразу (fsWrite),
 * а сервер подтверждает их позже. Если подтверждения нет дольше 45 с при
 * живом интернете — поток Firestore залип (так было у кассира 25.10.2026:
 * расход часами не доходил до отчётов). Переподключаем базу — Firestore
 * досылает накопленное сам — не чаще раза в 2 минуты.
 *
 * @returns {number} сколько записей ждут сервер дольше 30 с (0 — всё дошло)
 */
export function useSyncWatchdog() {
  const [stuck, setStuck] = useState(0);
  useEffect(() => {
    let lastKick = 0;
    let kicking = false;
    const tick = async () => {
      const { count, oldestAt } = pendingWrites();
      const age = count ? Date.now() - oldestAt : 0;
      setStuck(age > SHOW_AFTER_MS ? count : 0);
      const online = typeof navigator === 'undefined' || navigator.onLine !== false;
      if (age > KICK_AFTER_MS && online && !kicking && Date.now() - lastKick > KICK_EVERY_MS) {
        kicking = true;
        lastKick = Date.now();
        console.warn(`[sync] ${count} записей ждут сервер ${Math.round(age / 1000)} с — переподключаю базу`);
        try { await disableNetwork(db); } catch (_) { /* уже отключена */ }
        try { await enableNetwork(db); } catch (e) { console.error('[sync] enableNetwork', e); }
        kicking = false;
      }
    };
    const iv = setInterval(tick, 10 * 1000);
    const off = onPendingChange(tick);
    window.addEventListener('online', tick);
    return () => { clearInterval(iv); off(); window.removeEventListener('online', tick); };
  }, []);
  return stuck;
}
