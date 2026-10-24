/**
 * Запись в Firestore «сразу»: применить в локальной базе и НЕ ждать сервер.
 *
 * Обычные addDoc/updateDoc/setDoc/deleteDoc и batch.commit() возвращают
 * обещание, которое исполняется только когда СЕРВЕР подтвердит запись. Без
 * интернета оно висит до появления связи. Кассовый код писал так:
 *     const ref = await addDoc(guests…);   // без сети — ждём вечно
 *     await addDoc(payments…);             // …и запись оплаты не создаётся
 * Гость в программе уже «оплачен» (его запись в локальной базе есть), а записи
 * оплаты — того, из чего строятся отчёт и смена, — нет. Закрыли программу до
 * появления связи — хвоста операции не будет никогда.
 *
 * Здесь те же функции с теми же аргументами, но обещание исполняется сразу:
 * Firestore уже положил запись в локальную базу (её видят экраны и отчёты) и
 * в очередь отправки (сохраняется между запусками), а на сервер дошлёт сам.
 * Порядок записей одной кассы Firestore сохраняет. Отказ сервера (правила,
 * удалённый документ) приходит позже — его показываем кассиру через
 * setWriteErrorHandler; локальная правка при этом откатывается сама.
 *
 * Транзакции (runTransaction) сюда не относятся: без сети они не работают
 * вовсе и честно отвечают ошибкой.
 */
import {
  addDoc as fsAddDoc, setDoc as fsSetDoc, updateDoc as fsUpdateDoc, deleteDoc as fsDeleteDoc, doc,
} from 'firebase/firestore';

let onError = (e) => console.error('[fsWrite]', e);

/** Куда сообщать об отказе сервера (App ставит тост кассиру). */
export function setWriteErrorHandler(fn) {
  onError = typeof fn === 'function' ? fn : onError;
}

const background = (p) => { p.catch((e) => { try { onError(e); } catch (_) { /* не мешаем */ } }); };

/** addDoc без ожидания сервера: id документа известен сразу (doc() создаёт его локально). */
export function addDoc(colRef, data) {
  const ref = doc(colRef);
  background(fsSetDoc(ref, data));
  return Promise.resolve(ref);
}

export function setDoc(ref, data, options) {
  background(options ? fsSetDoc(ref, data, options) : fsSetDoc(ref, data));
  return Promise.resolve();
}

export function updateDoc(ref, ...args) {
  background(fsUpdateDoc(ref, ...args));
  return Promise.resolve();
}

export function deleteDoc(ref) {
  background(fsDeleteDoc(ref));
  return Promise.resolve();
}

/** batch.commit() без ожидания сервера: пакет применяется локально целиком. */
export function commitNow(batch) {
  background(batch.commit());
  return Promise.resolve();
}
