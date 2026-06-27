// Лист проживающих для бухгалтерии — список группы 1..20 чел.
// Печать в том же стиле, что и договор. Заголовок и язык (RU/UZ) задаются в модалке.
// Печать (М.П.) ставится отдельно вручную.

const getPaid = (g) => (typeof g.amountPaid === 'number' ? g.amountPaid
    : ((+g.paidCash || 0) + (+g.paidCard || 0) + (+g.paidQR || 0) + (+g.paidTransfer || 0)));

// Реквизиты по хостелам
const LEGAL = {
    hostel1: {
        entity: '«SABIROVA SHOIRA BAXTIYOROVNA»',
        regAddr: 'Юнусабадский район, Мирзо Улугбек МФЙ, ул. Ниёзбек Йули, 43',
        idLabel: 'ИНН', idNum: '41802800190045',
        account: '20218000207167574001',
        mfo: '01145',
        bank: 'Шайхантахурский филиал АИКБ «Ипак Йули»',
        sign: 'SABIROVA SH. B.',
    },
    hostel2: {
        entity: '«YULDASHEV AZIZ IRGASHEVICH»',
        regAddr: 'Юнусабадский район, ул. Ниёзбек Йули, 6-проезд, 41',
        idLabel: 'ПИНФЛ', idNum: '31406840190037',
        account: '20218000507377875001',
        mfo: '01145',
        bank: 'АТБ «Ипак Йули»',
        sign: 'YULDASHEV A. I.',
    },
};

// Заголовки документа по умолчанию (используются и в модалке)
export const RECEIPT_TITLES = {
    ru: 'СПРАВКА О ПРОЖИВАНИИ',
    uz: 'YASHASH TO‘G‘RISIDA MA’LUMOTNOMA',
};

// Полностью переводимые строки документа
const STR = {
    ru: {
        titleDefault: RECEIPT_TITLES.ru,
        entityPrefix: 'ИП',
        fromDate: 'от ',
        period: 'Период проживания',
        rate: 'Ставка', rateUnit: 'сум/ночь',
        thName: 'Ф.И.О.', thPassport: 'Паспортные данные', thQty: 'Кол-во', thPrice: 'Цена', thSum: 'Сумма, сум',
        totalStay: 'Итого за проживание', total: 'ИТОГО', persons: 'чел.',
        svcTitle: 'Дополнительные услуги', thService: 'Услуга', svcTotal: 'Итого услуги',
        grand: 'ВСЕГО К ОПЛАТЕ', sum: 'сум',
        emptyList: 'Список пуст',
        accountLbl: 'Счёт №', mfoLbl: 'МФО',
        signRole: 'Подпись ответственного лица', seal: 'М.П.',
        kind: 'Семейное предпринимательство без образования юридического лица',
        locale: 'ru-RU',
    },
    uz: {
        titleDefault: RECEIPT_TITLES.uz,
        entityPrefix: 'YATT',
        fromDate: '',
        period: 'Yashash davri',
        rate: 'Tarif', rateUnit: 'so‘m/kecha',
        thName: 'F.I.Sh.', thPassport: 'Pasport ma’lumotlari', thQty: 'Soni', thPrice: 'Narxi', thSum: 'Summa, so‘m',
        totalStay: 'Yashash uchun jami', total: 'JAMI', persons: 'kishi',
        svcTitle: 'Qo‘shimcha xizmatlar', thService: 'Xizmat', svcTotal: 'Xizmatlar jami',
        grand: 'JAMI TO‘LOVGA', sum: 'so‘m',
        emptyList: 'Ro‘yxat bo‘sh',
        accountLbl: 'Hisob raqami', mfoLbl: 'MFO',
        signRole: 'Mas’ul shaxs imzosi', seal: 'M.O‘.',
        kind: 'Yuridik shaxs tashkil etmagan oilaviy tadbirkorlik',
        locale: 'uz-UZ',
    },
};

// Узбекские аналоги налоговых меток
const ID_LABEL_UZ = { 'ИНН': 'STIR', 'ПИНФЛ': 'JSHSHIR' };

const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = (n) => (Number(n) || 0).toLocaleString('ru-RU');

/**
 * Печать листа проживающих для бухгалтерии.
 * @param {Array} guests  — массив гостей (1..20)
 * @param {string} hostelId — 'hostel1' | 'hostel2'
 * @param {object} opts — { date, periodFrom, periodTo, rate, services, blocks, title, lang }
 */
export function printGroupReceipt(guests = [], hostelId = 'hostel1', opts = {}) {
    const L = LEGAL[hostelId] || LEGAL.hostel1;
    const lang = opts.lang === 'uz' ? 'uz' : 'ru';
    const S = STR[lang];
    const title = (opts.title || '').trim() || S.titleDefault;

    const list = (guests || []).slice(0, 20);
    const dateObj = opts.date ? new Date(opts.date) : new Date();
    const dateStr = dateObj.toLocaleDateString(S.locale, { day: '2-digit', month: 'long', year: 'numeric' });
    const fmtD = (d) => d ? new Date(d).toLocaleDateString(S.locale) : '';
    const period = (opts.periodFrom && opts.periodTo) ? `${S.period}: ${fmtD(opts.periodFrom)} — ${fmtD(opts.periodTo)}` : '';
    const rateLine = opts.rate ? `${S.rate}: ${money(opts.rate)} ${S.rateUnit}` : '';
    const logo1 = `${import.meta.env.BASE_URL}Logo.png`;
    const logo2 = `${import.meta.env.BASE_URL}uzbek-tourism.svg`;

    let total = 0;
    const rows = list.map((g, i) => {
        const sum = (Number(g.totalPrice) || 0) || getPaid(g);
        total += sum;
        const kun = g.days || (g.checkInDate && g.checkOutDate
            ? Math.max(1, Math.round((new Date(g.checkOutDate) - new Date(g.checkInDate)) / 86400000)) : '');
        return `<tr>
            <td class="c">${i + 1}</td>
            <td>${esc(g.fullName || '')}</td>
            <td>${esc(g.passport || '')}</td>
            <td class="c">${esc(kun)}</td>
            <td class="r">${sum ? money(sum) : ''}</td>
        </tr>`;
    }).join('');

    // Доп. услуги (произвольные цены)
    const servicesArr = Array.isArray(opts.services) ? opts.services : [];
    const svcQty = (s) => (Number(s.qty) > 0 ? Number(s.qty) : 1);
    const svcSum = (s) => svcQty(s) * (Number(s.price) || 0);
    const servicesTotal = servicesArr.reduce((acc, x) => acc + svcSum(x), 0);
    const grandTotal = total + servicesTotal;
    const servicesRows = servicesArr.map((s, i) => `<tr>
            <td class="c">${i + 1}</td>
            <td>${esc(s.name || '')}</td>
            <td class="c">${svcQty(s)}</td>
            <td class="r">${money(s.price)}</td>
            <td class="r">${money(svcSum(s))}</td>
        </tr>`).join('');
    const servicesBlock = servicesArr.length ? `
        <div class="subttl">${S.svcTitle}</div>
        <table class="g svc">
          <thead><tr><th class="c num">№</th><th>${S.thService}</th><th class="c kun">${S.thQty}</th><th class="r">${S.thPrice}</th><th class="r sum">${S.thSum}</th></tr></thead>
          <tbody>${servicesRows}</tbody>
          <tfoot><tr><td colspan="4" class="r">${S.svcTotal}:</td><td class="r">${money(servicesTotal)}</td></tr></tfoot>
        </table>
        <div class="grand">${S.grand}: <b>${money(grandTotal)} ${S.sum}</b></div>` : '';

    // Произвольные текстовые блоки
    const blocksArr = Array.isArray(opts.blocks) ? opts.blocks : [];
    const blocksBlock = blocksArr.length
        ? `<div class="blocks">${blocksArr.map(t => `<p>${esc(t).replace(/\n/g, '<br/>')}</p>`).join('')}</div>`
        : '';

    const idLabel = lang === 'uz' ? (ID_LABEL_UZ[L.idLabel] || L.idLabel) : L.idLabel;
    const bank1 = `${L.regAddr}${L.idNum ? `, ${idLabel} ${L.idNum}` : ''}`;
    const bank2 = `${S.accountLbl} ${L.account || '____________________'}, ${S.mfoLbl} ${L.mfo || '_____'}${L.bank ? `, ${L.bank}` : ''}`;

    const w = window.open('', '', 'width=900,height=1200');
    const html = `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><title>${esc(title)}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0;}
      html,body{background:#e7ecf1;font-family:'PT Sans','Segoe UI',Arial,sans-serif;color:#1b2733;font-size:11.5px;line-height:1.4;-webkit-font-smoothing:antialiased;}
      .page{width:210mm;min-height:297mm;margin:20px auto;background:#fff;padding:15mm 16mm 14mm;box-shadow:0 10px 40px rgba(18,62,116,.16);}
      .head{display:flex;align-items:center;justify-content:space-between;gap:20px;}
      .head img{object-fit:contain;display:block;}
      .head .logoA{height:62px;}
      .head .logoB{height:50px;}
      .org{text-align:center;margin-top:6px;}
      .org .name{font-weight:800;font-size:14px;color:#123e74;letter-spacing:.3px;}
      .org .kind{font-size:10.5px;color:#42536a;margin-top:1px;}
      .org .bank{font-size:10px;color:#5a6b7e;margin-top:2px;}
      .rule{border-top:2.5px solid #123e74;margin:8px 0 0;}
      .rule i{display:block;border-top:1px solid #cdd8e6;margin-top:2.5px;}
      .ktitle{text-align:center;font-size:18px;font-weight:800;letter-spacing:1.5px;color:#123e74;margin:11px 0 1px;line-height:1.25;}
      .kdate{text-align:center;font-size:11px;color:#5a6b7e;margin-bottom:9px;}
      table.g{width:100%;border-collapse:collapse;font-size:11.5px;}
      table.g th{background:#123e74;color:#fff;font-size:10.5px;font-weight:700;padding:8px 9px;text-align:left;}
      table.g th.c,table.g td.c{text-align:center;}
      table.g th.r,table.g td.r{text-align:right;}
      table.g td{padding:7px 9px;border-bottom:1px solid #e6ebf1;}
      table.g tbody tr:nth-child(even) td{background:#f7f9fc;}
      table.g .num{width:34px;}
      table.g .kun{width:60px;}
      table.g .sum{width:120px;}
      table.g tfoot td{font-weight:800;font-size:12.5px;border-top:2px solid #123e74;background:#eef3f9;padding:9px;}
      .subttl{font-weight:800;font-size:12px;color:#123e74;margin:14px 0 6px;}
      .grand{text-align:right;font-size:14px;font-weight:800;color:#123e74;margin-top:8px;}
      .blocks{margin-top:14px;font-size:11.5px;color:#1b2733;}
      .blocks p{margin:0 0 7px;white-space:pre-wrap;line-height:1.5;}
      .sigrow{display:flex;justify-content:space-between;align-items:flex-end;margin-top:34px;gap:24px;}
      .sigrow .who{font-size:11.5px;}
      .sigrow .who .ln{display:inline-block;border-bottom:1px solid #2a3a49;min-width:160px;margin-left:6px;}
      .sigrow .who .role{font-size:9.5px;color:#6b7a8c;margin-top:3px;}
      .seal{width:128px;height:128px;border:1.5px dashed #b6c1cf;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;color:#aab6c4;font-size:9.5px;}
      .foot{margin-top:14px;padding-top:8px;border-top:1px solid #e7ecf1;text-align:center;font-size:9px;color:#9aa7b6;}
      @media print{
        html,body{background:#fff;}
        .page{width:auto;min-height:auto;margin:0;padding:0;box-shadow:none;}
        table.g th,table.g tfoot td,table.g tbody tr:nth-child(even) td{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      }
      @page{size:A4;margin:13mm 14mm;}
    </style></head><body>
      <div class="page">
        <div class="head"><img class="logoA" src="${logo1}" alt=""/><img class="logoB" src="${logo2}" alt=""/></div>
        <div class="org">
          <div class="name">${S.entityPrefix} ${L.entity}</div>
          <div class="kind">${S.kind}</div>
          <div class="bank">${bank1}</div>
          <div class="bank">${bank2}</div>
        </div>
        <div class="rule"><i></i></div>
        <div class="ktitle">${esc(title)}</div>
        <div class="kdate">${S.fromDate}${dateStr}${period ? ` · ${period}` : ''}${rateLine ? ` · ${rateLine}` : ''}</div>
        <table class="g">
          <thead><tr>
            <th class="c num">№</th><th>${S.thName}</th><th>${S.thPassport}</th>
            <th class="c kun">${S.thQty}</th><th class="r sum">${S.thSum}</th>
          </tr></thead>
          <tbody>${rows || `<tr><td colspan="5" class="c" style="color:#9aa7b6;padding:18px">${S.emptyList}</td></tr>`}</tbody>
          <tfoot><tr><td colspan="4" class="r">${servicesArr.length ? S.totalStay : S.total} (${list.length} ${S.persons}):</td><td class="r">${money(total)}</td></tr></tfoot>
        </table>
        ${servicesBlock}
        ${blocksBlock}
        <div class="sigrow">
          <div class="who">
            <div>${S.entityPrefix} ${L.sign}: <span class="ln"></span></div>
            <div class="role">${S.signRole}</div>
          </div>
          <div class="seal">${S.seal}</div>
        </div>
        <div class="foot">${S.entityPrefix} ${L.entity} · ${L.regAddr}</div>
      </div>
    </body></html>`;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 350);
}
