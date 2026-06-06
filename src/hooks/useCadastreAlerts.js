/**
 * useCadastreAlerts — отправляет Telegram-уведомления об истекающих кадастр-регистрациях.
 * Один сводный message в день на все истекающие регистрации.
 * Атомарный Firestore-трекинг через alertsLog — не дублируется с нескольких устройств.
 */
import { useEffect, useRef } from 'react';
import { sendTelegramMessage } from '../utils/telegram';
import { checkAndMarkAlert, maybeCleanupAlerts } from '../utils/alertsLog';

const ALERT_DAYS = 3;

/** Локальная дата YYYY-MM-DD */
const getLocalDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

/** Разница в днях (endDate минус сегодня).
 *  Регистрация 6–16 → последний день 16-е → daysLeft=0 когда сегодня 16-е */
const getDaysLeft = (endDate) => {
  const todayStr = getLocalDateStr();
  const endMs   = new Date(endDate   + 'T12:00:00').getTime();
  const todayMs = new Date(todayStr  + 'T12:00:00').getTime();
  return Math.round((endMs - todayMs) / 86400000);
};

/** 'YYYY-MM-DD' → 'DD.MM.YYYY' */
const fmtDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};

export function useCadastreAlerts({ cadastreRegs, clients, tgSettings, isOnline }) {
  const cleanupDoneRef = useRef(false);

  useEffect(() => {
    if (!isOnline) return;

    if (!cleanupDoneRef.current) {
      cleanupDoneRef.current = true;
      maybeCleanupAlerts();
    }

    if (!cadastreRegs?.length) return;

    const disabledTypes = new Set(tgSettings?.disabledTypes || []);
    if (disabledTypes.has('cadastreExpiring')) return;

    const today = getLocalDateStr();

    const expiring = cadastreRegs.filter(r => {
      if (r.status === 'removed') return false;
      const d = getDaysLeft(r.endDate);
      return d >= 0 && d <= ALERT_DAYS;
    });

    if (expiring.length === 0) return;

    // Один сводный ключ на день — сообщение отправится ровно один раз
    const summaryKey = `cad_summary_${today}`;
    checkAndMarkAlert(summaryKey).then(shouldFire => {
      if (!shouldFire) return;

      // Группируем по daysLeft: 0=сегодня, 1=завтра, 2-3=через N дней
      const groups = { 0: [], 1: [], 2: [], 3: [] };
      for (const reg of expiring) {
        const d = getDaysLeft(reg.endDate);
        if (d >= 0 && d <= ALERT_DAYS) groups[d].push(reg);
      }

      const lines = ['⚠️ <b>Кадастр-регистрации истекают</b>'];

      // ── Раздел 1: сводка — кто и когда ──
      for (let d = 0; d <= ALERT_DAYS; d++) {
        for (const reg of groups[d]) {
          let label;
          if      (d === 0) label = `🔴 <b>Сегодня последний день</b> (${fmtDate(reg.endDate)})`;
          else if (d === 1) label = `🟠 <b>Завтра последний день</b> (${fmtDate(reg.endDate)})`;
          else              label = `🟡 Осталось ${d} дн. (до ${fmtDate(reg.endDate)})`;
          lines.push('');
          lines.push(label);
          lines.push(`👤 ${reg.guestName}`);
          lines.push(`📍 ${reg.cadastreAddress}`);
        }
      }

      // ── Раздел 2: данные для продления — только сегодняшние ──
      if (groups[0].length > 0) {
        lines.push('');
        lines.push('━━━━━━━━━━━━━━━━━━━━');
        lines.push('📋 <b>Данные для продления:</b>');

        for (const reg of groups[0]) {
          const client = reg.guestId ? (clients || []).find(c => c.id === reg.guestId) : null;
          const pid  = reg.passportIssueDate || client?.passportIssueDate || '';
          const bdt  = reg.birthDate         || client?.birthDate         || '';
          const ctry = reg.country           || client?.country           || '';

          lines.push('');
          lines.push(`<code>${reg.guestName}</code>`);
          if (bdt)          lines.push(`Дата рожд.: <code>${fmtDate(bdt)}</code>`);
          if (reg.passport) lines.push(`Паспорт: <code>${reg.passport}</code>`);
          if (pid)          lines.push(`Выдан: <code>${fmtDate(pid)}</code>`);
          if (ctry)         lines.push(`Страна: <code>${ctry}</code>`);
        }
      }

      sendTelegramMessage(lines.join('\n'), 'cadastreExpiring');
    });
  }, [cadastreRegs, clients, tgSettings, isOnline]);
}
