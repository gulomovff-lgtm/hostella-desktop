import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { emehmonAmountFor, getLocalDateString, HOSTELS } from '../utils/helpers';
import { emehmonAmountForStay } from '../utils/emehmonAmount';
import {
  openEmehmonDeparture, checkEmehmonActive, fetchEmehmonRegistered,
  departEmehmonBackground, departEmehmonBulk, autoRegisterArrival, recalcEmehmonAmounts,
} from '../utils/emehmon';
import TRANSLATIONS from '../constants/translations';

/**
 * useEmehmonAutomation — вся автоматика госпортала e-mehmon.
 *
 * Что здесь живёт:
 *  • отметки «зарегистрирован / выведен» на карточке гостя;
 *  • фоновый вывод (одиночный и массовый) и подтверждение результата;
 *  • сверка со списком /listok: ставит и снимает отметки по факту портала;
 *  • авто-регистрация прибытия граждан Узбекистана;
 *  • пересчёт стоимости услуг (ставка x прожитые сутки), раз в сутки и по кнопке.
 *
 * Ключевое правило: состояние портала — ОТДЕЛЬНОЕ на каждый филиал
 * (emehmonByHostel). У хостелов разные сессии e-mehmon, поэтому обновление
 * одного не должно блокировать другой, а переключение филиала не должно
 * подменять список. Филиал берётся из выбранного фильтра, а не из привязки
 * пользователя, — иначе кассир, смотрящий чужой хостел, увидит чужие данные.
 */
export function useEmehmonAutomation({
  guests, registrations, cadastreRegs, currentUser, selectedHostelFilter,
  isDataReady, showNotification, setGuestDetailsModal, lang,
}) {
  const t = k => TRANSLATIONS[lang]?.[k] || k;
  const [emehmonReminder, setEmehmonReminder] = useState(null);
  const [emehmonDepart, setEmehmonDepart] = useState(null);          // гость(и) для фонового выселения
  const [emehmonChecking, setEmehmonChecking] = useState(null);      // id гостя на проверке «Готово»
  const [emehmonArrivalPrompt, setEmehmonArrivalPrompt] = useState(null);
  const [emehmonDepartingIds, setEmehmonDepartingIds] = useState(() => new Set()); // в процессе вывода (лоадер)

  // Снимок портала — ОТДЕЛЬНЫЙ на каждый филиал:
  //   { hostel1: { rows, status: 'none'|'ok'|'need_login'|'error', at, syncing } }
  const [emehmonByHostel, setEmehmonByHostel] = useState({});
  const patchEmehmon = useCallback((hostelId, patch) => {
    setEmehmonByHostel(prev => ({ ...prev, [hostelId]: { ...(prev[hostelId] || {}), ...patch } }));
  }, []);

  // Филиал, с чьей сессией работаем. Правило то же, что у фильтра данных
  // (filterByHostel): смотрим на ВЫБРАННЫЙ филиал, а не на привязку пользователя.
  // Иначе кассир второго хостела, переключившийся на первый, видел гостей первого,
  // а список и отметки тянулись из портала второго — филиалы путались местами.
  const emehmonHostelId = useMemo(() => {
    if (!currentUser) return 'hostel1';
    const picked = (selectedHostelFilter && selectedHostelFilter !== 'all') ? selectedHostelFilter : null;
    const own = (currentUser.hostelId && currentUser.hostelId !== 'all') ? currentUser.hostelId : null;
    const canSwitch = currentUser.role === 'admin' || currentUser.role === 'super'
      || currentUser.canViewHostel1 || (currentUser.allowedHostels || []).length > 1;
    if (canSwitch) return picked || own || 'hostel1';
    return own || picked || 'hostel1';
  }, [currentUser, selectedHostelFilter]);

  const emehmonCur      = emehmonByHostel[emehmonHostelId] || {};
  const emehmonList     = emehmonCur.rows || [];
  const emehmonSnapshot = { status: emehmonCur.status || 'none', at: emehmonCur.at || null };
  const emehmonSyncing  = !!emehmonCur.syncing;

  const emehmonSyncBusy    = useRef(new Set()); // филиалы, по которым сверка уже идёт
  const emehmonNoRoomTried = useRef(new Set()); // гости, у кого авто-регистрация упёрлась в «нет комнаты»

// e-mehmon: отметки «зарегистрирован/выведен» на госте
const handleEmehmonFlag = useCallback(async (guestId, updates) => {
  try {
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), updates);
  } catch (e) {
    showNotification(t('hsError') + e.message, 'error');
  }
}, []); // eslint-disable-line react-hooks/exhaustive-deps

// e-mehmon: открыть подтверждение фонового выселения. Если Electron недоступен
// (веб) — фолбэк на старое окно. Иначе показываем модалку EmehmonDepartureModal.
const handleEmehmonDepart = useCallback((guestOrList) => {
  if (!guestOrList) return;
  const arr = Array.isArray(guestOrList) ? guestOrList.filter(Boolean) : [guestOrList];
  if (!arr.length) return;
  setEmehmonReminder(null); // закрываем напоминание, чтобы не перекрывало модалку выселения
  if (window.electronAPI?.emehmonDeparture) {
    setEmehmonDepart(arr);
  } else {
    openEmehmonDeparture(arr[0]);
    showNotification(t('emehmonOpenDeparture'), 'info');
  }
}, []); // eslint-disable-line react-hooks/exhaustive-deps

// Итог фонового выселения: помечаем «выведен», чистим лоадеры, обновляем список.
const handleDepartOutcome = useCallback((res, list) => {
  const ids = (list || []).filter(g => g && g.id).map(g => g.id);
  setEmehmonDepartingIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
  const status = res?.status;
  if (status === 'done' || status === 'submitted') {
    const now = new Date().toISOString();
    ids.forEach(id => handleEmehmonFlag(id, { emehmonOut: true, emehmonOutAt: now }));
    const n = res?.selected != null ? res.selected : (list || []).length;
    showNotification(t('emaDepartedCount').replace('{n}', n), 'success');
    setEmehmonReminder(null);
    // Сверка с e-mehmon: подтянуть свежий /listok, подтвердить вывод по факту
    // (на случай если «submitted» — Check-Out прошёл, но закрытие не подтвердилось).
    setTimeout(() => { if (emehmonSyncRef.current) emehmonSyncRef.current(false); }, 1500);
  } else if (status === 'need_login') {
    showNotification(t('emaLoginRepeatDepart'), 'info');
  } else if (status === 'multiple') {
    showNotification(t('emaMultipleMatches'), 'warning');
  } else if (status === 'not_found') {
    showNotification(t('emaNotFoundDepart'), 'error');
  } else {
    showNotification(t('emaAutoDepartFail'), 'error');
  }
}, [handleEmehmonFlag]); // eslint-disable-line react-hooks/exhaustive-deps

// Подтверждение из модалки: закрываем её сразу, выселяем в фоне, кнопки —
// в загрузку (departingIds); по завершении гость уходит из всех плашек/вкладок.
const handleEmehmonDepartConfirm = useCallback((opts) => {
  const list = emehmonDepart || [];
  if (!list.length) return;
  setEmehmonDepart(null); // окно уходит в фон сразу
  const ids = list.filter(g => g && g.id).map(g => g.id);
  setEmehmonDepartingIds(prev => new Set([...prev, ...ids]));
  showNotification(t('emaDepartingBg').replace('{n}', list.length), 'info');
  (async () => {
    const res = list.length > 1
      ? await departEmehmonBulk(list, opts)
      : await departEmehmonBackground(list[0], opts);
    handleDepartOutcome(res, list);
  })();
}, [emehmonDepart, handleDepartOutcome]); // eslint-disable-line react-hooks/exhaustive-deps

// «Готово»/«Уже выведен»: нельзя просто убрать плашку — сверяемся с e-mehmon.
// absent (нет в активном /listok) → ставим отметку; present (ещё активен) →
// отметку не даём, открываем окно выселения, чтобы не отмечали «просто так».
const handleEmehmonDone = useCallback(async (guest) => {
  if (!guest) return;
  if (!window.electronAPI?.emehmonCheck) {
    handleEmehmonFlag(guest.id, { emehmonOut: true, emehmonOutAt: new Date().toISOString() });
    setEmehmonReminder(null);
    return;
  }
  setEmehmonChecking(guest.id);
  showNotification(t('emaChecking'), 'info');
  const res = await checkEmehmonActive(guest);
  setEmehmonChecking(null);
  const status = res?.status;
  if (status === 'absent') {
    handleEmehmonFlag(guest.id, { emehmonOut: true, emehmonOutAt: new Date().toISOString() });
    showNotification(t('emaDepartConfirmed'), 'success');
    setEmehmonReminder(null);
  } else if (status === 'present') {
    showNotification(t('emaStillActive'), 'warning');
    setEmehmonReminder(null);
    setEmehmonDepart([guest]);
  } else if (status === 'need_login') {
    showNotification(t('emaLoginRepeat'), 'info');
  } else {
    showNotification(t('emaCheckFail'), 'error');
    setEmehmonReminder(null);
    setEmehmonDepart([guest]);
  }
}, [handleEmehmonFlag]); // eslint-disable-line react-hooks/exhaustive-deps

// Фоновая синхронизация статусов регистрации: тянем /listok текущего филиала и
// авто-ставим «Зарегистрирован» совпавшим активным иностранцам. НЕ снимаем —
// поэтому ложноотрицательные (другой филиал/аккаунт) безвредны.
const runEmehmonSync = useCallback(async (manual = false, hostelOverride = null) => {
  if (!window.electronAPI?.emehmonList) {
    if (manual) showNotification(t('emaDesktopOnly'), 'info');
    return;
  }
  const hostelId = hostelOverride || emehmonHostelId;
  // Занятость считаем по филиалу: сверка одного хостела не блокирует второй
  if (emehmonSyncBusy.current.has(hostelId)) return;
  emehmonSyncBusy.current.add(hostelId);
  patchEmehmon(hostelId, { syncing: true });
  if (manual) showNotification(t('emaCheckingHostel').replace('{name}', HOSTELS[hostelId]?.name || hostelId), 'info');
  try {
    const res = await fetchEmehmonRegistered(hostelId);
    if (res?.status === 'ok') {
      patchEmehmon(hostelId, { rows: res.rows || [], status: 'ok', at: Date.now() });
      const norm = s => (s || '').replace(/\s/g, '').toUpperCase();
      const pSet = new Set((res.rows || []).map(r => r.passport).filter(Boolean));
      const nSet = new Set((res.rows || []).map(r => r.name).filter(Boolean));
      // e-mehmon регистрирует всех гостей (в т.ч. граждан Узбекистана) — фильтр
      // по гражданству НЕ применяем, сопоставляем по паспорту/ФИО.
      // Долговые записи (roomId==='DEBT_ONLY') — не гости в комнате, из логики исключаем.
      const isReal = (g) => g.roomId !== 'DEBT_ONLY';
      // Список /listok принадлежит ОДНОМУ филиалу (у каждого своя сессия e-mehmon),
      // поэтому и отметки ставим только гостям этого филиала. Без этой проверки
      // список второго хостела помечал «зарегистрирован» гостей первого — и филиалы
      // путались местами при переключении.
      const sameHostel = (g) => (g.hostelId || 'hostel1') === hostelId;
      const now = new Date().toISOString();
      // Чистим устаревшую пометку «Комната не совпала с e-mehmon» — она больше не
      // выставляется (чаще всего это был ложный след от переезда со старой отметкой).
      const toClearRoomErr = (guests || []).filter(g =>
        g.status === 'active' && typeof g.emehmonRegError === 'string' &&
        g.emehmonRegError.startsWith('Комната не совпала'));
      for (const g of toClearRoomErr) {
        try {
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id),
            { emehmonRegError: deleteField(), emehmonRegErrorAt: deleteField() });
        } catch (_) { /* пропускаем */ }
      }
      const toMark = (guests || []).filter(g =>
        g.status === 'active' && isReal(g) && sameHostel(g) && !g.emehmonReg &&
        (pSet.has(norm(g.passport)) || nSet.has(norm(g.fullName))));
      for (const g of toMark) {
        try {
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id),
            { emehmonReg: true, emehmonRegAt: now, emehmonRegAuto: true,
              emehmonAmount: emehmonAmountFor(g.country) });
        } catch (_) { /* пропускаем */ }
      }
      // Сверка «зарегистрирован»: активный гость своего филиала помечен emehmonReg,
      // но его НЕТ в /listok → регистрация истекла/снята. Снимаем флаг, чтобы счётчик
      // в системе совпадал с сайтом e-mehmon, а гость попал в «Оформить».
      const toUnmark = (guests || []).filter(g =>
        g.status === 'active' && isReal(g) && g.emehmonReg && sameHostel(g) &&
        !((g.passport && pSet.has(norm(g.passport))) || (g.fullName && nSet.has(norm(g.fullName)))));
      for (const g of toUnmark) {
        try {
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id),
            { emehmonReg: false, emehmonRegAt: deleteField(), emehmonRegAuto: deleteField() });
        } catch (_) { /* пропускаем */ }
      }
      // Авто-подтверждение вывода: выселенный гость, зарегистрированный в e-mehmon,
      // которого в /listok уже НЕТ → выведен. Только для своего филиала (g.hostelId
      // === hostelId), чтобы чужой аккаунт не дал ложного «выведен».
      const toMarkOut = (guests || []).filter(g =>
        g.status === 'checked_out' && g.emehmonReg && !g.emehmonOut && sameHostel(g) &&
        !((g.passport && pSet.has(norm(g.passport))) || (g.fullName && nSet.has(norm(g.fullName)))));
      for (const g of toMarkOut) {
        try {
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id),
            { emehmonOut: true, emehmonOutAt: now, emehmonOutAuto: true });
        } catch (_) { /* пропускаем */ }
      }
      // ── АВТО-ВЫВОД ПО ИСТЕЧЕНИИ СРОКА ────────────────────────────────────
      // Регистрации (журнал), у которых срок вышел, а статус ещё active:
      //  • есть в /listok → выселяем в фоне одной операцией → помечаем removed;
      //  • нет в /listok → уже выведен → просто помечаем removed.
      const expiredActive = (registrations || []).filter(r =>
        r.status === 'active' && r.hostelId === hostelId && r.endDate &&
        new Date(r.endDate + 'T23:59:59').getTime() < Date.now());
      if (expiredActive.length > 0) {
        const inListok = expiredActive.filter(r =>
          (r.passport && pSet.has(norm(r.passport))) || (r.fullName && nSet.has(norm(r.fullName))));
        const absent = expiredActive.filter(r => !inListok.includes(r));
        const markRemoved = async (r, by) => {
          try {
            await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'registrations', r.id),
              { status: 'removed', removedAt: new Date().toISOString(), removedBy: by });
          } catch (_) { /* пропускаем */ }
        };
        for (const r of absent) await markRemoved(r, 'auto_expiry_absent');
        if (inListok.length > 0 && window.electronAPI?.emehmonDepartureBulk) {
          const dep = await departEmehmonBulk(
            inListok.map(r => ({ fullName: r.fullName, passport: r.passport, hostelId })),
            { hostelId });
          if (dep?.status === 'done' || dep?.status === 'submitted') {
            for (const r of inListok) await markRemoved(r, 'auto_expiry');
            showNotification(t('emaExpiredAutoDeparted').replace('{n}', inListok.length), 'success');
          } else if (manual) {
            showNotification(t('emaExpiredAutoDepartFail'), 'warning');
          }
        } else if (absent.length > 0 && manual) {
          showNotification(t('emaExpiredClosed').replace('{n}', absent.length), 'info');
        }
      }

      // ── АВТО-ДОБОР «ЗАБЫТЫХ» МЕСТНЫХ ────────────────────────────────────
      // Активные граждане Узбекистана с оплатой, без e-mehmon/кадастра и без
      // прежней ошибки — регистрируем сами, ТИХО (окно не показываем).
      // Ошибка госбазы → пометка «ошибка в паспортных данных» на госте,
      // повторов не делаем, пока данные не исправят (пометка снимается при
      // редактировании паспорта/ДР). До 3 гостей за цикл (цикл каждые 5 мин).
      if (window.electronAPI?.emehmonArrivalAuto) {
        const paidOf = (g) => (typeof g.amountPaid === 'number' ? g.amountPaid : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0)));
        const inCad = (g) => (cadastreRegs || []).some(r =>
          r.status !== 'removed' &&
          (r.guestId === g.id || (r.passport && g.passport && norm(r.passport) === norm(g.passport))));
        const candidates = (guests || []).filter(g =>
          g.status === 'active' && isReal(g) && g.country === 'Узбекистан' &&
          !g.emehmonReg && !g.emehmonSkip && !g.emehmonRegError &&
          sameHostel(g) && paidOf(g) > 0 &&
          !(pSet.has(norm(g.passport)) || nSet.has(norm(g.fullName))) &&
          !inCad(g) && !emehmonAutoBusy.current.has(g.id) &&
          !emehmonNoRoomTried.current.has(g.id)
        ).slice(0, 3);
        for (const g of candidates) {
          emehmonAutoBusy.current.add(g.id);
          try {
            const reg = await autoRegisterArrival(g, { silent: true });
            const st = reg?.status;
            if (st === 'done') {
              await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id),
                { emehmonReg: true, emehmonRegAt: new Date().toISOString(), emehmonRegAuto: true,
                  emehmonRegError: deleteField(), emehmonAmount: emehmonAmountFor(g.country) });
              showNotification(t('emaRegisteredAuto').replace('{name}', g.fullName), 'success');
            } else if (st === 'not_found') {
              await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id),
                { emehmonRegError: 'Ошибка в паспортных данных — нужно исправить', emehmonRegErrorAt: new Date().toISOString() });
              showNotification(t('emaNotInGovDb').replace('{name}', g.fullName), 'warning');
            } else if (st === 'no_room') {
              // Комнату не удалось сопоставить в e-mehmon. Ошибку гостю НЕ вешаем
              // (просьба убрать её) — просто не повторяем в этой сессии, гость
              // остаётся в «Оформить» для ручной регистрации.
              emehmonNoRoomTried.current.add(g.id);
            } else if (st === 'need_login') {
              break; // без входа продолжать нет смысла — попробуем в следующем цикле
            }
            // прочие сбои (таймаут/сеть) — без пометки, повтор в следующем цикле
          } catch (_) { /* пропускаем */ } finally {
            emehmonAutoBusy.current.delete(g.id);
          }
        }
      }
      if (manual) showNotification(t('emaSyncResult').replace('{marked}', toMark.length).replace('{out}', toMarkOut.length), 'success');
    } else if (res?.status === 'need_login') {
      patchEmehmon(hostelId, { status: 'need_login', at: Date.now() });
      if (manual) showNotification(t('emaLoginRepeat'), 'info');
    } else {
      patchEmehmon(hostelId, { status: 'error', at: Date.now() });
      if (manual) showNotification(t('emaListFail'), 'error');
    }
  } finally {
    emehmonSyncBusy.current.delete(hostelId);
    patchEmehmon(hostelId, { syncing: false });
  }
}, [guests, registrations, cadastreRegs, currentUser, selectedHostelFilter, emehmonHostelId, patchEmehmon]); // eslint-disable-line react-hooks/exhaustive-deps

// Стабильный планировщик: старт через 8с после входа + каждые 5 минут — по текущему филиалу.
const emehmonSyncRef = useRef(runEmehmonSync);
useEffect(() => { emehmonSyncRef.current = runEmehmonSync; }, [runEmehmonSync]);
const emehmonHostelIdRef = useRef(emehmonHostelId);
useEffect(() => { emehmonHostelIdRef.current = emehmonHostelId; }, [emehmonHostelId]);
useEffect(() => {
  if (!window.electronAPI?.emehmonList || !currentUser) return;
  const run = () => emehmonSyncRef.current(false, emehmonHostelIdRef.current);
  const t = setTimeout(run, 8000);
  const iv = setInterval(run, 5 * 60 * 1000);
  return () => { clearTimeout(t); clearInterval(iv); };
}, [currentUser]);

// Переключили филиал → подтягиваем список ЭТОГО филиала. Чужой слот не трогаем:
// у каждого хостела свой снимок и своя занятость, поэтому переключение во время
// сверки первого не мешает обновить второй.
const FRESH_SNAPSHOT_MS = 2 * 60 * 1000;
useEffect(() => {
  if (!window.electronAPI?.emehmonList || !currentUser) return;
  const slot = emehmonByHostel[emehmonHostelId];
  if (slot?.syncing) return;                                   // уже обновляется
  if (slot?.status === 'ok' && Date.now() - (slot.at || 0) < FRESH_SNAPSHOT_MS) return; // свежий
  const t = setTimeout(() => emehmonSyncRef.current(false, emehmonHostelId), 400);
  return () => clearTimeout(t);
}, [currentUser, emehmonHostelId]); // eslint-disable-line react-hooks/exhaustive-deps

// ─── Пересчёт стоимости услуг в e-mehmon ────────────────────────────────
// Портал ждёт сумму за фактическое проживание: 10 суток по 30 000 = 300 000.
// Раз в сутки (и по кнопке) пересчитываем её всем, кто ЖИВЁТ сейчас, и
// отправляем изменившиеся суммы в портал. Выехавших не трогаем: у них сумма
// зафиксирована при выписке.
const emehmonRecalcBusy = useRef(new Set());
const runEmehmonRecalc = useCallback(async (manual = false, hostelOverride = null) => {
  if (!window.electronAPI?.emehmonRecalc) {
    if (manual) showNotification(t('emaDesktopOnly'), 'info');
    return;
  }
  const hostelId = hostelOverride || emehmonHostelId;
  if (emehmonRecalcBusy.current.has(hostelId)) return;
  emehmonRecalcBusy.current.add(hostelId);
  try {
    const now = Date.now();
    const living = (guests || []).filter(g =>
      g.status === 'active' && g.roomId !== 'DEBT_ONLY' &&
      (g.hostelId || 'hostel1') === hostelId && g.emehmonReg && g.passport);

    const items = living.map(g => ({
      passport: g.passport,
      name: g.fullName,
      amount: emehmonAmountForStay(g, emehmonAmountFor(g.country), now),
    })).filter(x => x.amount > 0);

    if (!items.length) {
      if (manual) showNotification(t('emaNoOneToRecalc'), 'info');
      return;
    }
    if (manual) showNotification(t('emaRecalcing').replace('{n}', items.length), 'info');

    const res = await recalcEmehmonAmounts(items, hostelId);
    if (res?.status === 'done') {
      localStorage.setItem(`emehmonRecalc_${hostelId}`, getLocalDateString(new Date()));
      // Запоминаем отправленные суммы — по ним видно, что стоит в портале
      for (const g of living) {
        const amount = emehmonAmountForStay(g, emehmonAmountFor(g.country), now);
        if (amount > 0 && g.emehmonAmount !== amount) {
          try {
            await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id),
              { emehmonAmount: amount, emehmonAmountAt: new Date().toISOString() });
          } catch (_) { /* не критично: портал уже обновлён */ }
        }
      }
      if (manual || res.updated > 0) {
        showNotification(
          res.updated > 0
            ? t('emaAmountsUpdated').replace('{n}', res.updated)
            : t('emaAmountsAlreadyOk'),
          'success');
      }
      if (res.failed > 0) showNotification(t('emaAmountsPartFail').replace('{n}', res.failed), 'warning');
    } else if (res?.status === 'need_login' && manual) {
      showNotification(t('emaLoginRecalc'), 'info');
    } else if (manual) {
      showNotification(t('emaRecalcFail') + (res?.message || res?.status || t('error')), 'error');
    }
  } finally {
    emehmonRecalcBusy.current.delete(hostelId);
  }
}, [guests, emehmonHostelId]); // eslint-disable-line react-hooks/exhaustive-deps

// Раз в сутки после 9:00 (смена суток в отчётах) — тихо, по текущему филиалу
const emehmonRecalcRef = useRef(runEmehmonRecalc);
useEffect(() => { emehmonRecalcRef.current = runEmehmonRecalc; }, [runEmehmonRecalc]);
useEffect(() => {
  if (!window.electronAPI?.emehmonRecalc || !currentUser || !isDataReady) return;
  const tick = () => {
    const hid = emehmonHostelIdRef.current;
    if (new Date().getHours() < 9) return;                       // ждём начала суток
    if (localStorage.getItem(`emehmonRecalc_${hid}`) === getLocalDateString(new Date())) return;
    emehmonRecalcRef.current(false, hid);
  };
  const first = setTimeout(tick, 60 * 1000);        // через минуту после запуска
  const iv = setInterval(tick, 30 * 60 * 1000);     // и раз в полчаса проверяем дату
  return () => { clearTimeout(first); clearInterval(iv); };
}, [currentUser, isDataReady]);

// Полная авто-регистрация прибытия (граждане Узбекистана) в фоне.
const emehmonAutoBusy = useRef(new Set()); // guestId в процессе — защита от дубля листка
const handleEmehmonAutoArrival = useCallback(async (guest) => {
  if (!guest || !window.electronAPI?.emehmonArrivalAuto) return;
  if (guest.id && emehmonAutoBusy.current.has(guest.id)) return; // уже регистрируется
  if (guest.id) emehmonAutoBusy.current.add(guest.id);
  showNotification(t('emaRegistering').replace('{name}', guest.fullName), 'info');
  const res = await autoRegisterArrival(guest);
  if (guest.id) emehmonAutoBusy.current.delete(guest.id);
  const st = res?.status;
  if (st === 'done') {
    handleEmehmonFlag(guest.id, { emehmonReg: true, emehmonRegAt: new Date().toISOString(), emehmonRegAuto: true,
      emehmonRegError: deleteField(), emehmonAmount: emehmonAmountFor(guest.country) });
    showNotification(t('emaRegistered').replace('{name}', guest.fullName), 'success');
  } else if (st === 'need_login') {
    showNotification(t('emaLoginContinueReg'), 'info');
  } else if (st === 'not_found') {
    showNotification(t('emaNotInGovDbManual').replace('{name}', guest.fullName), 'warning');
  } else if (st === 'no_room') {
    showNotification(t('emaRoomMismatch').replace('{name}', guest.fullName), 'warning');
  } else if (st === 'no_electron') {
    /* веб — пропускаем */
  } else {
    showNotification(t('emaAutoRegNotDone').replace('{name}', guest.fullName), 'error');
  }
}, [handleEmehmonFlag]); // eslint-disable-line react-hooks/exhaustive-deps

// Успешная регистрация прибытия в e-mehmon → авто-галочка «Зарегистрирован».
const guestsRef = useRef(guests);
useEffect(() => { guestsRef.current = guests; }, [guests]);
const emehmonRegHooked = useRef(false);
useEffect(() => {
  if (emehmonRegHooked.current || !window.electronAPI?.onEmehmonRegistered) return;
  emehmonRegHooked.current = true;
  window.electronAPI.onEmehmonRegistered((data) => {
    const norm = s => (s || '').replace(/\s/g, '').toUpperCase();
    let id = data?.guestId;
    if (!id && data?.passport) {
      const g = (guestsRef.current || []).find(x =>
        x.passport && norm(x.passport) === norm(data.passport) && x.status === 'active');
      id = g?.id;
    }
    if (id) {
      const regGuest = (guestsRef.current || []).find(x => x.id === id);
      handleEmehmonFlag(id, { emehmonReg: true, emehmonRegAt: new Date().toISOString(), emehmonRegAuto: true,
        emehmonAmount: emehmonAmountFor(regGuest?.country) });
      showNotification(t('emaGuestRegistered'), 'success');
    }
  });
}, [handleEmehmonFlag]); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    // состояние для разметки
    emehmonReminder, setEmehmonReminder,
    emehmonDepart, setEmehmonDepart,
    emehmonChecking,
    emehmonArrivalPrompt, setEmehmonArrivalPrompt,
    emehmonDepartingIds,
    // снимок портала по текущему филиалу
    emehmonHostelId, emehmonList, emehmonSnapshot, emehmonSyncing,
    // действия
    handleEmehmonFlag, handleEmehmonDepart, handleEmehmonDepartConfirm,
    handleEmehmonDone, handleEmehmonAutoArrival,
    handleDepartOutcome, runEmehmonSync, runEmehmonRecalc,
  };
}
