/**
 * useShiftActions — операции со сменами и пользователями.
 */
import {
  collection, doc, addDoc, updateDoc, deleteDoc, writeBatch, query, where, getDocs,
} from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { hashPassword } from '../utils/hash';
import { getConfig } from '../utils/appConfig';

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
  showNotification, onLogout,
}) {

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

  const handleStartShift = async (hostelIdOverride) => {
    if (!currentUser?.id) return;
    // БАГ-5 FIX: проверяем дубликат по обоим идентификаторам
    const active = shifts.find(s =>
      !s.endTime &&
      (s.staffId === currentUser.id || (s.staffLogin && s.staffLogin === currentUser.login))
    );
    if (active) return;
    const hostelId = hostelIdOverride || currentUser.hostelId;
    try {
      await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'), {
        staffId:    currentUser.id,
        staffLogin: currentUser.login || null,
        staffName:  currentUser.name  || null,
        hostelId,
        startTime: new Date().toISOString(),
        endTime: null,
      });
      showNotification('Смена начата', 'success');
    } catch (e) {
      console.error('Error starting shift:', e);
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
    onLogout();
  };

  const handleTransferShift = async (currentShiftId, targetUserId) => {
    if (!targetUserId) return;
    const targetUser = usersList.find(u => u.id === targetUserId);
    const batch = writeBatch(db);
    batch.update(doc(db, ...PUBLIC_DATA_PATH, 'shifts', currentShiftId), {
      endTime: new Date().toISOString(),
    });
    const newShiftRef = doc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'));
    // БАГ-2 FIX: добавляем staffLogin/staffName в новую смену
    batch.set(newShiftRef, {
      staffId:    targetUserId,
      staffLogin: targetUser?.login || null,
      staffName:  targetUser?.name  || null,
      hostelId:   targetUser ? targetUser.hostelId : currentUser.hostelId,
      startTime:  new Date().toISOString(),
      endTime:    null,
    });
    await batch.commit();
    showNotification('Shift Transferred');
  };

  const handleTransferToMe = async (shiftId) => {
    if (!currentUser) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, ...PUBLIC_DATA_PATH, 'shifts', shiftId), { endTime: new Date().toISOString() });
      const newShiftRef = doc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'));
      // БАГ-2 FIX: добавляем staffLogin/staffName
      batch.set(newShiftRef, {
        staffId:    currentUser.id,
        staffLogin: currentUser.login || null,
        staffName:  currentUser.name  || null,
        hostelId:   currentUser.hostelId,
        startTime:  new Date().toISOString(),
        endTime:    null,
      });
      await batch.commit();
      showNotification('Смена принята успешно!', 'success');
    } catch (e) {
      showNotification('Ошибка передачи смены: ' + e.message, 'error');
    }
  };

  const handleAdminAddShift = async (shiftData) => {
    const norm = (shiftData.startTime && shiftData.endTime)
      ? { ...shiftData, ...normalizeShiftTimes(shiftData.startTime, shiftData.endTime) }
      : shiftData;
    await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'), norm);
    showNotification('Смена добавлена вручную');
  };

  const handleAdminUpdateShift = async (id, data) => {
    const norm = (data.startTime && data.endTime)
      ? { ...data, ...normalizeShiftTimes(data.startTime, data.endTime) }
      : data;
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'shifts', id), norm);
    showNotification('Смена обновлена');
  };

  const handleAdminDeleteShift = async (id) => {
    try {
      await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'shifts', id));
      showNotification('Смена удалена', 'success');
    } catch (e) {
      showNotification('Ошибка удаления: ' + e.message, 'error');
    }
  };

  // ── Пользователи ─────────────────────────────────────────────────────────

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
      showNotification('Сотрудник обновлён', 'success');
    } catch (e) {
      showNotification('Ошибка: ' + e.message, 'error');
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
      showNotification('Сотрудник удалён', 'success');
    } catch (e) {
      showNotification('Ошибка: ' + e.message, 'error');
    }
  };

  const handleChangePassword = async (userId, newPassword) => {
    try {
      const hashed = await hashPassword(newPassword);
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'users', userId), { pass: hashed });
      const { pass: _p, ...sessionUser } = { ...currentUser };
      setCurrentUser({ ...currentUser });
      sessionStorage.setItem('hostella_user_v4', JSON.stringify(sessionUser));
      showNotification('Пароль успешно изменен!', 'success');
    } catch (e) {
      showNotification('Ошибка изменения пароля: ' + e.message, 'error');
    }
  };

  return {
    handleStartShift, handleEndShift,
    handleTransferShift, handleTransferToMe,
    handleAdminAddShift, handleAdminUpdateShift, handleAdminDeleteShift,
    handleAddUser, handleUpdateUser, handleDeleteUser,
    handleChangePassword,
  };
}
