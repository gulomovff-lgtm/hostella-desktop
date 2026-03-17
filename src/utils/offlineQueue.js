/**
 * offlineQueue.js
 * Очередь платежей и отложенных уведомлений для работы в оффлайн-режиме.
 * Хранит записи в localStorage. При восстановлении интернета —
 * флашится в Firestore через колбэк синхронизации.
 * В Electron также сохраняется в файл через IPC при закрытии приложения.
 *
 * Типы записей в очереди (_type):
 *  - undefined   → обычный платёж (legacy, совместимость)
 *  - 'telegram'  → отложенное Telegram-уведомление (Cloud Function)
 */

const QUEUE_KEY = 'hostella_offline_payment_queue';

/** Получить очередь из localStorage */
export const getQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
};

/** Добавить произвольную запись в очередь */
export const enqueuePayment = (item) => {
  const queue = getQueue();
  const entry = {
    ...item,
    _id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    _queuedAt: new Date().toISOString(),
  };
  queue.push(entry);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  persistToElectron(queue);
  return entry._id;
};

/**
 * Поставить Telegram-уведомление в очередь для отправки при восстановлении сети.
 * Fix 15: дедупликация — не добавляем, если такое же сообщение уже есть в очереди
 * @param {string} text - HTML-текст сообщения
 * @param {string} [notifType] - тип уведомления ('refund', 'checkout', ...)
 */
export const enqueueTelegram = (text, notifType) => {
  const existing = getQueue();
  const isDup = existing.some(e => e._type === 'telegram' && e.text === text && e.notifType === notifType);
  if (isDup) return null;
  return enqueuePayment({ _type: 'telegram', text, notifType });
};

/** Удалить один элемент из очереди по _id */
export const dequeuePayment = (id) => {
  const queue = getQueue().filter(i => i._id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  persistToElectron(queue);
};

/** Очистить всю очередь */
export const clearQueue = () => {
  localStorage.removeItem(QUEUE_KEY);
  persistToElectron([]);
};

/** Количество элементов в очереди */
export const queueLength = () => getQueue().length;

/**
 * Загрузить очередь из Electron-файла (вызывается при старте приложения).
 * Если файл есть — мёрджит записи в localStorage (без дублей по _id).
 */
export const loadFromElectron = async () => {
  try {
    if (!window.electronAPI?.loadPendingPayments) return;
    const data = await window.electronAPI.loadPendingPayments();
    if (!data || !data.length) return;
    const existing = getQueue();
    const existingIds = new Set(existing.map(i => i._id));
    const merged = [...existing, ...data.filter(i => !existingIds.has(i._id))];
    localStorage.setItem(QUEUE_KEY, JSON.stringify(merged));
  } catch (e) {
    console.warn('offlineQueue: не удалось загрузить из Electron-файла', e);
  }
};

/** Сохранить очередь в Electron-файл */
const persistToElectron = (queue) => {
  try {
    if (window.electronAPI?.savePendingPayments) {
      window.electronAPI.savePendingPayments(queue);
    }
  } catch {
    // не Electron-среда, игнорируем
  }
};
