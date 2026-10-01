/**
 * Остаток при заселении не вычитает баланс клиента дважды.
 *
 * Боевая ошибка в деньгах. Остаток считался как
 * `effectiveTotal - totalPaid`, а баланс клиента вычитался в обоих
 * слагаемых: из цены (`effectiveTotal = totalPrice - appliedBalance`)
 * и внутри `totalPaid`, куда `paidBalance` входит наравне с наличными.
 *
 * При цене 300 000 и балансе 100 000 окно показывало остаток 100 000
 * вместо 200 000: кассир брал с гостя на сумму баланса меньше, чем
 * нужно, и недостача всплывала на закрытии смены. Видно это было только
 * у клиентов с балансом — то есть у постоянных.
 *
 * Кнопка «вся сумма» при этом считала верно (`effectiveTotal - others`,
 * без баланса), так что магнит и надпись рядом с ним показывали разное.
 *
 * Формула живёт в разметке окна, поэтому здесь она повторена один раз
 * и проверена числами, а сам файл окна проверяется на то, что в нём
 * стоит именно она.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Ровно то, что считает окно заселения. */
const money = ({ pricePerNight, days, paidBalance = 0, cash = 0, card = 0, qr = 0, transfer = 0 }) => {
  const totalPrice = days * pricePerNight;
  const appliedBalance = paidBalance;
  const totalPaid = cash + card + qr + transfer + paidBalance;
  const effectiveTotal = Math.max(0, totalPrice - appliedBalance);
  const collected = totalPaid - appliedBalance;
  return { totalPrice, effectiveTotal, collected, totalPaid, balance: effectiveTotal - collected };
};

test('без баланса ничего не меняется', () => {
  const m = money({ pricePerNight: 100_000, days: 3, cash: 120_000 });
  assert.equal(m.effectiveTotal, 300_000);
  assert.equal(m.balance, 180_000);
});

test('баланс вычитается ОДИН раз', () => {
  // Тот самый случай: 300 000 к оплате, 100 000 на карточке.
  // До правки окно показывало 100 000 — на размер баланса меньше.
  const m = money({ pricePerNight: 100_000, days: 3, paidBalance: 100_000 });
  assert.equal(m.effectiveTotal, 200_000, 'к оплате после зачёта баланса');
  assert.equal(m.collected, 0, 'в кассу пока не внесено ничего');
  assert.equal(m.balance, 200_000, 'остаток занижен на размер баланса');
});

test('баланс и наличные вместе', () => {
  const m = money({ pricePerNight: 100_000, days: 3, paidBalance: 100_000, cash: 150_000 });
  assert.equal(m.balance, 50_000);
});

test('баланс покрывает счёт целиком', () => {
  const m = money({ pricePerNight: 100_000, days: 1, paidBalance: 100_000 });
  assert.equal(m.balance, 0);
  assert.equal(m.totalPaid, 100_000, 'в документ гостя уходит вся оплата, включая зачёт');
});

test('переплата уходит в минус, а не прячется', () => {
  const m = money({ pricePerNight: 100_000, days: 1, cash: 150_000 });
  assert.equal(m.balance, -50_000);
});

test('в документ гостя пишется всё оплаченное, включая зачтённый баланс', () => {
  // Долг считается от полной цены, поэтому amountPaid обязан включать зачёт.
  const m = money({ pricePerNight: 100_000, days: 3, paidBalance: 100_000, cash: 200_000 });
  assert.equal(m.totalPaid, 300_000);
  assert.equal(m.totalPrice, 300_000);
  assert.equal(m.balance, 0);
});

test('окно считает по этой же формуле', () => {
  const src = readFileSync(
    new URL('../src/components/Modals/CheckInModal.jsx', import.meta.url), 'utf8');
  assert.match(src, /const collected = totalPaid - appliedBalance;/);
  assert.match(src, /const balance = effectiveTotal - collected;/);
  assert.ok(!/const balance = effectiveTotal - totalPaid;/.test(src),
    'баланс снова вычитается дважды');
  // «В долг» смотрит на реально принятые деньги: гость с зачтённым
  // балансом и пустой кассой считался «что-то внёсшим», и кнопка пропадала.
  assert.match(src, /\{collected === 0 && totalPrice > 0 && \(/);
  assert.match(src, /amountPaid: totalPaid,/);
});
