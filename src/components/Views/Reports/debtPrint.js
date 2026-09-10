// Печатная форма отчёта по долгам: открывается в новом окне и уходит в печать.
// Держим отдельно от модалки — это чистая строка HTML, её удобно менять и читать.
import TRANSLATIONS from '../../../constants/translations.js';

const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

const money = (n) => (parseInt(n, 10) || 0).toLocaleString('ru');

export const printDebtReport = ({ report, hostelLabel, hostelName, periodLabel, periodNet, expected, lang = 'ru' }) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;
    const SOURCE_TITLE = { guest: t('drmGuests'), rental: t('drmRentals'), contract: t('drmContracts') };
    const w = window.open('', '', 'width=900,height=700');
    if (!w) return;
    const { rows, totals, byHostel, byEntity, bySource } = report;
    const today = new Date().toLocaleDateString('ru');

    const section = (source) => {
        const list = rows.filter(r => r.source === source);
        if (!list.length) return '';
        return `
        <h3>${SOURCE_TITLE[source]} — ${money(bySource[source].debt)} ${t('sum')}</h3>
        <table>
            <thead><tr>
                <th>${t('drmColWho')}</th><th>${t('drmColDetails')}</th><th>${t('drmColBranch')}</th>
                <th class="r">${t('drmColCharged')}</th><th class="r">${t('drmColPaid')}</th><th class="r">${t('drmColDebt')}</th><th>${t('drmExpectedCol')}</th>
            </tr></thead>
            <tbody>${list.map(r => `
                <tr>
                    <td>${esc(r.name)}${r.records > 1 ? ` <span class="muted">(${t('drmRecords').replace('{n}', r.records)})</span>` : ''}</td>
                    <td class="muted">${esc(r.detail || '—')}</td>
                    <td>${esc(hostelName(r.hostelId))}</td>
                    <td class="r">${money(r.charged)}</td>
                    <td class="r">${money(r.paid)}</td>
                    <td class="r debt">${money(r.debt)}</td>
                    <td>${r.method === 'transfer' ? `${t('drmTransfer')}${r.entities?.length ? ` · ${esc(r.entities.join(', '))}` : ''}` : t('drmCashCard')}</td>
                </tr>`).join('')}
            </tbody>
        </table>`;
    };

    const html = `<html><head><title>${t('dvReportHeading')}</title><style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #1e293b; }
        h1 { margin: 0 0 4px; font-size: 20px; }
        h3 { margin: 22px 0 8px; font-size: 14px; }
        .sub { color: #64748b; font-size: 12px; margin-bottom: 18px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
        th { background: #f1f5f9; }
        .r { text-align: right; }
        .muted { color: #64748b; }
        .debt { color: #dc2626; font-weight: bold; }
        .cards { display: flex; gap: 10px; margin: 16px 0; }
        .card { flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; }
        .card .lbl { font-size: 10px; text-transform: uppercase; color: #64748b; letter-spacing: .04em; }
        .card .val { font-size: 17px; font-weight: bold; margin-top: 3px; }
        .note { font-size: 11px; color: #64748b; margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
    </style></head><body>
        <h1>${t('dvReportHeading')}</h1>
        <div class="sub">${esc(hostelLabel)} · ${today}</div>
        <div class="cards">
            <div class="card"><div class="lbl">${t('drmCardTotalDebts')}</div><div class="val debt">${money(totals.debt)}</div></div>
            <div class="card"><div class="lbl">${t('drmCardTransfer')}</div><div class="val">${money(totals.transfer)}</div></div>
            <div class="card"><div class="lbl">${t('drmCashCard')}</div><div class="val">${money(totals.regular)}</div></div>
            <div class="card"><div class="lbl">${t('dbpExpectedWithDebts')}</div><div class="val">${money(expected)}</div></div>
        </div>
        <h3>${t('drmByBranch')}</h3>
        <table>
            <thead><tr><th>${t('drmColBranch')}</th><th class="r">${t('drmGuests')}</th><th class="r">${t('drmColRent')}</th><th class="r">${t('drmColContracts')}</th><th class="r">${t('drmCardTransfer')}</th><th class="r">${t('drmCardRegular')}</th><th class="r">${t('drmColTotal')}</th></tr></thead>
            <tbody>${byHostel.map(h => `
                <tr>
                    <td>${esc(hostelName(h.hostelId))}</td>
                    <td class="r">${money(h.guest)}</td>
                    <td class="r">${money(h.rental)}</td>
                    <td class="r">${money(h.contract)}</td>
                    <td class="r">${money(h.transfer)}</td>
                    <td class="r">${money(h.regular)}</td>
                    <td class="r debt">${money(h.debt)}</td>
                </tr>`).join('')}
                <tr>
                    <td><b>${t('total')}</b></td>
                    <td class="r"><b>${money(bySource.guest.debt)}</b></td>
                    <td class="r"><b>${money(bySource.rental.debt)}</b></td>
                    <td class="r"><b>${money(bySource.contract.debt)}</b></td>
                    <td class="r"><b>${money(totals.transfer)}</b></td>
                    <td class="r"><b>${money(totals.regular)}</b></td>
                    <td class="r debt"><b>${money(totals.debt)}</b></td>
                </tr>
            </tbody>
        </table>
        ${byEntity.length ? `
        <h3>${t('dbpTransfersByRecipient')}</h3>
        <table>
            <thead><tr><th>${t('dbpRecipient')}</th><th class="r">${t('drmExpectedCol')}</th></tr></thead>
            <tbody>${byEntity.map(e => `<tr><td>${esc(e.entity)}</td><td class="r">${money(e.debt)}</td></tr>`).join('')}</tbody>
        </table>` : ''}
        ${section('guest')}
        ${section('rental')}
        ${section('contract')}
        <div class="note">
            ${t('dbpNote1').replace('{date}', today)}
            ${t('dbpNote2').replace('{period}', esc(periodLabel)).replace('{sum}', money(periodNet))}
            ${t('drmInfo3')}
        </div>
    </body></html>`;

    w.document.write(html);
    w.document.close();
    w.print();
};
