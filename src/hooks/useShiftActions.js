/**
 * useShiftActions — операции со сменами и пользователями.
 */
import {
  collection, doc, addDoc, updateDoc, deleteDoc, writeBatch, query, where, getDocs,
} from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { hashPassword } from '../utils/hash';

export function useShiftActions({
  currentUser, setCurrentUser,
  usersList, shifts,
  showNotification, onLogout,
}) {

  // ── Смены ────────────────────────────────────────────────────────────────

  const handleStartShift = async (hostelIdOverride) => {
    if (!currentUser?.id) return;
    const active = shifts.find(s => s.staffId === currentUser.id && !s.endTime);
    if (active) return;
    const hostelId = hostelIdOverride || currentUser.hostelId;
    try {
      await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'), {
        staffId:   currentUser.id,
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
      for (const d of snap1.docs) await updateDoc(d.ref, { endTime: now });

      // Попытка 2: если freshUserDoc имеет другой id — закрыть смены и по нему
      if (freshUserDoc && freshUserDoc.id !== currentUser.id) {
        const q2 = query(
          collection(db, ...PUBLIC_DATA_PATH, 'shifts'),
          where('staffId', '==', freshUserDoc.id),
          where('endTime', '==', null)
        );
        const snap2 = await getDocs(q2);
        for (const d of snap2.docs) await updateDoc(d.ref, { endTime: now });
      }
    } catch (e) {
      // Fallback: ищем в React-стейте по id или login
      const myOpenShifts = shifts.filter(s =>
        (s.staffId === currentUser.id || (s.staffLogin && s.staffLogin === login) ||
         (freshUserDoc && s.staffId === freshUserDoc.id)) && !s.endTime
      );
      for (const s of myOpenShifts) {
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'shifts', s.id), { endTime: now });
      }
    }
    onLogout();
  };

  const handleTransferShift = async (currentShiftId, targetUserId) => {
    if (!targetUserId) return;
    const batch = writeBatch(db);
    batch.update(doc(db, ...PUBLIC_DATA_PATH, 'shifts', currentShiftId), {
      endTime: new Date().toISOString(),
    });
    const targetUser = usersList.find(u => u.id === targetUserId);
    const newShiftRef = doc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'));
    batch.set(newShiftRef, {
      staffId: targetUserId,
      hostelId: targetUser ? targetUser.hostelId : currentUser.hostelId,
      startTime: new Date().toISOString(),
      endTime: null,
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
      batch.set(newShiftRef, {
        staffId: currentUser.id,
        hostelId: currentUser.hostelId,
        startTime: new Date().toISOString(),
        endTime: null,
      });
      await batch.commit();
      showNotification('Смена принята успешно!', 'success');
    } catch (e) {
      showNotification('Ошибка передачи смены: ' + e.message, 'error');
    }
  };

  const handleAdminAddShift = async (shiftData) => {
    await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'), shiftData);
    showNotification('Смена добавлена вручную');
  };

  const handleAdminUpdateShift = async (id, data) => {
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'shifts', id), data);
    showNotification('Смена обновлена');
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
      // Закрываем все открытые смены перед удалением, иначе открытая смена заблокирует вход другим кассирам
      const now = new Date().toISOString();
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
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'users', userId), { pass: newPassword });
      const { pass: _p, ...sessionUser } = { ...currentUser, pass: newPassword };
      setCurrentUser({ ...currentUser, pass: newPassword });
      sessionStorage.setItem('hostella_user_v4', JSON.stringify(sessionUser));
      showNotification('Пароль успешно изменен!', 'success');
    } catch (e) {
      showNotification('Ошибка изменения пароля: ' + e.message, 'error');
    }
  };

  return {
    handleStartShift, handleEndShift,
    handleTransferShift, handleTransferToMe,
    handleAdminAddShift, handleAdminUpdateShift,
    handleAddUser, handleUpdateUser, handleDeleteUser,
    handleChangePassword,
  };
}
