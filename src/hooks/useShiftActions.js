/**
 * useShiftActions — операции со сменами и пользователями.
 */
import {
  collection, doc, addDoc, updateDoc, deleteDoc, writeBatch,
} from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { hashPassword } from '../utils/hash';

export function useShiftActions({
  currentUser, setCurrentUser,
  usersList, shifts,
  showNotification, onLogout,
}) {

  // ── Смены ────────────────────────────────────────────────────────────────

  const handleStartShift = async () => {
    if (!currentUser?.id) return;
    const active = shifts.find(s => s.staffId === currentUser.id && !s.endTime);
    if (active) return;
    try {
      await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'), {
        staffId: currentUser.id,
        hostelId: currentUser.hostelId,
        startTime: new Date().toISOString(),
        endTime: null,
      });
      showNotification('Смена начата', 'success');
    } catch (e) {
      console.error('Error starting shift:', e);
    }
  };

  const handleEndShift = async () => {
    if (currentUser?.id) {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'users', currentUser.id), {
        lastShiftEnd: new Date().toISOString(),
      });
    }
    const myOpenShift = shifts.find(s => s.staffId === currentUser.id && !s.endTime);
    if (myOpenShift) {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'shifts', myOpenShift.id), {
        endTime: new Date().toISOString(),
      });
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
      if (d.pass) payload.pass = await hashPassword(d.pass);
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'users', id), payload);
      if (currentUser?.id === id) {
        const updatedUser = { ...currentUser, ...payload };
        setCurrentUser(updatedUser);
        sessionStorage.setItem('hostella_user_v4', JSON.stringify(updatedUser));
      }
      showNotification('Сотрудник обновлён', 'success');
    } catch (e) {
      showNotification('Ошибка: ' + e.message, 'error');
    }
  };

  const handleDeleteUser = async (id) => {
    try {
      await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'users', id));
      showNotification('Сотрудник удалён', 'success');
    } catch (e) {
      showNotification('Ошибка: ' + e.message, 'error');
    }
  };

  const handleChangePassword = async (userId, newPassword) => {
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'users', userId), { pass: newPassword });
      const updatedUser = { ...currentUser, pass: newPassword };
      setCurrentUser(updatedUser);
      sessionStorage.setItem('hostella_user_v4', JSON.stringify(updatedUser));
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
