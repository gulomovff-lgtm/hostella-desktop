/**
 * expenseCats.js — свои статьи расходов общие для всех устройств.
 *
 * Раньше добавленные статьи, их значки и архив жили только в localStorage
 * того устройства, где их завели (ключи exp_custom_cats_<хостел> и т.п.):
 * на другой кассе и телефоне их не было. Владелец (2026-09-27): «всё должно
 * писаться в базу, прозрачно на всех устройствах».
 *
 * Теперь источник — документ settings/expenseCats в Firestore:
 *   { [hostelKey]: { custom: [...], icons: {name: '🧴'}, archived: [...] } }
 * Программа держит его открытым и раскладывает в те же ключи localStorage —
 * экраны читают их как раньше. Запись — через saveExpenseCats (и в кэш, и в базу).
 * При первом снимке статьи, которые есть только на этом устройстве, досылаются
 * в базу (объединение, ничего не теряется).
 */
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';

const FIELDS = { custom: 'exp_custom_cats', icons: 'exp_custom_icons', archived: 'exp_archived_cats' };
const HOSTEL_KEYS = ['all', 'hostel1', 'hostel2'];
const ref = () => doc(db, ...PUBLIC_DATA_PATH, 'settings', 'expenseCats');

const readLs = (key, fb) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const writeLs = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* приватный режим */ } };

/** Объединить локальное и серверное (без потерь): списки — union, значки — сервер поверх локальных. */
export function mergeCats(local = {}, remote = {}) {
  const uniq = (a, b) => [...new Set([...(a || []), ...(b || [])])].filter(Boolean);
  return {
    custom: uniq(remote.custom, local.custom),
    icons: { ...(local.icons || {}), ...(remote.icons || {}) },
    archived: uniq(remote.archived, local.archived),
  };
}

const sameCats = (a = {}, b = {}) => JSON.stringify(mergeCats({}, a)) === JSON.stringify(mergeCats({}, b));

/** Подписка: база → localStorage. onChange(hostelKey) — чтобы экран перечитал. Вернёт отписку. */
export function startExpenseCatsSync(onChange) {
  let migrated = false;
  return onSnapshot(ref(), (snap) => {
    const data = snap.exists() ? snap.data() : {};
    const toUpload = {};
    for (const k of HOSTEL_KEYS) {
      const local = { custom: readLs(`${FIELDS.custom}_${k}`, []), icons: readLs(`${FIELDS.icons}_${k}`, {}), archived: readLs(`${FIELDS.archived}_${k}`, []) };
      const remote = data[k] || {};
      // первый снимок: локальные статьи этого устройства дописываем в базу
      const merged = migrated ? mergeCats({}, remote) : mergeCats(local, remote);
      if (!migrated && !sameCats(merged, remote)) toUpload[k] = merged;
      writeLs(`${FIELDS.custom}_${k}`, merged.custom);
      writeLs(`${FIELDS.icons}_${k}`, merged.icons);
      writeLs(`${FIELDS.archived}_${k}`, merged.archived);
      onChange?.(k);
    }
    migrated = true;
    if (Object.keys(toUpload).length) setDoc(ref(), toUpload, { merge: true }).catch(e => console.warn('[expenseCats] upload', e.message));
  }, (e) => console.warn('[expenseCats] sync', e.message));
}

/** Сохранить статьи хостела: patch = { custom?, icons?, archived? } — сразу в кэш и в базу. */
export function saveExpenseCats(hostelKey, patch) {
  const k = hostelKey || 'all';
  const cur = { custom: readLs(`${FIELDS.custom}_${k}`, []), icons: readLs(`${FIELDS.icons}_${k}`, {}), archived: readLs(`${FIELDS.archived}_${k}`, []) };
  const next = { ...cur, ...patch };
  writeLs(`${FIELDS.custom}_${k}`, next.custom);
  writeLs(`${FIELDS.icons}_${k}`, next.icons);
  writeLs(`${FIELDS.archived}_${k}`, next.archived);
  // Весь объект хостела целиком: удаление статьи/значка тоже доезжает до базы
  return setDoc(ref(), { [k]: next }, { merge: true }).catch(e => console.warn('[expenseCats] save', e.message));
}
