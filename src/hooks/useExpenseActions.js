/**
 * useExpenseActions — расходы, удаление платежей, экспорт.
 */
import { collection, doc, addDoc, updateDoc, deleteDoc, increment } from 'firebase/firestore';

import * as XLSX from 'xlsx';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { sendTelegramMessage } from '../utils/telegram';
import { enqueueTelegram } from '../utils/offlineQueue';
import { logAction } from '../utils/auditLog';
import TRANSLATIONS from '../constants/translations';
import { HOSTELS } from '../utils/helpers';

/**
 * Генерирует автоописание расхода для отчётов.
 * - Нет комментария → просто "Категория" (напр. "Вода")
 * - Есть комментарий → "Категория: комментарий" (напр. "Такси: Фазлиддин оплатил")
 */
export function buildExpenseComment(expense) {
  const category = (expense.category || '').trim();
  const comment  = (expense.comment  || '').trim();

  if (!comment) return category;

  // Если уже начинается с "Категория: " — не дублировать
  if (comment.startsWith(category + ': ')) return comment;

  return `${category}: ${comment}`;
}

export function useExpenseActions({
  currentUser, selectedHostelFilter,
  expenses, usersList, lang,
  setExpenseModal, setUndoStack,
  showNotification, isOnline = true,
}) {

  const pushUndo = (item) => {
    setUndoStack(prev => [
      { ...item, id: Date.now(), timestamp: new Date().toISOString() },
      ...prev,
    ].slice(0, 5));
  };

  const handleAddExpense = async (d) => {
    try {
      const isFazliddin = currentUser.login === 'fazliddin';
      // fazliddin (кассир hostel2) может вести расходы по выбранному хостелу,
      // включая hostel1 — как админ/super, по selectedHostelFilter.
      const hostelId = (currentUser.role === 'admin' || currentUser.role === 'super')
        ? selectedHostelFilter
        : isFazliddin
          ? ((selectedHostelFilter && selectedHostelFilter !== 'all') ? selectedHostelFilter : currentUser.hostelId)
          : currentUser.hostelId;

      // Расходы fazliddin по первому хостелу не вычитаются из его кассы
      const skipCashbox = !!d.skipCashbox || (isFazliddin && hostelId === 'hostel1');

      const expRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'expenses'), {
        ...d,
        comment: buildExpenseComment(d),
        hostelId,
        staffId: currentUser.id || currentUser.login,
        date: d.date || new Date().toISOString(),
        skipCashbox,
      });

      pushUndo({
        type: 'expense',
        label: `${d.category}: ${(+d.amount).toLocaleString()} сум${skipCashbox ? ' (без вычета с кассы)' : ''}${d.comment ? ' — ' + d.comment : ''}`,
        expenseId: expRef.id,
      });

      setExpenseModal(false);
      showNotification('Расход добавлен', 'success');
      logAction(currentUser, 'expense_add', { amount: d.amount, category: d.category, comment: d.comment });

      if (d.category !== 'Возврат' && !skipCashbox && currentUser.role !== 'admin' && currentUser.role !== 'super') {
        const hostelLabel = hostelId === 'hostel1' ? 'Хостел №1' : hostelId === 'hostel2' ? 'Хостел №2' : hostelId || '—';
        const tgMsg = `💳 <b>Расход</b>\n🏨 ${hostelLabel}\n📂 ${d.category}\n💰 ${(+d.amount).toLocaleString()} сум${d.comment ? '\n💬 ' + d.comment : ''}\n👤 Кассир: ${currentUser.name || currentUser.login}`;
        if (isOnline) {
          await sendTelegramMessage(tgMsg, 'expenseAdded');
        } else {
          enqueueTelegram(tgMsg, 'expenseAdded');
        }
      }
    } catch (err) {
      console.error('Ошибка добавления расхода:', err);
      showNotification('Ошибка: ' + (err.message || 'не удалось сохранить'), 'error');
    }
  };

  const handleDeletePayment = async (id, type, record = {}) => {
    // Сначала корректируем баланс гостя, потом удаляем запись —
    // чтобы при сбое платёж остался и его можно было попробовать снова
    if (type === 'income' && record.guestId && record.category !== 'registration') {
      try {
        const cash  = Number(record.cash)   || 0;
        const card  = Number(record.card)   || 0;
        const qr    = Number(record.qr)     || 0;
        const total = Number(record.amount) || (cash + card + qr);
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', record.guestId), {
          paidCash: increment(-cash), paidCard: increment(-card),
          paidQR: increment(-qr), amountPaid: increment(-total),
        });
      } catch (e) {
        console.warn('Не удалось обновить баланс гостя:', e.message);
      }
    }

    await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, type === 'income' ? 'payments' : 'expenses', id));

    let msg = `🗑 <b>Удалена запись</b>\nТип: ${type === 'income' ? 'Платёж' : record.category === 'Возврат' ? 'Возврат' : 'Расход'}`;
    if (type === 'income') {
      if (record.guestName || record.guest) msg += `\n👤 Гость: ${record.guestName || record.guest}`;
      if (record.amount) msg += `\n💵 Сумма: ${Number(record.amount).toLocaleString()} сум`;
      if (record.method) msg += `\n💳 Метод: ${record.method}`;
      if (record.date)   msg += `\n📅 Дата: ${new Date(record.date).toLocaleString('ru')}`;
    } else {
      if (record.category) msg += `\n📂 Категория: ${record.category}`;
      if (record.amount)   msg += `\n💵 Сумма: ${Number(record.amount).toLocaleString()} сум`;
      if (record.comment)  msg += `\n💬 ${record.comment}`;
      if (record.date)     msg += `\n📅 Дата: ${new Date(record.date).toLocaleString('ru')}`;
    }
    msg += `\n👤 Удалил: ${currentUser?.name || currentUser?.login || '—'}`;
    showNotification('Запись удалена');
  };

  const downloadExpensesCSV = () => {
    const filtered = currentUser?.role === 'super'
      ? expenses
      : expenses.filter(e => e.hostelId === (currentUser?.role === 'admin' ? selectedHostelFilter : currentUser?.hostelId));

    const today = new Date().toLocaleDateString('ru-RU');
    const reportDate = new Date().toISOString().split('T')[0];
    const hostelKey = currentUser?.role === 'super' ? 'all' : (currentUser?.role === 'admin' ? selectedHostelFilter : currentUser?.hostelId);
    const hostelSlug = hostelKey === 'hostel1' ? 'Хостел1' : hostelKey === 'hostel2' ? 'Хостел2' : 'Все';

    // ─── Данные по расходам ───────────────────────────────────────────────
    const rows = filtered.map(e => {
      const d = new Date(e.date);
      return {
        'Дата':        d.toLocaleDateString('ru-RU'),
        'Время':       d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        'Хостел':      HOSTELS[e.hostelId]?.name || e.hostelId || '—',
        'Категория':   e.category || '—',
        'Сумма (сум)': Number(e.amount) || 0,
        'Кассир':      usersList.find(u => u.id === e.staffId || u.login === e.staffId)?.name || e.staffId || '—',
        'Комментарий': e.comment || '',
      };
    }).sort((a, b) => a['Дата'].localeCompare(b['Дата']));

    const totalAmount = rows.reduce((s, r) => s + r['Сумма (сум)'], 0);

    // Строка итого
    rows.push({
      'Дата':        'ИТОГО',
      'Время':       '',
      'Хостел':      '',
      'Категория':   '',
      'Сумма (сум)': totalAmount,
      'Кассир':      '',
      'Комментарий': '',
    });

    // ─── Сводка по категориям ─────────────────────────────────────────────
    const byCategory = {};
    filtered.forEach(e => {
      const cat = e.category || 'Другое';
      byCategory[cat] = (byCategory[cat] || 0) + (Number(e.amount) || 0);
    });
    const summaryRows = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, sum]) => ({
        'Категория':           cat,
        'Сумма (сум)':         sum,
        'Доля (%)': totalAmount > 0 ? +((sum / totalAmount) * 100).toFixed(1) : 0,
      }));
    summaryRows.push({ 'Категория': 'ИТОГО', 'Сумма (сум)': totalAmount, 'Доля (%)': 100 });

    // ─── Сводка по хостелам ───────────────────────────────────────────────
    const byHostel = {};
    filtered.forEach(e => {
      const h = HOSTELS[e.hostelId]?.name || e.hostelId || '—';
      byHostel[h] = (byHostel[h] || 0) + (Number(e.amount) || 0);
    });
    const hostelRows = Object.entries(byHostel)
      .sort((a, b) => b[1] - a[1])
      .map(([h, sum]) => ({
        'Хостел':      h,
        'Сумма (сум)': sum,
        'Доля (%)': totalAmount > 0 ? +((sum / totalAmount) * 100).toFixed(1) : 0,
      }));
    hostelRows.push({ 'Хостел': 'ИТОГО', 'Сумма (сум)': totalAmount, 'Доля (%)': 100 });

    // ─── Создание книги ───────────────────────────────────────────────────
    const wb = XLSX.utils.book_new();

    // Лист 1: Все расходы
    const ws1 = XLSX.utils.json_to_sheet(rows);
    ws1['!cols'] = [
      { wch: 12 }, // Дата
      { wch: 7  }, // Время
      { wch: 16 }, // Хостел
      { wch: 18 }, // Категория
      { wch: 16 }, // Сумма
      { wch: 18 }, // Кассир
      { wch: 35 }, // Комментарий
    ];
    ws1['!freeze'] = { xSplit: 0, ySplit: 1 };
    ws1['!autofilter'] = { ref: ws1['!ref'] };
    XLSX.utils.book_append_sheet(wb, ws1, 'Расходы');

    // Лист 2: По категориям
    const ws2 = XLSX.utils.json_to_sheet(summaryRows);
    ws2['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 12 }];
    ws2['!freeze'] = { xSplit: 0, ySplit: 1 };
    ws2['!autofilter'] = { ref: ws2['!ref'] };
    XLSX.utils.book_append_sheet(wb, ws2, 'По категориям');

    // Лист 3: По хостелам
    const ws3 = XLSX.utils.json_to_sheet(hostelRows);
    ws3['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 12 }];
    ws3['!freeze'] = { xSplit: 0, ySplit: 1 };
    ws3['!autofilter'] = { ref: ws3['!ref'] };
    XLSX.utils.book_append_sheet(wb, ws3, 'По хостелам');

    XLSX.writeFile(wb, `Расходы_${hostelSlug}_${reportDate}.xlsx`);
  };

  const handleCashToTerminal = async (amount, comment = '', dateOverride = null, receipt = null) => {
    try {
      const hostelId = (currentUser.role === 'admin' || currentUser.role === 'super')
        ? selectedHostelFilter
        : currentUser.hostelId;
      await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'payments'), {
        type: 'cash_to_terminal',
        amount: Number(amount),
        method: 'cash',
        comment: comment || 'Инкассация — перевод наличных в терминал',
        staffId: currentUser.id || currentUser.login,
        staffName: currentUser.name || currentUser.login,
        hostelId,
        date: dateOverride || new Date().toISOString(),
        ...(receipt ? { receipt } : {}),
      });
      showNotification(`✅ Инкассация записана: ${Number(amount).toLocaleString()} сум`, 'success');
      logAction(currentUser, 'cash_to_terminal', { amount, hostelId, comment });
    } catch (err) {
      showNotification('Ошибка: ' + (err.message || 'не удалось сохранить'), 'error');
    }
  };

  const handleEditExpenseCategory = async (expenseId, newCategory) => {
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'expenses', expenseId), { category: newCategory });
      showNotification('Категория обновлена', 'success');
    } catch (err) {
      showNotification('Ошибка: ' + (err.message || 'не удалось обновить'), 'error');
    }
  };

  /** Обновляет comment у расходов текущего месяца по новой логике */
  const handleBackfillComments = async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    const toUpdate = expenses.filter(e =>
      e.date >= monthStart && e.date < monthEnd && e.category !== 'Возврат'
    );

    if (toUpdate.length === 0) {
      showNotification('Нет записей для обновления', 'info');
      return;
    }

    let updated = 0;
    for (const e of toUpdate) {
      const newComment = buildExpenseComment(e);
      if (newComment !== (e.comment || '').trim()) {
        try {
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'expenses', e.id), { comment: newComment });
          updated++;
        } catch (_) { /* skip */ }
      }
    }
    showNotification(`Обновлено ${updated} из ${toUpdate.length} записей`, 'success');
  };

  /** Редактирует поля расхода (для админа) */
  const handleUpdateExpense = async (expenseId, patch) => {
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'expenses', expenseId), patch);
      showNotification('Расход обновлён', 'success');
    } catch (err) {
      showNotification('Ошибка: ' + (err.message || 'не удалось обновить'), 'error');
    }
  };

  return { handleAddExpense, handleDeletePayment, downloadExpensesCSV, handleCashToTerminal, handleEditExpenseCategory, handleBackfillComments, handleUpdateExpense };
}
