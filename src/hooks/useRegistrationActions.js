/**
 * useRegistrationActions — операции с регистрациями E-mehmon.
 */
import { collection, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { sendTelegramMessage } from '../utils/telegram';
import { logAction } from '../utils/auditLog';
import { openEmehmonArrival } from '../utils/emehmon';

export function useRegistrationActions({
  currentUser, selectedHostelFilter, lang,
  setRegistrationModal, showNotification, guests,
}) {

  const handleRegistrationSubmit = async (formData) => {
    try {
      const safeStaffId = currentUser.id || currentUser.login || 'unknown';
      const targetHostelId = (!currentUser.hostelId || currentUser.hostelId === 'all')
        ? (selectedHostelFilter || 'hostel1')
        : currentUser.hostelId;

      const docRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'registrations'), {
        ...formData,
        hostelId: targetHostelId,
        staffId: safeStaffId,
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: currentUser.login || 'unknown',
      });

      const totalPaid = (formData.paidCash || 0) + (formData.paidCard || 0) + (formData.paidQR || 0);
      if (totalPaid > 0) {
        await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'payments'), {
          registrationId: docRef.id, guestId: docRef.id, staffId: safeStaffId,
          guestName: formData.fullName, amount: totalPaid,
          cash: formData.paidCash || 0, card: formData.paidCard || 0, qr: formData.paidQR || 0,
          date: new Date().toISOString(), type: 'income', category: 'registration',
          comment: `E-mehmon: ${formData.fullName} (${formData.startDate} – ${formData.endDate})`,
          hostelId: targetHostelId,
          method: [(formData.paidCash||0)>0,(formData.paidCard||0)>0,(formData.paidQR||0)>0].filter(Boolean).length>1 ? 'split' : (formData.paidCash||0)>0 ? 'cash' : (formData.paidCard||0)>0 ? 'card' : 'qr',
        });
      }

      setRegistrationModal(false);
      showNotification(
        lang === 'ru' ? 'Гость зарегистрирован в E-mehmon!' : "Mehmon E-mehmon'da ro'yxatga olindi!",
        'success'
      );

      // Открываем стандартное окно регистрации e-mehmon с автозаполнением из формы.
      // Комнату (нужна на шаге 3 мастера) берём у совпадающего активного гостя.
      if (window.electronAPI?.openEmehmon) {
        const norm0 = (s) => (s || '').replace(/\s/g, '').toUpperCase();
        const match = (guests || []).find(g =>
          g.status === 'active' && g.passport && formData.passport &&
          norm0(g.passport) === norm0(formData.passport));
        openEmehmonArrival({
          id: match?.id || '',
          fullName: formData.fullName,
          passport: formData.passport,
          birthDate: formData.birthDate,
          passportIssueDate: formData.passportIssueDate,
          country: formData.country,
          days: formData.days,
          roomNumber: match?.roomNumber || '',
          hostelId: targetHostelId,
        });
        showNotification(
          lang === 'ru' ? 'Открываю e-mehmon — нажмите «Заполнить из Hostella»' : 'E-mehmon ochilmoqda',
          'info'
        );
      }

      // Автоматически подтверждаем kppRegistered у совпадающего активного гостя
      if (formData.passport) {
        const norm = (s) => (s || '').replace(/\s/g, '').toUpperCase();
        const normalizedPassport = norm(formData.passport);
        const matchingGuests = (guests || []).filter(g =>
          g.status === 'active' &&
          g.passport &&
          norm(g.passport) === normalizedPassport &&
          !g.kppRegistered
        );
        for (const mg of matchingGuests) {
          try {
            await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', mg.id), {
              kppRegistered: true,
              kppRegisteredAt: new Date().toISOString(),
            });
          } catch (e) {
            console.warn('[kppRegistered] auto-confirm failed:', e.message);
          }
        }
      }
      logAction(currentUser, 'registration_add', { fullName: formData.fullName, passport: formData.passport, days: formData.days });
      sendTelegramMessage(
        `🪪 <b>Регистрация (E-mehmon)</b>\n👤 ${formData.fullName}\n🪪 ${formData.passport} · ${formData.country || ''}\n📅 ${formData.startDate} → ${formData.endDate} (${formData.days} дн.)\n💰 ${totalPaid.toLocaleString()} сум\n👷 ${currentUser.name || currentUser.login}`,
        'registration'
      );
    } catch (e) {
      console.error(e);
      showNotification('Ошибка регистрации: ' + e.message, 'error');
    }
  };

  const handleExtendRegistration = async (reg, extData) => {
    try {
      const safeStaffId = currentUser.id || currentUser.login || 'unknown';
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'registrations', reg.id), {
        endDate: extData.newEndDate,
        days: (reg.days || 0) + extData.days,
        status: 'active',
      });
      if (extData.amount > 0) {
        await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'payments'), {
          registrationId: reg.id, guestId: reg.id, staffId: safeStaffId,
          guestName: reg.fullName, amount: extData.amount,
          cash: extData.paidCash || 0, card: extData.paidCard || 0, qr: extData.paidQR || 0,
          date: new Date().toISOString(), type: 'income', category: 'registration',
          comment: `E-mehmon продление: ${reg.fullName} (+${extData.days} дн. → ${extData.newEndDate})`,
          hostelId: reg.hostelId,
          method: [(extData.paidCash||0)>0,(extData.paidCard||0)>0,(extData.paidQR||0)>0].filter(Boolean).length>1 ? 'split' : (extData.paidCash||0)>0 ? 'cash' : (extData.paidCard||0)>0 ? 'card' : 'qr',
        });
      }
      showNotification(
        lang === 'ru'
          ? `Регистрация продлена до ${extData.newEndDate}`
          : `Ro'yxat ${extData.newEndDate} gacha uzaytirildi`,
        'success'
      );
      logAction(currentUser, 'registration_extend', { id: reg.id, fullName: reg.fullName, newEndDate: extData.newEndDate });
      sendTelegramMessage(
        `🔄 <b>Продление регистрации (E-mehmon)</b>\n👤 ${reg.fullName}\n🪪 ${reg.passport || '—'}\n📅 +${extData.days} дн. → ${extData.newEndDate}\n💰 ${extData.amount.toLocaleString()} сум\n👷 ${currentUser.name || currentUser.login}`,
        'registrationExtend'
      );
    } catch (e) {
      showNotification('Ошибка продления: ' + e.message, 'error');
    }
  };

  const handleRemoveFromEmehmon = async (reg) => {
    const confirmMsg = lang === 'ru'
      ? `Подтвердить вывод "${reg.fullName}" из E-mehmon?`
      : `"${reg.fullName}" ni E-mehmondan chiqarishni tasdiqlaysizmi?`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'registrations', reg.id), {
        status: 'removed',
        removedAt: new Date().toISOString(),
        removedBy: currentUser.login || currentUser.id,
      });
      showNotification(
        lang === 'ru' ? `${reg.fullName} выведен из E-mehmon` : `${reg.fullName} E-mehmondan chiqarildi`,
        'success'
      );
      logAction(currentUser, 'registration_remove', { id: reg.id, fullName: reg.fullName });
      sendTelegramMessage(
        `🔴 <b>Вывод из E-mehmon</b>\n👤 ${reg.fullName}\n🪪 ${reg.passport || '—'}\n👷 ${currentUser.name || currentUser.login}`,
        'registrationRemove'
      );
    } catch (e) {
      showNotification('Ошибка: ' + e.message, 'error');
    }
  };

  const handleDeleteRegistration = async (reg) => {
    const confirmMsg = lang === 'ru'
      ? `Удалить запись регистрации "${reg.fullName}"?`
      : `"${reg.fullName}" ro'yxatini o'chirishni tasdiqlaysizmi?`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'registrations', reg.id));
      showNotification(lang === 'ru' ? 'Запись удалена' : "Yozuv o'chirildi", 'success');
    } catch (e) {
      showNotification('Ошибка удаления: ' + e.message, 'error');
    }
  };

  return {
    handleRegistrationSubmit,
    handleExtendRegistration,
    handleRemoveFromEmehmon,
    handleDeleteRegistration,
  };
}
