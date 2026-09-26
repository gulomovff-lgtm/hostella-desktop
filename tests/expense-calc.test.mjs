import test from 'node:test';
import assert from 'node:assert/strict';
import { evalExpr, hasOperator, amountOf } from '../src/utils/expenseCalc.js';

test('калькулятор: обычные выражения', () => {
    assert.equal(evalExpr('73000+33000'), 106000);
    assert.equal(evalExpr('100000-25000'), 75000);
    assert.equal(evalExpr('12000*3'), 36000);
    assert.equal(evalExpr('12000×3'), 36000);
    assert.equal(evalExpr('90000÷3'), 30000);
    assert.equal(evalExpr('(10000+5000)*2'), 30000);
    assert.equal(evalExpr('73 000 + 33 000'), 106000, 'пробелы');
    assert.equal(evalExpr('73 000'), 73000, 'неразрывный пробел');
});

test('калькулятор: разделители тысяч точкой и запятой', () => {
    assert.equal(evalExpr('1.500.000'), 1500000);
    assert.equal(evalExpr('1,500,000'), 1500000);
    assert.equal(evalExpr('12.500+3.000'), 15500);
    assert.equal(evalExpr('1.500'), 1500);
    assert.equal(amountOf('1.500.000'), 1500000, 'раньше давало 0 и кнопка не нажималась');
});

test('калькулятор: дроби и ведущие нули', () => {
    assert.equal(evalExpr('0.5'), 0.5);
    assert.equal(evalExpr('1,5'), 1.5);
    assert.equal(evalExpr('100.05'), 100.05);
    assert.equal(evalExpr('0500'), 500, 'в строгом режиме 0500 — ошибка разбора');
    assert.equal(evalExpr('100000+05000'), 105000);
    assert.equal(amountOf('100/3'), 33);
});

test('калькулятор: мусор и неполные выражения', () => {
    assert.ok(Number.isNaN(evalExpr('')));
    assert.ok(Number.isNaN(evalExpr('abc')));
    assert.ok(Number.isNaN(evalExpr('100+')));
    assert.ok(Number.isNaN(evalExpr('alert(1)')));
    assert.ok(Number.isNaN(evalExpr('1/0')), 'бесконечность');
    assert.equal(amountOf('5000-9000'), 0, 'отрицательное не записываем');
    assert.equal(amountOf(''), 0);
});

test('hasOperator: ведущий минус — не оператор', () => {
    assert.equal(hasOperator('-500'), false);
    assert.equal(hasOperator('500-100'), true);
    assert.equal(hasOperator('1500000'), false);
});
