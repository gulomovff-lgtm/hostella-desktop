/**
 * Тесты логики баланса: старая формула против новой.
 * Модель повторяет handlePayment / handleDeletePayment / handleCheckOut.
 */
const fmt = n => Number(n).toLocaleString('ru-RU');
let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✅' : '❌'} ${name}: получено ${fmt(got)}, ожидалось ${fmt(want)}`);
};

// ── Модель мира ──────────────────────────────────────────────────
const mk = (totalPrice) => ({ totalPrice, amountPaid: 0, balanceCredited: 0, refundSettledAmount: 0, clientBalance: 0 });

// СТАРАЯ логика оплаты
const payOld = (g, amt) => {
  const overpay = Math.max(0, g.amountPaid + amt - g.totalPrice);
  g.amountPaid += amt;
  g.clientBalance += overpay;
  return overpay;
};
// НОВАЯ логика оплаты: переплата НЕ уходит на баланс во время проживания
const payNew = (g, amt) => { g.amountPaid += amt; return 0; };
// Удаление платежа: старое (баланс не трогали) / новое (клоубэк)
const delOld = (g, amt) => { g.amountPaid -= amt; };
const delNew = (g, amt) => {
  const paidAfter = g.amountPaid - amt;
  const overAfter = Math.max(0, paidAfter - g.totalPrice);
  const clawback = Math.min(g.balanceCredited, Math.max(0, g.balanceCredited - overAfter));
  g.amountPaid = paidAfter;
  g.balanceCredited -= clawback;
  g.clientBalance -= clawback;
  return clawback;
};
// Выселение «оставить на балансе»
const checkoutOld = (g, finalPrice) => {
  const raw = Math.max(0, g.amountPaid - finalPrice);
  const settled = g.refundSettledAmount;
  const part = Math.max(0, raw - settled);
  g.refundSettledAmount += part; g.clientBalance += part; g.totalPrice = finalPrice;
  return part;
};
const checkoutNew = (g, finalPrice) => {
  const raw = Math.max(0, g.amountPaid - finalPrice);
  const settled = g.refundSettledAmount + g.balanceCredited;
  const part = Math.max(0, raw - settled);
  g.refundSettledAmount += part; g.clientBalance += part; g.totalPrice = finalPrice;
  return part;
};

console.log('ТЕСТ 1. Повторная доплата при уже существующей переплате');
console.log('  Цена 100 000. Платежи: 60 000, 60 000, затем ещё 10 000.');
{
  const o = mk(100000); payOld(o, 60000); payOld(o, 60000); payOld(o, 10000);
  const n = mk(100000); payNew(n, 60000); payNew(n, 60000); payNew(n, 10000);
  console.log(`  Реальная переплата: ${fmt(130000 - 100000)}`);
  check('СТАРАЯ логика воспроизводит баг (50к вместо 30к)', o.clientBalance, 50000);
  check('НОВАЯ логика — переплата висит у гостя, баланс чист', n.clientBalance, 0);
  check('НОВАЯ логика — переплата у гостя', n.amountPaid - n.totalPrice, 30000);
}

console.log('\nТЕСТ 2. Урезание дней (цена упала), затем доплата — случай AZIZ YULDASHEV');
console.log('  Заплатил 700 000 за 700 000. Урезали дни → цена 500 000. Потом доплата 80 000.');
{
  const o = mk(700000); payOld(o, 700000); o.totalPrice = 500000; payOld(o, 80000);
  const n = mk(700000); payNew(n, 700000); n.totalPrice = 500000; payNew(n, 80000);
  console.log(`  Реальная переплата: ${fmt(780000 - 500000)}`);
  check('СТАРАЯ логика — на балансе', o.clientBalance, 280000);
  check('НОВАЯ логика — баланс чист до выселения', n.clientBalance, 0);
  const part = checkoutNew(n, 500000);
  check('НОВАЯ логика — при выселении на баланс', part, 280000);
}

console.log('\nТЕСТ 3. Оплата вперёд до продления — случай MUSTAFAQULOV (2×260 000)');
console.log('  Цена 780 000, оплачено 780 000. Гость платит 260 000 вперёд, потом продлеваем.');
{
  const o = mk(780000); payOld(o, 780000);
  payOld(o, 260000); o.totalPrice = 1040000;      // заплатил вперёд, потом продлили
  payOld(o, 260000); o.totalPrice = 1300000;
  const n = mk(780000); payNew(n, 780000);
  payNew(n, 260000); n.totalPrice = 1040000;
  payNew(n, 260000); n.totalPrice = 1300000;
  console.log(`  Реальная переплата в конце: ${fmt(0)} (оплачено 1 300 000 = цене)`);
  check('СТАРАЯ логика воспроизводит баг (520к из воздуха)', o.clientBalance, 520000);
  check('НОВАЯ логика — на балансе', n.clientBalance, 0);
  const part3 = checkoutNew(n, 1300000);
  check('НОВАЯ логика — при выселении на баланс', part3, 0);
}

console.log('\nТЕСТ 4. Удаление платежа после переплаты');
console.log('  Цена 100 000, оплата 150 000 (→50 000 на баланс). Кассир удаляет платёж 150 000.');
{
  const o = mk(100000); payOld(o, 150000); delOld(o, 150000);
  const n = mk(100000); payNew(n, 150000); delNew(n, 150000);
  check('СТАРАЯ логика воспроизводит баг (50к осело на балансе)', o.clientBalance, 50000);
  check('НОВАЯ логика — на балансе осталось', n.clientBalance, 0);
  check('НОВАЯ логика — оплачено у гостя', n.amountPaid, 0);
  // Старые записи с уже зачисленной переплатой: клоубэк обязан сработать
  const legacy = mk(100000); legacy.amountPaid = 150000; legacy.balanceCredited = 50000; legacy.clientBalance = 50000;
  delNew(legacy, 150000);
  check('СТАРАЯ запись (balanceCredited) — клоубэк с баланса', legacy.clientBalance, 0);
}

console.log('\nТЕСТ 5. Выселение «оставить на балансе» после переплаты во время проживания');
console.log('  Цена 500 000, оплата 950 000 (→450 000 на баланс). Выселение с той же ценой.');
{
  const o = mk(500000); payOld(o, 950000); checkoutOld(o, 500000);
  const n = mk(500000); payNew(n, 950000); checkoutNew(n, 500000);
  console.log(`  Реальная переплата: ${fmt(450000)}`);
  check('СТАРАЯ логика воспроизводит баг (900к = двойное зачисление)', o.clientBalance, 900000);
  check('НОВАЯ логика — на балансе', n.clientBalance, 450000);
  // Старая запись, где переплата уже улетела на баланс во время проживания
  const legacy = mk(500000); legacy.amountPaid = 950000; legacy.balanceCredited = 450000; legacy.clientBalance = 450000;
  checkoutNew(legacy, 500000);
  check('СТАРАЯ запись — при выселении повторно НЕ зачисляется', legacy.clientBalance, 450000);
}

console.log('\nТЕСТ 6. Частичное удаление одного из двух платежей (старая запись с зачислением)');
console.log('  Цена 100 000. Оплачено 150 000, из них 50 000 уже на балансе. Удаляем платёж 70 000.');
{
  const n = mk(100000); n.amountPaid = 150000; n.balanceCredited = 50000; n.clientBalance = 50000;
  const cb = delNew(n, 70000);
  check('снято с баланса (переплаты больше нет)', cb, 50000);
  check('на балансе осталось', n.clientBalance, 0);
  check('оплачено у гостя', n.amountPaid, 80000);
  check('у гостя теперь недоплата, баланс пуст', n.totalPrice - n.amountPaid, 20000);
}

console.log('\nТЕСТ 7. Длинная цепочка: продления, урезания, доплаты, удаление, выселение');
{
  const n = mk(300000);
  payNew(n, 300000);            // ровно
  n.totalPrice = 600000;        // продлили
  payNew(n, 300000);            // доплатил ровно
  n.totalPrice = 400000;        // урезали дни → переплата 200 000
  payNew(n, 50000);             // ещё доплата
  check('баланс во время проживания чист', n.clientBalance, 0);
  check('переплата у гостя', n.amountPaid - n.totalPrice, 250000);
  delNew(n, 50000);             // удалили последний платёж
  check('после удаления оплачено', n.amountPaid, 600000);
  check('после удаления баланс всё ещё чист', n.clientBalance, 0);
  const part = checkoutNew(n, 400000);
  check('при выселении на баланс ушло', part, 200000);
  check('итоговый баланс', n.clientBalance, 200000);
}

console.log('\nТЕСТ 8. Деньги не создаются: касса = проживание + баланс');
{
  const n = mk(500000);
  payNew(n, 300000); payNew(n, 400000);   // внесено 700 000
  const part = checkoutNew(n, 500000);
  check('внесено в кассу', n.amountPaid, 700000);
  check('стоимость проживания', n.totalPrice, 500000);
  check('ушло на баланс', part, 200000);
  check('проживание + баланс = внесено', n.totalPrice + n.clientBalance, n.amountPaid);
}

console.log(`\n${'='.repeat(50)}\nИТОГО: пройдено ${pass}, провалено ${fail}`);
process.exit(fail > 0 ? 1 : 0);
