// Выгрузка отчёта по долгам в Excel. Оформление то же, что у финансового
// отчёта (те же цвета шапки и рамки), чтобы два файла выглядели как один пакет.

const MONEY = '#,##0';
const HEAD = 'FF0F9688', TOTAL_FILL = 'FFE8F5F3', ZEBRA = 'FFF1F5F9', TITLE = 'FF1A3C40';

const SOURCE_TITLE = { guest: 'Гости', rental: 'Аренда комнат', contract: 'Договоры и бригады' };

export const exportDebtsToExcel = async ({ report, hostelLabel, hostelName, periodLabel, periodNet, expected }) => {
    const ExcelJS = (await import('exceljs')).default;
    const { rows, totals, byHostel, byEntity, bySource } = report;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Hostella';
    const thin = { style: 'thin', color: { argb: 'FFE2E8F0' } };
    const box = { top: thin, left: thin, bottom: thin, right: thin };
    const boxRow = (r) => r.eachCell(c => { c.border = box; });
    const fillRow = (r, argb) => r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }; });
    const addHeader = (ws, labels) => {
        const r = ws.addRow(labels); r.height = 22;
        r.eachCell(c => {
            c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD } };
            c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            c.border = box;
        });
    };
    const titleBlock = (ws, span, title) => {
        const t1 = ws.addRow([title]);
        ws.mergeCells(t1.number, 1, t1.number, span);
        const c1 = t1.getCell(1);
        c1.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE } };
        c1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        t1.height = 28;
        const t2 = ws.addRow([`${hostelLabel}    ·    на ${new Date().toLocaleString('ru')}`]);
        ws.mergeCells(t2.number, 1, t2.number, span);
        t2.getCell(1).font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
        ws.addRow([]);
    };
    const money = (ws, idxs) => idxs.forEach(i => {
        ws.getColumn(i).numFmt = MONEY;
        ws.getColumn(i).alignment = { horizontal: 'right' };
    });
    const widths = (ws, w) => w.forEach((x, i) => { ws.getColumn(i + 1).width = x; });
    const methodLabel = (r) => r.method === 'transfer'
        ? `Перечисление${r.entities?.length ? ` (${r.entities.join(', ')})` : ''}`
        : 'Наличные / карта';

    // ── Лист 1: Сводка ────────────────────────────────────────────────────────
    const ws1 = wb.addWorksheet('Сводка');
    titleBlock(ws1, 7, 'Отчёт по долгам');
    addHeader(ws1, ['Филиал', 'Гости', 'Аренда', 'Договоры', 'Перечислением', 'Обычные', 'Всего долг']);
    byHostel.forEach((h, i) => {
        const r = ws1.addRow([hostelName(h.hostelId), h.guest, h.rental, h.contract, h.transfer, h.regular, h.debt]);
        boxRow(r);
        if (i % 2) fillRow(r, ZEBRA);
        r.getCell(7).font = { bold: true, color: { argb: 'FFDC2626' } };
    });
    const totalRow = ws1.addRow(['ИТОГО', bySource.guest.debt, bySource.rental.debt, bySource.contract.debt, totals.transfer, totals.regular, totals.debt]);
    boxRow(totalRow); fillRow(totalRow, TOTAL_FILL);
    totalRow.eachCell(c => { c.font = { bold: true }; });
    widths(ws1, [22, 16, 16, 16, 18, 16, 18]);
    money(ws1, [2, 3, 4, 5, 6, 7]);

    ws1.addRow([]);
    const addKv = (label, value, bold) => {
        const r = ws1.addRow([label, value]);
        r.getCell(1).font = { bold: !!bold };
        r.getCell(2).font = { bold: true };
        r.getCell(2).numFmt = MONEY;
        return r;
    };
    addKv(`Баланс за период (${periodLabel})`, periodNet);
    addKv('Долги на сегодня', totals.debt);
    fillRow(addKv('ОЖИДАЕМО, когда должники рассчитаются', expected, true), TOTAL_FILL);

    if (byEntity.length) {
        ws1.addRow([]);
        addHeader(ws1, ['Получатель перечисления', 'Ожидается']);
        byEntity.forEach(e => { boxRow(ws1.addRow([e.entity, e.debt])); });
    }

    // ── Лист 2: Долги подробно ────────────────────────────────────────────────
    const ws2 = wb.addWorksheet('Долги подробно', { views: [{ state: 'frozen', ySplit: 4 }] });
    titleBlock(ws2, 8, 'Долги — построчно');
    addHeader(ws2, ['Источник', 'Кто', 'Детали', 'Филиал', 'Начислено', 'Оплачено', 'Долг', 'Ожидается']);
    rows.forEach((r, i) => {
        const row = ws2.addRow([
            SOURCE_TITLE[r.source], r.name, r.detail || '—', hostelName(r.hostelId),
            r.charged, r.paid, r.debt, methodLabel(r),
        ]);
        boxRow(row);
        if (i % 2) fillRow(row, ZEBRA);
        row.getCell(7).font = { bold: true, color: { argb: 'FFDC2626' } };
    });
    const tot2 = ws2.addRow(['', 'ИТОГО', '', '', '', '', totals.debt, '']);
    boxRow(tot2); fillRow(tot2, TOTAL_FILL);
    tot2.getCell(2).font = { bold: true }; tot2.getCell(7).font = { bold: true };
    widths(ws2, [20, 28, 34, 16, 16, 16, 16, 28]);
    money(ws2, [5, 6, 7]);

    const stamp = new Date().toLocaleDateString('ru').replace(/\./g, '-');
    const slug = hostelLabel.replace(/\s/g, '_');
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Долги_${slug}_${stamp}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
};
