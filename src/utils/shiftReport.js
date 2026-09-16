/**
 * shiftReport — единый расчёт сверки смены кассира.
 * Используется окном закрытия смены ShiftClosingModal:
 * один источник правды для цифр, Telegram-отчёта и текстовой копии.
 * Логика перенесена из ShiftClosingModal без изменений.
 */

import TRANSLATIONS from '../constants/translations.js'; // .js — чтобы модуль грузился и в node --test

// Экранирование для Telegram HTML (локально — модуль остаётся чистым, без
// зависимости от firebase, чтобы юнит-тесты импортировали его напрямую).
const escapeTg = (s = '') =>
    String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Пустой перенос — смена начата с нуля. */
const emptyOpening = () => ({ cash: 0, card: 0, qr: 0, transfer: 0, transferByEntity: {}, refunds: 0, expenses: 0 });

/**
 * Приводит перенос к объекту. Принимает и число (старый формат — только наличные),
 * чтобы уже сохранённые смены продолжали считаться правильно.
 */
const readOpening = (opening) => {
    if (!opening) return emptyOpening();
    if (typeof opening === 'number' || typeof opening === 'string') {
        return { ...emptyOpening(), cash: parseInt(opening) || 0 };
    }
    return {
        cash:     parseInt(opening.cash)     || 0,
        card:     parseInt(opening.card)     || 0,
        qr:       parseInt(opening.qr)       || 0,
        transfer: parseInt(opening.transfer) || 0,
        transferByEntity: { ...(opening.transferByEntity || {}) },
        refunds:  parseInt(opening.refunds)  || 0,
        expenses: parseInt(opening.expenses) || 0,
    };
};

/**
 * @param {object|number} opening — итоги смены, принятой от предыдущего кассира при
 *   передаче. Сутки не закончены и касса не сдавалась, поэтому цифры складываются:
 *   принявший закрывает смену одним общим отчётом за сутки, как и раньше, — а не
 *   своей половиной. Число поддерживается для смен, записанных ранним форматом.
 */
export function computeShiftReport(user, payments = [], expenses = [], opening = null) {
    const shiftStart = user.lastShiftEnd || '1970-01-01T00:00:00.000Z';
    const carried = readOpening(opening);

    const myPayments = payments.filter(p =>
        ((p.staffId === user.id) || (p.staffId === user.login)) && p.date > shiftStart);

    const myExpenses = expenses.filter(e =>
        ((e.staffId === user.id) || (e.staffId === user.login)) && e.date > shiftStart && e.source !== 'cadastre');

    // Принятая смена входит в те же строки отчёта: сдаётся общая касса за сутки
    const income = myPayments.reduce((acc, p) => {
        acc.cash += p.cash !== undefined ? (parseInt(p.cash) || 0) : (p.method === 'cash' ? (parseInt(p.amount) || 0) : 0);
        acc.card += p.card !== undefined ? (parseInt(p.card) || 0) : (p.method === 'card' ? (parseInt(p.amount) || 0) : 0);
        acc.qr   += p.qr   !== undefined ? (parseInt(p.qr)   || 0) : (p.method === 'qr'   ? (parseInt(p.amount) || 0) : 0);
        const t = p.transfer !== undefined ? (parseInt(p.transfer) || 0) : (p.method === 'transfer' ? (parseInt(p.amount) || 0) : 0);
        acc.transfer += t;
        if (t > 0 && p.transferTo) acc.transferByEntity[p.transferTo] = (acc.transferByEntity[p.transferTo] || 0) + t;
        return acc;
    }, {
        cash: carried.cash,
        card: carried.card,
        qr: carried.qr,
        transfer: carried.transfer,
        transferByEntity: { ...carried.transferByEntity },
    });

    const { totalRefunds, totalExpenses, cashboxExpenses } = myExpenses.reduce((acc, e) => {
        const amt = parseInt(e.amount) || 0;
        acc.totalExpenses += amt;
        if (e.category === 'Возврат') acc.totalRefunds += amt;
        if (!e.skipCashbox) acc.cashboxExpenses += amt;
        return acc;
    }, {
        totalRefunds: carried.refunds,
        totalExpenses: carried.expenses,
        cashboxExpenses: carried.expenses,
    });

    const totalRevenue = income.cash + income.card + income.qr + income.transfer;
    const cashInHand = income.cash - cashboxExpenses;

    return {
        income, totalRefunds, totalExpenses, cashboxExpenses, totalRevenue, cashInHand,
        // Итоги принятой смены — для передачи дальше и для контроля, в отчёт не выносятся
        opening: carried,
    };
}

/** HTML-сообщение для Telegram при закрытии смены (формат — как был). */
export function buildShiftTelegramMsg(user, r, lang = 'ru') {
    const t = k => TRANSLATIONS[lang]?.[k] || k;
    const transferEntries = Object.entries(r.income.transferByEntity || {});
    const transferLine = r.income.transfer > 0
        ? (transferEntries.length > 0
            ? transferEntries.map(([entity, amt]) => `\n🏦 ${escapeTg(entity)}: ${amt.toLocaleString()}`).join('')
            : `\n🏦 ${t('scmBankTransfer')}: ${r.income.transfer.toLocaleString()}`)
        : '';
    const refundLine = r.totalRefunds > 0 ? `\n🔄 ${t('refund')}: -${r.totalRefunds.toLocaleString()}` : '';
    return `<b>🔒 ${t('shiftClose')}</b>\n${t('cashier')}: ${escapeTg(user.name)}\n---\n💵 ${t('cash')}: ${r.income.cash.toLocaleString()}\n💳 ${t('card')}: ${r.income.card.toLocaleString()}\n📱 ${t('qr')}: ${r.income.qr.toLocaleString()}${transferLine}\n---\n<b>✅ ${t('total')}: ${r.totalRevenue.toLocaleString()}</b>${refundLine}\n🔴 ${t('expenses')}: ${r.cashboxExpenses.toLocaleString()}\n<b>💰 ${t('cashInHand')}: ${r.cashInHand.toLocaleString()}</b>`;
}

/** Плоский текст отчёта для «Копировать» (формат — как был). */
export function buildShiftReportText(user, r, lang = 'ru') {
    const t = k => TRANSLATIONS[lang]?.[k] || k;
    const pad = (val, len) => String(val).padStart(len, ' ');
    const sumWord = t('sum');
    const amt = (v) => pad(v.toLocaleString() + ' ' + sumWord, 18);
    const negAmt = (v) => pad('-' + v.toLocaleString() + ' ' + sumWord, 18);
    const lbl = (s) => (s + ':').padEnd(13, ' ');
    const line = '─'.repeat(30);
    const date = new Date().toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const nonRefundExpenses = r.cashboxExpenses - r.totalRefunds;

    const parts = [
        `🔒 ${t('shiftClose')}`,
        `👤 ${t('cashier')}: ${user.name}`,
        `📅 ${date}`,
        line,
        `📈 ${t('scmReceipts')}`,
        `💵 ${lbl(t('cash'))}${amt(r.income.cash)}`,
        `💳 ${lbl(t('card'))}${amt(r.income.card)}`,
        `📱 ${lbl(t('qr'))}${amt(r.income.qr)}`,
        ...(r.income.transfer > 0 ? (Object.entries(r.income.transferByEntity || {}).length > 0
            ? Object.entries(r.income.transferByEntity).map(([entity, amtv]) => `🏦 ${lbl(entity)}${amt(amtv)}`)
            : [`🏦 ${lbl(t('scmBankTransfer'))}${amt(r.income.transfer)}`]) : []),
        line,
        `✅ ${lbl(t('total'))}${amt(r.totalRevenue)}`,
    ];

    if (r.totalRefunds > 0 || nonRefundExpenses > 0) {
        parts.push(line);
        parts.push(`➖ ${t('scmDeductions')}`);
        if (r.totalRefunds > 0)      parts.push(`🔄 ${lbl(t('refund'))}${negAmt(r.totalRefunds)}`);
        if (nonRefundExpenses > 0)   parts.push(`🔴 ${lbl(t('expenses'))}${negAmt(nonRefundExpenses)}`);
    }

    parts.push(line);
    parts.push(`💰 ${lbl(t('cashInHand'))}${amt(r.cashInHand)}`);
    parts.push(line);
    return parts.join('\n');
}
