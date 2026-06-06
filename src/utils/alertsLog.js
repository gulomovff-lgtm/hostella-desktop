/**
 * alertsLog — глобальный журнал отправленных Telegram-уведомлений в Firestore.
 *
 * Решает проблему дублирования: если приложение открыто на нескольких устройствах
 * или в нескольких вкладках, уведомление всё равно отправляется ровно один раз.
 *
 * Документ: artifacts/hostella-multi-v4/public/data/settings/alertsLog
 * Структура: { "kpp_guestId_day9_2026-04-14": true, "cad_regId_2026-04-14": true, _lastCleanup: "2026-04-14" }
 *
 * Ключи всегда заканчиваются на дату YYYY-MM-DD — это позволяет автоматически
 * чистить их раз в 30 дней без риска повторных уведомлений (условия срабатывания
 * по дням и статусу гостя уже не совпадут со старыми ключами).
 */

import { doc, runTransaction, getDoc, updateDoc, setDoc, deleteField } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';

const getRef = () => doc(db, ...PUBLIC_DATA_PATH, 'settings', 'alertsLog');

/**
 * Атомарно проверяет и устанавливает ключ в alertsLog.
 * Возвращает true — уведомление нужно отправить (ключа не было).
 * Возвращает false — уведомление уже отправлялось (ключ существует).
 * В случае ошибки сети возвращает false (не отправляем, чтобы не дублировать).
 */
export async function checkAndMarkAlert(key) {
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(getRef());
      const data = snap.exists() ? snap.data() : {};
      if (data[key]) return false;
      tx.set(getRef(), { [key]: true }, { merge: true });
      return true;
    });
  } catch (e) {
    console.warn('[alertsLog] checkAndMarkAlert error:', e.message);
    return false;
  }
}

/**
 * Раз в 30 дней удаляет ключи старше 30 дней.
 * Вызывается один раз за сессию из useCadastreAlerts.
 */
export async function maybeCleanupAlerts() {
  try {
    const ref = getRef();
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data = snap.data();
    const lastCleanup = data._lastCleanup || '1970-01-01';
    const daysSince = (Date.now() - new Date(lastCleanup).getTime()) / 86400000;
    if (daysSince < 30) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const updates = { _lastCleanup: new Date().toISOString().slice(0, 10) };
    let removedCount = 0;
    for (const key of Object.keys(data)) {
      if (key.startsWith('_')) continue;
      const m = key.match(/(\d{4}-\d{2}-\d{2})$/);
      if (m && m[1] < cutoffStr) {
        updates[key] = deleteField();
        removedCount++;
      }
    }

    if (removedCount > 0) {
      await updateDoc(ref, updates);
      console.info(`[alertsLog] cleanup: removed ${removedCount} old keys`);
    } else {
      // Обновляем только дату последней очистки
      await updateDoc(ref, { _lastCleanup: updates._lastCleanup });
    }
  } catch (e) {
    console.warn('[alertsLog] cleanup error:', e.message);
  }
}
