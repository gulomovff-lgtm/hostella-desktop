import { pmcFmtISO, PMC_MONTHS_FULL } from './shared';
import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import TRANSLATIONS from '../../../constants/translations';

const orPayAmt = (p) => ((parseInt(p.cash) || 0) + (parseInt(p.transfer) || 0) + (parseInt(p.card) || 0) + (parseInt(p.qr) || 0)) || (parseInt(p.amount) || 0);

const OverallReportModal = ({ groups = [], payments = [], scopeLabel = 'Все договоры', hostelLabel = '', onClose, lang = 'ru' }) => {
    const t = k => TRANSLATIONS[lang]?.[k] || k;
    const OR_COLS = [
        { key: 'members',      label: t('ormColMembers'), num: true,  val: r => r.members },
        { key: 'pn',           label: t('ormColPn'),      num: true,  val: r => r.pn,           accent: true },
        { key: 'rate',         label: t('msRate'),        num: true,  money: true, val: r => r.rate },
        { key: 'charged',      label: t('msChargedUpper'),num: true,  money: true, val: r => r.charged },
        { key: 'paid',         label: t('msPaidUpper'),   num: true,  money: true, green: true, val: r => r.paid },
        { key: 'paidCash',     label: t('cash'),          num: true,  money: true, val: r => r.paidCash },
        { key: 'paidTransfer', label: t('transferShort'), num: true,  money: true, val: r => r.paidTransfer },
        { key: 'paidCard',     label: t('ormCardCol'),    num: true,  money: true, val: r => r.paidCard },
        { key: 'paidQR',       label: t('qr'),            num: true,  money: true, val: r => r.paidQR },
        { key: 'debt',         label: t('msDebtUpper'),   num: true,  money: true, red: true, val: r => r.debt },
        { key: 'period',       label: t('period'),        num: false, text: true, val: r => r.period },
        { key: 'status',       label: t('status'),        num: false, text: true, val: r => r.closed ? t('archived') : r.completed ? t('msCompletedBadge') : t('pcActive') },
    ];
    const dk = document.documentElement.dataset.theme === 'dark';
    const [ym, setYm] = useState('');
    const [copied, setCopied] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [cols, setCols] = useState({ members: true, pn: true, rate: false, charged: true, paid: true, paidCash: false, paidTransfer: false, paidCard: false, paidQR: false, debt: true, period: true, status: false });
    const [sec, setSec] = useState({ payments: true, periods: false, members: false, specs: false });
    const groupIds = useMemo(() => new Set(groups.map(g => g.id)), [groups]);
    const mkey = (iso) => (iso || '').slice(0, 7);
    const fm = (n) => (Number(n) || 0).toLocaleString('ru-RU');

    const months = useMemo(() => {
        const s = new Set();
        groups.forEach(g => (g.manualEntries || []).forEach(e => { if (e.checkIn) s.add(mkey(e.checkIn)); }));
        payments.forEach(p => { if (groupIds.has(p.contractGroupId) && p.date) s.add(mkey(p.date)); });
        return [...s].filter(Boolean).sort().reverse();
    }, [groups, payments, groupIds]);

    // Дни/чел-ночи/специальности периода в рамках выбранного месяца (или всего)
    const scopeStats = (g, m) => {
        let pn = 0; const specs = {};
        (g.manualEntries || []).forEach(e => {
            if (!e.checkIn || !e.checkOut) return;
            const ppl = parseInt(e.people) || 0;
            let days = 0;
            let d = new Date(e.checkIn + 'T12:00:00'); const end = new Date(e.checkOut + 'T12:00:00'); let guard = 0;
            while (d < end && guard < 500) { if (!m || pmcFmtISO(d).slice(0, 7) === m) days++; d = new Date(d.getTime() + 86400000); guard++; }
            pn += ppl * days;
            (e.workerGroups || []).forEach(wg => { if (!wg.specialty) return; specs[wg.specialty] = (specs[wg.specialty] || 0) + (parseInt(wg.count) || 0) * days; });
        });
        return { pn, specs };
    };

    const rows = useMemo(() => groups.map((g, i) => {
        const isos = (g.manualEntries || []).flatMap(e => [e.checkIn, e.checkOut]).filter(Boolean).sort();
        const periodStr = isos.length ? `${isos[0]} → ${isos[isos.length - 1]}` : '—';
        const grpPays = payments.filter(p => p.contractGroupId === g.id && (!ym || mkey(p.date) === ym));
        const paidCash = grpPays.reduce((s, p) => s + (parseInt(p.cash) || 0), 0);
        const paidTransfer = grpPays.reduce((s, p) => s + (parseInt(p.transfer) || 0), 0);
        const paidCard = grpPays.reduce((s, p) => s + (parseInt(p.card) || 0), 0);
        const paidQR = grpPays.reduce((s, p) => s + (parseInt(p.qr) || 0), 0);
        const recPaid = grpPays.reduce((s, p) => s + orPayAmt(p), 0);
        const rate = parseInt(g.contractRate) || 0;
        const ss = scopeStats(g, ym);
        if (ym) {
            // Доп. расходы месяца (по дате позиции; без даты — не попадают в месячный срез)
            const extraScoped = (g.extraCharges || [])
                .filter(c => c.date && mkey(c.date) === ym)
                .reduce((s, c) => s + (parseInt(c.amount, 10) || 0), 0);
            // Списания админа: уменьшают начисленное молча, отдельной строки в отчёте нет
            const writeOffScoped = (g.writeOffs || [])
                .filter(c => c.date && mkey(c.date) === ym)
                .reduce((s, c) => s + Math.abs(parseInt(c.amount, 10) || 0), 0);
            const charged = rate * ss.pn + extraScoped - writeOffScoped;
            return { id: g.id, name: g.name, members: g.members.length, memberNames: g.members.map(m => m.name), pn: ss.pn, rate, charged, paid: recPaid, paidCash, paidTransfer, paidCard, paidQR, debt: charged > 0 ? charged - recPaid : 0, period: ym, closed: !!g.closed, completed: !!g.completed, specs: ss.specs };
        }
        return { id: g.id, name: g.name, members: g.members.length, memberNames: g.members.map(m => m.name), pn: g.totalPersonNights, rate, charged: g.contractTotal, paid: g.amountPaid, paidCash, paidTransfer, paidCard, paidQR, debt: Math.max(0, g.debt), period: periodStr, closed: !!g.closed, completed: !!g.completed, specs: ss.specs };
    }), [groups, ym, payments]);  

    const activeCols = OR_COLS.filter(c => cols[c.key]);
    const totals = {};
    OR_COLS.forEach(c => { if (c.num) totals[c.key] = rows.reduce((s, r) => s + (c.key === 'debt' ? Math.max(0, r.debt) : (Number(c.val(r)) || 0)), 0); });

    const scopedPayments = useMemo(() => payments
        .filter(p => groupIds.has(p.contractGroupId) && (!ym || mkey(p.date) === ym))
        .sort((a, b) => (b.date || '').localeCompare(a.date || '')), [payments, groupIds, ym]);

    // Специальности по всем (в рамках области)
    const specsTotal = useMemo(() => {
        const m = {};
        rows.forEach(r => Object.entries(r.specs).forEach(([sp, v]) => { m[sp] = (m[sp] || 0) + v; }));
        return Object.entries(m).sort((a, b) => b[1] - a[1]);
    }, [rows]);

    const gname = (id) => groups.find(g => g.id === id)?.name || '—';
    const titleScope = ym ? `${PMC_MONTHS_FULL[parseInt(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}` : scopeLabel;

    // Оплаты по ДНЮ: общая сумма за день + разбивка, КОМУ (по договорам) и каким методом
    const paymentsByDay = useMemo(() => {
        const dayMap = new Map();
        scopedPayments.forEach(p => {
            const day = (p.date || '').slice(0, 10);
            if (!dayMap.has(day)) dayMap.set(day, { day, total: 0, cash: 0, transfer: 0, card: 0, qr: 0, byContract: new Map() });
            const d = dayMap.get(day);
            let cash = parseInt(p.cash) || 0, transfer = parseInt(p.transfer) || 0, card = parseInt(p.card) || 0, qr = parseInt(p.qr) || 0;
            let sum = cash + transfer + card + qr;
            if (sum === 0) { const amt = parseInt(p.amount) || 0; const m = p.method; if (m === 'transfer') transfer = amt; else if (m === 'card') card = amt; else if (m === 'qr') qr = amt; else cash = amt; sum = amt; }
            d.total += sum; d.cash += cash; d.transfer += transfer; d.card += card; d.qr += qr;
            if (!d.byContract.has(p.contractGroupId)) d.byContract.set(p.contractGroupId, { id: p.contractGroupId, cash: 0, transfer: 0, card: 0, qr: 0, total: 0 });
            const bc = d.byContract.get(p.contractGroupId);
            bc.cash += cash; bc.transfer += transfer; bc.card += card; bc.qr += qr; bc.total += sum;
        });
        return [...dayMap.values()]
            .map(d => ({ ...d, contracts: [...d.byContract.values()].sort((a, b) => b.total - a.total) }))
            .sort((a, b) => (b.day || '').localeCompare(a.day || ''));
    }, [scopedPayments]);
    const methodParts = (o) => [[t('ormPmCash'), o.cash], [t('ormPmTransfer'), o.transfer], [t('ormPmCard'), o.card], [t('qr'), o.qr]].filter(([, v]) => v > 0).map(([l, v]) => `${l} ${fm(v)}`).join(' · ') || '—';

    // Детальные периоды проживания всех договоров (с учётом выбранного месяца)
    const periodRows = useMemo(() => {
        const out = [];
        groups.forEach(g => (g.manualEntries || []).forEach(e => {
            if (ym) {
                const a = e.checkIn ? mkey(e.checkIn) : '', b = e.checkOut ? mkey(e.checkOut) : '';
                if (!(a === ym || b === ym || (a && b && a <= ym && ym <= b))) return;
            }
            let nights = 0;
            if (e.checkIn && e.checkOut) nights = Math.round((new Date(e.checkOut + 'T00:00:00') - new Date(e.checkIn + 'T00:00:00')) / 86400000);
            if (!nights) nights = parseInt(e.nights, 10) || 0;
            const people = parseInt(e.people, 10) || 0;
            const specs = (e.workerGroups || []).filter(wg => wg.specialty && (parseInt(wg.count) || 0) > 0).map(wg => `${wg.specialty} ${wg.count}`).join(', ');
            out.push({ contract: g.name, checkIn: e.checkIn || '', checkOut: e.checkOut || '', nights, people, personNights: nights * people, specs });
        }));
        // Сортируем по договору (каждый отдельно), внутри — по дате заезда
        return out.sort((a, b) => a.contract.localeCompare(b.contract, 'ru') || (a.checkIn || '').localeCompare(b.checkIn || ''));
    }, [groups, ym]);  

    // Участники с проживанием (сколько ночей прожили)
    const memberRows = useMemo(() => {
        const out = [];
        groups.forEach(g => (g.members || []).forEach(m => out.push({ contract: g.name, member: m.name, nights: m.totalNights || 0 })));
        return out.sort((a, b) => a.contract.localeCompare(b.contract, 'ru') || a.member.localeCompare(b.member, 'ru'));
    }, [groups]);

    const copyText = () => {
        const L = [t('ormReportDash').replace('{n}', titleScope), ''];
        L.push([t('ormContract'), ...activeCols.map(c => c.label)].join('\t'));
        rows.forEach(r => L.push([r.name, ...activeCols.map(c => c.key === 'debt' ? Math.max(0, r.debt) : c.val(r))].join('\t')));
        L.push([t('ormTotalUpper'), ...activeCols.map(c => c.num ? totals[c.key] : '')].join('\t'));
        if (sec.periods && periodRows.length) {
            L.push('', t('ormPeriodsColon'));
            periodRows.forEach(p => L.push(`  ${p.contract}: ${p.checkIn || '?'} → ${p.checkOut || '?'} · ${p.nights} ${t('msNightShort')} · ${p.people} ${t('msPeopleWord')} · ${p.personNights} ${t('ormPnShort')}`));
        }
        if (sec.members) {
            L.push('', t('ormMembersLivedColon'));
            groups.forEach(g => { if ((g.members || []).length) L.push(`  ${g.name}: ${g.members.map(m => `${m.name} (${m.totalNights || 0}${t('msNightShort')})`).join(', ')}`); });
        }
        if (sec.specs && specsTotal.length) {
            L.push('', t('ormSpecsColon'));
            specsTotal.forEach(([sp, v]) => L.push(`  ${sp}: ${v}`));
        }
        if (sec.payments && paymentsByDay.length) {
            L.push('', t('ormPaymentsColon'));
            paymentsByDay.forEach(d => {
                L.push(`  ${d.day} — ${t('ormTotalLc')} ${fm(d.total)} (${methodParts(d)})`);
                d.contracts.forEach(c => L.push(`     ↳ ${gname(c.id)}: ${fm(c.total)} (${methodParts(c)})`));
            });
        }
        navigator.clipboard.writeText(L.join('\n')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
    };

    const exportXlsx = async () => {
        if (exporting) return;
        setExporting(true);
        try {
        const ExcelJS = (await import('exceljs')).default;
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Hostella';
        const MONEY = '#,##0';
        const HEAD = 'FF0F9688';        // бирюзовый заголовок
        const TOTAL_FILL = 'FFE8F5F3';  // светлый итог
        const ZEBRA = 'FFF8FAFC';       // чередование строк
        // акцентные цвета (как в экранной таблице)
        const C_TEAL = 'FF0F9688';      // чел-ночи
        const C_GREEN = 'FF059669';     // оплачено
        const C_RED = 'FFDC2626';       // долг (текст)
        const C_RED_FILL = 'FFFFE4E6';  // долг (заливка)
        const C_GREY = 'FF94A3B8';      // ноль / архив
        const C_SLATE = 'FF334155';     // обычный текст
        const thin = { style: 'thin', color: { argb: 'FFE2E8F0' } };
        const box = { top: thin, left: thin, bottom: thin, right: thin };
        const titleRow = (ws, span, text) => {
            const r = ws.addRow([text]);
            ws.mergeCells(r.number, 1, r.number, span);
            const c = r.getCell(1);
            c.font = { bold: true, size: 13, color: { argb: HEAD } };
            c.alignment = { vertical: 'middle', horizontal: 'left' };
            r.height = 26;
            return r;
        };

        const addHeader = (ws, labels) => {
            const r = ws.addRow(labels);
            r.height = 22;
            r.eachCell(c => {
                c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD } };
                c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                c.border = box;
            });
        };
        const fillRow = (row, argb) => row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }; });
        const boxRow = (row) => row.eachCell(c => { c.border = box; });
        const moneyFmt = (ws, idxs) => idxs.forEach(i => { ws.getColumn(i).numFmt = MONEY; ws.getColumn(i).alignment = { horizontal: 'right' }; });
        const widths = (ws, ws_widths) => ws_widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

        // ── 1) Сводка ──
        {
            const ncol = activeCols.length + 1;
            const ws = wb.addWorksheet(t('ormSheetSummary'), { views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }] });
            titleRow(ws, ncol, t('ormReportByContracts').replace('{n}', titleScope) + (hostelLabel ? ' · ' + hostelLabel : ''));
            addHeader(ws, [t('ormContract'), ...activeCols.map(c => c.label)]);

            const accentCell = (cell, col, value, { isTotal = false } = {}) => {
                if (col.money) cell.numFmt = MONEY;
                if (col.num) cell.alignment = { horizontal: 'right' };
                const v = Number(value) || 0;
                if (col.key === 'debt') {
                    if (v > 0) {
                        cell.font = { bold: true, size: isTotal ? 12 : 11, color: { argb: C_RED } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_RED_FILL } };
                    } else {
                        cell.font = { color: { argb: C_GREY }, bold: isTotal };
                    }
                } else if (col.key === 'paid') {
                    cell.font = { bold: true, color: { argb: v > 0 ? C_GREEN : C_GREY } };
                } else if (col.key === 'pn') {
                    cell.font = { bold: true, color: { argb: C_TEAL } };
                } else if (col.key === 'status') {
                    cell.alignment = { horizontal: 'center' };
                    cell.font = { bold: true, color: { argb: value === t('archived') ? C_GREY : value === t('msCompletedBadge') ? C_SLATE : C_TEAL } };
                } else if (isTotal) {
                    cell.font = { bold: true };
                }
            };

            rows.forEach((r, idx) => {
                const vals = activeCols.map(c => c.key === 'debt' ? Math.max(0, r.debt) : c.val(r));
                const row = ws.addRow([r.name, ...vals]);
                boxRow(row);
                if (idx % 2) fillRow(row, ZEBRA);
                row.getCell(1).font = { bold: true, color: { argb: C_SLATE } };
                row.getCell(1).alignment = { horizontal: 'left', wrapText: true };
                activeCols.forEach((c, i) => accentCell(row.getCell(i + 2), c, vals[i]));
            });

            const tr = ws.addRow([t('ormTotalUpper'), ...activeCols.map(c => c.num ? totals[c.key] : '')]);
            tr.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } }; c.border = { ...box, top: { style: 'medium', color: { argb: HEAD } } }; });
            tr.getCell(1).font = { bold: true, size: 12, color: { argb: C_SLATE } };
            activeCols.forEach((c, i) => { if (c.num) accentCell(tr.getCell(i + 2), c, totals[c.key], { isTotal: true }); });

            widths(ws, [30, ...activeCols.map(c => c.text ? 24 : 14)]);
        }

        // ── 2) Периоды (по договорам, с подытогами) ──
        if (sec.periods && periodRows.length) {
            const ws = wb.addWorksheet(t('ormSheetPeriods'), { views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }] });
            titleRow(ws, 7, t('ormPeriodsLivingDash').replace('{n}', titleScope));
            addHeader(ws, [t('ormContract'), t('tplVarCheckIn'), t('tplVarCheckOut'), t('tplVarNights'), t('ormPeopleCol'), t('ormPersonNightsFull'), t('ormSpecialties')]);
            const byC = periodRows.reduce((acc, p) => { (acc[p.contract] = acc[p.contract] || []).push(p); return acc; }, {});
            const entries = Object.entries(byC);
            entries.forEach(([contract, list], gi) => {
                list.forEach((p, idx) => {
                    // Имя договора показываем только в первой строке группы — чище и понятнее
                    const row = ws.addRow([idx === 0 ? contract : '', p.checkIn, p.checkOut, p.nights, p.people, p.personNights, p.specs]);
                    boxRow(row);
                    if (idx % 2) fillRow(row, ZEBRA);
                    if (idx === 0) row.getCell(1).font = { bold: true, color: { argb: C_SLATE } };
                    row.getCell(1).alignment = { horizontal: 'left', wrapText: true };
                    [4, 5].forEach(ci => { row.getCell(ci).alignment = { horizontal: 'right' }; });
                    const pnCell = row.getCell(6); pnCell.alignment = { horizontal: 'right' }; pnCell.font = { bold: true, color: { argb: C_TEAL } };
                    row.getCell(7).alignment = { horizontal: 'left', wrapText: true };
                });
                const sub = ws.addRow([t('ormTotalColon').replace('{n}', contract), '', '', list.reduce((s, p) => s + p.nights, 0), '', list.reduce((s, p) => s + p.personNights, 0), '']);
                sub.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } }; c.border = box; });
                sub.getCell(1).font = { bold: true, color: { argb: C_SLATE } };
                sub.getCell(1).alignment = { horizontal: 'left' };
                sub.getCell(4).font = { bold: true }; sub.getCell(4).alignment = { horizontal: 'right' };
                sub.getCell(6).font = { bold: true, color: { argb: C_TEAL } }; sub.getCell(6).alignment = { horizontal: 'right' };
                // Разделитель между группами
                if (gi < entries.length - 1) ws.addRow([]);
            });
            widths(ws, [30, 13, 13, 9, 8, 13, 36]);
        }

        // ── 3) Участники (сколько прожили) ──
        if (sec.members && memberRows.length) {
            const ws = wb.addWorksheet(t('msParticipants'), { views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }] });
            titleRow(ws, 3, t('ormMembersDash').replace('{n}', titleScope));
            addHeader(ws, [t('ormContract'), t('ormMember'), t('ormLivedNights')]);
            memberRows.forEach((m, idx) => {
                const row = ws.addRow([m.contract, m.member, m.nights]);
                boxRow(row);
                if (idx % 2) fillRow(row, ZEBRA);
                row.getCell(3).alignment = { horizontal: 'right' };
            });
            widths(ws, [26, 28, 14]);
            moneyFmt(ws, [3]);
        }

        // ── 4) Специальности ──
        if (sec.specs && specsTotal.length) {
            const ws = wb.addWorksheet(t('ormSpecialties'), { views: [{ state: 'frozen', ySplit: 2 }] });
            titleRow(ws, 2, t('ormSpecsPersonDaysDash').replace('{n}', titleScope));
            addHeader(ws, [t('ormSpecialty'), t('ormPersonDays')]);
            specsTotal.forEach(([sp, v], idx) => {
                const row = ws.addRow([sp, v]);
                boxRow(row);
                if (idx % 2) fillRow(row, ZEBRA);
                const c = row.getCell(2); c.alignment = { horizontal: 'right' }; c.font = { bold: true, color: { argb: C_TEAL } };
            });
            widths(ws, [30, 14]);
            moneyFmt(ws, [2]);
        }

        // ── 5) Оплаты по дням (итог дня + кому) ──
        if (sec.payments && paymentsByDay.length) {
            const ws = wb.addWorksheet(t('ormSheetPayments'), { views: [{ state: 'frozen', ySplit: 2 }] });
            titleRow(ws, 7, t('ormPaymentsByDayDash').replace('{n}', titleScope));
            addHeader(ws, [t('date'), t('ormContract'), t('cash'), t('transferShort'), t('ormCardCol'), t('qr'), t('total')]);
            paymentsByDay.forEach((d, di) => {
                const dr = ws.addRow([d.day, t('ormDayTotal'), d.cash, d.transfer, d.card, d.qr, d.total]);
                dr.eachCell(c => { c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } }; c.border = box; });
                dr.getCell(7).font = { bold: true, color: { argb: C_TEAL } };
                d.contracts.forEach(c0 => {
                    const row = ws.addRow(['', `↳ ${gname(c0.id)}`, c0.cash, c0.transfer, c0.card, c0.qr, c0.total]);
                    boxRow(row);
                    row.getCell(2).font = { color: { argb: C_SLATE } };
                });
                if (di < paymentsByDay.length - 1) ws.addRow([]);
            });
            const tot = ws.addRow([t('ormGrandTotal'), '', paymentsByDay.reduce((s, d) => s + d.cash, 0), paymentsByDay.reduce((s, d) => s + d.transfer, 0), paymentsByDay.reduce((s, d) => s + d.card, 0), paymentsByDay.reduce((s, d) => s + d.qr, 0), paymentsByDay.reduce((s, d) => s + d.total, 0)]);
            tot.eachCell(c => { c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } }; c.border = { ...box, top: { style: 'medium', color: { argb: HEAD } } }; });
            tot.getCell(7).font = { bold: true, size: 12, color: { argb: C_GREEN } };
            widths(ws, [14, 28, 14, 14, 14, 12, 16]);
            moneyFmt(ws, [3, 4, 5, 6, 7]);
        }

        // ── Скачивание ──
        if (wb.worksheets.length === 0) wb.addWorksheet(t('ormReport')); // на всякий случай: книга не пустая
        const buf = await wb.xlsx.writeBuffer();
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${t('ormReport')}_${(hostelLabel || '').replace(/\s/g, '') || t('ormContractsWord')}_${ym || t('ormAllWord')}.xlsx`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        } catch (e) {
            console.error('Excel export failed:', e);
            alert(t('ormExcelFail').replace('{n}', e?.message || t('ormUnknownError')));
        } finally {
            setExporting(false);
        }
    };

    const bg = dk ? '#1e293b' : '#fff';
    const txt = dk ? '#e2e8f0' : '#1e293b';
    const sub = dk ? '#94a3b8' : '#64748b';
    const bd = dk ? '#334155' : '#f1f5f9';
    const th = { color: sub, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' };
    const tdBase = { fontSize: 12, padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap', borderTop: `1px solid ${bd}` };
    const Chip = ({ on, onClick, children }) => (
        <button onClick={onClick} className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
            style={on ? { background: 'rgba(15,150,136,0.15)', color: '#0f9688', border: '1px solid rgba(15,150,136,0.4)' }
                      : { background: dk ? '#0f172a' : '#f1f5f9', color: sub, border: `1px solid ${bd}` }}>{children}</button>
    );

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: 'rgba(13,43,48,0.72)' }} onClick={onClose}>
            <div className="rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col" style={{ background: bg }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${bd}` }}>
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#0f9688' }}>{t('ormOverall')}{hostelLabel ? ` · ${hostelLabel}` : ''}</div>
                        <div className="text-lg font-black mt-0.5" style={{ color: txt }}>{titleScope}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <select value={ym} onChange={e => setYm(e.target.value)}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg focus:outline-none"
                            style={{ background: dk ? '#0f172a' : '#f1f5f9', color: txt, border: `1px solid ${bd}` }}>
                            <option value="">{t('ormAllMonthsTotals')}</option>
                            {months.map(m => <option key={m} value={m}>{PMC_MONTHS_FULL[parseInt(m.slice(5, 7)) - 1]} {m.slice(0, 4)}</option>)}
                        </select>
                        <button onClick={copyText} className="px-3 py-1.5 text-xs font-bold rounded-lg" style={{ background: copied ? '#22c55e' : '#0f9688', color: '#fff' }}>{copied ? t('ormCopiedCheck') : t('copy')}</button>
                        <button onClick={exportXlsx} disabled={exporting} className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-60" style={{ background: '#6366f1', color: '#fff' }}>{exporting ? t('ormBuilding') : 'Excel'}</button>
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: sub }}><X size={16} /></button>
                    </div>
                </div>

                {/* Что показать */}
                <div className="px-5 py-3 shrink-0" style={{ borderBottom: `1px solid ${bd}` }}>
                    <div className="text-[9px] font-bold uppercase tracking-wide mb-1.5" style={{ color: sub }}>{t('ormColumns')}</div>
                    <div className="flex flex-wrap gap-1.5">
                        {OR_COLS.map(c => <Chip key={c.key} on={cols[c.key]} onClick={() => setCols(s => ({ ...s, [c.key]: !s[c.key] }))}>{c.label}</Chip>)}
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-wide mt-2.5 mb-1.5" style={{ color: sub }}>{t('staffSecView')}</div>
                    <div className="flex flex-wrap gap-1.5">
                        <Chip on={sec.payments} onClick={() => setSec(s => ({ ...s, payments: !s.payments }))}>{t('ormPaymentsByDay')}</Chip>
                        <Chip on={sec.periods} onClick={() => setSec(s => ({ ...s, periods: !s.periods }))}>{t('ormPeriodsDetailed')}</Chip>
                        <Chip on={sec.members} onClick={() => setSec(s => ({ ...s, members: !s.members }))}>{t('ormMembersNights')}</Chip>
                        <Chip on={sec.specs} onClick={() => setSec(s => ({ ...s, specs: !s.specs }))}>{t('ormSpecialties')}</Chip>
                    </div>
                </div>

                <div className="overflow-auto px-5 py-4">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ ...th, textAlign: 'left' }}>{t('ormContract')}</th>
                                {activeCols.map(c => <th key={c.key} style={{ ...th, textAlign: c.text ? 'left' : 'right' }}>{c.label}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r.id}>
                                    <td style={{ ...tdBase, color: txt, textAlign: 'left', fontWeight: 700 }}>{r.name}{r.closed ? ' 🔒' : ''}</td>
                                    {activeCols.map(c => {
                                        const raw = c.key === 'debt' ? Math.max(0, r.debt) : c.val(r);
                                        const color = c.accent ? '#0f9688' : c.green ? '#16a34a' : (c.red && r.debt > 0) ? '#ef4444' : c.text ? sub : txt;
                                        return <td key={c.key} style={{ ...tdBase, color, textAlign: c.text ? 'left' : 'right', fontWeight: (c.accent || c.green) ? 700 : 400, fontSize: c.text ? 11 : 12 }}>
                                            {c.money ? (raw ? fm(raw) : (c.key === 'debt' ? '—' : fm(0))) : raw}
                                        </td>;
                                    })}
                                </tr>
                            ))}
                            {rows.length === 0 && (
                                <tr><td colSpan={activeCols.length + 1} style={{ ...tdBase, color: sub, textAlign: 'center' }}>{t('noData')}</td></tr>
                            )}
                        </tbody>
                        {rows.length > 0 && (
                            <tfoot>
                                <tr>
                                    <td style={{ ...tdBase, color: txt, textAlign: 'left', fontWeight: 900, borderTop: `2px solid ${bd}` }}>{t('ormTotalUpper')}</td>
                                    {activeCols.map(c => (
                                        <td key={c.key} style={{ ...tdBase, color: c.accent ? '#0f9688' : c.green ? '#16a34a' : c.red ? '#ef4444' : txt, textAlign: c.text ? 'left' : 'right', fontWeight: 900, borderTop: `2px solid ${bd}` }}>
                                            {c.num ? (c.money ? fm(totals[c.key]) : totals[c.key]) : ''}
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        )}
                    </table>

                    {sec.periods && periodRows.length > 0 && (
                        <div className="mt-5">
                            <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: sub }}>{t('ormPeriodsByContract')}</div>
                            <div className="space-y-3">
                                {Object.entries(periodRows.reduce((acc, p) => { (acc[p.contract] = acc[p.contract] || []).push(p); return acc; }, {})).map(([contract, list]) => (
                                    <div key={contract} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${bd}` }}>
                                        <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ background: dk ? '#0f172a' : '#f1f5f9' }}>
                                            <span style={{ color: txt, fontSize: 12, fontWeight: 800 }}>{contract}</span>
                                            <span style={{ color: sub, fontSize: 10 }}>{list.reduce((s, p) => s + p.nights, 0)} {t('ormNochShort')} · {list.reduce((s, p) => s + p.personNights, 0)} {t('ormPnShort')}</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ ...th, textAlign: 'left' }}>{t('tplVarCheckIn')}</th>
                                                        <th style={{ ...th, textAlign: 'left' }}>{t('tplVarCheckOut')}</th>
                                                        <th style={th}>{t('tplVarNights')}</th>
                                                        <th style={th}>{t('ormPeopleCol')}</th>
                                                        <th style={th}>{t('ormPnCol')}</th>
                                                        <th style={{ ...th, textAlign: 'left' }}>{t('ormSpecialties')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {list.map((p, i) => (
                                                        <tr key={i}>
                                                            <td style={{ ...tdBase, textAlign: 'left', color: sub }}>{p.checkIn || '—'}</td>
                                                            <td style={{ ...tdBase, textAlign: 'left', color: sub }}>{p.checkOut || '—'}</td>
                                                            <td style={{ ...tdBase, color: txt }}>{p.nights}</td>
                                                            <td style={{ ...tdBase, color: txt }}>{p.people}</td>
                                                            <td style={{ ...tdBase, color: '#0f9688', fontWeight: 700 }}>{p.personNights}</td>
                                                            <td style={{ ...tdBase, textAlign: 'left', color: sub, whiteSpace: 'normal' }}>{p.specs || '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {sec.members && memberRows.length > 0 && (
                        <div className="mt-5">
                            <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: sub }}>{t('ormMembersLived')}</div>
                            <div className="space-y-1.5">
                                {groups.filter(g => (g.members || []).length).map(g => (
                                    <div key={g.id} className="px-3 py-1.5 rounded-lg" style={{ background: dk ? '#0f172a' : '#f8fafc' }}>
                                        <span style={{ color: txt, fontSize: 12, fontWeight: 700 }}>{g.name}:</span>{' '}
                                        <span style={{ color: sub, fontSize: 11 }}>{g.members.map(m => `${m.name} (${m.totalNights || 0}${t('msNightShort')})`).join(', ')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {sec.specs && specsTotal.length > 0 && (
                        <div className="mt-5">
                            <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: sub }}>{t('ormSpecsPersonDays')}</div>
                            <div className="flex flex-wrap gap-2">
                                {specsTotal.map(([sp, v]) => (
                                    <div key={sp} className="px-3 py-1.5 rounded-lg flex items-center gap-2" style={{ background: dk ? '#0f172a' : '#f8fafc' }}>
                                        <span style={{ color: txt, fontSize: 12, fontWeight: 600 }}>{sp}</span>
                                        <span style={{ color: '#0f9688', fontSize: 12, fontWeight: 800 }}>{fm(v)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {sec.payments && paymentsByDay.length > 0 && (
                        <div className="mt-5">
                            <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: sub }}>{t('ormPaymentsByDayN').replace('{n}', paymentsByDay.length)}</div>
                            <div className="space-y-2">
                                {paymentsByDay.map((d) => (
                                    <div key={d.day} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${bd}` }}>
                                        {/* Итог за день */}
                                        <div className="flex items-center justify-between gap-3 px-3 py-2" style={{ background: dk ? '#0f172a' : '#f1f5f9' }}>
                                            <span style={{ color: txt, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>{d.day}</span>
                                            <span style={{ color: sub, fontSize: 10, flex: 1, textAlign: 'right', minWidth: 0 }} className="truncate">{methodParts(d)}</span>
                                            <span style={{ color: '#16a34a', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap' }}>{fm(d.total)}</span>
                                        </div>
                                        {/* Кому из этой суммы */}
                                        {d.contracts.map(c => (
                                            <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-1.5" style={{ borderTop: `1px solid ${bd}` }}>
                                                <span style={{ color: txt, fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0 }} className="truncate">↳ {gname(c.id)}</span>
                                                <span style={{ color: sub, fontSize: 10, whiteSpace: 'nowrap' }}>{methodParts(c)}</span>
                                                <span style={{ color: '#16a34a', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{fm(c.total)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Отчёт по составу бригады ─────────────────────────────────────────────

export default OverallReportModal;
