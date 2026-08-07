/**
 * Тесты денег при переезде/разделении гостя.
 * Модель повторяет расчёт из handleMoveGuest / handleSplitGuest.
 * Главное, что проверяем: деньги не пропадают и не появляются,
 * включая оплату переводом и списание с баланса.
 */
const fmt = n => Number(n).toLocaleString('ru-RU');
let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✅' : '❌'} ${name}: получено ${fmt(got)}, ожидалось ${fmt(want)}`);
};

// СТАРАЯ логика: делила только нал/карта/QR, сумму брала из amountPaid
const moveOld = (g, daysPassed, totalDays, price) => {
  const totalPaid = g.amountPaid ?? ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0));
  const oldPaid = Math.min(totalPaid, daysPassed * price);
  const r1 = totalPaid > 0 ? oldPaid / totalPaid : 1;
  const oc = Math.round((g.paidCash || 0) * r1), nc = (g.paidCash || 0) - oc;
  const od = Math.round((g.paidCard || 0) * r1), nd = (g.paidCard || 0) - od;
  const oq = Math.round((g.paidQR || 0) * r1),   nq = (g.paidQR || 0) - oq;
  return { oldPaid: oc + od + oq, newPaid: nc + nd + nq };
};

// НОВАЯ логика: делит все методы; итоги считает от общей суммы
const moveNew = (g, daysPassed, totalDays, price) => {
  const mCash = Number(g.paidCash) || 0, mCard = Number(g.paidCard) || 0;
  const mQR = Number(g.paidQR) || 0, mTr = Number(g.paidTransfer) || 0;
  const mBal = Number(g.paidBalance) || 0;
  const methodsSum = mCash + mCard + mQR + mTr + mBal;
  const totalPaid = Math.max(Number(g.amountPaid) || 0, methodsSum);
  const oldPaid = Math.min(totalPaid, daysPassed * price);
  const r1 = totalPaid > 0 ? oldPaid / totalPaid : 1;
  const oldAmountPaid = Math.round(totalPaid * r1);
  return {
    oldPaid: oldAmountPaid,
    newPaid: totalPaid - oldAmountPaid,
    methods: {
      cash: [Math.round(mCash * r1), mCash - Math.round(mCash * r1)],
      tr:   [Math.round(mTr * r1),   mTr   - Math.round(mTr * r1)],
      bal:  [Math.round(mBal * r1),  mBal  - Math.round(mBal * r1)],
    },
  };
};

console.log('ТЕСТ 1. Оплата ПЕРЕВОДОМ — деньги не должны пропасть');
console.log('  10 дней × 70 000 = 700 000, оплачено переводом 700 000, переезд на 3-й день');
{
  const g = { amountPaid: 700000, paidCash: 0, paidCard: 0, paidQR: 0, paidTransfer: 700000 };
  const o = moveOld(g, 3, 10, 70000), n = moveNew(g, 3, 10, 70000);
  console.log(`  СТАРАЯ: старая часть ${fmt(o.oldPaid)}, новая ${fmt(o.newPaid)} — всего ${fmt(o.oldPaid + o.newPaid)}`);
  check('СТАРАЯ логика теряла деньги (баг)', o.oldPaid + o.newPaid, 0);
  check('НОВАЯ: сумма сохранена', n.oldPaid + n.newPaid, 700000);
  check('НОВАЯ: старая часть = прожитым дням', n.oldPaid, 210000);
  check('НОВАЯ: новая часть покрывает 7 дней', n.newPaid, 490000);
  check('НОВАЯ: долга у новой части нет', Math.max(0, 7 * 70000 - n.newPaid), 0);
}

console.log('\nТЕСТ 2. Оплата с БАЛАНСА клиента');
console.log('  8 дней × 60 000 = 480 000: 180 000 налом + 300 000 с баланса, переезд на 4-й день');
{
  const g = { amountPaid: 480000, paidCash: 180000, paidCard: 0, paidQR: 0, paidBalance: 300000 };
  const o = moveOld(g, 4, 8, 60000), n = moveNew(g, 4, 8, 60000);
  check('СТАРАЯ логика теряла часть (баг)', o.oldPaid + o.newPaid, 180000);
  check('НОВАЯ: сумма сохранена', n.oldPaid + n.newPaid, 480000);
  check('НОВАЯ: новая часть покрывает 4 дня', n.newPaid, 240000);
}

console.log('\nТЕСТ 3. Смешанная оплата: нал + карта + перевод');
{
  const g = { amountPaid: 900000, paidCash: 300000, paidCard: 200000, paidQR: 0, paidTransfer: 400000 };
  const n = moveNew(g, 5, 10, 90000);
  check('сумма сохранена', n.oldPaid + n.newPaid, 900000);
  check('старая часть = 5 дней', n.oldPaid, 450000);
  check('нал разделён без потерь', n.methods.cash[0] + n.methods.cash[1], 300000);
  check('перевод разделён без потерь', n.methods.tr[0] + n.methods.tr[1], 400000);
}

console.log('\nТЕСТ 4. Гость в долгу (заплатил меньше стоимости) — долг едет с новой частью');
console.log('  10 дней × 70 000 = 700 000, оплачено только 210 000, переезд на 3-й день');
{
  const g = { amountPaid: 210000, paidCash: 210000 };
  const n = moveNew(g, 3, 10, 70000);
  check('сумма сохранена', n.oldPaid + n.newPaid, 210000);
  check('прожитые 3 дня закрыты полностью', n.oldPaid, 210000);
  check('новой части не досталось оплаты', n.newPaid, 0);
  check('долг новой части = 7 дней', 7 * 70000 - n.newPaid, 490000);
}

console.log('\nТЕСТ 5. Легаси-запись: amountPaid есть, разбивки по методам нет');
{
  const g = { amountPaid: 500000 };   // ни paidCash, ни прочих
  const n = moveNew(g, 2, 10, 50000);
  check('сумма не потерялась', n.oldPaid + n.newPaid, 500000);
  check('старая часть = 2 дня', n.oldPaid, 100000);
}

console.log('\nТЕСТ 6. Переплата переезжает целиком, долг не появляется');
{
  const g = { amountPaid: 800000, paidCash: 800000 };  // цена 700 000
  const n = moveNew(g, 3, 10, 70000);
  check('сумма сохранена', n.oldPaid + n.newPaid, 800000);
  check('новая часть покрывает 7 дней и переплату', n.newPaid, 590000);
  check('долга нет', Math.max(0, 7 * 70000 - n.newPaid), 0);
}

console.log(`\n${'='.repeat(52)}\nИТОГО: пройдено ${pass}, провалено ${fail}`);
process.exit(fail > 0 ? 1 : 0);
