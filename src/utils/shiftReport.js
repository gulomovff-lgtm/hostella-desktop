/**
 * shiftReport — единый расчёт сверки смены кассира.
 * Используется родной ShiftClosingModal и бета-модалкой ShiftCloseBeta:
 * один источник правды для цифр, Telegram-отчёта и текстовой копии.
 * Логика перенесена из ShiftClosingModal без изменений.
 */

export function computeShiftReport(user, payments = [], expenses = []) {
    const shiftStart = user.lastShiftEnd || '1970-01-01T00:00:00.000Z';

    const myPayments = payments.filter(p =>
        ((p.staffId === user.id) || (p.staffId === user.login)) && p.date > shiftStart);

    const myExpenses = expenses.filter(e =>
        ((e.staffId === user.id) || (e.staffId === user.login)) && e.date > shiftStart && e.source !== 'cadastre');

    const income = myPayments.reduce((acc, p) => {
        acc.cash += p.cash !== undefined ? (parseInt(p.cash) || 0) : (p.method === 'cash' ? (parseInt(p.amount) || 0) : 0);
        acc.card += p.card !== undefined ? (parseInt(p.card) || 0) : (p.method === 'card' ? (parseInt(p.amount) || 0) : 0);
        acc.qr   += p.qr   !== undefined ? (parseInt(p.qr)   || 0) : (p.method === 'qr'   ? (parseInt(p.amount) || 0) : 0);
        const t = p.transfer !== undefined ? (parseInt(p.transfer) || 0) : (p.method === 'transfer' ? (parseInt(p.amount) || 0) : 0);
        acc.transfer += t;
        if (t > 0 && p.transferTo) acc.transferByEntity[p.transferTo] = (acc.transferByEntity[p.transferTo] || 0) + t;
        return acc;
    }, { cash: 0, card: 0, qr: 0, transfer: 0, transferByEntity: {} });

    const { totalRefunds, totalExpenses, cashboxExpenses } = myExpenses.reduce((acc, e) => {
        const amt = parseInt(e.amount) || 0;
        acc.totalExpenses += amt;
        if (e.category === 'Возврат') acc.totalRefunds += amt;
        if (!e.skipCashbox) acc.cashboxExpenses += amt;
        return acc;
    }, { totalRefunds: 0, totalExpenses: 0, cashboxExpenses: 0 });

    const totalRevenue = income.cash + income.card + income.qr + income.transfer;
    const cashInHand = income.cash - cashboxExpenses;

    return { income, totalRefunds, totalExpenses, cashboxExpenses, totalRevenue, cashInHand };
}

/** HTML-сообщение для Telegram при закрытии смены (формат — как был). */
export function buildShiftTelegramMsg(user, r) {
    const transferEntries = Object.entries(r.income.transferByEntity || {});
    const transferLine = r.income.transfer > 0
        ? (transferEntries.length > 0
            ? transferEntries.map(([entity, amt]) => `\n🏦 ${entity}: ${amt.toLocaleString()}`).join('')
            : `\n🏦 Перечисление: ${r.income.transfer.toLocaleString()}`)
        : '';
    const refundLine = r.totalRefunds > 0 ? `\n🔄 Возврат: -${r.totalRefunds.toLocaleString()}` : '';
    return `<b>🔒 Закрытие смены</b>\nКассир: ${user.name}\n---\n💵 Наличные: ${r.income.cash.toLocaleString()}\n💳 Терминал: ${r.income.card.toLocaleString()}\n📱 QR: ${r.income.qr.toLocaleString()}${transferLine}\n---\n<b>✅ ИТОГО: ${r.totalRevenue.toLocaleString()}</b>${refundLine}\n🔴 Расходы: ${r.cashboxExpenses.toLocaleString()}\n<b>💰 В КАССЕ: ${r.cashInHand.toLocaleString()}</b>`;
}

/** Плоский текст отчёта для «Копировать» (формат — как был). */
export function buildShiftReportText(user, r) {
    const pad = (val, len) => String(val).padStart(len, ' ');
    const line = '─'.repeat(30);
    const date = new Date().toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const nonRefundExpenses = r.cashboxExpenses - r.totalRefunds;

    const parts = [
        `🔒 ЗАКРЫТИЕ СМЕНЫ`,
        `👤 Кассир: ${user.name}`,
        `📅 ${date}`,
        line,
        `📈 ПОСТУПЛЕНИЯ`,
        `💵 Наличные:   ${pad(r.income.cash.toLocaleString() + ' сум', 18)}`,
        `💳 Терминал:   ${pad(r.income.card.toLocaleString() + ' сум', 18)}`,
        `📱 QR-код:     ${pad(r.income.qr.toLocaleString() + ' сум', 18)}`,
        ...(r.income.transfer > 0 ? (Object.entries(r.income.transferByEntity || {}).length > 0
            ? Object.entries(r.income.transferByEntity).map(([entity, amt]) => `🏦 ${entity}: ${pad(amt.toLocaleString() + ' сум', 18)}`)
            : [`🏦 Перечисление: ${pad(r.income.transfer.toLocaleString() + ' сум', 18)}`]) : []),
        line,
        `✅ Итого:      ${pad(r.totalRevenue.toLocaleString() + ' сум', 18)}`,
    ];

    if (r.totalRefunds > 0 || nonRefundExpenses > 0) {
        parts.push(line);
        parts.push(`➖ ВЫЧЕТЫ`);
        if (r.totalRefunds > 0)      parts.push(`🔄 Возврат:    ${pad('-' + r.totalRefunds.toLocaleString() + ' сум', 18)}`);
        if (nonRefundExpenses > 0)   parts.push(`🔴 Расходы:    ${pad('-' + nonRefundExpenses.toLocaleString() + ' сум', 18)}`);
    }

    parts.push(line);
    parts.push(`💰 В КАССЕ:     ${pad(r.cashInHand.toLocaleString() + ' сум', 18)}`);
    parts.push(line);
    return parts.join('\n');
}
