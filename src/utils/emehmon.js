// Облачное хранение доступов e-mehmon (Firebase: settings/emehmon), выбор по филиалу.
// Пароль хранится в base64 — это лёгкая обфускация (НЕ шифрование): не светится открытым
// текстом в консоли Firebase, но технически доступен клиентам, читающим настройки.
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { buildEmehmonPayload } from './helpers';

const accDoc = () => doc(db, ...PUBLIC_DATA_PATH, 'settings', 'emehmon');

const enc = (s) => { try { return btoa(unescape(encodeURIComponent(s || ''))); } catch { return ''; } };
const dec = (s) => { try { return decodeURIComponent(escape(atob(s || ''))); } catch { return ''; } };

const HOSTELS = ['hostel1', 'hostel2'];

// Аккаунт для конкретного филиала (с расшифрованным паролем) или null
export async function getEmehmonAccount(hostelId) {
  try {
    const snap = await getDoc(accDoc());
    if (!snap.exists()) return null;
    const a = snap.data()[hostelId];
    if (!a || !a.login) return null;
    return { login: a.login, password: a.pw ? dec(a.pw) : (a.password || '') };
  } catch {
    return null;
  }
}

// Для каких филиалов заданы доступы (без раскрытия паролей)
export async function getEmehmonStatus() {
  try {
    const snap = await getDoc(accDoc());
    const d = snap.exists() ? snap.data() : {};
    return { hostel1: !!(d.hostel1 && d.hostel1.login), hostel2: !!(d.hostel2 && d.hostel2.login) };
  } catch {
    return { hostel1: false, hostel2: false };
  }
}

// Подмешать логин/пароль филиала и открыть окно e-mehmon
async function openWith(payload) {
  if (!window.electronAPI?.openEmehmon) return false;
  const acc = await getEmehmonAccount(payload.hostelId);
  if (acc) { payload.login = acc.login; payload.password = acc.password; }
  window.electronAPI.openEmehmon(payload);
  return true;
}

// Прибытие — окно на create-page с автозаполнением мастера.
// guestId/passport кладём в payload, чтобы после успешной регистрации main
// мог сообщить рендеру и автоматически проставить «Зарегистрирован».
export function openEmehmonArrival(guest) {
  return openWith({ ...buildEmehmonPayload(guest), guestId: guest?.id || '' });
}

// Полная авто-регистрация прибытия (граждане Узбекистана) — всё в фоне.
//   done / need_login / not_found / no_room / … | no_electron
export async function autoRegisterArrival(guest) {
  if (!window.electronAPI?.emehmonArrivalAuto) return { status: 'no_electron' };
  const payload = { ...buildEmehmonPayload(guest), guestId: guest?.id || '', amount: '1' };
  const acc = await getEmehmonAccount(payload.hostelId);
  if (acc) { payload.login = acc.login; payload.password = acc.password; }
  try {
    return await window.electronAPI.emehmonArrivalAuto(payload);
  } catch (e) {
    return { status: 'error', message: e?.message || String(e) };
  }
}

// Убытие/печать — окно на /listok, скрипт найдёт и выделит гостя
export function openEmehmonDeparture(guest) {
  return openWith({ ...buildEmehmonPayload(guest), mode: 'departure', path: '/listok' });
}

// Фоновое выселение: всё делается в скрытом окне и возвращается статус.
// opts: { amount, payType, print } — TO‘LOV, тип оплаты (1=Boshqa…), печать листа.
export async function departEmehmonBackground(guest, opts = {}) {
  if (!window.electronAPI?.emehmonDeparture) return { status: 'no_electron' };
  const payload = {
    ...buildEmehmonPayload(guest),
    mode: 'departure',
    path: '/listok',
    amount: opts.amount != null ? String(opts.amount) : '1',
    payType: opts.payType != null ? String(opts.payType) : '1',
    print: !!opts.print,
  };
  const acc = await getEmehmonAccount(payload.hostelId);
  if (acc) { payload.login = acc.login; payload.password = acc.password; }
  try {
    return await window.electronAPI.emehmonDeparture(payload);
  } catch (e) {
    return { status: 'error', message: e?.message || String(e) };
  }
}

// Массовое выселение: список гостей одной операцией. Гости могут быть «orphan»
// (есть в e-mehmon, нет в Hostella) — сопоставление по паспорту/ФИО.
export async function departEmehmonBulk(guests, opts = {}) {
  if (!window.electronAPI?.emehmonDepartureBulk) return { status: 'no_electron' };
  const list = (guests || []).map(g => {
    const p = buildEmehmonPayload(g);
    return { passport: p.passport, name: g.fullName || g.guestName || '' };
  });
  const payload = {
    list,
    amount: opts.amount != null ? String(opts.amount) : '1',
    payType: opts.payType != null ? String(opts.payType) : '1',
    print: !!opts.print,
  };
  const hostelId = opts.hostelId || (guests[0] && guests[0].hostelId) || '';
  const acc = await getEmehmonAccount(hostelId);
  if (acc) { payload.login = acc.login; payload.password = acc.password; }
  try {
    return await window.electronAPI.emehmonDepartureBulk(payload);
  } catch (e) {
    return { status: 'error', message: e?.message || String(e) };
  }
}

// Проверить, активен ли гость в /listok e-mehmon (т.е. ещё НЕ выселен).
//   present → ещё в активном списке; absent → уже выселен; need_login/error/…
export async function checkEmehmonActive(guest) {
  if (!window.electronAPI?.emehmonCheck) return { status: 'no_electron' };
  const payload = { ...buildEmehmonPayload(guest) };
  const acc = await getEmehmonAccount(payload.hostelId);
  if (acc) { payload.login = acc.login; payload.password = acc.password; }
  try {
    return await window.electronAPI.emehmonCheck(payload);
  } catch (e) {
    return { status: 'error', message: e?.message || String(e) };
  }
}

// Получить список зарегистрированных в e-mehmon (текущий аккаунт филиала).
//   { status:'ok', rows:[{passport,name}] } | need_login | error | no_electron
export async function fetchEmehmonRegistered(hostelId) {
  if (!window.electronAPI?.emehmonList) return { status: 'no_electron' };
  const payload = { hostelId: hostelId || '' };
  const acc = await getEmehmonAccount(hostelId);
  if (acc) { payload.login = acc.login; payload.password = acc.password; }
  try {
    return await window.electronAPI.emehmonList(payload);
  } catch (e) {
    return { status: 'error', message: e?.message || String(e) };
  }
}

// Сохранить доступы. Пустой пароль не затирает существующий; clear:true удаляет филиал.
export async function saveEmehmonAccounts(accounts) {
  const cur = await getDoc(accDoc()).then(s => (s.exists() ? s.data() : {})).catch(() => ({}));
  const next = { ...cur };
  for (const hid of HOSTELS) {
    const a = accounts && accounts[hid];
    if (!a) continue;
    if (a.clear) { delete next[hid]; continue; }
    const login = (a.login || '').trim();
    const password = a.password || '';
    if (login && password) next[hid] = { login, pw: enc(password) };
  }
  await setDoc(accDoc(), next);
}
