/**
 * useCadastreActions вЂ” РєР°РґР°СЃС‚СЂ-СЂРµРіРёСЃС‚СЂР°С†РёСЏ РіРѕСЃС‚РµР№ РІ С‡Р°СЃС‚РЅС‹С… РґРѕРјР°С….
 */
import { collection, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { logAction } from '../utils/auditLog';
import { sendTelegramMessage } from '../utils/telegram';

const HOSTEL_LABEL = { hostel1: 'Хостел №1', hostel2: 'Хостел №2' };

export function useCadastreActions({
  currentUser, selectedHostelFilter,
  showNotification, tgSettings, isOnline,
}) {

  const targetHostel = () =>
    (!currentUser.hostelId || currentUser.hostelId === 'all')
      ? (selectedHostelFilter || 'hostel1')
      : currentUser.hostelId;

  // в”Ђв”Ђв”Ђ РЈРїСЂР°РІР»РµРЅРёРµ РєР°РґР°СЃС‚СЂР°РјРё (С‡Р°СЃС‚РЅС‹РјРё РґРѕРјР°РјРё) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

  const handleAddCadastre = async (data) => {
    try {
      await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'cadastres'), {
        ...data,
        hostelId: data.hostelId || targetHostel(),
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.login,
      });
      showNotification('РљР°РґР°СЃС‚СЂ РґРѕР±Р°РІР»РµРЅ', 'success');
      logAction(currentUser, 'cadastre_add', { name: data.name, address: data.address });
    } catch (e) {
      showNotification('РћС€РёР±РєР°: ' + e.message, 'error');
    }
  };

  const handleUpdateCadastre = async (id, data) => {
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'cadastres', id), data);
      showNotification('РљР°РґР°СЃС‚СЂ РѕР±РЅРѕРІР»С‘РЅ', 'success');
      logAction(currentUser, 'cadastre_update', { id });
    } catch (e) {
      showNotification('РћС€РёР±РєР°: ' + e.message, 'error');
    }
  };

  const handleDeleteCadastre = async (id) => {
    if (!window.confirm('РЈРґР°Р»РёС‚СЊ СЌС‚РѕС‚ РєР°РґР°СЃС‚СЂ?')) return;
    try {
      await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'cadastres', id));
      showNotification('РљР°РґР°СЃС‚СЂ СѓРґР°Р»С‘РЅ');
      logAction(currentUser, 'cadastre_delete', { id });
    } catch (e) {
      showNotification('РћС€РёР±РєР°: ' + e.message, 'error');
    }
  };

  // в”Ђв”Ђв”Ђ Р РµРіРёСЃС‚СЂР°С†РёРё в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

  const handleAddCadastreReg = async (data) => {
    try {
      const hostelId = targetHostel();
      const safeStaffId = currentUser.id || currentUser.login;

      const regRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'cadastreRegistrations'), {
        guestId:         data.guestId || null,
        guestName:       data.guestName,
        passport:        data.passport || '',
        birthDate:       data.birthDate || '',
        country:         data.country || '',
        phone:           data.phone || '',
        cadastreId:      data.cadastreId || null,
        cadastreAddress: data.cadastreAddress,
        cadastreName:    data.cadastreName || '',
        cadastreOwner:   data.cadastreOwner || '',
        hostelId,
        startDate:       data.startDate,
        endDate:         data.endDate,
        days:            Number(data.days),
        amount:          Number(data.amount) || 0,
        regLink:         data.regLink || '',
        status:          'active',
        expenseAdded:    false,
        expenseId:       null,
        staffId:         safeStaffId,
        createdAt:       new Date().toISOString(),
        createdBy:       currentUser.login,
      });

      // Р•СЃР»Рё РІС‹Р±СЂР°РЅРѕ В«РґРѕР±Р°РІРёС‚СЊ РІ СЂР°СЃС…РѕРґС‹В» вЂ” СЃРѕР·РґР°С‘Рј Р·Р°РїРёСЃСЊ РІ expenses
      if (data.addToExpenses && Number(data.amount) > 0) {
        const expRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'expenses'), {
          category:  'Р РµРіРёСЃС‚СЂР°С†РёСЏ',
          amount:    Number(data.amount),
          comment:   `РљР°РґР°СЃС‚СЂ: ${data.cadastreAddress} вЂ” ${data.guestName} (${data.startDate} вЂ“ ${data.endDate})`,
          hostelId,
          staffId:   safeStaffId,
          date:      new Date().toISOString(),
        });
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'cadastreRegistrations', regRef.id), {
          expenseAdded: true,
          expenseId: expRef.id,
        });
      }

      showNotification('Регистрация добавлена', 'success');
      logAction(currentUser, 'cadastre_reg_add', {
        guestName: data.guestName, cadastreAddress: data.cadastreAddress, days: data.days,
      });

      // Telegram-уведомление
      const disabledTypes = new Set(tgSettings?.disabledTypes || []);
      if (!disabledTypes.has('cadastreNew') && isOnline) {
        const msg = [
          `🏠 <b>Кадастр-регистрация добавлена</b>`,
          `👤 ${data.guestName}`,
          data.passport ? `🪪 ${data.passport}` : null,
          `📍 ${data.cadastreAddress}`,
          `📅 ${data.startDate} → ${data.endDate} (${data.days} дн.)`,
          Number(data.amount) > 0 ? `💰 ${Number(data.amount).toLocaleString()} сум` : null,
          `🏨 ${HOSTEL_LABEL[hostelId] || hostelId}`,
          `👷 ${currentUser.name || currentUser.login}`,
        ].filter(Boolean).join('\n');
        sendTelegramMessage(msg, 'cadastreNew');
      }
    } catch (e) {
      console.error(e);
      showNotification('РћС€РёР±РєР°: ' + e.message, 'error');
    }
  };

  const handleExtendCadastreReg = async (reg, extData) => {
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'cadastreRegistrations', reg.id), {
        endDate: extData.newEndDate,
        days:    (reg.days || 0) + Number(extData.days),
        status:  'active',
      });

      // Р”РѕР±Р°РІРёС‚СЊ СЃС‚РѕРёРјРѕСЃС‚СЊ РїСЂРѕРґР»РµРЅРёСЏ РІ СЂР°СЃС…РѕРґС‹
      if (extData.addToExpenses && Number(extData.regCost) > 0) {
        await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'expenses'), {
          category:  'Р РµРіРёСЃС‚СЂР°С†РёСЏ',
          amount:    Number(extData.regCost),
          comment:   `РљР°РґР°СЃС‚СЂ РїСЂРѕРґР»РµРЅРёРµ: ${reg.cadastreAddress} вЂ” ${reg.guestName} (+${extData.days} РґРЅ.)`,
          hostelId:  reg.hostelId,
          staffId:   currentUser.id || currentUser.login,
          date:      new Date().toISOString(),
        });
      }

      showNotification(`Р РµРіРёСЃС‚СЂР°С†РёСЏ РїСЂРѕРґР»РµРЅР° РґРѕ ${extData.newEndDate}`, 'success');
      logAction(currentUser, 'cadastre_reg_extend', { id: reg.id, newEndDate: extData.newEndDate });
    } catch (e) {
      showNotification('РћС€РёР±РєР° РїСЂРѕРґР»РµРЅРёСЏ: ' + e.message, 'error');
    }
  };

  const handleRemoveCadastreReg = async (reg) => {
    if (!window.confirm(`РЎРЅСЏС‚СЊ "${reg.guestName}" СЃ РєР°РґР°СЃС‚СЂ-СЂРµРіРёСЃС‚СЂР°С†РёРё?`)) return;
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'cadastreRegistrations', reg.id), {
        status: 'removed',
        removedAt: new Date().toISOString(),
        removedBy: currentUser.login,
      });
      showNotification('Р“РѕСЃС‚СЊ СЃРЅСЏС‚ СЃ РєР°РґР°СЃС‚СЂ-СЂРµРіРёСЃС‚СЂР°С†РёРё');
      logAction(currentUser, 'cadastre_reg_remove', { id: reg.id, guestName: reg.guestName });
    } catch (e) {
      showNotification('РћС€РёР±РєР°: ' + e.message, 'error');
    }
  };

  const handleDeleteCadastreReg = async (reg) => {
    if (!window.confirm(`РЈРґР°Р»РёС‚СЊ Р·Р°РїРёСЃСЊ "${reg.guestName}"? Р­С‚Рѕ РґРµР№СЃС‚РІРёРµ РЅРµРѕР±СЂР°С‚РёРјРѕ.`)) return;
    try {
      await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'cadastreRegistrations', reg.id));
      showNotification('Р—Р°РїРёСЃСЊ СѓРґР°Р»РµРЅР°');
      logAction(currentUser, 'cadastre_reg_delete', { id: reg.id, guestName: reg.guestName });
    } catch (e) {
      showNotification('РћС€РёР±РєР°: ' + e.message, 'error');
    }
  };

  // Р”РѕР±Р°РІРёС‚СЊ РІ СЂР°СЃС…РѕРґС‹ РѕРґРЅСѓ Р·Р°РїРёСЃСЊ
  const handleAddRegToExpenses = async (reg) => {
    if (reg.expenseAdded) {
      showNotification('Р Р°СЃС…РѕРґ СѓР¶Рµ Р±С‹Р» РґРѕР±Р°РІР»РµРЅ', 'info');
      return;
    }
    if (!reg.amount || Number(reg.amount) <= 0) {
      showNotification('РЎСѓРјРјР° СЂРµРіРёСЃС‚СЂР°С†РёРё РЅРµ СѓРєР°Р·Р°РЅР°', 'error');
      return;
    }
    try {
      const expRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'expenses'), {
        category:  'Р РµРіРёСЃС‚СЂР°С†РёСЏ',
        amount:    Number(reg.amount),
        comment:   `РљР°РґР°СЃС‚СЂ: ${reg.cadastreAddress} вЂ” ${reg.guestName} (${reg.startDate} вЂ“ ${reg.endDate})`,
        hostelId:  reg.hostelId,
        staffId:   currentUser.id || currentUser.login,
        date:      new Date().toISOString(),
      });
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'cadastreRegistrations', reg.id), {
        expenseAdded: true,
        expenseId: expRef.id,
      });
      showNotification('Р”РѕР±Р°РІР»РµРЅРѕ РІ СЂР°СЃС…РѕРґС‹', 'success');
      logAction(currentUser, 'cadastre_reg_to_expense', { id: reg.id, amount: reg.amount });
    } catch (e) {
      showNotification('РћС€РёР±РєР°: ' + e.message, 'error');
    }
  };

  // Р”РѕР±Р°РІРёС‚СЊ Р’РЎР• Р°РєС‚РёРІРЅС‹Рµ СЂРµРіРёСЃС‚СЂР°С†РёРё (Сѓ РєРѕС‚РѕСЂС‹С… РµС‰С‘ РЅРµ РґРѕР±Р°РІР»РµРЅ СЂР°СЃС…РѕРґ) РІ СЂР°СЃС…РѕРґС‹ РѕРґРЅРѕР№ РєРЅРѕРїРєРѕР№
  const handleAddAllToExpenses = async (cadastreRegs) => {
    const safeStaffId = currentUser.id || currentUser.login;
    const toAdd = cadastreRegs.filter(r =>
      r.status !== 'removed' && !r.expenseAdded && Number(r.amount) > 0
    );
    if (toAdd.length === 0) {
      showNotification('РќРµС‚ РЅРѕРІС‹С… Р·Р°РїРёСЃРµР№ РґР»СЏ РґРѕР±Р°РІР»РµРЅРёСЏ РІ СЂР°СЃС…РѕРґС‹', 'info');
      return;
    }
    let addedCount = 0;
    const now = new Date().toISOString();
    for (const reg of toAdd) {
      try {
        const expRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'expenses'), {
          category:  'Р РµРіРёСЃС‚СЂР°С†РёСЏ',
          amount:    Number(reg.amount),
          comment:   `РљР°РґР°СЃС‚СЂ: ${reg.cadastreAddress} вЂ” ${reg.guestName} (${reg.startDate} вЂ“ ${reg.endDate})`,
          hostelId:  reg.hostelId,
          staffId:   safeStaffId,
          date:      now,
        });
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'cadastreRegistrations', reg.id), {
          expenseAdded: true,
          expenseId: expRef.id,
        });
        addedCount++;
      } catch (e) {
        console.error('РћС€РёР±РєР° РїСЂРё РґРѕР±Р°РІР»РµРЅРёРё СЂР°СЃС…РѕРґР°:', e);
      }
    }
    showNotification(`Р”РѕР±Р°РІР»РµРЅРѕ РІ СЂР°СЃС…РѕРґС‹: ${addedCount} РёР· ${toAdd.length} Р·Р°РїРёСЃРµР№`, 'success');
    logAction(currentUser, 'cadastre_bulk_expense', { count: addedCount });
  };

  return {
    handleAddCadastre,
    handleUpdateCadastre,
    handleDeleteCadastre,
    handleAddCadastreReg,
    handleExtendCadastreReg,
    handleRemoveCadastreReg,
    handleDeleteCadastreReg,
    handleAddRegToExpenses,
    handleAddAllToExpenses,
  };
}
