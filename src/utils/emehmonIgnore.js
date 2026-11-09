/**
 * emehmonIgnore.js — кого не показывать в «Есть в E-mehmon, но нет в программе».
 *
 * Владелец (2026-11-03): в портале числятся люди, которых нет в Hostella и
 * выводить их не нужно, — а задача «Вывести» висит на всех кассах. Исключает
 * только супер (и правило базы пускает на запись только его), видят все.
 * С 2026-11-09 скрыть можно любую регистрацию, и скрытого автомат не выводит
 * из портала (правило — utils/emehmonHidden.js).
 *
 * Документ settings/emehmonIgnore: { [hostelId]: { [key]: { name, passport, by, at } } }
 * key — паспорт без пробелов в верхнем регистре, без паспорта — «N:» + имя так же.
 */
import { doc, onSnapshot, setDoc, deleteField } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';

import { ignoreKey } from './emehmonHidden';
export { ignoreKey, isEmehmonHidden } from './emehmonHidden';

const ref = () => doc(db, ...PUBLIC_DATA_PATH, 'settings', 'emehmonIgnore');

/** Подписка на документ; onChange(data). Вернёт отписку. */
export const watchEmehmonIgnore = (onChange) =>
  onSnapshot(ref(), (snap) => onChange(snap.exists() ? snap.data() : {}),
    (e) => console.warn('[emehmonIgnore]', e.message));

export const ignoreEmehmonRow = (hostelId, r, by) => setDoc(ref(), {
  [hostelId]: { [ignoreKey(r)]: { name: r.fullName || r.name || '', passport: r.passport || '', by: by || '', at: new Date().toISOString() } },
}, { merge: true });

export const unignoreEmehmonRow = (hostelId, key) =>
  setDoc(ref(), { [hostelId]: { [key]: deleteField() } }, { merge: true });
