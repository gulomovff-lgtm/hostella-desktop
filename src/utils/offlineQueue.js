/**
 * offlineQueue.js
 * Очередь платежей для работы в оффлайн-режиме.
 * Хранит записи в localStorage. При восстановлении интернета —
 * флашится в Firestore через колбэк синхронизации.
 * В Electron также сохраняется в файл через IPC при закрытии приложения.
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

/** Добавить платёж в очередь */
export const enqueuePayment = (item) => {
  const queue = getQueue();
  const entry = {
    ...item,
    _id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    _queuedAt: new Date().toISOString(),
  };
  queue.push(entry);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  // Также сохранить в Electron-файл, если доступно
  persistToElectron(queue);
  return entry._id;
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
