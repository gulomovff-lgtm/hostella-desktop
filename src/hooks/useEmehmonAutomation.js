import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { emehmonAmountFor, getLocalDateString, HOSTELS } from '../utils/helpers';
import { emehmonAmountForStay } from '../utils/emehmonAmount';
import {
  openEmehmonDeparture, checkEmehmonActive, fetchEmehmonRegistered,
  departEmehmonBackground, departEmehmonBulk, autoRegisterArrival, recalcEmehmonAmounts,
  checkPassportInGov, getEmehmonStatus,
} from '../utils/emehmon';
import {
  parseEmehmonProbe, assessKpp, registrationDue, trimProbe, shouldRetryNoRoom,
  todayIso, daysBetween, getRegistrationWindow,
} from '../utils/kppRules';
import TRANSLATIONS from '../constants/translations';

const LOCAL_COUNTRY = 'Узбекистан';
const isLocal = (g) => g?.country === LOCAL_COUNTRY;
const paidOf = (g) => (typeof g.amountPaid === 'number' ? g.amountPaid : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0)));
/** Липкий текст ошибки госбазы: тот же, что снимает handleGuestUpdate при правке паспорта. */
export const REG_ERROR_TEXT = 'Ошибка в паспортных данных — нужно исправить';
const HOURS = 3600 * 1000;
const fmtRu = (iso) => { try { return new Date(iso).toLocaleDateString('ru-RU'); } catch { return iso; } };

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
  const emehmonAutoBusy    = useRef(new Set()); // guestId в процессе регистрации — защита от дубля листка
  const foreignBusy        = useRef(new Set()); // guestId в проверке госбазы (иностранец)

  // Окна для иностранца: «госбаза не нашла — исправьте данные» и «ситуация»
  // (гость за пределами окна, разрыв после другого отеля — решает человек).
  const [kppFixPrompt, setKppFixPrompt] = useState(null);   // { guest, notFoundText }
  const [kppSituation, setKppSituation] = useState(null);   // { guest, assessment, stays }

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

// ─── КПП иностранца: данные портала → карточка гостя ───────────────────────
// Ответ портала (проверка паспорта или мастер прибытия) несёт сырой дамп
// вкладок. Разбираем его (utils/kppRules.js), пишем дату/№ КПП, прошлые
// проживания и оценку правила сроков. Дата КПП из портала СИЛЬНЕЕ ручной —
// кроме правки, сделанной уже после прошлой проверки (kppEditedAt новее).
const applyProbeToGuest = useCallback(async (guest, res) => {
  if (!guest?.id || !res) return { parsed: null, assessment: null, kppDate: guest?.kppDate || '' };
  const now = new Date().toISOString();
  const today = todayIso();
  const probe = res.probe || res;            // шаг 2 (проверка паспорта отдаёт поля сверху)
  const last  = res.last || null;            // последний шаг мастера (список отелей)
  const merged = {
    fields: probe.fields || {}, labels: probe.labels || {},
    tables: [...(last?.tables || []), ...(probe.tables || [])],
    blocks: [...(last?.blocks || []), ...(probe.blocks || [])],
    officialName: probe.officialName || res.officialName || '',
  };
  const parsed = parseEmehmonProbe(merged, { birthDate: guest.birthDate, passportIssueDate: guest.passportIssueDate, today });
  const updates = {
    kppCheckedAt: now,
    emehmonProbe: trimProbe({ at: now, ...merged, keys: (probe.keys || []).concat(last?.keys || []).slice(0, 120) }),
    emehmonRegError: deleteField(), emehmonRegErrorAt: deleteField(),
  };
  const manualNewer = guest.kppSource === 'manual' && guest.kppEditedAt && guest.kppCheckedAt && guest.kppEditedAt > guest.kppCheckedAt;
  let kppDate = guest.kppDate ? String(guest.kppDate).slice(0, 10) : '';
  if (parsed.kppDate && !manualNewer && parsed.kppDate !== kppDate) {
    updates.kppDate = parsed.kppDate; updates.kppSource = 'emehmon'; kppDate = parsed.kppDate;
  } else if (parsed.kppDate && parsed.kppDate === kppDate && guest.kppSource !== 'emehmon') {
    updates.kppSource = 'emehmon';
  } else if (!parsed.kppDate && kppDate && guest.kppSource === 'emehmon') {
    // Портал даты больше не даёт (или прежняя была прочитана из не того поля —
    // «дата заезда» вместо КПП): портальную дату снимаем, ручную не трогаем.
    updates.kppDate = deleteField(); updates.kppSource = deleteField(); updates.kppNumber = deleteField(); kppDate = '';
  }
  if (parsed.kppNumber) updates.kppNumber = parsed.kppNumber;
  if (parsed.stays.length) updates.emehmonStays = parsed.stays;
  if (parsed.lastCheckout) updates.emehmonLastCheckout = parsed.lastCheckout;
  const lastCheckout = parsed.lastCheckout || guest.emehmonLastCheckout || null;
  const assessment = assessKpp({ country: guest.country, kppDate, lastCheckout, today });
  if (!assessment.ok) {
    // Ту же причину не переписываем — иначе «Понятно» кассира слетало бы каждый цикл.
    const prev = guest.kppSituation;
    if (!prev || prev.reason !== assessment.reason) {
      updates.kppSituation = { reason: assessment.reason, dayNumber: assessment.dayNumber, window: assessment.window, gapDays: assessment.gapDays, at: now };
    }
  } else if (guest.kppSituation) {
    updates.kppSituation = deleteField();
  }
  await handleEmehmonFlag(guest.id, updates);
  return { parsed, assessment, kppDate };
}, [handleEmehmonFlag]);

// Единый разбор итога мастера прибытия — для местных и иностранцев, громко и тихо.
const finishAutoArrival = useCallback(async (guest, res, opts = {}) => {
  const st = res?.status;
  const silent = !!opts.silent;
  const now = new Date().toISOString();
  const name = guest?.fullName || '';
  if (st === 'done') {
    await handleEmehmonFlag(guest.id, {
      emehmonReg: true, emehmonRegAt: now, emehmonRegAuto: true,
      emehmonRegError: deleteField(), emehmonRegErrorAt: deleteField(), emehmonNoRoomAt: deleteField(),
      emehmonAmount: emehmonAmountFor(guest.country),
    });
    showNotification(t(silent ? 'emaRegisteredAuto' : 'emaRegistered').replace('{name}', name), 'success');
    return true;
  }
  if (st === 'need_login') { if (!silent) showNotification(t('emaLoginContinueReg'), 'info'); return false; }
  if (st === 'not_found') {
    await handleEmehmonFlag(guest.id, { emehmonRegError: REG_ERROR_TEXT, emehmonRegErrorAt: now });
    if (!isLocal(guest)) setKppFixPrompt({ guest, notFoundText: res?.notFoundText || '' });
    showNotification(t(silent ? 'emaNotInGovDb' : 'emaNotInGovDbManual').replace('{name}', name), 'warning');
    return false;
  }
  if (st === 'no_room') {
    // Комнату не сопоставили. Ошибку гостю не вешаем — ставим метку времени и
    // повторяем не раньше чем через несколько часов (раньше помнили только в RAM).
    emehmonNoRoomTried.current.add(guest.id);
    await handleEmehmonFlag(guest.id, { emehmonNoRoomAt: now });
    if (!silent) showNotification(t('emaRoomMismatch').replace('{name}', name), 'warning');
    return false;
  }
  if (st === 'no_citizen') {
    if (!silent) { showNotification(t('emaNoCitizenOption').replace('{country}', guest.country || ''), 'warning'); if (!isLocal(guest)) setEmehmonArrivalPrompt(guest); }
    return false;
  }
  if (st === 'step2_failed') {
    if (!silent) { showNotification(t('emaForeignStep2Fail').replace('{name}', name), 'warning'); if (!isLocal(guest)) setEmehmonArrivalPrompt(guest); }
    return false;
  }
  if (st === 'no_electron' || st === 'busy' || st === 'needs_decision') return false;
  if (!silent) showNotification(t('emaAutoRegNotDone').replace('{name}', name), 'error');
  return false;
}, [handleEmehmonFlag]); // eslint-disable-line react-hooks/exhaustive-deps

// Регистрация иностранца. За пределами окна мастер останавливается перед
// «Сохранить» и отдаёт список прошлых проживаний (needs_decision): если по
// нему разрыв допустим — сохраняем сами, иначе показываем окно «ситуация».
const runForeignRegistration = useCallback(async (guest, opts = {}) => {
  if (!guest?.id || !window.electronAPI?.emehmonArrivalAuto) return { status: 'no_electron' };
  if (emehmonAutoBusy.current.has(guest.id)) return { status: 'busy' };
  emehmonAutoBusy.current.add(guest.id);
  const silent = !!opts.silent;
  try {
    const today = todayIso();
    const win = getRegistrationWindow(guest.country);
    const dayNumber = guest.kppDate ? daysBetween(guest.kppDate, today) + 1 : 0;
    const gateStays = !opts.force && (!guest.kppDate || dayNumber > win);
    if (!silent) showNotification(t('emaRegistering').replace('{name}', guest.fullName), 'info');
    let res = await autoRegisterArrival(guest, { silent, gateStays, force: !!opts.force, quietFail: true });
    if (res?.status === 'needs_decision') {
      const { parsed, assessment, kppDate } = await applyProbeToGuest(guest, res);
      if (assessment?.ok) {
        // Разрыва нет (или судить не по чему) — сохраняем сами, вторым заходом.
        res = await autoRegisterArrival({ ...guest, kppDate }, { silent, gateStays: false, force: true, quietFail: true });
      } else {
        setKppSituation({ guest: { ...guest, kppDate }, assessment, stays: parsed?.stays || [] });
        if (!silent) showNotification(t('emaNeedsDecision').replace('{name}', guest.fullName), 'warning');
        return res;
      }
    } else if (res?.probe && !guest.kppDate && !isLocal(guest)) {
      await applyProbeToGuest(guest, res);
    }
    await finishAutoArrival(guest, res, { silent });
    return res;
  } finally {
    emehmonAutoBusy.current.delete(guest.id);
  }
}, [applyProbeToGuest, finishAutoArrival]); // eslint-disable-line react-hooks/exhaustive-deps

// Проверка иностранца в госбазе (без регистрации): дата КПП → карточка.
// Возвращает гостя с обновлённой датой или null, если продолжать нельзя.
const checkForeign = useCallback(async (guest, { silent = false } = {}) => {
  const now = new Date().toISOString();
  if (!silent) showNotification(t('emaCheckingGov').replace('{name}', guest.fullName), 'info');
  const res = await checkPassportInGov(guest);
  const st = res?.status;
  if (st === 'need_login') { if (!silent) showNotification(t('emaLoginContinueReg'), 'info'); return { guest: null, status: st }; }
  if (st === 'not_found') {
    await handleEmehmonFlag(guest.id, { emehmonRegError: REG_ERROR_TEXT, emehmonRegErrorAt: now });
    if (!silent) setKppFixPrompt({ guest, notFoundText: res?.notFoundText || '' });
    else showNotification(t('emaNotInGovDb').replace('{name}', guest.fullName), 'warning');
    return { guest: null, status: st };
  }
  if (st === 'no_citizen') {
    if (!silent) { showNotification(t('emaNoCitizenOption').replace('{country}', guest.country || ''), 'warning'); setEmehmonArrivalPrompt(guest); }
    return { guest: null, status: st };
  }
  if (st !== 'valid') {
    if (!silent) showNotification(t('emaGovCheckFail').replace('{name}', guest.fullName), 'warning');
    return { guest: null, status: st || 'error' };
  }
  const { kppDate } = await applyProbeToGuest(guest, res);
  if (!silent) {
    showNotification(kppDate ? t('emaKppFound').replace('{date}', fmtRu(kppDate)) : t('emaKppNotRecognized'), kppDate ? 'success' : 'warning');
  }
  return { guest: { ...guest, kppDate, kppCheckedAt: now }, status: 'valid' };
}, [applyProbeToGuest, handleEmehmonFlag]); // eslint-disable-line react-hooks/exhaustive-deps

// Иностранец при заселении / первой оплате: проверить в госбазе, взять дату
// КПП; регистрировать — после оплаты и не раньше предпоследнего дня окна.
const handleForeignArrival = useCallback(async (guest) => {
  if (!guest?.id) return;
  if (!window.electronAPI?.emehmonPassportCheck) { setEmehmonArrivalPrompt(guest); return; }
  if (foreignBusy.current.has(guest.id)) return;
  foreignBusy.current.add(guest.id);
  try {
    let g = guest;
    const fresh = g.kppCheckedAt && (Date.now() - new Date(g.kppCheckedAt).getTime() < 24 * HOURS);
    if (!fresh || !g.kppDate) {
      const r = await checkForeign(g);
      if (!r.guest) return;
      g = r.guest;
    }
    if (g.emehmonReg || g.emehmonSkip) return;
    if (!(paidOf(g) > 0)) return;                       // регистрация — после оплаты, позовут снова
    if (g.kppDate && !registrationDue({ country: g.country, kppDate: g.kppDate })) {
      const win = getRegistrationWindow(g.country);
      showNotification(t('emaAutoOnDay').replace('{name}', g.fullName).replace('{n}', Math.max(1, win - 1)), 'info');
      return;
    }
    await runForeignRegistration(g, { silent: false });
  } finally {
    foreignBusy.current.delete(guest.id);
  }
}, [checkForeign, runForeignRegistration]); // eslint-disable-line react-hooks/exhaustive-deps

// Кнопка «Проверить в госбазе» в карточке — только проверка и дата КПП.
const handleKppRecheck = useCallback(async (guest) => {
  if (!guest?.id) return;
  if (!window.electronAPI?.emehmonPassportCheck) { showNotification(t('emaDesktopOnly'), 'info'); return; }
  if (foreignBusy.current.has(guest.id)) return;
  foreignBusy.current.add(guest.id);
  try { await checkForeign(guest); } finally { foreignBusy.current.delete(guest.id); }
}, [checkForeign]); // eslint-disable-line react-hooks/exhaustive-deps

const handleEmehmonAutoArrivalRef = useRef(null);
// Кнопка «Оформить авто» в карточке: человек нажал — правило «предпоследний
// день» не применяем, но список отелей за пределами окна всё равно проверяем.
const handleRegisterAuto = useCallback(async (guest) => {
  if (!guest?.id) return;
  if (isLocal(guest)) { await handleEmehmonAutoArrivalRef.current(guest); return; }
  if (!window.electronAPI?.emehmonArrivalAuto) { showNotification(t('emaDesktopOnly'), 'info'); return; }
  let g = guest;
  if (!g.kppDate && window.electronAPI?.emehmonPassportCheck) {
    const r = await checkForeign(g);
    if (!r.guest) return;
    g = r.guest;
  }
  await runForeignRegistration(g, { silent: false });
}, [checkForeign, runForeignRegistration]); // eslint-disable-line react-hooks/exhaustive-deps
// Решение по «ситуации»: зарегистрировать всё равно / направить в миграционную
// службу / просто «понятно» (окно вернётся через несколько часов).
const handleSituationDecision = useCallback(async (guest, decision) => {
  if (!guest?.id) return;
  const now = new Date().toISOString();
  setKppSituation(null);
  if (decision === 'register') {
    await handleEmehmonFlag(guest.id, { kppSituationDecision: 'register', kppSituationAckAt: now });
    await runForeignRegistration(guest, { silent: false, force: true });
  } else if (decision === 'migration') {
    await handleEmehmonFlag(guest.id, { kppSituationDecision: 'migration', kppSituationAckAt: now, emehmonSkip: true, emehmonSkipAt: now });
    showNotification(t('kppMigrationMarked').replace('{name}', guest.fullName), 'info');
  } else {
    await handleEmehmonFlag(guest.id, { kppSituationAckAt: now });
  }
}, [handleEmehmonFlag, runForeignRegistration]); // eslint-disable-line react-hooks/exhaustive-deps

// ─── Добор «забытых»: местные и иностранцы, тихо, до 3 походов на портал ─────
// Раньше добор был приделан к успешной загрузке /listok и только по выбранному
// филиалу — при ошибке списка или на неоткрытом филиале гости просто ждали.
// Теперь: без списка тоже работает (но только по свежим заездам — чтобы не
// продублировать листок), а планировщик обходит все филиалы с учётками.
const runEmehmonCatchup = useCallback(async (hostelId, listOk, pSet, nSet) => {
  if (!window.electronAPI?.emehmonArrivalAuto) return;
  const norm = s => (s || '').replace(/\s/g, '').toUpperCase();
  const isReal = (g) => g.roomId !== 'DEBT_ONLY';
  const sameHostel = (g) => (g.hostelId || 'hostel1') === hostelId;
  const inCad = (g) => (cadastreRegs || []).some(r =>
    r.status !== 'removed' &&
    (r.guestId === g.id || (r.passport && g.passport && norm(r.passport) === norm(g.passport))));
  const inList = (g) => pSet.has(norm(g.passport)) || nSet.has(norm(g.fullName));
  const recent = (g) => g.checkInDate && (Date.now() - new Date(g.checkInDate).getTime()) < 2 * 24 * HOURS;
  const candidates = (guests || []).filter(g =>
    g.status === 'active' && isReal(g) && g.country &&
    !g.emehmonReg && !g.emehmonSkip && !g.emehmonRegError &&
    sameHostel(g) && paidOf(g) > 0 && !inCad(g) &&
    (listOk ? !inList(g) : (recent(g) && !g.emehmonRegAt)) &&
    shouldRetryNoRoom(g) && !emehmonNoRoomTried.current.has(g.id) &&
    !emehmonAutoBusy.current.has(g.id) && !foreignBusy.current.has(g.id) &&
    !(g.kppSituation && !g.kppSituationDecision)   // ждёт решения человека — не дёргаем портал
  );
  let trips = 0;
  const MAX_TRIPS = 3;
  for (const g of candidates) {
    if (trips >= MAX_TRIPS) break;
    if (isLocal(g)) {
      emehmonAutoBusy.current.add(g.id); trips++;
      try {
        const reg = await autoRegisterArrival(g, { silent: true });
        if (reg?.status === 'need_login') break;
        await finishAutoArrival(g, reg, { silent: true });
      } catch (_) { /* пропускаем */ } finally { emehmonAutoBusy.current.delete(g.id); }
      continue;
    }
    // Иностранец: сперва дата КПП (раз в сутки), затем регистрация в срок.
    let gg = g;
    // Подозрительная дата: «портальная» и совпадает с днём проверки — это дата
    // заезда, а не КПП (так читал первый вариант парсера). Перепроверяем сразу.
    const suspicious = g.kppSource === 'emehmon' && g.kppDate && g.kppCheckedAt &&
      String(g.kppDate).slice(0, 10) === String(g.kppCheckedAt).slice(0, 10);
    const stale = suspicious || !g.kppCheckedAt || (Date.now() - new Date(g.kppCheckedAt).getTime() > 24 * HOURS);
    if (stale || !g.kppDate) {
      if (!window.electronAPI?.emehmonPassportCheck) continue;
      foreignBusy.current.add(g.id); trips++;
      let r;
      try { r = await checkForeign(g, { silent: true }); } finally { foreignBusy.current.delete(g.id); }
      if (r.status === 'need_login') break;
      if (!r.guest) continue;
      gg = r.guest;
    }
    if (gg.kppDate && !registrationDue({ country: gg.country, kppDate: gg.kppDate })) continue;
    if (trips >= MAX_TRIPS) break;
    trips++;
    const res = await runForeignRegistration(gg, { silent: true });
    if (res?.status === 'need_login') break;
  }
}, [guests, cadastreRegs, finishAutoArrival, checkForeign, runForeignRegistration]); // eslint-disable-line react-hooks/exhaustive-deps

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

      // ── АВТО-ДОБОР «ЗАБЫТЫХ» (местные и иностранцы) — см. runEmehmonCatchup ──
      await runEmehmonCatchup(hostelId, true, pSet, nSet);
      if (manual) showNotification(t('emaSyncResult').replace('{marked}', toMark.length).replace('{out}', toMarkOut.length), 'success');
    } else if (res?.status === 'need_login') {
      patchEmehmon(hostelId, { status: 'need_login', at: Date.now() });
      if (manual) showNotification(t('emaLoginRepeat'), 'info');
    } else {
      patchEmehmon(hostelId, { status: 'error', at: Date.now() });
      if (manual) showNotification(t('emaListFail'), 'error');
      // Список не пришёл, но сам портал жив (не need_login): добор по свежим
      // заездам всё равно делаем — иначе одна ошибка списка стопорила регистрацию.
      await runEmehmonCatchup(hostelId, false, new Set(), new Set());
    }
  } finally {
    emehmonSyncBusy.current.delete(hostelId);
    patchEmehmon(hostelId, { syncing: false });
  }
}, [guests, registrations, cadastreRegs, currentUser, selectedHostelFilter, emehmonHostelId, patchEmehmon, runEmehmonCatchup]); // eslint-disable-line react-hooks/exhaustive-deps

// Стабильный планировщик: старт через 8с после входа + каждые 5 минут.
// Сначала текущий филиал, затем остальные с учётками портала — иначе «забытые»
// гости неоткрытого филиала ждали, пока кто-нибудь его выберет.
const emehmonSyncRef = useRef(runEmehmonSync);
useEffect(() => { emehmonSyncRef.current = runEmehmonSync; }, [runEmehmonSync]);
const emehmonHostelIdRef = useRef(emehmonHostelId);
useEffect(() => { emehmonHostelIdRef.current = emehmonHostelId; }, [emehmonHostelId]);
const emehmonAccountsRef = useRef({ at: 0, status: null });
useEffect(() => {
  if (!window.electronAPI?.emehmonList || !currentUser) return;
  let cancelled = false;
  const run = async () => {
    const cur = emehmonHostelIdRef.current;
    await emehmonSyncRef.current(false, cur);
    if (cancelled) return;
    // Учётки перечитываем раз в час — это один документ настроек.
    if (Date.now() - emehmonAccountsRef.current.at > 60 * 60 * 1000) {
      emehmonAccountsRef.current = { at: Date.now(), status: await getEmehmonStatus() };
    }
    const st = emehmonAccountsRef.current.status || {};
    for (const hid of Object.keys(st)) {
      if (cancelled) return;
      if (st[hid] && hid !== cur) await emehmonSyncRef.current(false, hid);
    }
  };
  const t = setTimeout(run, 8000);
  const iv = setInterval(run, 5 * 60 * 1000);
  return () => { cancelled = true; clearTimeout(t); clearInterval(iv); };
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

// Полная авто-регистрация прибытия (граждане Узбекистана), громко — при
// заселении/оплате и по кнопке. Итог разбирает общий finishAutoArrival.
const handleEmehmonAutoArrival = useCallback(async (guest) => {
  if (!guest || !window.electronAPI?.emehmonArrivalAuto) return;
  if (guest.id && emehmonAutoBusy.current.has(guest.id)) return; // уже регистрируется
  if (guest.id) emehmonAutoBusy.current.add(guest.id);
  showNotification(t('emaRegistering').replace('{name}', guest.fullName), 'info');
  let res;
  try { res = await autoRegisterArrival(guest); } finally { if (guest.id) emehmonAutoBusy.current.delete(guest.id); }
  await finishAutoArrival(guest, res, { silent: false });
}, [finishAutoArrival]); // eslint-disable-line react-hooks/exhaustive-deps
useEffect(() => { handleEmehmonAutoArrivalRef.current = handleEmehmonAutoArrival; }, [handleEmehmonAutoArrival]);

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
    // КПП иностранца: окна «исправьте данные» и «ситуация» + действия
    kppFixPrompt, setKppFixPrompt,
    kppSituation, setKppSituation,
    handleForeignArrival, handleKppRecheck, handleRegisterAuto, handleSituationDecision,
    // снимок портала по текущему филиалу
    emehmonHostelId, emehmonList, emehmonSnapshot, emehmonSyncing,
    // действия
    handleEmehmonFlag, handleEmehmonDepart, handleEmehmonDepartConfirm,
    handleEmehmonDone, handleEmehmonAutoArrival,
    handleDepartOutcome, runEmehmonSync, runEmehmonRecalc,
  };
}
