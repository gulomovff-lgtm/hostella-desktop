/**
 * useCadastreActions — кадастр-регистрация гостей в частных домах.
 */
import { collection, doc, addDoc, updateDoc, deleteDoc, increment } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { logAction } from '../utils/auditLog';
import { sendTelegramMessage } from '../utils/telegram';

const HOSTEL_LABEL = { hostel1: 'Хостел №1', hostel2: 'Хостел №2' };

export function useCadastreActions({
  currentUser, selectedHostelFilter,
  showNotification, tgSettings, isOnline,
  setUndoStack,
}) {

  const monthKey = (dateLike) => {
    if (!dateLike) return '';
    const s = String(dateLike);
    if (s.length >= 7 && s[4] === '-') return s.slice(0, 7);
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return '';
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}`;
  };

  const nowMonth = () => monthKey(new Date().toISOString());

  const toNum = (v) => Number(v) || 0;

  const addMonthAmount = (map = {}, key, delta) => {
    if (!key || !delta) return { ...(map || {}) };
    const next = { ...(map || {}) };
    const cur = toNum(next[key]);
    const sum = cur + toNum(delta);
    if (sum <= 0) delete next[key];
    else next[key] = Math.round(sum);
    return next;
  };

  const getExpenseByMonthMap = (reg) => {
    const explicit = reg?.expenseByMonth && typeof reg.expenseByMonth === 'object' ? { ...reg.expenseByMonth } : {};
    if (Object.keys(explicit).length > 0) return explicit;
    const total = toNum(reg?.amount);
    const mk = monthKey(reg?.createdAt) || monthKey(reg?.startDate);
    return (total > 0 && mk) ? { [mk]: Math.round(total) } : {};
  };

  const getExpensedByMonthMap = (reg, expenseByMonth) => {
    const explicit = reg?.expensedByMonth && typeof reg.expensedByMonth === 'object' ? { ...reg.expensedByMonth } : {};
    if (Object.keys(explicit).length > 0) return explicit;
    const totalExpensed = toNum(reg?.totalExpensed ?? (reg?.expenseAdded ? reg?.amount : 0));
    if (totalExpensed <= 0) return {};
    const next = {};
    let rest = totalExpensed;
    const months = Object.keys(expenseByMonth).sort();
    for (const m of months) {
      if (rest <= 0) break;
      const cap = toNum(expenseByMonth[m]);
      if (cap <= 0) continue;
      const take = Math.min(cap, rest);
      next[m] = take;
      rest -= take;
    }
    return next;
  };

  const allocateExpensedByMonth = (expenseByMonth, expensedByMonth, amountToAdd) => {
    const next = { ...(expensedByMonth || {}) };
    let rest = toNum(amountToAdd);
    const months = Object.keys(expenseByMonth || {}).sort();
    for (const m of months) {
      if (rest <= 0) break;
      const cap = Math.max(0, toNum(expenseByMonth[m]) - toNum(next[m]));
      if (cap <= 0) continue;
      const take = Math.min(cap, rest);
      next[m] = toNum(next[m]) + take;
      rest -= take;
    }
    if (rest > 0) {
      const m = nowMonth();
      next[m] = toNum(next[m]) + rest;
    }
    return next;
  };

  const pushUndo = (item) => {
    if (!setUndoStack) return;
    setUndoStack(prev => [
      { ...item, id: Date.now(), timestamp: new Date().toISOString() },
      ...prev,
    ].slice(0, 5));
  };

  const targetHostel = () =>
    (!currentUser.hostelId || currentUser.hostelId === 'all')
      ? (selectedHostelFilter || 'hostel1')
      : currentUser.hostelId;

  // ─── Управление кадастрами (частными домами) ──────────────────────────────

  const handleAddCadastre = async (data) => {
    try {
      await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'cadastres'), {
        ...data,
        hostelId: data.hostelId || targetHostel(),
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.login,
      });
      showNotification('Кадастр добавлен', 'success');
      logAction(currentUser, 'cadastre_add', { name: data.name, address: data.address });
    } catch (e) {
      showNotification('Ошибка: ' + e.message, 'error');
    }
  };

  const handleUpdateCadastre = async (id, data) => {
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'cadastres', id), data);
      showNotification('Кадастр обновлён', 'success');
      logAction(currentUser, 'cadastre_update', { id });
    } catch (e) {
      showNotification('Ошибка: ' + e.message, 'error');
    }
  };

  // Удаление — confirm вынесен в UI
  const handleDeleteCadastre = async (id) => {
    try {
      await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'cadastres', id));
      showNotification('Кадастр удалён', 'success');
      logAction(currentUser, 'cadastre_delete', { id });
    } catch (e) {
      showNotification('Ошибка: ' + e.message, 'error');
    }
  };

  // ─── Регистрации ──────────────────────────────────────────────────────────

  const handleAddCadastreReg = async (data) => {
    try {
      const hostelId = targetHostel();
      const safeStaffId = currentUser.id || currentUser.login;
      const createdMonth = nowMonth();
      const regAmount = Number(data.amount) || 0;

      const expenseByMonth = regAmount > 0
        ? { [createdMonth]: Math.round(regAmount) }
        : {};

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
        amount:          regAmount,
        regLink:         data.regLink || '',
        status:          'active',
        expenseAdded:    false,
        expenseId:       null,
        expenseByMonth,
        expensedByMonth: {},
        staffId:         safeStaffId,
        createdAt:       new Date().toISOString(),
        createdBy:       currentUser.login,
      });

      if (data.addToExpenses && regAmount > 0) {
        const expRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'expenses'), {
          category: 'Регистрация',
          amount:   regAmount,
          comment:  `Кадастр: ${data.cadastreAddress} — ${data.guestName} (${data.startDate} – ${data.endDate})`,
          hostelId,
          staffId:  safeStaffId,
          source:   'cadastre',
          date:     new Date().toISOString(),
        });
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'cadastreRegistrations', regRef.id), {
          expenseAdded: true,
          expenseId: expRef.id,
          totalExpensed: regAmount,
          expensedByMonth: { [createdMonth]: Math.round(regAmount) },
        });
      }

      showNotification('Регистрация добавлена', 'success');
      logAction(currentUser, 'cadastre_reg_add', {
        guestName: data.guestName, cadastreAddress: data.cadastreAddress, days: data.days,
      });

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
      showNotification('Ошибка: ' + e.message, 'error');
    }
  };

  const handleExtendCadastreReg = async (reg, extData) => {
    try {
      const costNum = Number(extData.regCost) || 0;
      const extMonth = nowMonth();
      const expenseByMonth = addMonthAmount(getExpenseByMonthMap(reg), extMonth, costNum);
      // Считаем фактическое кол-во дней: от startFrom до newEndDate
      const startFrom = extData.startFrom || reg.endDate;
      const actualDays = startFrom && extData.newEndDate
        ? Math.round((new Date(extData.newEndDate + 'T12:00:00') - new Date(startFrom + 'T12:00:00')) / 86400000)
        : Number(extData.days);
      const regUpdate = {
        endDate:   extData.newEndDate,
        days:      (reg.days || 0) + Math.max(0, actualDays),
        status:    'active',
        ...(costNum > 0 ? { expenseByMonth } : {}),
      };
      // Накапливаем общую стоимость регистрации
      if (costNum > 0) {
        regUpdate.amount = increment(costNum);
      }

      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'cadastreRegistrations', reg.id), regUpdate);

      if (extData.addToExpenses && costNum > 0) {
        await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'expenses'), {
          category: 'Регистрация',
          amount:   costNum,
          comment:  `Кадастр продление: ${reg.cadastreAddress} — ${reg.guestName} (+${extData.days} дн.)`,
          hostelId: reg.hostelId,
          staffId:  currentUser.id || currentUser.login,
          source:   'cadastre',
          date:     new Date().toISOString(),
        });
        const expensedByMonth = addMonthAmount(
          getExpensedByMonthMap(reg, expenseByMonth),
          extMonth,
          costNum
        );
        // Помечаем сколько добавлено в расходы
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'cadastreRegistrations', reg.id), {
          expenseAdded:  true,
          totalExpensed: increment(costNum),
          expensedByMonth,
        });
      }

      showNotification(`Регистрация продлена до ${extData.newEndDate}`, 'success');
      logAction(currentUser, 'cadastre_reg_extend', { id: reg.id, newEndDate: extData.newEndDate });
    } catch (e) {
      showNotification('Ошибка продления: ' + e.message, 'error');
    }
  };

  // Снятие — confirm и опция addToExpenses вынесены в UI
  const handleRemoveCadastreReg = async (reg, { addToExpenses = false } = {}) => {
    try {
      const safeStaffId = currentUser.id || currentUser.login;
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'cadastreRegistrations', reg.id), {
        status:    'removed',
        removedAt: new Date().toISOString(),
        removedBy: currentUser.login,
      });

      let removedExpenseId = null;
      if (addToExpenses && Number(reg.amount) > 0 && !reg.expenseAdded) {
        const expRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'expenses'), {
          category: 'Регистрация',
          amount:   Number(reg.amount),
          comment:  `Кадастр завершение: ${reg.cadastreAddress} — ${reg.guestName} (${reg.startDate} – ${reg.endDate})`,
          hostelId: reg.hostelId,
          staffId:  safeStaffId,
          source:   'cadastre',
          date:     new Date().toISOString(),
        });
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'cadastreRegistrations', reg.id), {
          expenseAdded: true,
          expenseId: expRef.id,
        });
        removedExpenseId = expRef.id;
      }

      pushUndo({
        type: 'cadastre_remove',
        label: `Завершение регистрации: ${reg.guestName}`,
        regId: reg.id,
        expenseId: removedExpenseId,
      });
      showNotification('Регистрация завершена', 'success');
      logAction(currentUser, 'cadastre_reg_remove', { id: reg.id, guestName: reg.guestName });
    } catch (e) {
      showNotification('Ошибка: ' + e.message, 'error');
    }
  };

  // Изменение данных регистрации
  const handleUpdateCadastreReg = async (reg, data) => {
    try {
      const prevAmount = Number(reg.amount) || 0;
      const nextAmount = Number(data.amount) || 0;
      const diff = nextAmount - prevAmount;
      const updMonth = nowMonth();
      const expenseByMonth = diff !== 0
        ? addMonthAmount(getExpenseByMonthMap(reg), updMonth, diff)
        : getExpenseByMonthMap(reg);

      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'cadastreRegistrations', reg.id), {
        guestName:       data.guestName,
        startDate:       data.startDate,
        endDate:         data.endDate,
        days:            Number(data.days),
        amount:          nextAmount,
        regLink:         data.regLink || '',
        expenseByMonth,
        updatedAt:       new Date().toISOString(),
        updatedBy:       currentUser.login,
      });
      showNotification('Регистрация обновлена', 'success');
      logAction(currentUser, 'cadastre_reg_update', { id: reg.id, guestName: data.guestName });
    } catch (e) {
      showNotification('Ошибка: ' + e.message, 'error');
    }
  };

  // Удаление — confirm вынесен в UI
  const handleDeleteCadastreReg = async (reg) => {
    try {
      await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'cadastreRegistrations', reg.id));
      showNotification('Запись удалена', 'success');
      logAction(currentUser, 'cadastre_reg_delete', { id: reg.id, guestName: reg.guestName });
    } catch (e) {
      showNotification('Ошибка: ' + e.message, 'error');
    }
  };

  // Добавить в расходы одну запись
  const handleAddRegToExpenses = async (reg) => {
    // Вычисляем уже учтённую сумму (поддержка старых записей без totalExpensed)
    const alreadyExpensed = reg.totalExpensed ?? (reg.expenseAdded ? (Number(reg.amount) || 0) : 0);
    const toAdd = Math.max(0, (Number(reg.amount) || 0) - alreadyExpensed);

    if (toAdd <= 0) {
      showNotification('Все суммы уже добавлены в расходы', 'info');
      return;
    }
    try {
      const expenseByMonth = getExpenseByMonthMap(reg);
      const expensedByMonth = getExpensedByMonthMap(reg, expenseByMonth);
      const nextExpensedByMonth = allocateExpensedByMonth(expenseByMonth, expensedByMonth, toAdd);

      const expRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'expenses'), {
        category: 'Регистрация',
        amount:   toAdd,
        comment:  `Кадастр: ${reg.cadastreAddress} — ${reg.guestName} (${reg.startDate} – ${reg.endDate})`,
        hostelId: reg.hostelId,
        staffId:  currentUser.id || currentUser.login,
        source:   'cadastre',
        date:     new Date().toISOString(),
      });
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'cadastreRegistrations', reg.id), {
        expenseAdded:  true,
        expenseId:     expRef.id,
        totalExpensed: increment(toAdd),
        expenseByMonth,
        expensedByMonth: nextExpensedByMonth,
      });
      pushUndo({
        type: 'cadastre_expense',
        label: `Расход кадастр: ${reg.guestName} — ${toAdd.toLocaleString()} сум`,
        expenseId: expRef.id,
        regId: reg.id,
      });
      showNotification(`Добавлено в расходы: ${toAdd.toLocaleString()} сум`, 'success');
      logAction(currentUser, 'cadastre_reg_to_expense', { id: reg.id, amount: toAdd });
    } catch (e) {
      showNotification('Ошибка: ' + e.message, 'error');
    }
  };

  // Добавить ВСЕ активные регистрации в расходы одной кнопкой
  const handleAddAllToExpenses = async (cadastreRegs) => {
    const safeStaffId = currentUser.id || currentUser.login;
    const toAdd = cadastreRegs.filter(r => {
      if (r.status === 'removed' || !(Number(r.amount) > 0)) return false;
      const alreadyExpensed = r.totalExpensed ?? (r.expenseAdded ? (Number(r.amount) || 0) : 0);
      return (Number(r.amount) - alreadyExpensed) > 0;
    });
    if (toAdd.length === 0) {
      showNotification('Нет новых записей для добавления в расходы', 'info');
      return;
    }
    let addedCount = 0;
    const now = new Date().toISOString();
    for (const reg of toAdd) {
      try {
        const alreadyExpensed = reg.totalExpensed ?? (reg.expenseAdded ? (Number(reg.amount) || 0) : 0);
        const diff = Number(reg.amount) - alreadyExpensed;
        const expenseByMonth = getExpenseByMonthMap(reg);
        const expensedByMonth = getExpensedByMonthMap(reg, expenseByMonth);
        const nextExpensedByMonth = allocateExpensedByMonth(expenseByMonth, expensedByMonth, diff);
        const expRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'expenses'), {
          category: 'Регистрация',
          amount:   diff,
          comment:  `Кадастр: ${reg.cadastreAddress} — ${reg.guestName} (${reg.startDate} – ${reg.endDate})`,
          hostelId: reg.hostelId,
          staffId:  safeStaffId,
          source:   'cadastre',
          date:     now,
        });
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'cadastreRegistrations', reg.id), {
          expenseAdded:  true,
          expenseId:     expRef.id,
          totalExpensed: increment(diff),
          expenseByMonth,
          expensedByMonth: nextExpensedByMonth,
        });
        addedCount++;
      } catch (e) {
        console.error('Ошибка при добавлении расхода:', e);
      }
    }
    showNotification(`Добавлено в расходы: ${addedCount} из ${toAdd.length} записей`, 'success');
    logAction(currentUser, 'cadastre_bulk_expense', { count: addedCount });
  };

  return {
    handleAddCadastre, handleUpdateCadastre, handleDeleteCadastre,
    handleAddCadastreReg, handleExtendCadastreReg, handleUpdateCadastreReg,
    handleRemoveCadastreReg, handleDeleteCadastreReg,
    handleAddRegToExpenses, handleAddAllToExpenses,
  };
}
