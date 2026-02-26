/**
 * useExpenseActions — расходы, удаление платежей, экспорт.
 */
import { collection, doc, addDoc, updateDoc, deleteDoc, increment } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { sendTelegramMessage } from '../utils/telegram';
import { logAction } from '../utils/auditLog';
import TRANSLATIONS from '../constants/translations';
import { HOSTELS } from '../utils/helpers';

export function useExpenseActions({
  currentUser, selectedHostelFilter,
  expenses, usersList, lang,
  setExpenseModal, setUndoStack,
  showNotification,
}) {

  const pushUndo = (item) => {
    setUndoStack(prev => [
      { ...item, id: Date.now(), timestamp: new Date().toISOString() },
      ...prev,
    ].slice(0, 5));
  };

  const handleAddExpense = async (d) => {
    try {
      const hostelId = (currentUser.role === 'admin' || currentUser.role === 'super')
        ? selectedHostelFilter
        : currentUser.hostelId;

      const expRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'expenses'), {
        ...d,
        hostelId,
        staffId: currentUser.id || currentUser.login,
        date: new Date().toISOString(),
      });

      pushUndo({
        type: 'expense',
        label: `${d.category}: ${(+d.amount).toLocaleString()} сум${d.comment ? ' — ' + d.comment : ''}`,
        expenseId: expRef.id,
      });

      setExpenseModal(false);
      showNotification('Расход добавлен', 'success');
      logAction(currentUser, 'expense_add', { amount: d.amount, category: d.category, comment: d.comment });

      if (d.category !== 'Возврат') {
        const hostelLabel = hostelId === 'hostel1' ? 'Хостел №1' : hostelId === 'hostel2' ? 'Хостел №2' : hostelId || '—';
        const roleLabel = (currentUser.role === 'admin' || currentUser.role === 'super') ? 'Админ' : 'Кассир';
        await sendTelegramMessage(
          `💳 <b>Расход</b>\n🏨 ${hostelLabel}\n📂 ${d.category}\n💰 ${(+d.amount).toLocaleString()} сум${d.comment ? '\n💬 ' + d.comment : ''}\n👤 ${roleLabel}: ${currentUser.name || currentUser.login}`,
          'expenseAdded'
        );
      }
    } catch (err) {
      console.error('Ошибка добавления расхода:', err);
      showNotification('Ошибка: ' + (err.message || 'не удалось сохранить'), 'error');
    }
  };

  const handleDeletePayment = async (id, type, record = {}) => {
    if (!confirm('Удалить запись?')) return;
    await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, type === 'income' ? 'payments' : 'expenses', id));

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
    sendTelegramMessage(msg, 'deleteRecord');
    showNotification('Запись удалена');
  };

  const downloadExpensesCSV = () => {
    const filtered = currentUser?.role === 'super'
      ? expenses
      : expenses.filter(e => e.hostelId === (currentUser?.role === 'admin' ? selectedHostelFilter : currentUser?.hostelId));
    const exportData = filtered.map(e => ({
      date: new Date(e.date).toLocaleString(),
      hostel: (HOSTELS[e.hostelId]?.name || e.hostelId || '-'),
      category: e.category,
      amount: parseInt(e.amount),
      staff: usersList.find(u => u.id === e.staffId || u.login === e.staffId)?.name || 'N/A',
      comment: e.comment || '-',
    }));
    const totalExpenses = exportData.reduce((s, i) => s + i.amount, 0);
    const rows = exportData.map(row =>
      `<tr><td>${row.date}</td><td>${row.hostel}</td><td>${row.category}</td><td class="amount">${row.amount.toLocaleString()}</td><td>${row.staff}</td><td>${row.comment}</td></tr>`
    ).join('');
    const table = `<html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
      <style>body{font-family:Arial,sans-serif}table{border-collapse:collapse;width:100%}th,td{border:1px solid #000;padding:8px;text-align:left}th{background:#dc2626;color:#fff;font-weight:bold}.amount{text-align:right;color:#991b1b;font-weight:bold}.total-row{background:#fee2e2;font-weight:bold;border-top:3px solid #991b1b}</style>
      </head><body><h2 style="text-align:center;">Отчет по расходам</h2>
      <table><thead><tr><th>Дата</th><th>Хостел</th><th>Категория</th><th>Сумма</th><th>Кассир</th><th>Комментарий</th></tr></thead>
      <tbody>${rows}<tr class="total-row"><td colspan="3">ИТОГО РАСХОДОВ:</td><td class="amount">${totalExpenses.toLocaleString()}</td><td colspan="2"></td></tr></tbody></table></body></html>`;
    const blob = new Blob([table], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Expenses_Report_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return { handleAddExpense, handleDeletePayment, downloadExpensesCSV };
}
