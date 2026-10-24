import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { addDebtSheets } from '../src/components/Views/Reports/debtExcel.js';
import { buildDebtReport, expectedProfit } from '../src/utils/debtReport.js';

const report = buildDebtReport({
    guests: [{ id: 'g1', fullName: 'Иванов И.', passport: 'AA1', hostelId: 'hostel1', totalPrice: 200000, amountPaid: 50000, roomNumber: '5' }],
    rooms: [{ id: 'r1', number: '12', hostelId: 'hostel2', rental: { active: true, tenantName: 'ООО «Тест»', totalAmount: 1000000, paidTransfer: 400000 } }],
    contractGroups: [{ id: 'c1', name: 'Бригада А', hostelId: 'hostel1', contractRate: '50000', manualEntries: [{ id: 'e', people: 2, nights: 5 }] }],
    payments: [{ id: 'p1', contractGroupId: 'c1', transfer: 200000, transferTo: 'YATT SOBIROVA' }],
});

const args = {
    report,
    hostelLabel: 'Все хостелы',
    hostelName: (id) => (id === 'hostel1' ? 'Хостел №1' : 'Хостел №2'),
    periodLabel: '01.08.2026 — 18.08.2026',
    periodNet: 1500000,
    expected: expectedProfit(1500000, report.totals.debt),
};

test('листы с долгами добавляются в готовую книгу', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Операции');           // как в общем финансовом отчёте
    addDebtSheets(wb, args);
    assert.deepEqual(wb.worksheets.map(w => w.name), ['Операции', 'Долги — сводка', 'Долги подробно']);
});

test('книга реально сериализуется в xlsx', async () => {
    const wb = new ExcelJS.Workbook();
    addDebtSheets(wb, args);
    const buf = await wb.xlsx.writeBuffer();
    assert.ok(buf.byteLength > 3000, 'файл получился пустым');
    // Сигнатура zip-архива, которым и является xlsx
    const head = Buffer.from(buf.slice(0, 2));
    assert.equal(head.toString('binary'), 'PK');
});

test('сводный лист содержит итоги и ожидаемую прибыль', async () => {
    const wb = new ExcelJS.Workbook();
    addDebtSheets(wb, args);
    const ws = wb.getWorksheet('Долги — сводка');
    const cells = [];
    ws.eachRow(r => r.eachCell(c => cells.push(c.value)));
    assert.ok(cells.includes('ИТОГО'));
    assert.ok(cells.includes(report.totals.debt), 'нет общей суммы долга');
    assert.ok(cells.includes(args.expected), 'нет ожидаемой прибыли');
    assert.ok(cells.includes('YATT SOBIROVA'), 'нет получателя перечисления');
});

test('подробный лист содержит строку на каждый долг', async () => {
    const wb = new ExcelJS.Workbook();
    addDebtSheets(wb, args);
    const ws = wb.getWorksheet('Долги подробно');
    const names = [];
    ws.eachRow(r => names.push(r.getCell(2).value));
    report.rows.forEach(row => assert.ok(names.includes(row.name), `нет строки: ${row.name}`));
    assert.ok(names.includes('ИТОГО'));
});
