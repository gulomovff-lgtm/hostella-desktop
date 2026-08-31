/**
 * useShiftActions — операции со сменами и пользователями.
 */
import {
  collection, doc, addDoc, updateDoc, deleteDoc, writeBatch, query, where, getDocs,
  runTransaction, getDoc, deleteField,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, PUBLIC_DATA_PATH } from '../firebase';
import { hashPassword } from '../utils/hash';
import { getConfig } from '../utils/appConfig';
import { logAction } from '../utils/auditLog';
import TRANSLATIONS from '../constants/translations';

// Доля суток (и ЗП) у части разделённой смены: передача и админ-деление — всегда 50/50.
export const SHARE_HALF = 0.5;

// Замок открытой смены по хостелам: { hostel1: {shiftId, staffId, staffLogin, staffName, startTime} }.
// Нужен, чтобы два кассира не открыли смену одновременно с разных устройств:
// локального списка shifts для этого мало — он приходит с задержкой.
// Замок самовосстанавливается: если смена в нём уже закрыта, он считается свободным.
const shiftLockRef = () => doc(db, ...PUBLIC_DATA_PATH, 'settings', 'shiftLocks');

// Один и тот же сотрудник? staffId у пользователя может смениться (документ пересоздавали),
// поэтому login — более надёжный идентификатор.
const isSameStaff = (a, b) =>
  !!a && !!b && (
    (a.staffId && a.staffId === b.staffId) ||
    (a.staffLogin && a.staffLogin === b.staffLogin)
  );

// Смена дольше 6 часов всегда считается полными сутками: с 9:00 до следующего 9:00.
// Возвращает нормализованные времена (или исходные для коротких смен < 6ч).
export const SHIFT_DAY_HOUR = 9;
export const MIN_FULL_SHIFT_H = 6;
export const normalizeShiftTimes = (startISO, endISO) => {
  if (!startISO || !endISO) return { startTime: startISO, endTime: endISO };
  const cfg = getConfig();
  const dayHour = Number.isFinite(cfg.shiftDayHour) ? cfg.shiftDayHour : SHIFT_DAY_HOUR;
  const minFull = Number.isFinite(cfg.minFullShiftHours) ? cfg.minFullShiftHours : MIN_FULL_SHIFT_H;
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (isNaN(start) || isNaN(end)) return { startTime: startISO, endTime: endISO };
  const durH = (end - start) / 3600000;
  if (!(durH > minFull)) return { startTime: startISO, endTime: endISO };
  // Сутки привязываются к ДНЮ СТАРТА: <dayHour>:00 дня начала → следующий день.
  const s = new Date(start);
  s.setHours(dayHour, 0, 0, 0);
  const e = new Date(s); e.setDate(e.getDate() + 1);
  return { startTime: s.toISOString(), endTime: e.toISOString() };
};

export function useShiftActions({
  currentUser, setCurrentUser,
  usersList, shifts, payments = [],
  showNotification, onLogout, lang = 'ru',
}) {
  const t = k => TRANSLATIONS[lang]?.[k] || k;

  // Была ли оплата во время смены (по staffId/staffLogin в окне смены)
  const shiftHadPayment = (shiftDoc) => {
    const st = new Date(shiftDoc.startTime).getTime();
    const en = Date.now();
    return payments.some(p => {
      if (p.type === 'cash_to_terminal') return false;
      const sid = p.staffId;
      const match = sid === shiftDoc.staffId || (shiftDoc.staffLogin && sid === shiftDoc.staffLogin);
      if (!match) return false;
      const pt = new Date(p.date || p.timestamp || 0).getTime();
      return pt >= st && pt <= en;
    });
  };
  // Закрыть смену: если короче 1 часа и без оплаты — не сохраняем (удаляем).
  const MIN_SAVE_H = 1;
  const closeShiftDoc = async (ref, data, now) => {
    const durH = (Date.now() - new Date(data.startTime).getTime()) / 3600000;
    if (durH < MIN_SAVE_H && !shiftHadPayment(data)) {
      await deleteDoc(ref);
    } else {
      await updateDoc(ref, normalizeShiftTimes(data.startTime, now));
    }
  };

  // ── Смены ────────────────────────────────────────────────────────────────

  const me = () => ({
    staffId:    currentUser?.id || null,
    staffLogin: currentUser?.login || null,
    staffName:  currentUser?.name  || null,
  });

  // Снять замки, оставшиеся за текущим кассиром (после закрытия его смен).
  const clearMyShiftLocks = async () => {
    try {
      const snap = await getDoc(shiftLockRef());
      if (!snap.exists()) return;
      const updates = {};
      Object.entries(snap.data()).forEach(([hostelId, lock]) => {
        if (lock && isSameStaff(lock, me())) updates[hostelId] = deleteField();
      });
      if (Object.keys(updates).length) await updateDoc(shiftLockRef(), updates);
    } catch {
      // не критично: замок сам считается свободным, когда его смена закрыта
    }
  };

  const handleStartShift = async (hostelIdOverride) => {
    if (!currentUser?.id) return;
    // БАГ-5 FIX: проверяем дубликат по обоим идентификаторам
    const active = shifts.find(s => !s.endTime && isSameStaff(s, me()));
    if (active) return;
    const hostelId = hostelIdOverride || currentUser.hostelId;
    // Быстрая локальная проверка: смена другого кассира уже открыта в этом хостеле.
    // (учитываем только смены существующих пользователей — как и авто-старт)
    const otherOpen = shifts.find(s =>
      s.hostelId === hostelId &&
      !s.endTime &&
      !isSameStaff(s, me()) &&
      usersList.some(u => u.id === s.staffId || (s.staffLogin && u.login === s.staffLogin))
    );
    if (otherOpen) {
      const owner = usersList.find(u => u.id === otherOpen.staffId || (otherOpen.staffLogin && u.login === otherOpen.staffLogin));
      showNotification(
        t('shaShiftOccupied').replace('{name}', owner?.name || otherOpen.staffName || t('shaOtherCashier')),
        'error'
      );
      return;
    }
    try {
      // Транзакция на замке хостела: страхует от одновременного старта с двух устройств,
      // когда локальный список shifts ещё не успел обновиться у обоих.
      await runTransaction(db, async (tx) => {
        const lockSnap = await tx.get(shiftLockRef());
        const lock = lockSnap.exists() ? (lockSnap.data()[hostelId] || null) : null;
        if (lock?.shiftId && !isSameStaff(lock, me())) {
          const otherSnap = await tx.get(doc(db, ...PUBLIC_DATA_PATH, 'shifts', lock.shiftId));
          if (otherSnap.exists() && !otherSnap.data().endTime) {
            const err = new Error('SHIFT_OCCUPIED');
            err.occupiedBy = lock.staffName || t('shaOtherCashier');
            throw err;
          }
        }
        const startTime = new Date().toISOString();
        const newRef = doc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'));
        tx.set(newRef, { ...me(), hostelId, startTime, endTime: null });
        tx.set(shiftLockRef(), { [hostelId]: { ...me(), shiftId: newRef.id, startTime } }, { merge: true });
      });
      showNotification(t('shaShiftStarted'), 'success');
    } catch (e) {
      if (e?.message === 'SHIFT_OCCUPIED') {
        showNotification(
          t('shaShiftOccupied').replace('{name}', e.occupiedBy),
          'error'
        );
        return;
      }
      // Нет связи — транзакция невозможна, но кассир не должен остаться без смены.
      // Чужую открытую смену уже отсекла локальная проверка выше.
      console.warn('[shift] транзакция не прошла, открываем смену напрямую:', e?.message);
      addDoc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'), {
        ...me(), hostelId, startTime: new Date().toISOString(), endTime: null,
      }).catch(err => console.error('Error starting shift:', err));
      showNotification(t('shaShiftStartedOffline'), 'warning');
    }
  };

  const handleEndShift = async () => {
    const now = new Date().toISOString();

    // Находим актуальный документ пользователя по login (стабильный идентификатор),
    // т.к. Firestore document ID мог смениться после редактирования настроек пользователя.
    const freshUserDoc = usersList.find(u => u.login === currentUser.login);
    const targetDocId  = freshUserDoc?.id || currentUser.id;

    if (targetDocId) {
      // forceLogoutAfter вызывает авто-логаут на ВСЕХ вкладках/устройствах этого кассира
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'users', targetDocId), {
        lastShiftEnd:     now,
        forceLogoutAfter: now,
      });
    }

    // Закрываем смены по обоим возможным staffId (старый и новый) + по staffLogin
    const login = currentUser.login;
    try {
      // Попытка 1: по текущему currentUser.id
      const q1 = query(
        collection(db, ...PUBLIC_DATA_PATH, 'shifts'),
        where('staffId', '==', currentUser.id),
        where('endTime', '==', null)
      );
      const snap1 = await getDocs(q1);
      for (const d of snap1.docs) await closeShiftDoc(d.ref, d.data(), now);

      // Попытка 2: если freshUserDoc имеет другой id — закрыть смены и по нему
      if (freshUserDoc && freshUserDoc.id !== currentUser.id) {
        const q2 = query(
          collection(db, ...PUBLIC_DATA_PATH, 'shifts'),
          where('staffId', '==', freshUserDoc.id),
          where('endTime', '==', null)
        );
        const snap2 = await getDocs(q2);
        for (const d of snap2.docs) await closeShiftDoc(d.ref, d.data(), now);
      }
    } catch (e) {
      // Fallback: ищем в React-стейте по id или login
      const myOpenShifts = shifts.filter(s =>
        (s.staffId === currentUser.id || (s.staffLogin && s.staffLogin === login) ||
         (freshUserDoc && s.staffId === freshUserDoc.id)) && !s.endTime
      );
      for (const s of myOpenShifts) {
        await closeShiftDoc(doc(db, ...PUBLIC_DATA_PATH, 'shifts', s.id), s, now);
      }
    }
    await clearMyShiftLocks();
    onLogout();
  };

  /**
   * Передать смену другому кассиру (подмена).
   * Смена делится 50/50: обе части получают shareRatio = 0.5, поэтому и сутки,
   * и ЗП считаются как половина смены каждому — независимо от фактических часов.
   * Передавший выходит из системы: принявший работает под своим аккаунтом.
   *
   * @param {object} opening — итоги смены на момент передачи (наличные, терминал, QR,
   *   перечисления, возвраты, расходы). Сутки не закончены и касса не сдавалась, поэтому
   *   вся смена переходит принимающему: он закроет её одним общим отчётом за сутки.
   */
  const handleTransferShift = async (currentShiftId, targetUserId, opening = null) => {
    if (!targetUserId) return;
    const targetUser = usersList.find(u => u.id === targetUserId);
    if (!targetUser) { showNotification(t('shaCashierNotFound'), 'error'); return; }
    const shift = shifts.find(s => s.id === currentShiftId);
    if (!shift) { showNotification(t('shaShiftNotFound'), 'error'); return; }
    if (shift.endTime) { showNotification(t('shaShiftAlreadyClosed'), 'error'); return; }

    const now = new Date().toISOString();
    const hostelId = shift.hostelId || currentUser.hostelId;
    const groupId  = shift.shareGroupId || `sh_${currentShiftId}`;
    const fromName = shift.staffName || currentUser.name || currentUser.login || null;
    const toName   = targetUser.name || targetUser.login || null;

    try {
      const batch = writeBatch(db);
      const num = (v) => Math.max(0, parseInt(v) || 0);
      const carried = {
        cash:     num(opening?.cash),
        card:     num(opening?.card),
        qr:       num(opening?.qr),
        transfer: num(opening?.transfer),
        transferByEntity: opening?.transferByEntity || {},
        refunds:  num(opening?.refunds),
        expenses: num(opening?.expenses),
      };
      // Наличные на руках = наличные минус расходы из кассы (то, что физически передаётся)
      const handedCash = Math.max(0, carried.cash - carried.expenses);
      batch.update(doc(db, ...PUBLIC_DATA_PATH, 'shifts', currentShiftId), {
        endTime:      now,
        shareRatio:   SHARE_HALF,
        shareGroupId: groupId,
        handedToId:   targetUser.id,
        handedToName: toName,
        handedCash,               // сколько наличных ушло напарнику вместе со сменой
      });
      const newShiftRef = doc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'));
      // БАГ-2 FIX: добавляем staffLogin/staffName в новую смену
      batch.set(newShiftRef, {
        staffId:        targetUser.id,
        staffLogin:     targetUser.login || null,
        staffName:      targetUser.name  || null,
        hostelId,
        startTime:      now,
        endTime:        null,
        shareRatio:     SHARE_HALF,
        shareGroupId:   groupId,
        handedFromId:   shift.staffId || currentUser.id,
        handedFromName: fromName,
        opening:        carried,      // смена не закрывается — все итоги переходят принявшему
        openingFrom:    fromName,
      });
      // Замок хостела переходит принимающему — иначе он не сможет открыть свою смену
      batch.set(shiftLockRef(), {
        [hostelId]: {
          staffId: targetUser.id, staffLogin: targetUser.login || null,
          staffName: targetUser.name || null, shiftId: newShiftRef.id, startTime: now,
        },
      }, { merge: true });
      await batch.commit();

      logAction(currentUser, 'shift_transfer', { to: toName, hostelId, shiftId: currentShiftId, cash: handedCash });

      // Передавший больше не на смене — разлогиниваем его на всех устройствах,
      // чтобы дальше работали строго под аккаунтом принявшего.
      const freshUserDoc = usersList.find(u => u.login === currentUser.login);
      const targetDocId  = freshUserDoc?.id || currentUser.id;
      if (targetDocId) {
        try {
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'users', targetDocId), {
            lastShiftEnd: now, forceLogoutAfter: now,
          });
        } catch { /* не блокируем передачу из-за этого */ }
      }
      showNotification(
        t('shaShiftTransferred')
          .replace('{name}', toName)
          .replace('{cash}', handedCash.toLocaleString('ru-RU')),
        'success'
      );
      onLogout();
    } catch (e) {
      showNotification(t('shaTransferError') + e.message, 'error');
    }
  };

  /**
   * Админ: разделить уже отработанную смену 50/50 с другим кассиром.
   * Исходная смена помечается долей 0.5, напарнику создаётся такая же половина
   * с теми же временами (splitFrom — чтобы деление можно было отменить одним кликом).
   */
  const handleAdminSplitShift = async (shift, partnerId) => {
    const partner = usersList.find(u => u.id === partnerId);
    if (!shift || !partner) { showNotification(t('shaSelectCashierToSplit'), 'error'); return; }
    if (isSameStaff(shift, { staffId: partner.id, staffLogin: partner.login })) {
      showNotification(t('shaCannotSplitSameCashier'), 'error');
      return;
    }
    const groupId = shift.shareGroupId || `sh_${shift.id}`;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, ...PUBLIC_DATA_PATH, 'shifts', shift.id), {
        shareRatio:     SHARE_HALF,
        shareGroupId:   groupId,
        sharedWithName: partner.name || partner.login || null,
      });
      const partRef = doc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'));
      batch.set(partRef, {
        staffId:        partner.id,
        staffLogin:     partner.login || null,
        staffName:      partner.name  || null,
        hostelId:       shift.hostelId || null,
        startTime:      shift.startTime,
        endTime:        shift.endTime || null,
        shareRatio:     SHARE_HALF,
        shareGroupId:   groupId,
        splitFrom:      shift.id,
        sharedWithName: shift.staffName || null,
      });
      await batch.commit();
      logAction(currentUser, 'shift_split', {
        shiftId: shift.id, with: partner.name || partner.login, startTime: shift.startTime,
      });
      showNotification(t('shaShiftSplit5050').replace('{name}', partner.name || partner.login), 'success');
    } catch (e) {
      showNotification(t('shaSplitError') + e.message, 'error');
    }
  };

  /** Админ: отменить деление — удалить созданную половину и вернуть смену целиком. */
  const handleAdminUnsplitShift = async (shift) => {
    if (!shift?.shareGroupId) return;
    const parts  = shifts.filter(s => s.shareGroupId === shift.shareGroupId);
    const base   = parts.find(s => !s.splitFrom) || shift;
    const clones = parts.filter(s => s.splitFrom === base.id);
    if (!clones.length) {
      showNotification(t('shaCannotUnsplitTransfer'), 'error');
      return;
    }
    try {
      const batch = writeBatch(db);
      clones.forEach(c => batch.delete(doc(db, ...PUBLIC_DATA_PATH, 'shifts', c.id)));
      batch.update(doc(db, ...PUBLIC_DATA_PATH, 'shifts', base.id), {
        shareRatio: deleteField(), shareGroupId: deleteField(), sharedWithName: deleteField(),
      });
      await batch.commit();
      logAction(currentUser, 'shift_unsplit', { shiftId: base.id });
      showNotification(t('alShiftUnsplit'), 'success');
    } catch (e) {
      showNotification(t('shaUnsplitError') + e.message, 'error');
    }
  };

  const handleAdminAddShift = async (shiftData) => {
    const norm = (shiftData.startTime && shiftData.endTime)
      ? { ...shiftData, ...normalizeShiftTimes(shiftData.startTime, shiftData.endTime) }
      : shiftData;
    await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'), norm);
    showNotification(t('shaShiftAddedManually'));
  };

  const handleAdminUpdateShift = async (id, data) => {
    const norm = (data.startTime && data.endTime)
      ? { ...data, ...normalizeShiftTimes(data.startTime, data.endTime) }
      : data;
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'shifts', id), norm);
    showNotification(t('shaShiftUpdated'));
  };

  const handleAdminDeleteShift = async (id) => {
    try {
      await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'shifts', id));
      showNotification(t('shaShiftDeleted'), 'success');
    } catch (e) {
      showNotification(t('shaDeleteError') + e.message, 'error');
    }
  };

  // ── Пользователи ─────────────────────────────────────────────────────────
  //
  // Пароль нового/отредактированного сотрудника админ задаёт как раньше — в users.pass.
  // При первом входе Cloud Function authenticateUser примет его, перехеширует в PBKDF2
  // и положит в закрытую коллекцию userSecrets. Так админу не нужно подтверждать
  // операцию своим паролем, а секрет всё равно переезжает в защищённое хранилище.

  const handleAddUser = async (d) => {
    const hashed = await hashPassword(d.pass);
    await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'users'), { ...d, pass: hashed });
  };

  const handleUpdateUser = async (id, d) => {
    try {
      const payload = { ...d };
      if (d.pass) {
        payload.pass = await hashPassword(d.pass);
      } else {
        delete payload.pass; // пароль не менялся — не перезаписываем существующий
      }
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'users', id), payload);
      if (currentUser?.id === id) {
        const { pass: _p, ...updatedUser } = { ...currentUser, ...payload };
        setCurrentUser({ ...currentUser, ...payload });
        sessionStorage.setItem('hostella_user_v4', JSON.stringify(updatedUser));
      }
      showNotification(t('shaStaffUpdated'), 'success');
    } catch (e) {
      showNotification(t('shaErrorPrefix') + e.message, 'error');
    }
  };

  const handleDeleteUser = async (id) => {
    try {
      const now = new Date().toISOString();
      // БАГ-3 FIX: ставим forceLogoutAfter ДО удаления — оставшиеся сессии получат force-logout
      // Авто-логаут по исчезновению документа сработает в App.jsx (БАГ-4 FIX)
      try {
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'users', id), { forceLogoutAfter: now });
      } catch { /* silent — док может уже не существовать */ }
      // Закрываем все открытые смены перед удалением
      const openShifts = shifts.filter(s => s.staffId === id && !s.endTime);
      for (const s of openShifts) {
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'shifts', s.id), { endTime: now });
      }
      await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'users', id));
      showNotification(t('shaStaffDeleted'), 'success');
    } catch (e) {
      showNotification(t('shaErrorPrefix') + e.message, 'error');
    }
  };

  /**
   * Смена своего пароля. Текущий пароль проверяет Cloud Function — клиент хеши
   * больше не хранит и не сверяет.
   * Легаси-поле users.pass пока обновляем тоже: кассы обновляются не мгновенно,
   * старым сборкам оно ещё нужно для входа (удалим отдельным релизом).
   */
  const handleChangePassword = async (userId, newPassword, oldPassword) => {
    try {
      const setPassword = httpsCallable(functions, 'setUserPassword');
      await setPassword({
        userId,
        newPassword,
        actorLogin: currentUser.login,
        actorPassword: oldPassword,
      });
      // Пароль уже сохранён на сервере в закрытой userSecrets (PBKDF2). Больше НЕ
      // дублируем читаемый users.pass — именно из него аноним крал/перебирал хеши.
      const { pass: _p, ...sessionUser } = { ...currentUser };
      setCurrentUser({ ...currentUser });
      sessionStorage.setItem('hostella_user_v4', JSON.stringify(sessionUser));
      showNotification(t('shaPasswordChanged'), 'success');
    } catch (e) {
      const msg = e?.message || t('shaFailed');
      showNotification(t('shaPasswordChangeError') + msg, 'error');
      throw new Error(msg);
    }
  };

  return {
    handleStartShift, handleEndShift,
    handleTransferShift,
    handleAdminSplitShift, handleAdminUnsplitShift,
    handleAdminAddShift, handleAdminUpdateShift, handleAdminDeleteShift,
    handleAddUser, handleUpdateUser, handleDeleteUser,
    handleChangePassword,
  };
}
