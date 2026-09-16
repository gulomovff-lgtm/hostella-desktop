import { useEffect, useState } from 'react';
import { loadFromElectron, getQueue, clearQueue, isFreshTelegram } from '../utils/offlineQueue';
import { closeSession } from '../utils/session';
import { sendTelegramMessage } from '../utils/telegram';

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

  // Появилась сеть — досылаем накопленное
  useEffect(() => {
    if (!isOnline || !queueLoaded) return;
    const q = getQueue();
    if (!q.length) return;

    const telegramEntries = q.filter(e => e._type === 'telegram' && isFreshTelegram(e));
    const staleCount      = q.filter(e => e._type === 'telegram' && !isFreshTelegram(e)).length;
    telegramEntries.forEach(e => { sendTelegramMessage(e.text, e.notifType).catch(() => {}); });
    if (staleCount > 0) console.info(`[offlineQueue] отброшено устаревших уведомлений: ${staleCount}`);

    const paymentCount = q.filter(e => e._type !== 'telegram').length;
    const parts = [];
    if (paymentCount > 0) parts.push(`${paymentCount} оплат`);
    if (telegramEntries.length > 0) parts.push(`${telegramEntries.length} уведомлений`);
    if (parts.length > 0) showNotification?.(`📶 Синхронизировано: ${parts.join(', ')}`, 'success');

    clearQueue();
  }, [isOnline, queueLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
}
