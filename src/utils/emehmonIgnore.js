/**
 * emehmonIgnore.js — кого не показывать в «Есть в E-mehmon, но нет в программе».
 *
 * Владелец (2026-11-03): в портале числятся люди, которых нет в Hostella и
 * выводить их не нужно, — а задача «Вывести» висит на всех кассах. Исключает
 * только супер (и правило базы пускает на запись только его), видят все.
 *
 * Документ settings/emehmonIgnore: { [hostelId]: { [key]: { name, passport, by, at } } }
 * key — паспорт без пробелов в верхнем регистре, без паспорта — «N:» + имя так же.
 */
import { doc, onSnapshot, setDoc, deleteField } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';

const ref = () => doc(db, ...PUBLIC_DATA_PATH, 'settings', 'emehmonIgnore');
const norm = (s) => String(s || '').replace(/\s/g, '').toUpperCase();

/** Ключ строки портала: паспорт надёжнее, имя — только когда паспорта нет. */
export const ignoreKey = (r) => (r?.passport ? norm(r.passport) : (r?.fullName || r?.name) ? 'N:' + norm(r.fullName || r.name) : '');

/** Подписка на документ; onChange(data). Вернёт отписку. */
export const watchEmehmonIgnore = (onChange) =>
  onSnapshot(ref(), (snap) => onChange(snap.exists() ? snap.data() : {}),
    (e) => console.warn('[emehmonIgnore]', e.message));

export const ignoreEmehmonRow = (hostelId, r, by) => setDoc(ref(), {
  [hostelId]: { [ignoreKey(r)]: { name: r.fullName || r.name || '', passport: r.passport || '', by: by || '', at: new Date().toISOString() } },
}, { merge: true });

export const unignoreEmehmonRow = (hostelId, key) =>
  setDoc(ref(), { [hostelId]: { [key]: deleteField() } }, { merge: true });
