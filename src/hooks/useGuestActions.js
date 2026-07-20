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
  collection, doc, addDoc, updateDoc, deleteDoc, increment, writeBatch, deleteField,
} from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { sendTelegramMessage } from '../utils/telegram';
import { logAction } from '../utils/auditLog';
import { getStayDetails, getTotalPaid } from '../utils/helpers';
import { enqueuePayment, enqueueTelegram } from '../utils/offlineQueue';
import { notifySiteBooking } from '../utils/siteCallback';

export function useGuestActions(ctx) {
  const {
    currentUser, rooms, guests, clients,
    cadastreRegs,
    selectedHostelFilter, lang,
    checkInModal, setCheckInModal,
    setGuestDetailsModal, setMoveGuestModal,
    setUndoStack, setUndoHistoryOpen,
    showNotification, isOnline = true,
    setEmehmonReminder,
    setEmehmonArrivalPrompt,
    onEmehmonDepart,
    onEmehmonAutoArrival,
    onEmehmonAutoDepart,
  } = ctx;

  // ─── Internal helpers ────────────────────────────────────────────────────

  const logTransaction = async (guestId, amounts, staffId) => {
    const { cash = 0, card = 0, qr = 0, transfer = 0 } = amounts;
    const date = new Date().toISOString();
    const items = [];
    const ids = [];
    if (cash     > 0) items.push({ guestId, staffId, amount: cash,     method: 'cash',     date, hostelId: currentUser.hostelId });
    if (card     > 0) items.push({ guestId, staffId, amount: card,     method: 'card',     date, hostelId: currentUser.hostelId });
    if (qr       > 0) items.push({ guestId, staffId, amount: qr,       method: 'qr',       date, hostelId: currentUser.hostelId });
    if (transfer > 0) items.push({ guestId, staffId, amount: transfer, method: 'transfer', date, hostelId: currentUser.hostelId });
    for (const item of items) {
      const ref = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'payments'), item);
      ids.push(ref.id);
    }
    // Fix 16: храним lastPaymentAt на госте — используется в Gate 4 авто-выселения
    if (items.length > 0) {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), { lastPaymentAt: date });
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
          bonusCheckOutDate: item.prevBonusCheckOut ? item.prevBonusCheckOut : deleteField(),
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
      } else if (item.type === 'activate_booking') {
        // Заселение брони: возвращаем статус «бронь» и счётчик занятости комнаты
        fb.update(doc(db, ...PUBLIC_DATA_PATH, 'guests', item.guestId), { status: 'booking' });
        if (item.roomId)
          fb.update(doc(db, ...PUBLIC_DATA_PATH, 'rooms', item.roomId), { occupied: increment(-1) });
      } else if (item.type === 'trim') {
        const trimRestore = {
          days: item.prevDays, totalPrice: item.prevTotalPrice, checkOutDate: item.prevCheckOut,
          bonusCheckOutDate: item.prevBonusCheckOut ? item.prevBonusCheckOut : deleteField(),
        };
        fb.update(doc(db, ...PUBLIC_DATA_PATH, 'guests', item.guestId), trimRestore);
      } else if (item.type === 'expense') {
        fb.delete(doc(db, ...PUBLIC_DATA_PATH, 'expenses', item.expenseId));
      } else if (item.type === 'cadastre_expense') {
        fb.delete(doc(db, ...PUBLIC_DATA_PATH, 'expenses', item.expenseId));
        fb.update(doc(db, ...PUBLIC_DATA_PATH, 'cadastreRegistrations', item.regId), {
          expenseAdded: false,
          expenseId: null,
        });
      } else if (item.type === 'cadastre_remove') {
        fb.update(doc(db, ...PUBLIC_DATA_PATH, 'cadastreRegistrations', item.regId), {
          status: 'active',
          removedAt: deleteField(),
          removedBy: deleteField(),
        });
        if (item.expenseId) {
          fb.delete(doc(db, ...PUBLIC_DATA_PATH, 'expenses', item.expenseId));
          fb.update(doc(db, ...PUBLIC_DATA_PATH, 'cadastreRegistrations', item.regId), {
            expenseAdded: false,
            expenseId: null,
          });
        }
      } else if (item.type === 'balance_topup') {
        // Откатываем пополнение баланса: уменьшаем balance клиента, удаляем запись в кассе
        fb.update(doc(db, ...PUBLIC_DATA_PATH, 'clients', item.clientId), { balance: increment(-item.amount) });
        if (item.paymentId) fb.delete(doc(db, ...PUBLIC_DATA_PATH, 'payments', item.paymentId));
      } else if (item.type === 'debtPayment') {
        // Откатываем погашение долга: удаляем платёжные документы и уменьшаем amountPaid
        (item.paymentIds || []).forEach(pid => fb.delete(doc(db, ...PUBLIC_DATA_PATH, 'payments', pid)));
        for (const t of (item.targets || [])) {
          fb.update(doc(db, ...PUBLIC_DATA_PATH, 'guests', t.id), {
            paidCash: increment(-t.cashPay),
            paidCard: increment(-t.cardPay),
            paidQR:   increment(-t.qrPay),
            amountPaid: increment(-(t.cashPay + t.cardPay + t.qrPay)),
          });
        }
      } else if (item.type === 'rental') {
        // Откат любого действия с арендой: восстанавливаем прошлое состояние комнаты
        // (rental + rentalHistory) и удаляем платежи, созданные действием.
        const restore = { rental: item.prevRental || { active: false } };
        restore.rentalHistory = (item.prevRentalHistory == null) ? deleteField() : item.prevRentalHistory;
        fb.update(doc(db, ...PUBLIC_DATA_PATH, 'rooms', item.roomId), restore);
        (item.paymentIds || []).forEach(pid => fb.delete(doc(db, ...PUBLIC_DATA_PATH, 'payments', pid)));
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

      // Бронь с сайта/бота: переносим метаданные (код брони, канал, tg-чат гостя)
      // в новую запись — для аналитики «откуда гость» и обратной связи с сайтом.
      // Телефон гостя тоже не должен потеряться.
      const srcBooking = checkInModal.bookingId ? (checkInModal.client || null) : null;
      const bookingMeta = srcBooking ? {
        bookingCode: srcBooking.bookingCode || '',
        mysqlId:     srcBooking.mysqlId || 0,
        tgChatId:    srcBooking.tgChatId || 0,
        channel:     srcBooking.channel || 'site',
        fromWebsite: true,
        ...(!formData.phone && srcBooking.phone ? { phone: srcBooking.phone } : {}),
      } : {};

      const newGuest = {
        ...formData,
        ...bookingMeta,
        hostelId: targetHostelId,
        staffId: safeStaffId,
        checkInDate:  new Date(formData.checkInDate).toISOString(),
        checkOutDate: new Date(formData.checkOutDate).toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: currentUser.login || 'admin',
        passportClean: formData.passport ? formData.passport.replace(/\s/g, '').toUpperCase() : '',
      };

      // Залог по брони: гость мог внести предоплату до заселения (без паспорта).
      // Переносим её в запись гостя (платёжные записи уже созданы при приёме залога,
      // поэтому здесь только поля гостя — без новой записи в кассе).
      const depCash = srcBooking && !srcBooking.depositMoved ? (Number(srcBooking.paidCash) || 0) : 0;
      const depCard = srcBooking && !srcBooking.depositMoved ? (Number(srcBooking.paidCard) || 0) : 0;
      const depQR   = srcBooking && !srcBooking.depositMoved ? (Number(srcBooking.paidQR)   || 0) : 0;
      const depTotal = depCash + depCard + depQR;
      if (depTotal > 0) {
        newGuest.paidCash   = (Number(newGuest.paidCash) || 0) + depCash;
        newGuest.paidCard   = (Number(newGuest.paidCard) || 0) + depCard;
        newGuest.paidQR     = (Number(newGuest.paidQR)   || 0) + depQR;
        newGuest.amountPaid = (Number(newGuest.amountPaid) || 0) + depTotal;
        newGuest.depositFromBooking = depTotal; // след: сколько пришло залогом
      }

      const docRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'guests'), newGuest);
      const guestId = docRef.id;

      const paidBalance = Number(formData.paidBalance) || 0;
      const paidTransfer = Number(formData.paidTransfer) || 0;
      const totalPaid = (Number(formData.paidCash) || 0) + (Number(formData.paidCard) || 0) + (Number(formData.paidQR) || 0) + paidTransfer + paidBalance;
      let checkinPaymentIds = [];
      if (totalPaid > 0) {
        const methodParts = [Number(formData.paidCash)>0, Number(formData.paidCard)>0, Number(formData.paidQR)>0, paidTransfer>0].filter(Boolean).length;
        const payRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'payments'), {
          guestId, staffId: safeStaffId, guestName: formData.fullName,
          roomId: formData.roomId, roomNumber: formData.roomNumber,
          amount: totalPaid,
          cash: Number(formData.paidCash) || 0,
          card: Number(formData.paidCard) || 0,
          qr:   Number(formData.paidQR)   || 0,
          transfer: paidTransfer,
          balance: paidBalance,
          date: new Date().toISOString(),
          type: 'income', category: 'accommodation', comment: formData.fullName,
          hostelId: targetHostelId, admin: currentUser.login || 'admin',
          method: methodParts > 1 ? 'split' : Number(formData.paidCash)>0 ? 'cash' : Number(formData.paidCard)>0 ? 'card' : Number(formData.paidQR)>0 ? 'qr' : paidTransfer>0 ? 'transfer' : 'balance',
        });
        checkinPaymentIds = [payRef.id];
      }
      // Вычитаем применённый баланс из профиля клиента
      if (paidBalance > 0) {
        const clientRec = clients.find(c => c.passport && formData.passport &&
          c.passport.replace(/\s/g,'').toUpperCase() === formData.passport.replace(/\s/g,'').toUpperCase());
        if (clientRec) {
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'clients', clientRec.id), {
            balance: increment(-paidBalance),
          });
        }
      }

      if (formData.status === 'active') {
        const room = rooms.find(r => r.id === formData.roomId);
        if (room) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', room.id), { occupied: increment(1) });
      }

      if (checkInModal.bookingId) {
        // Групповая бронь (несколько мест): заселяем по одному человеку, бронь
        // живёт, пока не заселены все. Каждому — своя запись со своим паспортом.
        const totalBeds = parseInt(srcBooking?.beds, 10) || 1;
        const seated = (parseInt(srcBooking?.seatedCount, 10) || 0) + 1;
        if (totalBeds > seated) {
          try {
            await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', checkInModal.bookingId), {
              seatedCount: seated,
              // залог перенесён первому заселённому — на брони обнуляем, чтобы не задвоить
              ...(depTotal > 0 ? { paidCash: 0, paidCard: 0, paidQR: 0, amountPaid: 0, depositMoved: true } : {}),
            });
          } catch (_) {}
          showNotification(`Заселён ${seated}-й из ${totalBeds} — бронь остаётся, заселите остальных так же`, 'info');
        } else {
          try { await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', checkInModal.bookingId)); } catch (_) {}
        }
        // Обратная связь сайту: active = гость пришёл (checked_in), booking = бронь
        // подтверждена с назначенным местом (confirmed). Для группы шлём один раз —
        // при первом заселённом. Гость получит Telegram-уведомление.
        if (srcBooking?.bookingCode && seated === 1) {
          notifySiteBooking(srcBooking, formData.status === 'active' ? 'checked_in' : 'confirmed')
            .then(r => {
              if (r?.status === 'ok' && r.notified) {
                showNotification('Гость получил подтверждение в Telegram ✓', 'success');
              } else if (r?.status === 'error') {
                console.warn('[siteCallback]', r.message);
              }
            });
        }
      }

      showNotification(lang === 'ru' ? 'Гость успешно заселен!' : 'Mehmon muvaffaqiyatli joylashtirildi!', 'success');
      logAction(currentUser, newGuest.status === 'active' ? 'checkin' : 'booking_add', {
        guestName: newGuest.fullName, roomNumber: newGuest.roomNumber, bedId: newGuest.bedId, amount: totalPaid,
      });

      if (newGuest.status === 'active') {
        const hostelLabel = targetHostelId === 'hostel1' ? 'Хостел №1' : 'Хостел №2';
        const checkinMsg = `🏨 <b>Новое заселение</b>\n👤 ${newGuest.fullName}\n🛏 ${hostelLabel} · Ком. ${newGuest.roomNumber || '—'}, место ${newGuest.bedId || '—'}\n📅 ${new Date(newGuest.checkInDate).toLocaleDateString('ru')} → ${new Date(newGuest.checkOutDate).toLocaleDateString('ru')} (${newGuest.days || 1} дн.)\n💰 Оплачено: ${totalPaid.toLocaleString()} сум\n👷 Кассир: ${currentUser.name || currentUser.login}`;
        if (isOnline) {
          sendTelegramMessage(checkinMsg, 'checkin');
        } else {
          enqueueTelegram(checkinMsg, 'checkin');
        }
        pushUndo({
          type: 'checkin',
          label: `${newGuest.fullName} — комн. ${newGuest.roomNumber}, место ${newGuest.bedId}`,
          guestId, paymentIds: checkinPaymentIds, roomId: formData.roomId, wasActive: true,
        });
        await upsertClient(formData);

        // e-mehmon: граждан Узбекистана регистрируем ПОЛНОСТЬЮ авто, но только
        // ПОСЛЕ ОПЛАТЫ (новые деньги ИЛИ залог, внесённый по брони заранее).
        // Заселение в долг → регистрация запустится при первой оплате (handlePayment).
        if (window.electronAPI?.openEmehmon && newGuest.country && !newGuest.emehmonReg) {
          if (newGuest.country === 'Узбекистан') {
            if ((totalPaid + depTotal) > 0 && onEmehmonAutoArrival && window.electronAPI?.emehmonArrivalAuto) {
              onEmehmonAutoArrival({ id: guestId, ...newGuest });
            }
          } else if (setEmehmonArrivalPrompt) {
            setEmehmonArrivalPrompt({ id: guestId, ...newGuest });
          }
        }
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
        if (r) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', r.id), { occupied: increment(1) });
        await upsertClient(data);
      }
      showNotification(data.status === 'booking' ? 'Booking created' : 'Checked In!');
    } catch (e) {
      showNotification(e.message, 'error');
    }
  };

  const handleCheckOut = async (guest, final) => {
    try {
      setGuestDetailsModal({ open: false, guest: null });
      const paidTotal = getTotalPaid(guest);
      const rawOverpay = Math.max(0, paidTotal - (final.totalPrice || 0));
      const alreadySettled = Math.max(0, Number(guest.refundSettledAmount || 0));
      const pendingRefund = Math.max(0, rawOverpay - alreadySettled);

      // Защита от двойного начисления: можно обработать только остаток непогашенной переплаты
      const requestedRefund = Math.max(0, Number(final.refundAmount || 0));
      const requestedMixBalance = Math.max(0, Number(final.mixBalanceAmount || 0));
      const balancePart = final.leaveOnBalance
        ? Math.min(requestedRefund, pendingRefund)
        : Math.min(requestedMixBalance, pendingRefund);
      const cashPart = final.leaveOnBalance
        ? 0
        : Math.min(requestedRefund, Math.max(0, pendingRefund - balancePart));
      const settledNow = balancePart + cashPart;

      const today = new Date(); today.setHours(12, 0, 0, 0);
      const originalCheckOut = new Date(guest.checkOutDate); originalCheckOut.setHours(12, 0, 0, 0);
      const finalCheckOutDate = today < originalCheckOut ? today.toISOString() : guest.checkOutDate;

      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guest.id), {
        totalPrice: final.totalPrice, status: 'checked_out', checkOutDate: finalCheckOutDate,
        bonusCheckOutDate: deleteField(),
        ...(settledNow > 0 ? {
          refundSettledAmount: increment(settledNow),
          lastRefundSettledAt: new Date().toISOString(),
        } : {}),
      });

      // Сразу (без задержки) предлагаем вывод из e-mehmon, если гость зарегистрирован
      // и ещё не выведен — окно выбора открывается прямо за подтверждением выселения.
      if (onEmehmonDepart && guest.emehmonReg && !guest.emehmonOut && window.electronAPI?.emehmonDeparture) {
        onEmehmonDepart(guest);
      }

      // Sync to clients collection on checkout (don't increment visits — already counted on check-in)
      await upsertClient({ ...guest, checkOutDate: finalCheckOutDate }, { incrementVisits: false });

      const r = rooms.find(i => i.id === guest.roomId);
      if (r) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', r.id), { occupied: increment(-1) });

      const hostelLabel = guest.hostelId === 'hostel1' ? 'Хостел №1' : 'Хостел №2';
      const checkoutMsg = `🚪 <b>Выселение</b>\n👤 ${guest.fullName}\n🛏 ${hostelLabel} · Ком. ${guest.roomNumber || '—'}\n📅 Заехал: ${new Date(guest.checkInDate).toLocaleDateString('ru')}\n💰 Итого: ${(final.totalPrice || 0).toLocaleString()} сум\n👷 Кассир: ${currentUser.name || currentUser.login}`;
      if (isOnline) {
        sendTelegramMessage(checkoutMsg, 'checkout');
      } else {
        enqueueTelegram(checkoutMsg, 'checkout');
      }

      if (balancePart > 0) {
        const clientRec = clients.find(c => c.passport && guest.passport &&
          c.passport.replace(/\s/g,'').toUpperCase() === guest.passport.replace(/\s/g,'').toUpperCase());
        if (clientRec) {
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'clients', clientRec.id), {
            balance: increment(balancePart),
          });
        }
      }

      if (cashPart > 0) {
        await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'expenses'), {
          amount: cashPart, category: 'Возврат',
          comment: `Возврат: ${guest.fullName} (${guest.passport})`,
          date: new Date().toISOString(),
          staffId: currentUser.id || currentUser.login,
          hostelId: currentUser.hostelId || guest.hostelId,
        });
        const refundMsg = `💸 <b>Возврат средств</b>\n👤 ${guest.fullName}\n💵 Сумма: ${cashPart.toLocaleString()} сум\n👷 Кассир: ${currentUser.name || currentUser.login}`;
        if (isOnline) {
          sendTelegramMessage(refundMsg, 'refund');
        } else {
          enqueueTelegram(refundMsg, 'refund');
        }
      }

      // Fix 10: логируем выселение в auditLog
      logAction(currentUser, 'checkout', {
        guestName: guest.fullName, roomNumber: guest.roomNumber,
        totalPrice: final.totalPrice, refund: cashPart, balanceTopUp: balancePart,
      });

      // Авто-снятие кадастр-регистраций при выселении гостя.
      // Матчим по guestId, паспорту ИЛИ имени — т.к. старые/ручные регистрации
      // могли быть созданы с другим guestId (id клиента) или вообще без него,
      // и тогда по выселенному гостю продолжали идти алерты «истекает регистрация».
      try {
        const normP = (s) => (s || '').replace(/\s/g, '').toUpperCase();
        const gPass = normP(guest.passport);
        const toRemove = (cadastreRegs || []).filter(r => {
          if (r.status !== 'active') return false;
          if (guest.id && r.guestId === guest.id) return true;
          if (gPass && normP(r.passport) === gPass) return true;
          // По имени — только если у регистрации нет паспорта (нет сильного ключа)
          if (!r.passport && guest.fullName && r.guestName === guest.fullName) return true;
          return false;
        });
        const removedAt = new Date().toISOString();
        for (const r of toRemove) {
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'cadastreRegistrations', r.id), {
            status: 'removed', removedAt, removedBy: 'auto_checkout',
          });
        }
      } catch (cadErr) {
        console.warn('[checkout] Не удалось снять кадастр-регистрации:', cadErr.message);
      }

    } catch (e) {
      console.error('handleCheckOut error:', e);
      showNotification('Ошибка выселения: ' + e.message, 'error');
    }
  };

  const handlePayment = async (guestId, amounts) => {
    try {
      const safeStaffId = currentUser.id || currentUser.login;
      const { cash = 0, card = 0, qr = 0, transfer = 0, balance: balanceUsed = 0 } = amounts;
      const total = cash + card + qr + transfer + balanceUsed;
      // Firestore offline persistence (persistentLocalCache) handles queuing automatically.
      // We also track in offlineQueue for Electron temp-file safety and UI badge.
      const g = guests.find(x => x.id === guestId);
      if (!isOnline) {
        enqueuePayment({ guestId, amounts: { cash, card, qr }, staffId: safeStaffId,
          hostelId: currentUser.hostelId, guestName: g?.fullName || '' });
      }
      const currentPaid = g ? (g.amountPaid || (g.paidCash||0) + (g.paidCard||0) + (g.paidQR||0)) : 0;
      const overpay = total > 0 ? Math.max(0, currentPaid + total - (g?.totalPrice || 0)) : 0;
      const guestUpdate = {
        paidCash: increment(cash), paidCard: increment(card), paidQR: increment(qr),
        ...(transfer > 0 ? { paidTransfer: increment(transfer) } : {}),
        amountPaid: increment(total),
      };
      if (balanceUsed > 0) guestUpdate.paidBalance = increment(balanceUsed);
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), guestUpdate);
      const paymentIds = await logTransaction(guestId, amounts, safeStaffId);
      const normStr = s => (s||'').replace(/\s/g,'').toUpperCase();
      const clientRec = g ? clients.find(c =>
        (c.passport && g.passport && normStr(c.passport) === normStr(g.passport)) ||
        (g.fullName && normStr(c.fullName) === normStr(g.fullName))
      ) : null;
      if (balanceUsed > 0 && clientRec) {
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'clients', clientRec.id), { balance: increment(-balanceUsed) });
      }
      if (overpay > 0 && clientRec) {
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'clients', clientRec.id), { balance: increment(overpay) });
      }
      if (total > 0) {
        pushUndo({ type: 'payment', label: `${total.toLocaleString()} сум — ${g?.fullName || guestId}`, guestId, paymentIds, cash, card, qr });
        if (g) {
          const hostelLabel = g.hostelId === 'hostel1' ? 'Хостел №1' : 'Хостел №2';
          const payMsg = `💵 <b>Оплата принята</b>\n👤 ${g.fullName}\n🛏 ${hostelLabel} · Ком. ${g.roomNumber || '—'}\n💰 ${total.toLocaleString()} сум\n👷 Кассир: ${currentUser.name || currentUser.login}`;
          if (isOnline) {
            sendTelegramMessage(payMsg, 'paymentAdded');
          } else {
            enqueueTelegram(payMsg, 'paymentAdded');
          }
        }
        // Авто-регистрация e-mehmon (граждане Узбекистана) — по факту первой оплаты
        // (заселение было в долг → регистрируем сейчас). emehmonSkip уважаем.
        if (g && g.status === 'active' && g.country === 'Узбекистан' &&
            !g.emehmonReg && !g.emehmonSkip &&
            onEmehmonAutoArrival && window.electronAPI?.emehmonArrivalAuto) {
          onEmehmonAutoArrival(g);
        }
      }
      setGuestDetailsModal({ open: false, guest: null });
      showNotification(isOnline ? 'Оплата принята' : '📵 Оплата сохранена — синхронизируется при подключении', isOnline ? 'success' : 'warning');
    } catch (e) {
      showNotification(e.message, 'error');
    }
  };

  const handleExtendGuest = async (guestId, extData) => {
    try {
      const safeStaffId = currentUser.id || currentUser.login;
      const { extendDays, payCash = 0, payCard = 0, payQR = 0,
              prevDays, prevTotalPrice, prevCheckOut, prevBonusCheckOut = null, prevStatus,
              newDays, newTotalPrice, newCheckOut } = extData;
      // Бонус: если он остаётся ДО нового checkOut — оставляем на месте (бонус будет посередине бара);
      // иначе сдвигаем на тот же офсет (старое поведение, если продлевают не от конца бонуса).
      let bonusUpdate;
      if (prevBonusCheckOut) {
        const prevBonusMs  = new Date(prevBonusCheckOut).getTime();
        const newCheckOutMs = new Date(newCheckOut).getTime();
        if (prevBonusMs <= newCheckOutMs) {
          // Бонус теперь в середине — не трогаем bonusCheckOutDate
          bonusUpdate = {};
        } else {
          // Бонус всё ещё после checkOut — сдвигаем на тот же офсет
          const extendOffsetMs = newCheckOutMs - new Date(prevCheckOut).getTime();
          const newBonusMs = prevBonusMs + extendOffsetMs;
          bonusUpdate = { bonusCheckOutDate: new Date(newBonusMs).toISOString() };
        }
      } else {
        bonusUpdate = { bonusCheckOutDate: deleteField() };
      }
      const extensionAddedPrice = newTotalPrice - prevTotalPrice;
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), {
        days: newDays, totalPrice: newTotalPrice, checkOutDate: newCheckOut, status: 'active',
        lastExtendedBy: safeStaffId,
        lastExtendedAt: new Date().toISOString(),
        lastExtensionPrice: extensionAddedPrice,
        ...bonusUpdate,
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
      pushUndo({ type: 'extend', label: `+${extendDays} дн. — ${g?.fullName || guestId}`, guestId, prevDays, prevTotalPrice, prevCheckOut, prevBonusCheckOut, prevStatus, paymentIds, payCash, payCard, payQR });
      if (g) {
        const extMsg = `📅 <b>Продление проживания</b>\n👤 ${g.fullName}\n➕ +${extendDays} дн. → ${new Date(newCheckOut).toLocaleDateString('ru')}\n💵 Доплачено: ${payTotal.toLocaleString()} сум\n👷 Кассир: ${currentUser.name || currentUser.login}`;
        if (isOnline) {
          sendTelegramMessage(extMsg, 'guestExtended');
        } else {
          enqueueTelegram(extMsg, 'guestExtended');
        }
      }
      setGuestDetailsModal({ open: false, guest: null });
      showNotification(`Продлено на ${extendDays} дн.`, 'success');
    } catch (e) {
      showNotification('Ошибка продления: ' + e.message, 'error');
    }
  };

  const handleSuperPayment = async (guestId, amount, method = 'cash') => {
    try {
      const methodField = method === 'card' ? 'paidCard' : method === 'qr' ? 'paidQR' : 'paidCash';
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), {
        [methodField]: increment(amount), amountPaid: increment(amount), superAdjusted: increment(amount),
        superAdjustedBy: currentUser.login || currentUser.id || 'unknown',
        superAdjustedAt: new Date().toISOString(),
      });
      // Зачёт не идёт в кассу/выручку, но фиксируется в аудит-логе — чтобы был след,
      // кто и кому зачёл сумму (виден владельцу/super).
      const g = guests.find(x => x.id === guestId);
      logAction(currentUser, 'super_payment', {
        guestId, guestName: g?.fullName || '', amount, method,
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
    try {
    for (const guestId of guestIds) {
      const guest = guests.find(g => g.id === guestId);
      if (!guest || guest.status !== 'active') continue;
      // Берём фактический диапазон (CI→CO), чтобы не опираться на устаревшее поле days
      const ciMs = new Date(guest.checkInDate  || guest.checkInDateTime || 0).getTime();
      const coMs = new Date(guest.checkOutDate || 0).getTime();
      const actualDays = (ciMs && coMs) ? Math.max(parseInt(guest.days || 1), Math.round((coMs - ciMs) / 86400000)) : parseInt(guest.days || 1);
      const newDays  = actualDays + days;
      const newTotal = parseInt(guest.pricePerNight || 0) * newDays;
      const co = new Date(guest.checkOutDate || Date.now()); co.setDate(co.getDate() + days);
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), {
        days: newDays, totalPrice: newTotal, checkOutDate: co.toISOString(), status: 'active',
      });
      count++;
    }
    if (count > 0) showNotification(`Продлено на ${days} дн. для ${count} гостей`, 'success');
    } catch (e) {
      showNotification('Ошибка продления: ' + e.message, 'error');
    }
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
      const debtMsg = `⚠️ <b>Создан долг</b>\n👤 ${client.fullName}\n💰 Сумма: ${amount.toLocaleString()} сум\n👷 Кассир: ${currentUser.name || currentUser.login}`;
      if (isOnline) {
        sendTelegramMessage(debtMsg, 'debtAlert');
      } else {
        enqueueTelegram(debtMsg, 'debtAlert');
      }
      showNotification('Debt created successfully');
    } catch (e) {
      showNotification('Error creating debt', 'error');
    }
  };

  const handleActivateBooking = async (guest) => {
    // Групповая бронь (несколько мест): активировать одной записью нельзя —
    // каждый человек заселяется отдельно со своим паспортом (кнопка «Заселить»
    // в заявке ведёт через окно заселения по одному).
    const bedsTotal = parseInt(guest.beds, 10) || 1;
    if (bedsTotal - (parseInt(guest.seatedCount, 10) || 0) > 1) {
      showNotification(`Групповая бронь (${bedsTotal} мест) — заселяйте каждого отдельно через «Заселить» в заявке`, 'error');
      return false;
    }
    // У брони с сайта место не выбрано — активация без койки создаст «гостя без места»
    if (!guest.roomId || !guest.bedId || guest.bedId === '-') {
      showNotification('У брони не выбрано место — нажмите «Заселить» в заявке и выберите койку', 'error');
      return false;
    }
    // Паспортные данные обязательны при фактическом заселении: бронь создаётся
    // без них, но активировать её «вслепую» нельзя (e-mehmon, госучёт).
    const passOk = (guest.passport || '').replace(/\s/g, '').length >= 5;
    if (!passOk || !guest.birthDate) {
      showNotification('Перед заселением дополните паспорт и дату рождения гостя', 'error');
      return false;
    }
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guest.id), { status: 'active' });
    const r = rooms.find(i => i.id === guest.roomId);
    if (r) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', r.id), { occupied: increment(1) });
    await upsertClient(guest);
    // Отмена действия: вернуть статус «бронь» и счётчик занятости комнаты
    pushUndo({
      type: 'activate_booking',
      label: `Заселение брони — ${guest.fullName}${guest.roomNumber ? ` (комн. ${guest.roomNumber})` : ''}`,
      guestId: guest.id, roomId: r?.id || null,
    });
    // Бронь с сайта/бота: сообщаем «гость заселён» (сайт + Telegram гостю)
    if (guest.bookingCode) notifySiteBooking(guest, 'checked_in');
    setGuestDetailsModal({ open: false, guest: null });
    showNotification('Activated');
    return true;
  };

  const handleSplitGuest = async (orig, splitAfterDays, gapDays) => {
    try {
      const firstLegDays = parseInt(splitAfterDays);
      const gap = parseInt(gapDays);
      const totalOriginalDays = parseInt(orig.days);
      const remainingDays = totalOriginalDays - firstLegDays;
      if (remainingDays <= 0) return;
      const price = parseInt(orig.pricePerNight) || (totalOriginalDays > 0 ? Math.round((parseInt(orig.totalPrice) || 0) / totalOriginalDays) : 0);
      // Оплата закрывает первую часть в первую очередь; остаток (долг) — на вторую,
      // а не размазывается пропорционально (иначе появлялся «долг-хвост»).
      const totalPaid = orig.amountPaid ?? ((orig.paidCash || 0) + (orig.paidCard || 0) + (orig.paidQR || 0));
      const firstCost = firstLegDays * price;
      const firstPaid = Math.min(totalPaid, firstCost);
      const r1 = totalPaid > 0 ? firstPaid / totalPaid : 1;
      const c1 = Math.round((orig.paidCash || 0) * r1);
      const d1 = Math.round((orig.paidCard || 0) * r1);
      const q1 = Math.round((orig.paidQR   || 0) * r1);
      const c2 = (orig.paidCash || 0) - c1;
      const d2 = (orig.paidCard || 0) - d1;
      const q2 = (orig.paidQR   || 0) - q1;
      const stay1 = getStayDetails(orig.checkInDate, firstLegDays);
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', orig.id), {
        days: firstLegDays, totalPrice: firstLegDays * price,
        amountPaid: c1 + d1 + q1,
        paidCash: c1, paidCard: d1, paidQR: q1,
        checkOutDate: stay1.end.toISOString(),
      });
      const secondStart = new Date(stay1.end);
      secondStart.setDate(secondStart.getDate() + gap);
      secondStart.setHours(12, 0, 0, 0);
      const stay2 = getStayDetails(secondStart.toISOString(), remainingDays);
      const nowForSplit = new Date();
      const newGuest = {
        ...orig, id: undefined,
        checkInDate: secondStart.toISOString(), checkOutDate: stay2.end.toISOString(),
        days: remainingDays, pricePerNight: price, totalPrice: remainingDays * price,
        amountPaid: c2 + d2 + q2,
        paidCash: c2, paidCard: d2, paidQR: q2,
        // Если вторая часть начинается в будущем — ставим 'booking', чтобы авто-выселение
        // её не трогало и она не показывалась как просроченная.
        status: secondStart > nowForSplit ? 'booking' : 'active',
        checkInDateTime: null, checkIn: null,
      };
      delete newGuest.id;
      // Вторая часть (после паузы) — новая регистрация в e-mehmon: сбрасываем отметки,
      // система оформит её при наступлении даты возврата.
      ['emehmonReg', 'emehmonRegAt', 'emehmonRegAuto', 'emehmonRegError', 'emehmonRegErrorAt',
       'emehmonOut', 'emehmonOutAt', 'emehmonOutAuto'].forEach(k => { delete newGuest[k]; });
      await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'guests'), newGuest);
      showNotification('Split successful!');
    } catch (e) {
      console.error(e);
      showNotification('Split Error', 'error');
    }
  };

  const handleMoveGuest = async (g, rid, rnum, bid) => {
    // То же самое место — ничего не делаем (иначе гость ошибочно «выселялся» сплитом)
    if (String(rid) === String(g.roomId) && String(bid) === String(g.bedId)) {
      setMoveGuestModal({ open: false, guest: null });
      showNotification('Гость уже на этом месте', 'info');
      return;
    }
    try {
      const now = new Date();
      const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);

      // Парсим дату заезда аналогично parseDate в CalendarView
      const rawCheckIn = new Date(g.checkInDate);
      if (!g.checkInDate.includes('T')) rawCheckIn.setHours(12, 0, 0, 0);

      const daysPassed = Math.floor((todayNoon - rawCheckIn) / 86400000);

      // Если гость ещё не заехал (бронь на будущее) — просто переносим комнату
      if (daysPassed <= 0) {
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), { roomId: rid, roomNumber: rnum, bedId: bid });
        setMoveGuestModal({ open: false, guest: null });
        setGuestDetailsModal({ open: false, guest: null });
        showNotification('Перемещено!');
        return;
      }

      const totalDays = parseInt(g.days) || 1;
      const remainingDays = totalDays - daysPassed;

      // Если оставшихся дней нет — просто обновляем комнату (гость уже давно выселен)
      if (remainingDays <= 0) {
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), { roomId: rid, roomNumber: rnum, bedId: bid });
        setMoveGuestModal({ open: false, guest: null });
        setGuestDetailsModal({ open: false, guest: null });
        showNotification('Перемещено!');
        return;
      }

      // --- Финансовый раздел оплаты ---
      // Оплата закрывает УЖЕ ПРОЖИТЫЕ дни в первую очередь; остаток (то, что гость
      // ещё должен) уходит на новую часть. Раньше делили пропорционально дням — из-за
      // этого на выселенной старой записи появлялся «долг-хвост», а с новой части
      // ошибочно списывалась часть оплаты, хотя долг за последние дни.
      const price = parseInt(g.pricePerNight) || (totalDays > 0 ? Math.round((parseInt(g.totalPrice) || 0) / totalDays) : 0);
      const totalPaid = g.amountPaid ?? ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0));
      const oldLegCost = daysPassed * price;
      const oldPaid = Math.min(totalPaid, oldLegCost);
      const r1 = totalPaid > 0 ? oldPaid / totalPaid : 1;
      // Каждый метод оплаты делим по той же доле; новая часть = остаток (без потерь на округлении).
      const oldCash = Math.round((g.paidCash || 0) * r1);
      const oldCard = Math.round((g.paidCard || 0) * r1);
      const oldQR   = Math.round((g.paidQR   || 0) * r1);
      const newCash = (g.paidCash || 0) - oldCash;
      const newCard = (g.paidCard || 0) - oldCard;
      const newQR   = (g.paidQR   || 0) - oldQR;
      const oldAmountPaid = oldCash + oldCard + oldQR;
      const newAmountPaid = newCash + newCard + newQR;

      // --- 1. Обновляем старую запись: обрезаем до сегодня, выселяем ---
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), {
        days:        daysPassed,
        checkOutDate: todayNoon.toISOString(),
        totalPrice:  daysPassed * price,
        amountPaid:  oldAmountPaid,
        paidCash:    oldCash,
        paidCard:    oldCard,
        paidQR:      oldQR,
        status:      'checked_out',
        // Убираем бонусный период из старой записи
        bonusCheckOutDate: null,
        bonusDaysAdded:    null,
      });

      // --- 2. Создаём новую запись в новой комнате с сегодняшней даты ---
      // Конечная дата берём из оригинального checkOut (если бонус активен — из bonusCheckOutDate)
      const originalCheckOut = (g.bonusCheckOutDate && new Date(g.bonusCheckOutDate) > new Date(g.checkOutDate))
        ? g.bonusCheckOutDate
        : g.checkOutDate;

      const newGuest = {
        ...g,
        id: undefined,
        roomId:      rid,
        roomNumber:  rnum,
        bedId:       bid,
        checkInDate:  todayNoon.toISOString(),
        checkOutDate: originalCheckOut,
        days:         remainingDays,
        totalPrice:   remainingDays * price,
        amountPaid:   newAmountPaid,
        paidCash:     newCash,
        paidCard:     newCard,
        paidQR:       newQR,
        status:       'active',
        checkInDateTime: null,
        movedFromRoom:   g.roomNumber || null, // для истории
      };
      delete newGuest.id;
      // Новая часть = НОВАЯ регистрация в e-mehmon (другая комната). Сбрасываем все
      // отметки: старую часть выведем из e-mehmon сами, а новую система зарегистрирует
      // при наступлении даты (граждан Узбекистана — авто, остальных — в «Оформить»).
      ['emehmonReg', 'emehmonRegAt', 'emehmonRegAuto', 'emehmonRegError', 'emehmonRegErrorAt',
       'emehmonOut', 'emehmonOutAt', 'emehmonOutAuto'].forEach(k => { delete newGuest[k]; });
      await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'guests'), newGuest);

      // Старую (выселенную) часть — тихий авто-вывод из e-mehmon в фоне, чтобы не
      // висело напоминание «вывести из e-mehmon пока не обновлю».
      if (g.emehmonReg && typeof onEmehmonAutoDepart === 'function') {
        onEmehmonAutoDepart({ ...g, status: 'checked_out' });
      }

      setMoveGuestModal({ open: false, guest: null });
      setGuestDetailsModal({ open: false, guest: null });
      showNotification(`Перемещено: ${daysPassed} дн. остались в ком. ${g.roomNumber}, ${remainingDays} дн. → ком. ${rnum}`);
    } catch (e) {
      showNotification('Ошибка: ' + e.message, 'error');
    }
  };

  const handleDeleteGuest = async (g) => {
    try {
      const guestId   = typeof g === 'string' ? g : g.id;
      const guestData = typeof g === 'object' ? g : guests.find(x => x.id === guestId);
      await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId));
      if (guestData?.status === 'active' && guestData.roomId !== 'DEBT_ONLY') {
        const r = rooms.find(i => i.id === guestData.roomId);
        if (r) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', r.id), { occupied: increment(-1) });
      }
      if (guestData) {
        const hostelLabel = guestData.hostelId === 'hostel1' ? 'Хостел №1' : 'Хостел №2';
        const notifType = guestData.status === 'booking' ? 'deleteBooking' : 'deleteGuest';
        const notifIcon = guestData.status === 'booking' ? '🗑️' : '🚫';
        const notifLabel = guestData.status === 'booking' ? 'Удалено бронирование' : 'Удалена запись гостя';
        const delMsg = `${notifIcon} <b>${notifLabel}</b>\n👤 ${guestData.fullName || '—'}\n🛏 ${hostelLabel} · Ком. ${guestData.roomNumber || '—'}\n📅 ${guestData.checkInDate ? new Date(guestData.checkInDate).toLocaleDateString('ru') : '—'} → ${guestData.checkOutDate ? new Date(guestData.checkOutDate).toLocaleDateString('ru') : '—'}\n👤 Удалил: ${currentUser?.name || currentUser?.login || '—'}`;
        if (isOnline) {
          sendTelegramMessage(delMsg, notifType);
        } else {
          enqueueTelegram(delMsg, notifType);
        }
      }
      setGuestDetailsModal({ open: false, guest: null });
      showNotification('Deleted');
    } catch (e) {
      showNotification('Ошибка удаления: ' + e.message, 'error');
    }
  };

  const handleRescheduleGuest = async (guestId, newCheckIn, newCheckOut) => {
    try {
      // Пересчитываем days из реального диапазона дат, чтобы поле не устаревало
      const ci = new Date(newCheckIn); ci.setHours(12, 0, 0, 0);
      const co = new Date(newCheckOut); co.setHours(12, 0, 0, 0);
      const newDays = Math.max(1, Math.round((co - ci) / 86400000));
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), {
        checkInDate: newCheckIn,
        checkOutDate: newCheckOut,
        days: newDays,
      });
      showNotification('Даты обновлены');
    } catch (e) {
      showNotification('Ошибка: ' + e.message, 'error');
    }
  };

  const handleGuestUpdate = async (id, d) => {
    // Strip undefined values — Firestore rejects them
    d = Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined));
    // Исправили паспортные данные → снимаем пометку «ошибка в паспортных данных»,
    // авто-регистрация e-mehmon попробует снова в ближайшем цикле (каждые 5 мин).
    const g0 = guests.find(x => x.id === id);
    if (g0?.emehmonRegError &&
        ['passport', 'birthDate', 'passportIssueDate', 'fullName', 'roomNumber'].some(k => d[k] !== undefined)) {
      d.emehmonRegError = deleteField();
      d.emehmonRegErrorAt = deleteField();
    }
    // Логируем изменение цены, если pricePerNight поменялась
    if (d.pricePerNight !== undefined) {
      const g = guests.find(x => x.id === id);
      if (g && parseInt(d.pricePerNight) !== parseInt(g.pricePerNight)) {
        logAction(currentUser, 'price_change', {
          guestId:    id,
          guestName:  g.fullName,
          oldPrice:   parseInt(g.pricePerNight) || 0,
          newPrice:   parseInt(d.pricePerNight) || 0,
          roomNumber: g.roomNumber,
          bedId:      g.bedId,
          hostelId:   g.hostelId,
        });
      }
    }
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', id), d);
  };

  const handleAdminReduceDays = async (g, rd) => {
    const newDays = parseInt(g.days) - parseInt(rd);
    const refundAmount = parseInt(rd) * parseInt(g.pricePerNight);
    const stay = getStayDetails(g.checkInDate, newDays);
    // Один updateDoc — атомарно, чтобы избежать несогласованность двух записей
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), {
      days: newDays,
      totalPrice: newDays * parseInt(g.pricePerNight),
      amountPaid: increment(-refundAmount),
      paidCash:   increment(-refundAmount),
      checkOutDate: stay.end.toISOString(),
    });
    showNotification('Days reduced');
  };

  const handleAdminReduceDaysNoRefund = async (g, rd) => {
    const newDays = parseInt(g.days) - parseInt(rd);
    const stay = getStayDetails(g.checkInDate, newDays);
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), {
      days: newDays,
      totalPrice: newDays * parseInt(g.pricePerNight),
      checkOutDate: stay.end.toISOString(),
    });
    showNotification('Reduced (No Refund)');
  };

  const handlePayDebt = async (targets, amount, methods = { cash: amount, card: 0, qr: 0 }) => {
    try {
      const safeStaffId = currentUser.id || currentUser.login;
      let remaining = amount;
      const totalMethods = (methods.cash || 0) + (methods.card || 0) + (methods.qr || 0);
      const allPaymentIds = [];
      const allTargetsWithPay = [];
      for (const target of targets) {
        if (remaining <= 0) break;
        const pay = Math.min(remaining, target.currentDebt);
        // Используем пропорцию с остатком, чтобы cashPay+cardPay+qrPay всегда = pay
        const cashPay = totalMethods > 0 ? Math.floor((methods.cash || 0) / totalMethods * pay) : pay;
        const cardPay = totalMethods > 0 ? Math.floor((methods.card || 0) / totalMethods * pay) : 0;
        const qrPay   = pay - cashPay - cardPay; // остаток обеспечивает целочисленность
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', target.id), {
          paidCash: increment(cashPay), paidCard: increment(cardPay), paidQR: increment(qrPay), amountPaid: increment(pay),
        });
        const payIds = await logTransaction(target.id, { cash: cashPay, card: cardPay, qr: qrPay }, safeStaffId);
        allPaymentIds.push(...payIds);
        allTargetsWithPay.push({ id: target.id, cashPay, cardPay, qrPay });
        remaining -= pay;
      }
      // Имя первого должника для метки
      const firstTarget = targets[0];
      const g = guests.find(x => x.id === firstTarget?.id);
      pushUndo({
        type: 'debtPayment',
        label: `Погашение долга — ${g?.fullName || firstTarget?.id || '?'} (${amount.toLocaleString()})`,
        paymentIds: allPaymentIds,
        targets: allTargetsWithPay,
      });
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

  const handleTrimDays = async (guestId, daysToRemove) => {
    try {
      const guest = guests.find(g => g.id === guestId);
      if (!guest || daysToRemove <= 0) return;
      const prevDays          = parseInt(guest.days || 1);
      const prevTotalPrice    = guest.totalPrice || 0;
      const prevCheckOut      = guest.checkOutDate;
      const prevBonusCheckOut = guest.bonusCheckOutDate || null;
      const pricePerNight     = parseInt(guest.pricePerNight) || (prevDays > 0 ? Math.round(prevTotalPrice / prevDays) : 0);

      const regularCo      = new Date(guest.checkOutDate);
      const bonusCo        = guest.bonusCheckOutDate ? new Date(guest.bonusCheckOutDate) : null;
      const bonusDaysAvail = bonusCo ? Math.max(0, Math.round((bonusCo.getTime() - regularCo.getTime()) / 86400000)) : 0;

      const updateData = {};
      let regularToTrim = 0;

      if (bonusDaysAvail > 0 && daysToRemove <= bonusDaysAvail) {
        // Only trim from bonus — days / totalPrice / checkOutDate stay unchanged
        const newBonusCo = new Date(bonusCo);
        newBonusCo.setDate(newBonusCo.getDate() - daysToRemove);
        updateData.bonusCheckOutDate = newBonusCo.getTime() <= regularCo.getTime()
          ? deleteField()
          : newBonusCo.toISOString();
      } else {
        // Remove all bonus (if any) then trim regular days
        if (bonusDaysAvail > 0) updateData.bonusCheckOutDate = deleteField();
        regularToTrim = daysToRemove - bonusDaysAvail;
        const newDays       = Math.max(1, prevDays - regularToTrim);
        const newTotalPrice = pricePerNight * newDays;
        const newCheckOut   = new Date(guest.checkOutDate);
        newCheckOut.setDate(newCheckOut.getDate() - regularToTrim);
        updateData.days = newDays;
        updateData.totalPrice = newTotalPrice;
        updateData.checkOutDate = newCheckOut.toISOString();
      }

      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), updateData);
      pushUndo({
        type: 'trim',
        label: `-${daysToRemove} дн. — ${guest.fullName}`,
        guestId, prevDays, prevTotalPrice, prevCheckOut, prevBonusCheckOut,
      });
      setGuestDetailsModal({ open: false, guest: null });
      const finalDateStr = updateData.checkOutDate
        ? new Date(updateData.checkOutDate).toLocaleDateString('ru')
        : (typeof updateData.bonusCheckOutDate === 'string'
            ? new Date(updateData.bonusCheckOutDate).toLocaleDateString('ru')
            : new Date(guest.checkOutDate).toLocaleDateString('ru'));
      showNotification(`Срезано ${daysToRemove} дн. Выезд: ${finalDateStr}`, 'success');
      logAction(currentUser, 'trim_days', { guestName: guest.fullName, daysToRemove, newDays: updateData.days || prevDays });
    } catch (e) {
      showNotification('Ошибка: ' + e.message, 'error');
    }
  };

  const handleRejectBooking = async (booking) => {
    try {
      await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', booking.id));
      showNotification('Бронь отклонена');
      // Сайту: отмена (место освободится в подсчёте доступности, гость получит
      // вежливое уведомление в Telegram, статус на «Проверке брони» — «отменена»)
      if (booking.bookingCode) {
        notifySiteBooking(booking, 'cancelled').then(r => {
          if (r?.status === 'ok' && r.notified) showNotification('Гость уведомлён об отмене в Telegram', 'info');
        });
      }
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
    handleRejectBooking, handleTrimDays,
  };
}
