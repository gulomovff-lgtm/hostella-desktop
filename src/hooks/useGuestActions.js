/**
 * useGuestActions — все операции с гостями.
 *
 * @param {object} ctx
 * @param {object}   ctx.currentUser
 * @param {array}    ctx.rooms
 * @param {array}    ctx.guests
 * @param {array}    ctx.clients
 * @param {string}   ctx.selectedHostelFilter
 * @param {string}   ctx.lang
 * @param {object}   ctx.checkInModal     — нужен checkInModal.bookingId
 * @param {function} ctx.setCheckInModal
 * @param {function} ctx.setGuestDetailsModal
 * @param {function} ctx.setMoveGuestModal
 * @param {function} ctx.setUndoStack
 * @param {function} ctx.setUndoHistoryOpen
 * @param {function} ctx.showNotification
 */
import {
  collection, doc, addDoc, updateDoc, deleteDoc, increment, writeBatch,
} from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { sendTelegramMessage } from '../utils/telegram';
import { logAction } from '../utils/auditLog';
import { getStayDetails, getTotalPaid } from '../utils/helpers';

export function useGuestActions(ctx) {
  const {
    currentUser, rooms, guests, clients,
    selectedHostelFilter, lang,
    checkInModal, setCheckInModal,
    setGuestDetailsModal, setMoveGuestModal,
    setUndoStack, setUndoHistoryOpen,
    showNotification,
  } = ctx;

  // ─── Internal helpers ────────────────────────────────────────────────────

  const logTransaction = async (guestId, amounts, staffId) => {
    const { cash = 0, card = 0, qr = 0 } = amounts;
    const date = new Date().toISOString();
    const items = [];
    const ids = [];
    if (cash > 0) items.push({ guestId, staffId, amount: cash, method: 'cash', date, hostelId: currentUser.hostelId });
    if (card > 0) items.push({ guestId, staffId, amount: card, method: 'card', date, hostelId: currentUser.hostelId });
    if (qr   > 0) items.push({ guestId, staffId, amount: qr,   method: 'qr',   date, hostelId: currentUser.hostelId });
    for (const item of items) {
      const ref = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'payments'), item);
      ids.push(ref.id);
    }
    return ids;
  };

  const pushUndo = (item) => {
    setUndoStack(prev => [
      { ...item, id: Date.now(), timestamp: new Date().toISOString() },
      ...prev,
    ].slice(0, 5));
  };

  const upsertClient = async (data, opts = {}) => {
    if (!data.passport && !data.fullName) return;
    // Search by passport first, then by fullName
    const ec = data.passport
      ? clients.find(c => c.passport && c.passport === data.passport)
      : clients.find(c => !c.passport && c.fullName && c.fullName === data.fullName);
    if (ec) {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'clients', ec.id), {
        lastVisit: new Date().toISOString(),
        ...(opts.incrementVisits !== false ? { visits: (ec.visits || 0) + 1 } : {}),
        fullName: ec.fullName || data.fullName || '',
        ...(data.passport && !ec.passport ? { passport: data.passport } : {}),
        ...(data.birthDate && !ec.birthDate ? { birthDate: data.birthDate } : {}),
        ...(data.country && !ec.country ? { country: data.country } : {}),
        ...(data.phone && !ec.phone ? { phone: data.phone } : {}),
      });
    } else {
      await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'clients'), {
        fullName: data.fullName || '',
        passport: data.passport || '',
        birthDate: data.birthDate || '',
        country: data.country || '',
        phone: data.phone || '',
        passportIssueDate: data.passportIssueDate || '',
        lastVisit: new Date().toISOString(),
        visits: 1,
      });
    }
  };

  // ─── Public handlers ─────────────────────────────────────────────────────

  const handleUndo = async (item) => {
    try {
      const fb = writeBatch(db);
      if (item.type === 'checkin') {
        fb.delete(doc(db, ...PUBLIC_DATA_PATH, 'guests', item.guestId));
        (item.paymentIds || []).forEach(pid => fb.delete(doc(db, ...PUBLIC_DATA_PATH, 'payments', pid)));
        if (item.wasActive && item.roomId)
          fb.update(doc(db, ...PUBLIC_DATA_PATH, 'rooms', item.roomId), { occupied: increment(-1) });
      } else if (item.type === 'payment') {
        (item.paymentIds || []).forEach(pid => fb.delete(doc(db, ...PUBLIC_DATA_PATH, 'payments', pid)));
        fb.update(doc(db, ...PUBLIC_DATA_PATH, 'guests', item.guestId), {
          paidCash: increment(-item.cash),
          paidCard: increment(-item.card),
          paidQR:   increment(-item.qr),
          amountPaid: increment(-(item.cash + item.card + item.qr)),
        });
      } else if (item.type === 'extend') {
        fb.update(doc(db, ...PUBLIC_DATA_PATH, 'guests', item.guestId), {
          days: item.prevDays, totalPrice: item.prevTotalPrice,
          checkOutDate: item.prevCheckOut, status: item.prevStatus || 'active',
        });
        (item.paymentIds || []).forEach(pid => fb.delete(doc(db, ...PUBLIC_DATA_PATH, 'payments', pid)));
        const rev = (item.payCash || 0) + (item.payCard || 0) + (item.payQR || 0);
        if (rev > 0) {
          fb.update(doc(db, ...PUBLIC_DATA_PATH, 'guests', item.guestId), {
            paidCash: increment(-(item.payCash || 0)),
            paidCard: increment(-(item.payCard || 0)),
            paidQR:   increment(-(item.payQR   || 0)),
            amountPaid: increment(-rev),
          });
        }
      } else if (item.type === 'expense') {
        fb.delete(doc(db, ...PUBLIC_DATA_PATH, 'expenses', item.expenseId));
      }
      await fb.commit();
      setUndoStack(prev => prev.filter(u => u.id !== item.id));
      setUndoHistoryOpen(false);
      showNotification('Действие отменено ↩', 'success');
      logAction(currentUser, 'undo', { originalAction: item.type, label: item.label });
    } catch (e) {
      showNotification('Ошибка отмены: ' + e.message, 'error');
    }
  };

  // Главная функция заселения (из CheckInModal)
  const handleCheckInSubmit = async (formData) => {
    try {
      const targetHostelId = (!currentUser.hostelId || currentUser.hostelId === 'all')
        ? (formData.hostelId || selectedHostelFilter || 'hostel1')
        : currentUser.hostelId;
      const safeStaffId = currentUser.id || currentUser.login || 'unknown';

      const newGuest = {
        ...formData,
        hostelId: targetHostelId,
        staffId: safeStaffId,
        checkInDate:  new Date(formData.checkInDate).toISOString(),
        checkOutDate: new Date(formData.checkOutDate).toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: currentUser.login || 'admin',
        passportClean: formData.passport ? formData.passport.replace(/\s/g, '').toUpperCase() : '',
      };

      const docRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'guests'), newGuest);
      const guestId = docRef.id;

      const totalPaid = (Number(formData.paidCash) || 0) + (Number(formData.paidCard) || 0) + (Number(formData.paidQR) || 0);
      let checkinPaymentIds = [];
      if (totalPaid > 0) {
        const payRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'payments'), {
          guestId, staffId: safeStaffId, guestName: formData.fullName,
          roomId: formData.roomId, roomNumber: formData.roomNumber,
          amount: totalPaid,
          cash: Number(formData.paidCash) || 0,
          card: Number(formData.paidCard) || 0,
          qr:   Number(formData.paidQR)   || 0,
          date: new Date().toISOString(),
          type: 'income', category: 'accommodation', comment: formData.fullName,
          hostelId: targetHostelId, admin: currentUser.login || 'admin',
          method: Number(formData.paidCash) > 0 ? 'cash' : (Number(formData.paidCard) > 0 ? 'card' : 'qr'),
        });
        checkinPaymentIds = [payRef.id];
      }

      if (formData.status === 'active') {
        const room = rooms.find(r => r.id === formData.roomId);
        if (room) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', room.id), { occupied: increment(1) });
      }

      if (checkInModal.bookingId) {
        try { await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', checkInModal.bookingId)); } catch (_) {}
      }

      showNotification(lang === 'ru' ? 'Гость успешно заселен!' : 'Mehmon muvaffaqiyatli joylashtirildi!', 'success');
      logAction(currentUser, newGuest.status === 'active' ? 'checkin' : 'booking_add', {
        guestName: newGuest.fullName, roomNumber: newGuest.roomNumber, bedId: newGuest.bedId, amount: totalPaid,
      });

      if (newGuest.status === 'active') {
        const hostelLabel = targetHostelId === 'hostel1' ? 'Хостел №1' : 'Хостел №2';
        sendTelegramMessage(
          `🏨 <b>Новое заселение</b>\n👤 ${newGuest.fullName}\n🛏 ${hostelLabel} · Ком. ${newGuest.roomNumber || '—'}, место ${newGuest.bedId || '—'}\n📅 ${new Date(newGuest.checkInDate).toLocaleDateString('ru')} → ${new Date(newGuest.checkOutDate).toLocaleDateString('ru')} (${newGuest.days || 1} дн.)\n💰 Оплачено: ${totalPaid.toLocaleString()} сум\n👷 Кассир: ${currentUser.name || currentUser.login}`,
          'checkin'
        );
        pushUndo({
          type: 'checkin',
          label: `${newGuest.fullName} — комн. ${newGuest.roomNumber}, место ${newGuest.bedId}`,
          guestId, paymentIds: checkinPaymentIds, roomId: formData.roomId, wasActive: true,
        });
        await upsertClient(formData);
      }

      setCheckInModal({ open: false, room: null, bedId: null, date: null, client: null, bookingId: null });
    } catch (error) {
      console.error('Error adding guest:', error);
      showNotification('Ошибка при заселении', 'error');
    }
  };

  // Заселение из кнопки в ShiftClosingModal / GroupCheckIn
  const handleCheckIn = async (data) => {
    setCheckInModal({ open: false, room: null, bedId: null, date: null });
    try {
      const safeStaffId = currentUser.id || currentUser.login || 'unknown';
      const docRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'guests'), { ...data, staffId: safeStaffId });
      const total = (data.paidCash || 0) + (data.paidCard || 0) + (data.paidQR || 0);
      if (total > 0) await logTransaction(docRef.id, { cash: data.paidCash, card: data.paidCard, qr: data.paidQR }, safeStaffId);
      if (data.status === 'active') {
        const r = rooms.find(i => i.id === data.roomId);
        if (r) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', r.id), { occupied: (r.occupied || 0) + 1 });
        await upsertClient(data);
      }
      showNotification(data.status === 'booking' ? 'Booking created' : 'Checked In!');
    } catch (e) {
      showNotification(e.message, 'error');
    }
  };

  const handleCheckOut = async (guest, final) => {
    setGuestDetailsModal({ open: false, guest: null });
    const actualRefund = final.refundAmount || 0;
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const originalCheckOut = new Date(guest.checkOutDate); originalCheckOut.setHours(12, 0, 0, 0);
    const finalCheckOutDate = today < originalCheckOut ? today.toISOString() : guest.checkOutDate;

    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guest.id), {
      totalPrice: final.totalPrice, status: 'checked_out', checkOutDate: finalCheckOutDate,
    });

    // Sync to clients collection on checkout (don't increment visits — already counted on check-in)
    await upsertClient({ ...guest, checkOutDate: finalCheckOutDate }, { incrementVisits: false });

    const r = rooms.find(i => i.id === guest.roomId);
    if (r) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', r.id), { occupied: Math.max(0, (r.occupied || 1) - 1) });

    const hostelLabel = guest.hostelId === 'hostel1' ? 'Хостел №1' : 'Хостел №2';
    sendTelegramMessage(
      `🚪 <b>Выселение</b>\n👤 ${guest.fullName}\n🛏 ${hostelLabel} · Ком. ${guest.roomNumber || '—'}\n📅 Заехал: ${new Date(guest.checkInDate).toLocaleDateString('ru')}\n💰 Итого: ${(final.totalPrice || 0).toLocaleString()} сум\n👷 Кассир: ${currentUser.name || currentUser.login}`,
      'checkout'
    );

    if (actualRefund > 0) {
      await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'expenses'), {
        amount: actualRefund, category: 'Возврат',
        comment: `Возврат: ${guest.fullName} (${guest.passport})`,
        date: new Date().toISOString(),
        staffId: currentUser.id || currentUser.login,
        hostelId: currentUser.hostelId || guest.hostelId,
      });
      sendTelegramMessage(
        `💸 <b>Возврат средств</b>\n👤 ${guest.fullName}\n💵 Сумма: ${actualRefund.toLocaleString()} сум\n👷 Кассир: ${currentUser.name || currentUser.login}`,
        'refund'
      );
    }
  };

  const handlePayment = async (guestId, amounts) => {
    try {
      const safeStaffId = currentUser.id || currentUser.login;
      const { cash = 0, card = 0, qr = 0 } = amounts;
      const total = cash + card + qr;
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), {
        paidCash: increment(cash), paidCard: increment(card), paidQR: increment(qr),
        amountPaid: increment(total),
      });
      const paymentIds = await logTransaction(guestId, amounts, safeStaffId);
      if (total > 0) {
        const g = guests.find(x => x.id === guestId);
        pushUndo({ type: 'payment', label: `${total.toLocaleString()} сум — ${g?.fullName || guestId}`, guestId, paymentIds, cash, card, qr });
        if (g) {
          const hostelLabel = g.hostelId === 'hostel1' ? 'Хостел №1' : 'Хостел №2';
          sendTelegramMessage(
            `💵 <b>Оплата принята</b>\n👤 ${g.fullName}\n🛏 ${hostelLabel} · Ком. ${g.roomNumber || '—'}\n💰 ${total.toLocaleString()} сум\n👷 Кассир: ${currentUser.name || currentUser.login}`,
            'paymentAdded'
          );
        }
      }
      setGuestDetailsModal({ open: false, guest: null });
      showNotification('Оплата принята', 'success');
    } catch (e) {
      showNotification(e.message, 'error');
    }
  };

  const handleExtendGuest = async (guestId, extData) => {
    try {
      const safeStaffId = currentUser.id || currentUser.login;
      const { extendDays, payCash = 0, payCard = 0, payQR = 0,
              prevDays, prevTotalPrice, prevCheckOut, prevStatus,
              newDays, newTotalPrice, newCheckOut } = extData;
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), {
        days: newDays, totalPrice: newTotalPrice, checkOutDate: newCheckOut, status: 'active',
      });
      let paymentIds = [];
      const payTotal = payCash + payCard + payQR;
      if (payTotal > 0) {
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), {
          paidCash: increment(payCash), paidCard: increment(payCard), paidQR: increment(payQR), amountPaid: increment(payTotal),
        });
        paymentIds = await logTransaction(guestId, { cash: payCash, card: payCard, qr: payQR }, safeStaffId);
      }
      const g = guests.find(x => x.id === guestId);
      pushUndo({ type: 'extend', label: `+${extendDays} дн. — ${g?.fullName || guestId}`, guestId, prevDays, prevTotalPrice, prevCheckOut, prevStatus, paymentIds, payCash, payCard, payQR });
      if (g) {
        sendTelegramMessage(
          `📅 <b>Продление проживания</b>\n👤 ${g.fullName}\n➕ +${extendDays} дн. → ${new Date(newCheckOut).toLocaleDateString('ru')}\n💵 Доплачено: ${payTotal.toLocaleString()} сум\n👷 Кассир: ${currentUser.name || currentUser.login}`,
          'guestExtended'
        );
      }
      setGuestDetailsModal({ open: false, guest: null });
      showNotification(`Продлено на ${extendDays} дн.`, 'success');
    } catch (e) {
      showNotification('Ошибка продления: ' + e.message, 'error');
    }
  };

  const handleSuperPayment = async (guestId, amount) => {
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), {
        paidCash: increment(amount), amountPaid: increment(amount), superAdjusted: increment(amount),
      });
      setGuestDetailsModal({ open: false, guest: null });
      showNotification('Сумма зачтена');
    } catch (e) {
      showNotification(e.message, 'error');
    }
  };

  const handleBulkExtend = async (guestIds, days) => {
    if (!guestIds?.length || !days) return;
    let count = 0;
    for (const guestId of guestIds) {
      const guest = guests.find(g => g.id === guestId);
      if (!guest || guest.status !== 'active') continue;
      const newDays  = parseInt(guest.days || 1) + days;
      const newTotal = parseInt(guest.pricePerNight || 0) * newDays;
      const co = new Date(guest.checkOutDate || Date.now()); co.setDate(co.getDate() + days);
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), {
        days: newDays, totalPrice: newTotal, checkOutDate: co.toISOString(), status: 'active',
      });
      count++;
    }
    if (count > 0) showNotification(`Продлено на ${days} дн. для ${count} гостей`, 'success');
  };

  const handleCreateDebt = async (client, amount) => {
    try {
      const safeStaffId = currentUser.id || currentUser.login || 'unknown';
      await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'guests'), {
        fullName: client.fullName, passport: client.passport,
        country: client.country, birthDate: client.birthDate,
        staffId: safeStaffId, checkInDate: new Date().toISOString(),
        days: 0, roomId: 'DEBT_ONLY', roomNumber: '-', bedId: '-',
        pricePerNight: 0, totalPrice: amount,
        paidCash: 0, paidCard: 0, paidQR: 0, amountPaid: 0,
        status: 'debt',
        hostelId: currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId,
      });
      sendTelegramMessage(
        `⚠️ <b>Создан долг</b>\n👤 ${client.fullName}\n💰 Сумма: ${amount.toLocaleString()} сум\n👷 Кассир: ${currentUser.name || currentUser.login}`,
        'debtAlert'
      );
      showNotification('Debt created successfully');
    } catch (e) {
      showNotification('Error creating debt', 'error');
    }
  };

  const handleActivateBooking = async (guest) => {
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guest.id), { status: 'active' });
    const r = rooms.find(i => i.id === guest.roomId);
    if (r) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', r.id), { occupied: (r.occupied || 0) + 1 });
    await upsertClient(guest);
    setGuestDetailsModal({ open: false, guest: null });
    showNotification('Activated');
  };

  const handleSplitGuest = async (orig, splitAfterDays, gapDays) => {
    try {
      const price = parseInt(orig.pricePerNight);
      const firstLegDays = parseInt(splitAfterDays);
      const gap = parseInt(gapDays);
      const totalOriginalDays = parseInt(orig.days);
      const remainingDays = totalOriginalDays - firstLegDays;
      if (remainingDays <= 0) return;
      const totalPaid = orig.amountPaid || 0;
      const ratio1 = firstLegDays / totalOriginalDays;
      const ratio2 = remainingDays / totalOriginalDays;
      const stay1 = getStayDetails(orig.checkInDate, firstLegDays);
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', orig.id), {
        days: firstLegDays, totalPrice: firstLegDays * price,
        amountPaid: Math.floor(totalPaid * ratio1),
        paidCash: Math.floor((orig.paidCash || 0) * ratio1),
        paidCard: Math.floor((orig.paidCard || 0) * ratio1),
        paidQR:   Math.floor((orig.paidQR   || 0) * ratio1),
        checkOutDate: stay1.end.toISOString(),
      });
      const secondStart = new Date(stay1.end);
      secondStart.setDate(secondStart.getDate() + gap);
      secondStart.setHours(12, 0, 0, 0);
      const stay2 = getStayDetails(secondStart.toISOString(), remainingDays);
      const newGuest = {
        ...orig, id: undefined,
        checkInDate: secondStart.toISOString(), checkOutDate: stay2.end.toISOString(),
        days: remainingDays, pricePerNight: price, totalPrice: remainingDays * price,
        amountPaid: Math.floor(totalPaid * ratio2),
        paidCash: Math.floor((orig.paidCash || 0) * ratio2),
        paidCard: Math.floor((orig.paidCard || 0) * ratio2),
        paidQR:   Math.floor((orig.paidQR   || 0) * ratio2),
        status: 'active', checkInDateTime: null, checkIn: null,
      };
      delete newGuest.id;
      await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'guests'), newGuest);
      showNotification('Split successful!');
    } catch (e) {
      console.error(e);
      showNotification('Split Error', 'error');
    }
  };

  const handleMoveGuest = async (g, rid, rnum, bid) => {
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), { roomId: rid, roomNumber: rnum, bedId: bid });
      setMoveGuestModal({ open: false, guest: null });
      setGuestDetailsModal({ open: false, guest: null });
      showNotification('Moved!');
    } catch (e) {
      showNotification('Error: ' + e.message, 'error');
    }
  };

  const handleDeleteGuest = async (g) => {
    const guestId   = typeof g === 'string' ? g : g.id;
    const guestData = typeof g === 'object' ? g : guests.find(x => x.id === guestId);
    await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId));
    if (guestData?.status === 'active' && guestData.roomId !== 'DEBT_ONLY') {
      const r = rooms.find(i => i.id === guestData.roomId);
      if (r) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', r.id), { occupied: Math.max(0, (r.occupied || 1) - 1) });
    }
    if (guestData) {
      const hostelLabel = guestData.hostelId === 'hostel1' ? 'Хостел №1' : 'Хостел №2';
      sendTelegramMessage(
        `🚫 <b>Удалена запись гостя</b>\n👤 ${guestData.fullName || '—'}\n🛏 ${hostelLabel} · Ком. ${guestData.roomNumber || '—'}\n📅 ${guestData.checkInDate ? new Date(guestData.checkInDate).toLocaleDateString('ru') : '—'} → ${guestData.checkOutDate ? new Date(guestData.checkOutDate).toLocaleDateString('ru') : '—'}\n👤 Удалил: ${currentUser?.name || currentUser?.login || '—'}`,
        'deleteGuest'
      );
    }
    setGuestDetailsModal({ open: false, guest: null });
    showNotification('Deleted');
  };

  const handleRescheduleGuest = async (guestId, newCheckIn, newCheckOut) => {
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), { checkInDate: newCheckIn, checkOutDate: newCheckOut });
      showNotification('Даты обновлены');
    } catch (e) {
      showNotification('Ошибка: ' + e.message, 'error');
    }
  };

  const handleGuestUpdate = async (id, d) => {
    setGuestDetailsModal({ open: false, guest: null });
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', id), d);
  };

  const handleAdminReduceDays = async (g, rd) => {
    const newDays = parseInt(g.days) - parseInt(rd);
    const newTotal = newDays * parseInt(g.pricePerNight);
    const refundAmount = parseInt(rd) * parseInt(g.pricePerNight);
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), {
      days: newDays, totalPrice: newTotal,
      amountPaid: (g.amountPaid || 0) - refundAmount,
      paidCash:   (g.paidCash   || 0) - refundAmount,
    });
    const stay = getStayDetails(g.checkInDate, newDays);
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), { checkOutDate: stay.end.toISOString() });
    showNotification('Days reduced');
  };

  const handleAdminReduceDaysNoRefund = async (g, rd) => {
    const newDays = parseInt(g.days) - parseInt(rd);
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), {
      days: newDays, totalPrice: newDays * parseInt(g.pricePerNight),
    });
    const stay = getStayDetails(g.checkInDate, newDays);
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), { checkOutDate: stay.end.toISOString() });
    showNotification('Reduced (No Refund)');
  };

  const handlePayDebt = async (targets, amount, methods = { cash: amount, card: 0, qr: 0 }) => {
    try {
      const safeStaffId = currentUser.id || currentUser.login;
      let remaining = amount;
      for (const target of targets) {
        if (remaining <= 0) break;
        const pay = Math.min(remaining, target.currentDebt);
        const ratio = pay / amount;
        const cashPay = Math.floor(methods.cash * ratio);
        const cardPay = Math.floor(methods.card * ratio);
        const qrPay   = Math.floor(methods.qr   * ratio);
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', target.id), {
          paidCash: increment(cashPay), paidCard: increment(cardPay), paidQR: increment(qrPay), amountPaid: increment(pay),
        });
        await logTransaction(target.id, { cash: cashPay, card: cardPay, qr: qrPay }, safeStaffId);
        remaining -= pay;
      }
      showNotification('Debt Paid!');
    } catch (e) {
      showNotification('Error paying debt', 'error');
    }
  };

  const handleAdminAdjustDebt = async (guestId, adjustment) => {
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), { totalPrice: increment(adjustment) });
      showNotification('Debt Adjusted');
    } catch (e) {
      showNotification('Error adjusting', 'error');
    }
  };

  const handleRejectBooking = async (booking) => {
    try {
      await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', booking.id));
      showNotification('Бронь отклонена');
    } catch (e) {
      showNotification('Ошибка', 'error');
    }
  };

  return {
    handleUndo, pushUndo, logTransaction,
    handleCheckInSubmit, handleCheckIn,
    handleCheckOut, handlePayment, handleExtendGuest,
    handleSuperPayment, handleBulkExtend,
    handleCreateDebt, handleActivateBooking,
    handleSplitGuest, handleMoveGuest, handleDeleteGuest,
    handleRescheduleGuest, handleGuestUpdate,
    handleAdminReduceDays, handleAdminReduceDaysNoRefund,
    handlePayDebt, handleAdminAdjustDebt,
    handleRejectBooking,
  };
}
