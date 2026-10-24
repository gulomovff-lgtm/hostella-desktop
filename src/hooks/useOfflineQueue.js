import { useEffect, useState } from 'react';
import { loadFromElectron, getQueue, dequeuePayment, isFreshTelegram, delayedTelegramText } from '../utils/offlineQueue';
import { closeSession } from '../utils/session';
import { sendTelegramMessage, isNetworkFailure } from '../utils/telegram';

/**
 * useOfflineQueue — отложенные операции, накопленные без сети.
 *
 * Платежи и расходы Firestore досылает сам (persistentLocalCache), а вот
 * Telegram-уведомления идут через Cloud Functions и офлайн не уходят — их мы
 * складываем в очередь и отправляем при восстановлении связи.
 *
 * Два правила, каждое из которых написано кровью:
 *  1. Флаш ждёт загрузки файла Electron (queueLoaded). Иначе очередь чистится
 *     «вхолостую» раньше, чем файл догрузится, записи оседают в localStorage
 *     и уходят при следующем восстановлении сети — через недели.
 *  2. Уведомления старше 12 часов (isFreshTelegram) выбрасываются молча:
 *     «Новое заселение» через неделю после события дезинформирует.
 *
 * @param {boolean}  isOnline — есть ли связь с Firestore
 * @param {function} showNotification — тост для кассира
 */
export function useOfflineQueue({ isOnline, showNotification }) {
  const [queueLoaded, setQueueLoaded] = useState(false);

  // Старт: подтягиваем файл Electron; выход: сохраняем очередь и закрываем сессию
  useEffect(() => {
    loadFromElectron().finally(() => setQueueLoaded(true));
    const handleBeforeUnload = () => {
      const q = getQueue();
      if (q.length > 0 && window.electronAPI?.savePendingPayments) {
        window.electronAPI.savePendingPayments(q);
      }
      closeSession();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Появилась сеть — досылаем накопленное. Запись уходит из очереди только
  // после удачной отправки: раньше очередь чистилась сразу, и уведомление,
  // отправленное в ещё неустойчивую сеть, терялось. Пока очередь не пуста и
  // связь есть — пробуем снова раз в 2 минуты.
  useEffect(() => {
    if (!isOnline || !queueLoaded) return undefined;
    let cancelled = false;
    let busy = false;
    const flush = async () => {
      if (busy || cancelled) return;
      busy = true;
      try {
        const q = getQueue();
        if (!q.length) return;
        let sentTg = 0, dropped = 0;
        const payments = q.filter(e => e._type !== 'telegram');
        // Оплаты в очереди — только отметка для кассира: сами записи Firestore
        // досылает из своей локальной базы (utils/fsWrite.js).
        payments.forEach(e => dequeuePayment(e._id));
        for (const e of q.filter(x => x._type === 'telegram')) {
          if (cancelled) return;
          if (!isFreshTelegram(e)) { dequeuePayment(e._id); dropped++; continue; }
          try {
            await sendTelegramMessage(delayedTelegramText(e), e.notifType, null, true);
            dequeuePayment(e._id);
            sentTg++;
          } catch (err) {
            if (isNetworkFailure(err)) break;       // сеть снова пропала — дошлём позже
            console.warn('[offlineQueue] уведомление отклонено сервером:', err?.message);
            dequeuePayment(e._id);                  // отказ по существу — повтор не поможет
          }
        }
        if (dropped > 0) console.info(`[offlineQueue] отброшено устаревших уведомлений: ${dropped}`);
        const parts = [];
        if (payments.length > 0) parts.push(`${payments.length} оплат`);
        if (sentTg > 0) parts.push(`${sentTg} уведомлений`);
        if (parts.length > 0) showNotification?.(`📶 Синхронизировано: ${parts.join(', ')}`, 'success');
      } finally {
        busy = false;
      }
    };
    flush();
    const iv = setInterval(flush, 2 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [isOnline, queueLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
}
