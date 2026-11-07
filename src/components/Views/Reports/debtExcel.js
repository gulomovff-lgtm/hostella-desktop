// Листы с долгами для Excel. Используются дважды:
//   - addDebtSheets(wb, …)      — дописывает листы в общий финансовый отчёт;
//   - exportDebtsToExcel(…)     — отдельный файл только с долгами.
// Оформление то же, что у финансового отчёта (цвета шапки, рамки, зебра).

import TRANSLATIONS from '../../../constants/translations.js';

const MONEY = '#,##0';
const HEAD = 'FF0F9688', TOTAL_FILL = 'FFE8F5F3', ZEBRA = 'FFF1F5F9', TITLE = 'FF1A3C40';

/**
 * Дописывает в книгу два листа: «Долги — сводка» и «Долги подробно».
 * ExcelJS не нужен — работаем с уже созданной книгой.
 */
export const addDebtSheets = (wb, { report, hostelLabel, hostelName, periodLabel, periodNet, expected, lang = 'ru' }) => {
    const { rows, totals, byHostel, byEntity, bySource } = report;
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;
    const SOURCE_TITLE = { guest: t('drmGuests'), rental: t('drmRentals'), contract: t('drmContracts') };

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
        const t2 = ws.addRow([`${hostelLabel}    ·    ${new Date().toLocaleString('ru')}`]);
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
        ? `${t('drmTransferFull')}${r.entities?.length ? ` (${r.entities.join(', ')})` : ''}`
        : t('drmCashCard');

    // ── Лист: сводка по долгам ────────────────────────────────────────────────
    const ws1 = wb.addWorksheet(t('drmSheetSummary'));
    titleBlock(ws1, 7, t('dvReportHeading'));
    addHeader(ws1, [t('drmColBranch'), t('drmGuests'), t('drmColRent'), t('drmColContracts'), t('drmCardTransfer'), t('drmCardRegular'), t('drmColTotalDebt')]);
    byHostel.forEach((h, i) => {
        const r = ws1.addRow([hostelName(h.hostelId), h.guest, h.rental, h.contract, h.transfer, h.regular, h.debt]);
        boxRow(r);
        if (i % 2) fillRow(r, ZEBRA);
        r.getCell(7).font = { bold: true, color: { argb: 'FFDC2626' } };
    });
    const totalRow = ws1.addRow([t('drmTotalUpper'), bySource.guest.debt, bySource.rental.debt, bySource.contract.debt, totals.transfer, totals.regular, totals.debt]);
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
    addKv(t('drmBalanceForPeriod').replace('{period}', periodLabel), periodNet);
    addKv(t('drmDebtsToday'), totals.debt);
    fillRow(addKv(t('drmExpectedWhenSettled'), expected, true), TOTAL_FILL);

    if (byEntity.length) {
        ws1.addRow([]);
        addHeader(ws1, [t('drmTransferRecipient'), t('drmExpectedCol')]);
        byEntity.forEach(e => { boxRow(ws1.addRow([e.entity, e.debt])); });
    }

    // ── Лист: долги построчно ─────────────────────────────────────────────────
    const ws2 = wb.addWorksheet(t('drmSheetDetail'), { views: [{ state: 'frozen', ySplit: 4 }] });
    titleBlock(ws2, 8, t('drmDetailTitle'));
    addHeader(ws2, [t('drmColSource'), t('drmColWho'), t('drmColDetails'), t('drmColBranch'), t('drmColCharged'), t('drmColPaid'), t('drmColDebt'), t('drmExpectedCol')]);
    rows.forEach((r, i) => {
        const row = ws2.addRow([
            SOURCE_TITLE[r.source], r.name, r.detail || '—', hostelName(r.hostelId),
            r.charged, r.paid, r.debt, methodLabel(r),
        ]);
        boxRow(row);
        if (i % 2) fillRow(row, ZEBRA);
        row.getCell(7).font = { bold: true, color: { argb: 'FFDC2626' } };
    });
    const tot2 = ws2.addRow(['', t('drmTotalUpper'), '', '', '', '', totals.debt, '']);
    boxRow(tot2); fillRow(tot2, TOTAL_FILL);
    tot2.getCell(2).font = { bold: true }; tot2.getCell(7).font = { bold: true };
    widths(ws2, [20, 28, 34, 16, 16, 16, 16, 28]);
    money(ws2, [5, 6, 7]);

    return wb;
};

/** Отдельный файл только с долгами — кнопка «Excel» в отчёте по долгам. */
export const exportDebtsToExcel = async (args) => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Hostella';
    addDebtSheets(wb, args);

    const t = (k) => TRANSLATIONS[args.lang || 'ru']?.[k] || k;
    const stamp = new Date().toLocaleDateString('ru').replace(/\./g, '-');
    const slug = (args.hostelLabel || t('drmAllHostels')).replace(/\s/g, '_');
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t('drmFileDebts')}_${slug}_${stamp}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
};
