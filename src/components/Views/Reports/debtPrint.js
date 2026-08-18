// Печатная форма отчёта по долгам: открывается в новом окне и уходит в печать.
// Держим отдельно от модалки — это чистая строка HTML, её удобно менять и читать.

const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

const money = (n) => (parseInt(n, 10) || 0).toLocaleString('ru');

const SOURCE_TITLE = { guest: 'Гости', rental: 'Аренда комнат', contract: 'Договоры и бригады' };

export const printDebtReport = ({ report, hostelLabel, hostelName, periodLabel, periodNet, expected }) => {
    const w = window.open('', '', 'width=900,height=700');
    if (!w) return;
    const { rows, totals, byHostel, byEntity, bySource } = report;

    const section = (source) => {
        const list = rows.filter(r => r.source === source);
        if (!list.length) return '';
        return `
        <h3>${SOURCE_TITLE[source]} — ${money(bySource[source].debt)} сум</h3>
        <table>
            <thead><tr>
                <th>Кто</th><th>Детали</th><th>Филиал</th>
                <th class="r">Начислено</th><th class="r">Оплачено</th><th class="r">Долг</th><th>Ожидается</th>
            </tr></thead>
            <tbody>${list.map(r => `
                <tr>
                    <td>${esc(r.name)}${r.records > 1 ? ` <span class="muted">(${r.records} записи)</span>` : ''}</td>
                    <td class="muted">${esc(r.detail || '—')}</td>
                    <td>${esc(hostelName(r.hostelId))}</td>
                    <td class="r">${money(r.charged)}</td>
                    <td class="r">${money(r.paid)}</td>
                    <td class="r debt">${money(r.debt)}</td>
                    <td>${r.method === 'transfer' ? `перечисление${r.entities?.length ? ` · ${esc(r.entities.join(', '))}` : ''}` : 'наличные / карта'}</td>
                </tr>`).join('')}
            </tbody>
        </table>`;
    };

    const html = `<html><head><title>Отчёт по долгам</title><style>
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
        <h1>Отчёт по долгам</h1>
        <div class="sub">${esc(hostelLabel)} · на ${new Date().toLocaleDateString('ru')}</div>
        <div class="cards">
            <div class="card"><div class="lbl">Всего долгов</div><div class="val debt">${money(totals.debt)}</div></div>
            <div class="card"><div class="lbl">Перечислением</div><div class="val">${money(totals.transfer)}</div></div>
            <div class="card"><div class="lbl">Наличные / карта</div><div class="val">${money(totals.regular)}</div></div>
            <div class="card"><div class="lbl">Ожидаемо с учётом долгов</div><div class="val">${money(expected)}</div></div>
        </div>
        <h3>По филиалам</h3>
        <table>
            <thead><tr><th>Филиал</th><th class="r">Гости</th><th class="r">Аренда</th><th class="r">Договоры</th><th class="r">Перечислением</th><th class="r">Обычные</th><th class="r">Всего</th></tr></thead>
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
                    <td><b>Итого</b></td>
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
        <h3>Перечисления по получателям</h3>
        <table>
            <thead><tr><th>Получатель</th><th class="r">Ожидается</th></tr></thead>
            <tbody>${byEntity.map(e => `<tr><td>${esc(e.entity)}</td><td class="r">${money(e.debt)}</td></tr>`).join('')}</tbody>
        </table>` : ''}
        ${section('guest')}
        ${section('rental')}
        ${section('contract')}
        <div class="note">
            Долги — снимок на ${new Date().toLocaleDateString('ru')}, они не зависят от выбранного периода.
            Баланс за период ${esc(periodLabel)}: ${money(periodNet)} сум. «Ожидаемо» = баланс периода + все долги,
            то есть сколько будет, когда должники рассчитаются.
            Способ оплаты определён по прошлым платежам должника.
        </div>
    </body></html>`;

    w.document.write(html);
    w.document.close();
    w.print();
};
