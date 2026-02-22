import React from 'react';
import { COUNTRY_MAP, COUNTRIES } from '../constants/countries';

// Renders a country flag image from flagcdn.com by ISO code
// flagcdn only supports: 20, 40, 80, 160, 320 — snap to nearest
const FLAG_SIZES = [20, 40, 80, 160, 320];
const snapFlagSize = (s) => FLAG_SIZES.find(f => f >= s) || 320;
export const Flag = ({ code, size = 20 }) => {
  if (!code) return null;
  const w = snapFlagSize(size);
  const w2 = snapFlagSize(size * 2);
  const h = Math.round(size * 0.75);
  return (
    <img
      src={`https://flagcdn.com/w${w}/${code.toLowerCase()}.png`}
      srcSet={`https://flagcdn.com/w${w2}/${code.toLowerCase()}.png 2x`}
      width={size}
      height={h}
      alt={code}
      style={{ display: 'inline-block', objectFit: 'cover', borderRadius: 2, verticalAlign: 'middle', flexShrink: 0 }}
    />
  );
};

// Pure function: compute time-left label given a checkOutDate string and current ts
export const getTimeLeftLabel = (checkOutDate, nowMs) => {
  const checkOut = new Date(checkOutDate); // Replaced parseDate with new Date()
  if (!checkOut) return null;
  const ms = checkOut.getTime() - nowMs;
  if (ms <= 0) return { text: 'Время вышло', color: 'text-rose-600', icon: 'alert' };
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hrs  = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days >= 1) {
    const w = days === 1 ? 'день' : days < 5 ? 'дня' : 'дней';
    return { text: hrs > 0 ? `${days} ${w} ${hrs}ч` : `${days} ${w}`, color: 'text-slate-500', icon: 'cal' };
  }
  if (hrs >= 1) return { text: `${hrs}ч ${mins > 0 ? `${mins}м` : ''}`, color: 'text-amber-600', icon: 'clock' };
  return { text: `${mins} мин`, color: 'text-rose-600', icon: 'clock' };
};

export const HOSTELS = {
  hostel1: { name: 'Хостел №1', address: 'Ташкент, улица Ниёзбек Йули, 43', currency: 'UZS' },
  hostel2: { name: 'Хостел №2', address: 'Ташкент, 6-й пр. Ниёзбек Йули, 39', currency: 'UZS' }
};

// --- HELPERS ---
export const getTotalPaid = (g) => (typeof g.amountPaid === 'number' ? g.amountPaid : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0)));
export const pluralize = (number, one, two, five, lang = 'ru') => {
    if (lang === 'uz') return one;
    
    const n = Math.abs(number);
    const n10 = n % 10;
    const n100 = n % 100;
    
    if (n10 === 1 && n100 !== 11) {
        return `${number} ${one}`;
    }
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) {
        return `${number} ${two}`;
    }
    return `${number} ${five}`;
};

export const getLocalDateString = (dateObj) => {
    if (!dateObj) return '';
    const offset = dateObj.getTimezoneOffset() * 60000;
    const localISOTime = new Date(dateObj.getTime() - offset).toISOString().slice(0, 10);
    return localISOTime;
};

export const getLocalDatetimeString = (dateObj) => {
    if (!dateObj) return '';
    const offset = dateObj.getTimezoneOffset() * 60000;
    const localISOTime = new Date(dateObj.getTime() - offset).toISOString().slice(0, 16);
    return localISOTime;
};

// ? ОБНОВЛЕННАЯ ЛОГИКА: Ранний заезд (00:00) = до 12:00 следующего дня
export const getStayDetails = (checkInDateTime, days) => {
    const start = new Date(checkInDateTime);
    const checkInHour = start.getHours();
    
    // ? РАННИЙ ЗАЕЗД: если время 00:00 (полночь)
    if (checkInHour === 0) {
        // Оставляем start как есть (00:00)
        // Выезд через days дней в 12:00
        const end = new Date(start);
        end.setDate(end.getDate() + parseInt(days));
        end.setHours(12, 0, 0, 0);
        
        return { start, end };
    }
    
    // ? ОБЫЧНЫЙ ЗАЕЗД: стандартизируем на 12:00
    start.setHours(12, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + parseInt(days));
    
    return { start, end };
};

export const checkCollision = (existingCheckIn, existingDays, newCheckIn, newDays) => {
    const e1 = new Date(existingCheckIn); 
    e1.setHours(12, 0, 0, 0);
    const e2 = new Date(e1); 
    e2.setDate(e2.getDate() + parseInt(existingDays));
    const n1 = new Date(newCheckIn); 
    n1.setHours(12, 0, 0, 0);
    const n2 = new Date(n1); 
    n2.setDate(n2.getDate() + parseInt(newDays));
    return !(e2 <= n1 || n2 <= e1);
};

export const calculateSalary = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffHours / 24;
    return Math.round(diffDays * DAILY_SALARY);
};

// ? ИСПРАВЛЕНИЕ: Улучшенный экспорт в Excel с правильными итогами
export const exportToExcel = (data, filename, totalIncome = 0, totalExpense = 0) => {
    const balance = totalIncome - totalExpense;
    
    let tableContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
            <style>
                body { font-family: Arial, sans-serif; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #000000; padding: 8px; text-align: left; vertical-align: top; }
                th { background-color: #4f46e5; color: #ffffff; font-weight: bold; }
                .income { color: #166534; font-weight: bold; }
                .expense { color: #9f1239; font-weight: bold; }
                .amount { text-align: right; }
                .total-row { background-color: #f3f4f6; font-weight: bold; border-top: 3px solid #000000; }
                .total-label { text-align: right; font-size: 14px; }
                .total-value { text-align: right; font-size: 14px; }
            </style>
        </head>
        <body>
            <table>
                <thead>
                    <tr>
                        <th>Дата</th>
                        <th>Тип</th>
                        <th>Хостел</th>
                        <th>Кассир</th>
                        <th>Сумма</th>
                        <th>Метод</th>
                        <th>Описание</th>
                    </tr>
                </thead>
                <tbody>
    `;

    data.forEach(row => {
        const typeClass = row.type === 'income' ? 'income' : 'expense';
        const typeLabel = row.type === 'income' ? 'Приход' : 'Расход';
        tableContent += `
            <tr>
                <td>${row.date}</td>
                <td class="${typeClass}">${typeLabel}</td>
                <td>${row.hostel}</td>
                <td>${row.staff}</td>
                <td class="amount">${parseInt(row.amount).toLocaleString()}</td>
                <td>${row.method}</td>
                <td>${row.comment}</td>
            </tr>
        `;
    });

    tableContent += `
        <tr class="total-row">
            <td colspan="4" class="total-label">ИТОГО ПРИХОД:</td>
            <td class="total-value income">${totalIncome.toLocaleString()}</td>
            <td colspan="2"></td>
        </tr>
        <tr class="total-row">
            <td colspan="4" class="total-label">ИТОГО РАСХОД:</td>
            <td class="total-value expense">${totalExpense.toLocaleString()}</td>
            <td colspan="2"></td>
        </tr>
        <tr class="total-row" style="background-color: #e0e7ff;">
            <td colspan="4" class="total-label" style="font-size: 16px;">БАЛАНС:</td>
            <td class="total-value" style="font-size: 16px; color: ${balance >= 0 ? '#166534' : '#9f1239'};">${balance.toLocaleString()}</td>
            <td colspan="2"></td>
        </tr>
    `;

    tableContent += `</tbody></table></body></html>`;

    const blob = new Blob([tableContent], { type: 'application/vnd.ms-excel' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// ? ИСПРАВЛЕНИЕ: Улучшенная печать документов (чеки, анкеты, справки)
export const printDocument = (type, guest, hostel) => {
    const w = window.open('', '', 'width=800,height=600');
    const date = new Date().toLocaleDateString('ru-RU');
    const time = new Date().toLocaleTimeString('ru-RU');
    
    let html = `
    <html>
    <head>
        <meta charset="UTF-8">
        <title>${type === 'check' ? 'Чек' : type === 'regcard' ? 'Регистрационная карта' : 'Справка'}</title>
        <style>
            body { font-family: 'Courier New', monospace; padding: 20px; max-width: 600px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
            .header h2 { margin: 5px 0; font-size: 18px; }
            .info-row { display: flex; justify-between; margin: 5px 0; font-size: 14px; }
            .info-row .label { font-weight: bold; }
            .total { border-top: 2px dashed #000; margin-top: 15px; padding-top: 10px; font-size: 16px; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
            .signature { margin-top: 40px; border-top: 1px solid #000; width: 200px; display: inline-block; }
            @media print { body { padding: 10px; } }
        </style>
    </head>
    <body>
    `;
    
    if (type === 'check') {
        const total = guest.totalPrice || 0;
        const paid = getTotalPaid(guest);
        html += `
        <div class="header">
            <h2>${hostel.name}</h2>
            <p style="margin: 2px 0; font-size: 12px;">${hostel.address}</p>
            <p style="margin: 2px 0; font-size: 12px;">Дата: ${date} ${time}</p>
        </div>
        <div style="text-align: center; font-size: 16px; font-weight: bold; margin: 15px 0;">КАССОВЫЙ ЧЕК</div>
        <div class="info-row"><span class="label">Гость:</span><span>${guest.fullName}</span></div>
        <div class="info-row"><span class="label">Паспорт:</span><span>${guest.passport || '-'}</span></div>
        <div class="info-row"><span class="label">Комната:</span><span>№${guest.roomNumber}, Место ${guest.bedId}</span></div>
        <div class="info-row"><span class="label">Дата заезда:</span><span>${new Date(guest.checkInDate).toLocaleDateString('ru-RU')}</span></div>
        <div class="info-row"><span class="label">Дней:</span><span>${guest.days}</span></div>
        <div class="info-row"><span class="label">Цена за ночь:</span><span>${guest.pricePerNight.toLocaleString()} сум</span></div>
        <div class="total">
            <div class="info-row"><span>ИТОГО:</span><span>${total.toLocaleString()} сум</span></div>
            <div class="info-row"><span>Оплачено:</span><span>${paid.toLocaleString()} сум</span></div>
            <div class="info-row"><span>Долг:</span><span style="color: ${(total - paid) > 0 ? '#d63031' : '#00b894'};">${Math.max(0, total - paid).toLocaleString()} сум</span></div>
        </div>
        <div class="footer">Спасибо за выбор ${hostel.name}!<br/>Приходите к нам еще!</div>
        `;
    } else if (type === 'regcard') {
        html += `
        <div class="header">
            <h2>РЕГИСТРАЦИОННАЯ КАРТА ГОСТЯ</h2>
            <p style="margin: 2px 0;">${hostel.name}</p>
        </div>
        <div class="info-row"><span class="label">ФИО:</span><span>${guest.fullName}</span></div>
        <div class="info-row"><span class="label">Дата рождения:</span><span>${guest.birthDate || '-'}</span></div>
        <div class="info-row"><span class="label">Паспорт:</span><span>${guest.passport || '-'}</span></div>
        <div class="info-row"><span class="label">Гражданство:</span><span>${guest.country || '-'}</span></div>
        <div class="info-row"><span class="label">Дата заезда:</span><span>${new Date(guest.checkInDate).toLocaleDateString('ru-RU')}</span></div>
        <div class="info-row"><span class="label">Дата выезда:</span><span>${guest.checkOutDate ? new Date(guest.checkOutDate).toLocaleDateString('ru-RU') : '-'}</span></div>
        <div class="info-row"><span class="label">Комната:</span><span>№${guest.roomNumber}</span></div>
        <div class="info-row"><span class="label">Место:</span><span>№${guest.bedId}</span></div>
        <div style="margin-top: 40px;">
            <p>Подпись гостя: <span class="signature"></span></p>
            <p>Дата: ${date}</p>
        </div>
        <div class="footer">Документ сформирован автоматически</div>
        `;
    } else if (type === 'ref') {
        html += `
        <div class="header">
            <h2>СПРАВКА О ПРОЖИВАНИИ</h2>
            <p style="margin: 2px 0;">${hostel.name}</p>
            <p style="margin: 2px 0; font-size: 11px;">${hostel.address}</p>
        </div>
        <p style="text-align: justify; line-height: 1.6; margin: 20px 0;">
            Настоящая справка выдана <strong>${guest.fullName}</strong>, паспорт ${guest.passport || '-'}, 
            в том, что он(а) действительно проживал(а) в ${hostel.name} 
            с <strong>${new Date(guest.checkInDate).toLocaleDateString('ru-RU')}</strong> 
            по <strong>${guest.checkOutDate ? new Date(guest.checkOutDate).toLocaleDateString('ru-RU') : 'настоящее время'}</strong>.
        </p>
        <p style="margin: 20px 0;">Комната: №${guest.roomNumber}, Место: №${guest.bedId}</p>
        <p style="margin: 20px 0;">Справка выдана для предъявления по месту требования.</p>
        <div style="margin-top: 60px;">
            <p>Дата выдачи: ${date}</p>
            <p>Подпись администратора: _________________</p>
            <p style="text-align: center; margin-top: 20px;">М.П.</p>
        </div>
        `;
    }
    
    html += `</body></html>`;
    w.document.write(html);
    w.document.close();
    w.print();
};

export const printDebts = (debts, totalDebt) => {
    const w = window.open('', '', 'width=800,height=600');
    const dateStr = new Date().toLocaleDateString();
    
    let html = `
    <html>
    <head>
        <title>Список Должников</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .header { text-align: center; margin-bottom: 30px; }
            .total { text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px; }
            .debt { color: #d63031; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Отчет по долгам</h1>
            <p>Дата: ${dateStr}</p>
        </div>
        <table>
            <thead>
                <tr>
                    <th>ФИО Гостя</th>
                    <th>Паспорт</th>
                    <th>Телефон/Инфо</th>
                    <th>Сумма долга</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    debts.forEach(d => {
        html += `
            <tr>
                <td>${d.fullName}</td>
                <td>${d.passport || '-'}</td>
                <td>${d.roomNumber ? `Комната ${d.roomNumber}` : '-'}</td>
                <td class="debt">${d.totalDebt.toLocaleString()}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
        <div class="total">Итого долгов: ${totalDebt.toLocaleString()}</div>
    </body>
    </html>
    `;
    
    w.document.write(html);
    w.document.close();
    w.print();
};

export const printReport = (data, totalIncome, totalExpense, filters, users) => {
    const w = window.open('', '', 'width=800,height=600');
    const startStr = new Date(filters.start).toLocaleString();
    const endStr = new Date(filters.end).toLocaleString();
    
    let html = `
    <html>
    <head>
        <title>Финансовый отчет</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ccc; padding: 5px; text-align: left; }
            th { background-color: #f2f2f2; }
            .header { text-align: center; margin-bottom: 20px; }
            .summary { display: flex; justify-content: space-between; margin: 20px 0; border: 1px solid #000; padding: 10px; }
            .income { color: green; }
            .expense { color: red; }
            .balance { font-weight: bold; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h2>Финансовый отчет</h2>
            <p>${startStr} — ${endStr}</p>
        </div>
        
        <div class="summary">
            <div>Приход: <span class="income">+${totalIncome.toLocaleString()}</span></div>
            <div>Расход: <span class="expense">-${totalExpense.toLocaleString()}</span></div>
            <div class="balance">Итого: ${(totalIncome - totalExpense).toLocaleString()}</div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Дата</th>
                    <th>Тип</th>
                    <th>Сумма</th>
                    <th>Метод</th>
                    <th>Кассир</th>
                    <th>Описание</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    data.forEach(row => {
        const staffName = users.find(u => u.id === row.staffId || u.login === row.staffId)?.name || row.staffId;
        const typeLabel = row.type === 'income' ? 'Приход' : 'Расход';
        const typeClass = row.type === 'income' ? 'income' : 'expense';
        
        html += `
            <tr>
                <td>${new Date(row.date).toLocaleString()}</td>
                <td class="${typeClass}">${typeLabel}</td>
                <td>${parseInt(row.amount).toLocaleString()}</td>
                <td>${row.method || '-'}</td>
                <td>${staffName}</td>
                <td>${row.comment || '-'}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    </body>
    </html>
    `;
    
    w.document.write(html);
    w.document.close();
    w.print();
};

export const getNormalizedCountry = (input) => {
    if (!input) return "Узбекистан";
    const clean = input.trim().replace(/['"]/g, '');
    const lower = clean.toLowerCase();
    if (COUNTRY_MAP[lower]) return COUNTRY_MAP[lower];
    const valid = COUNTRIES.find(c => c.toLowerCase() === lower);
    if (valid) return valid;
    return clean;
};
