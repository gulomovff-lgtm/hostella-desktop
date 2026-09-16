import test from 'node:test';
import assert from 'node:assert/strict';
import { computeContractFinancials, sumCharges, isWriteOff } from '../src/utils/contractFinancials.js';

// Договор: ставка 50 000 × 10 чел-ночей = 500 000, оплачено 200 000 → долг 300 000
const baseGroup = (extraCharges = []) => ({
    id: 'contract-1',
    contractRate: '50000',
    manualEntries: [{ id: 'e1', people: 2, nights: 5 }],
    extraCharges,
});
const paidTwoHundred = [{ contractGroupId: 'contract-1', cash: 200000 }];

test('без списаний долг считается как раньше', () => {
    const fin = computeContractFinancials(baseGroup(), [], paidTwoHundred);
    assert.equal(fin.contractTotal, 500000);
    assert.equal(fin.debt, 300000);
    assert.equal(fin.writeOffTotal, 0);
    assert.deepEqual(fin.writeOffs, []);
});

test('списание уменьшает начисленное и долг', () => {
    const fin = computeContractFinancials(
        baseGroup([{ id: 'w-1', name: 'Скидка', amount: -100000, writeOff: true }]),
        [], paidTwoHundred);
    assert.equal(fin.writeOffTotal, 100000);
    assert.equal(fin.contractTotal, 400000);
    assert.equal(fin.debt, 200000);
});

test('списание не попадает в extraCharges — отчёты его не видят', () => {
    const fin = computeContractFinancials(baseGroup([
        { id: 'x-1', name: 'Стирка',  amount: 30000 },
        { id: 'w-1', name: 'Скидка',  amount: -100000, writeOff: true },
    ]), [], paidTwoHundred);
    assert.deepEqual(fin.extraCharges.map(c => c.id), ['x-1']);
    assert.equal(fin.extraTotal, 30000);           // в отчёте — только стирка
    assert.equal(fin.contractTotal, 430000);        // 500 000 + 30 000 − 100 000
    assert.equal(fin.debt, 230000);
});

test('«Проживание» в бригадном отчёте сходится с «Начислено»', () => {
    // Отчёт печатает: Проживание = contractTotal − extraTotal, затем доп. позиции.
    const fin = computeContractFinancials(baseGroup([
        { id: 'x-1', name: 'Стирка', amount: 30000 },
        { id: 'w-1', name: 'Скидка', amount: -100000, writeOff: true },
    ]), [], paidTwoHundred);
    const stayShown = fin.contractTotal - fin.extraTotal;
    assert.equal(stayShown + fin.extraTotal, fin.contractTotal);
    assert.equal(stayShown, 400000);
});

test('списание больше долга уводит договор в переплату, а не в минус по формуле', () => {
    const fin = computeContractFinancials(
        baseGroup([{ id: 'w-1', name: 'Прощён остаток', amount: -400000, writeOff: true }]),
        [], paidTwoHundred);
    assert.equal(fin.contractTotal, 100000);
    assert.equal(fin.debt, -100000); // переплата: экраны показывают её через Math.max(0, debt)
});

test('перенос сальдо (обычная отрицательная позиция) остаётся видимым', () => {
    const fin = computeContractFinancials(
        baseGroup([{ id: 'x-9', name: 'Перенос долга на «Б»', amount: -50000, transferTo: 'contract-2' }]),
        [], paidTwoHundred);
    assert.equal(fin.writeOffTotal, 0);
    assert.equal(fin.extraCharges.length, 1);
    assert.equal(fin.extraTotal, -50000);
    assert.equal(fin.contractTotal, 450000);
});

test('helpers', () => {
    assert.equal(sumCharges([{ amount: 10 }, { amount: '5' }, { amount: null }]), 15);
    assert.equal(isWriteOff({ writeOff: true }), true);
    assert.equal(isWriteOff({ amount: -1 }), false);
    assert.equal(isWriteOff(null), false);
});
