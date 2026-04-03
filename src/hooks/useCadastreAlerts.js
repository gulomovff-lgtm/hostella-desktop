/**
 * useCadastreAlerts — отправляет Telegram-уведомления об истекающих кадастр-регистрациях.
 * Срабатывает раз в день на регистрацию (трекинг в localStorage).
 * Контролируется через настройки Telegram: тип 'cadastreExpiring'.
 */
import { useEffect, useRef } from 'react';
import { sendTelegramMessage } from '../utils/telegram';

// Сколько дней до окончания считается «истекает»
const ALERT_DAYS = 3;

export function useCadastreAlerts({ cadastreRegs, tgSettings, isOnline }) {
  const firedRef = useRef(new Set());

  useEffect(() => {
    if (!cadastreRegs?.length || !isOnline) return;

    // Проверяем, не отключён ли тип уведомлений
    const disabledTypes = new Set(tgSettings?.disabledTypes || []);
    if (disabledTypes.has('cadastreExpiring')) return;

    const today = new Date().toISOString().slice(0, 10);

    const expiring = cadastreRegs.filter(r => {
      if (r.status === 'removed') return false;
      const daysLeft = Math.ceil((new Date(r.endDate + 'T23:59:59') - Date.now()) / 86400000);
      return daysLeft >= 0 && daysLeft <= ALERT_DAYS;
    });

    for (const reg of expiring) {
      const lsKey = `cad_alert_${reg.id}_${today}`;
      if (firedRef.current.has(lsKey)) continue;
      if (localStorage.getItem(lsKey)) continue;

      const daysLeft = Math.ceil((new Date(reg.endDate + 'T23:59:59') - Date.now()) / 86400000);
      const msg = [
        `⚠️ <b>Кадастр-регистрация истекает</b>`,
        `👤 ${reg.guestName}`,
        `🪪 ${reg.passport || '—'}`,
        `📍 ${reg.cadastreAddress}`,
        `📅 Окончание: <b>${reg.endDate}</b>`,
        `⏰ Осталось: <b>${daysLeft} дн.</b>`,
      ].join('\n');

      sendTelegramMessage(msg, 'cadastreExpiring');
      firedRef.current.add(lsKey);
      localStorage.setItem(lsKey, '1');
    }
  }, [cadastreRegs, tgSettings, isOnline]);
}
