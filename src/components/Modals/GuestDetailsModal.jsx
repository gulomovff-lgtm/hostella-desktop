import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
    ChevronLeft, X, DollarSign, CreditCard, QrCode, Magnet, User, Wallet, Clock, Split,
    LogOut, Minus, Plus, Calendar, CalendarDays, ArrowLeftRight, Edit, Trash2, FileText,
    Printer, Lock, ShieldCheck, RotateCcw, UserX, Search, ChevronDown, Camera, Scissors, History, Copy, ArrowRightLeft, AlertTriangle, Settings
} from 'lucide-react';
import EmehmonAccountsModal from './EmehmonAccountsModal';
import { openEmehmonArrival, openEmehmonDeparture } from '../../utils/emehmon';
import { minNightPrice, packageMinDays } from '../../utils/pricing';
import TRANSLATIONS from '../../constants/translations';
import { COUNTRY_FLAGS } from '../../constants/countries';
import { Flag, getTotalPaid, fmtSum, parseSum, getKppDayNumber, getKppDeadline, getRegistrationWindow } from '../../utils/helpers';
import ConfirmDialog from '../UI/ConfirmDialog';

const getStayDetails = (checkInDateTime, days) => {
    const start = new Date(checkInDateTime);
    const checkInHour = start.getHours();
    if (checkInHour === 0) {
        const end = new Date(start);
        end.setDate(end.getDate() + parseInt(days));
        end.setHours(12, 0, 0, 0);
        return { start, end };
    }
    start.setHours(12, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + parseInt(days));
    return { start, end };
};

const printDocument = (type, guest, hostel) => {
    const w = window.open('', '', 'width=800,height=600');
    const date = new Date().toLocaleDateString('ru-RU');
    const time = new Date().toLocaleTimeString('ru-RU');
    const totalPaid = getTotalPaid(guest);
    const esc = (v) => String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
    let html = `<html><head><meta charset="UTF-8">
    <title>${type === 'check' ? 'Чек' : type === 'regcard' ? 'Регистрационная карта' : 'Справка'}</title>
    <style>
        body { font-family: 'Courier New', monospace; padding: 20px; max-width: 600px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
        .header h2 { margin: 5px 0; font-size: 18px; }
        .info-row { display: flex; justify-content: space-between; margin: 5px 0; font-size: 14px; }
        .info-row .label { font-weight: bold; }
        .total { border-top: 2px dashed #000; margin-top: 15px; padding-top: 10px; font-size: 16px; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
        .signature { margin-top: 40px; border-top: 1px solid #000; width: 200px; display: inline-block; }
        @media print { body { padding: 10px; } }
    </style></head><body>`;
    if (type === 'check') {
        const total = guest.totalPrice || 0;
        const paid = totalPaid;
        html += `<div class="header"><h2>${hostel.name}</h2>
            <p style="margin: 2px 0; font-size: 12px;">${hostel.address}</p>
            <p style="margin: 2px 0; font-size: 12px;">Дата: ${date} ${time}</p></div>
            <div style="text-align: center; font-size: 16px; font-weight: bold; margin: 15px 0;">КАССОВЫЙ ЧЕК</div>
            <div class="info-row"><span class="label">Гость:</span><span>${esc(guest.fullName)}</span></div>
            <div class="info-row"><span class="label">Паспорт:</span><span>${esc(guest.passport || '-')}</span></div>
            <div class="info-row"><span class="label">Комната:</span><span>№${esc(guest.roomNumber)}, Место ${esc(guest.bedId)}</span></div>
            <div class="info-row"><span class="label">Дата заезда:</span><span>${new Date(guest.checkInDate).toLocaleDateString('ru-RU')}</span></div>
            <div class="info-row"><span class="label">Дней:</span><span>${guest.days}</span></div>
            <div class="info-row"><span class="label">Цена за ночь:</span><span>${guest.pricePerNight.toLocaleString()} сум</span></div>
            <div class="total">
                <div class="info-row"><span>ИТОГО:</span><span>${total.toLocaleString()} сум</span></div>
                <div class="info-row"><span>Оплачено:</span><span>${paid.toLocaleString()} сум</span></div>
                <div class="info-row"><span>Долг:</span><span style="color: ${(total - paid) > 0 ? '#d63031' : '#00b894'};">${Math.max(0, total - paid).toLocaleString()} сум</span></div>
            </div>
            <div class="footer">Спасибо за выбор ${hostel.name}!<br/>Приходите к нам еще!</div>`;
    } else if (type === 'regcard') {
        html += `<div class="header"><h2>РЕГИСТРАЦИОННАЯ КАРТА ГОСТЯ</h2><p style="margin: 2px 0;">${esc(hostel.name)}</p></div>
            <div class="info-row"><span class="label">ФИО:</span><span>${esc(guest.fullName)}</span></div>
            <div class="info-row"><span class="label">Дата рождения:</span><span>${esc(guest.birthDate || '-')}</span></div>
            <div class="info-row"><span class="label">Паспорт:</span><span>${esc(guest.passport || '-')}</span></div>
            <div class="info-row"><span class="label">Гражданство:</span><span>${esc(guest.country || '-')}</span></div>
            <div class="info-row"><span class="label">Дата заезда:</span><span>${new Date(guest.checkInDate).toLocaleDateString('ru-RU')}</span></div>
            <div class="info-row"><span class="label">Дата выезда:</span><span>${guest.checkOutDate ? new Date(guest.checkOutDate).toLocaleDateString('ru-RU') : '-'}</span></div>
            <div class="info-row"><span class="label">Комната:</span><span>№${esc(guest.roomNumber)}</span></div>
            <div class="info-row"><span class="label">Место:</span><span>№${esc(guest.bedId)}</span></div>
            <div style="margin-top: 40px;"><p>Подпись гостя: <span class="signature"></span></p><p>Дата: ${date}</p></div>
            <div class="footer">Документ сформирован автоматически</div>`;
    } else if (type === 'ref') {
        html += `<div class="header"><h2>СПРАВКА О ПРОЖИВАНИИ</h2><p style="margin: 2px 0;">${hostel.name}</p>
            <p style="margin: 2px 0; font-size: 11px;">${hostel.address}</p></div>
            <p style="text-align: justify; line-height: 1.6; margin: 20px 0;">
                Настоящая справка выдана <strong>${esc(guest.fullName)}</strong>, паспорт ${esc(guest.passport || '-')}, 
                в том, что он(а) действительно проживал(а) в ${esc(hostel.name)} 
                с <strong>${new Date(guest.checkInDate).toLocaleDateString('ru-RU')}</strong> 
                по <strong>${guest.checkOutDate ? new Date(guest.checkOutDate).toLocaleDateString('ru-RU') : 'настоящее время'}</strong>.
            </p>
            <p style="margin: 20px 0;">Комната: №${esc(guest.roomNumber)}, Место: №${esc(guest.bedId)}</p>
            <p style="margin: 20px 0;">Справка выдана для предъявления по месту требования.</p>
            <div style="margin-top: 60px;"><p>Дата выдачи: ${date}</p>
            <p>Подпись администратора: _________________</p>
            <p style="text-align: center; margin-top: 20px;">М.П.</p></div>`;
    }
    html += `</body></html>`;
    w.document.write(html);
    w.document.close();
    w.print();
};

// ─── Договор клиента (3 языка) ───────────────────────────────────────────────
const CONTRACT_I18N = {
    ru: {
        title: 'ДОГОВОР-СОГЛАСОВАНИЕ', sub: 'с ЯТТ Сабирова Ш. Б.', no: '№', addr: 'г. Ташкент, ул. Ниёзбек Йули, дом 43',
        s1h: '1. Предмет договора',
        s1: 'Исполнитель обязуется предоставить услуги по длительному или краткосрочному пребыванию (проживанию) в помещении, расположенном по адресу: {ADDR} (Хостел) (далее — «Услуги»), а Клиент обязуется соблюдать условия настоящего договора и оплатить стоимость проживания.',
        s2h: '2. Предоставление места проживания',
        s2: 'Исполнитель предоставляет Клиенту комнату или койко-место (далее — «место проживания») на условиях, указанных в прайс-листе Исполнителя.',
        s3h: '3. Обязанности клиента',
        s3lead: 'Клиент не приобретает прав на самостоятельное использование помещения и обязуется:',
        obl: ['соблюдать Правила проживания, установленные Исполнителем;', 'не курить в жилых помещениях;', 'не употреблять наркотические вещества;', 'не употреблять алкогольные напитки;', 'не шуметь, не нарушать покой других жильцов;', 'не совершать кражу и не присваивать чужие вещи.'],
        s4h: '4. Подписание договора',
        s4: 'Заполнение и подписание настоящего договора означает полное согласие Клиента с условиями договора и внутренними правилами проживания (пребывания) в жилом помещении Исполнителя.',
        s5h: '5. Информация о клиенте',
        f: { cit: 'Гражданство', name: 'Ф.И.О.', pass: 'Паспортные данные', birth: 'Год рождения', phone: 'Контактный номер', cin: 'Дата приёма и регистрации', cout: 'Дата выбытия', days: 'дн.', room: 'Комната №', bed: 'Койка №' },
        warn: 'Внимание: Администрация Хостела не несёт ответственности за утерянные вещи, денежные средства и драгоценности.',
        s6h: '6. Согласование клиента', sigN: 'Ф.И.О.', sigS: 'Подпись', sigD: 'Дата',
    },
    uz: {
        title: 'KELISHUV-SHARTNOMA', sub: 'YaTT Sabirova Sh. B. bilan', no: '№', addr: 'Toshkent shahri, Niyozbek Yo‘li ko‘chasi, 43-uy',
        s1h: '1. Shartnoma predmeti',
        s1: 'Ijrochi mijozga quyidagi xizmatlarni taqdim etadi: {ADDR} (Xostel) manzilida joylashgan xonalarda qisqa muddatli yoki uzoq muddatli yashash (turar joy) xizmatlari (keyingi o‘rinlarda — «Xizmatlar»).',
        s2h: '2. Turar joy taqdim etish',
        s2: 'Ijrochi mijozga xonani yoki yotoq-o‘rinni (keyingi o‘rinlarda — «turar joy») o‘zining prays-listiga muvofiq to‘lov evaziga taqdim etadi.',
        s3h: '3. Mijozning majburiyatlari',
        s3lead: 'Mijoz turar joydan mustaqil foydalanish huquqiga ega emas va quyidagilarga rioya etishni o‘z zimmasiga oladi:',
        obl: ['Ijrochi belgilagan Turar joy qoidalariga rioya qilish;', 'xonalarda tamaki chekmaslik;', 'narkotik moddalarni iste’mol qilmaslik;', 'spirtli ichimliklarni iste’mol qilmaslik;', 'shovqin qilmaslik, boshqa mijozlarning tinchligini buzmaslik;', 'boshqalarning buyumlariga tajovuz qilmaslik.'],
        s4h: '4. Shartnomani imzolash',
        s4: 'Mazkur shartnomani to‘ldirish va imzolash mijozning shartnoma shartlariga hamda Ijrochi ichki qoidalariga to‘liq roziligini anglatadi.',
        s5h: '5. Mijoz haqida ma’lumotlar',
        f: { cit: 'Fuqaroligi', name: 'F.I.O.', pass: 'Pasport ma’lumotlari', birth: 'Tug‘ilgan sanasi', phone: 'Telefon raqami', cin: 'Qabul qilingan sana', cout: 'Chiqish sanasi', days: 'kun', room: 'Xona №', bed: 'Yotoq-o‘rin №' },
        warn: 'Diqqat: Xostel ma’muriyati yo‘qolgan buyumlar, pul mablag‘lari va qimmatbaho ashyolar uchun javobgar emas.',
        s6h: '6. Mijozning kelishuvi', sigN: 'F.I.O.', sigS: 'Imzo', sigD: 'Sana',
    },
    en: {
        title: 'AGREEMENT-CONTRACT', sub: 'with Sole Proprietor Sabirova Sh. B.', no: 'No.', addr: 'Tashkent, Niyozbek Yuli Street, House 43',
        s1h: '1. Subject of the Agreement',
        s1: 'The Executor undertakes to provide services for short-term or long-term accommodation at the premises located at: {ADDR} (Hostel) (hereinafter — “Services”), and the Client undertakes to comply with the terms of this Agreement and pay for the accommodation.',
        s2h: '2. Provision of Accommodation',
        s2: 'The Executor provides the Client with a room or a bed (hereinafter — “accommodation”) subject to payment in accordance with the Executor’s price list.',
        s3h: '3. Obligations of the Client',
        s3lead: 'The Client does not acquire the right to independent use of the premises and undertakes to:',
        obl: ['comply with the Rules of Residence established by the Executor;', 'not smoke in the rooms;', 'not use narcotic substances;', 'not consume alcoholic beverages;', 'not make noise or disturb other residents;', 'not steal or appropriate other people’s belongings.'],
        s4h: '4. Signing of the Agreement',
        s4: 'Completion and signing of this Agreement shall constitute the Client’s full consent with the terms and conditions of the Agreement as well as with the internal rules governing residence in the Executor’s premises.',
        s5h: '5. Client Information',
        f: { cit: 'Citizenship', name: 'Full Name', pass: 'Passport Details', birth: 'Date of Birth', phone: 'Contact Number', cin: 'Check-in Date', cout: 'Check-out Date', days: 'days', room: 'Room No.', bed: 'Bed No.' },
        warn: 'Attention: The Hostel Administration shall not be held liable for lost items, money, or valuables.',
        s6h: '6. Client’s Consent', sigN: 'Full Name', sigS: 'Signature', sigD: 'Date',
    },
};

// Реквизиты по хостелам (ИП + адрес на 3 языках)
const HOSTEL_LEGAL = {
    hostel1: {
        entity: 'YTT «SABIROVA SHOIRA BAXTIYOROVNA»',
        person: { ru: 'Сабирова Ш. Б.', uz: 'Sabirova Sh. B.', en: 'Sabirova Sh. B.' },
        addr: { ru: 'г. Ташкент, ул. Ниёзбек Йули, дом 43', uz: 'Toshkent shahri, Niyozbek Yo‘li ko‘chasi, 43-uy', en: 'Tashkent, Niyozbek Yuli Street, House 43' },
    },
    hostel2: {
        entity: 'YATT «YULDASHEV AZIZ IRGASHEVICH»',
        person: { ru: 'Юлдашев А. И.', uz: 'Yuldashev A. I.', en: 'Yuldashev A. I.' },
        addr: { ru: 'г. Ташкент, 6-проезд Ниёзбек Йули, дом 41', uz: 'Toshkent shahri, Niyozbek Yo‘li 6-tor ko‘chasi, 41-uy', en: 'Tashkent, Niyozbek Yuli 6th drive, House 41' },
    },
};
const CONTRACT_SUB = {
    ru: (p) => `с ЯТТ ${p}`,
    uz: (p) => `YaTT ${p} bilan`,
    en: (p) => `with Sole Proprietor ${p}`,
};

const printContract = (guest, hostel, lang = 'ru') => {
    const t = CONTRACT_I18N[lang] || CONTRACT_I18N.ru;
    const legal = HOSTEL_LEGAL[guest.hostelId] || HOSTEL_LEGAL.hostel1;
    const addr = legal.addr[lang] || legal.addr.ru;
    const sub = (CONTRACT_SUB[lang] || CONTRACT_SUB.ru)(legal.person[lang] || legal.person.ru);
    const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const fd = (d) => d ? new Date(d).toLocaleDateString('ru-RU') : '';
    const logo1 = `${import.meta.env.BASE_URL}Logo.png`;
    const logo2 = `${import.meta.env.BASE_URL}uzbek-tourism.svg`;
    const days = guest.days ? `(${guest.days} ${t.f.days})` : '';
    const w = window.open('', '', 'width=900,height=1200');
    const html = `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><title>${t.title}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0;}
      html,body{background:#e7ecf1;font-family:'PT Sans','Segoe UI',Arial,sans-serif;color:#1b2733;font-size:11.5px;line-height:1.45;-webkit-font-smoothing:antialiased;}
      .page{width:210mm;min-height:297mm;margin:20px auto;background:#fff;padding:16mm 17mm 14mm;box-shadow:0 10px 40px rgba(18,62,116,.16);}
      .head{display:flex;align-items:center;justify-content:space-between;gap:20px;}
      .head img{object-fit:contain;display:block;}
      .head .logoA{height:64px;}
      .head .logoB{height:50px;}
      .ent{text-align:center;font-weight:700;font-size:12px;letter-spacing:.4px;color:#2a3a49;margin-top:8px;}
      .rule{border-top:2.5px solid #123e74;margin:8px 0 0;}
      .rule i{display:block;border-top:1px solid #cdd8e6;margin-top:2.5px;}
      .docno{text-align:right;font-size:11px;color:#46566a;margin-top:6px;}
      .title{text-align:center;font-size:19px;font-weight:800;letter-spacing:.6px;color:#123e74;margin-top:2px;}
      .sub{text-align:center;font-size:11.5px;color:#5e7186;margin-bottom:6px;}
      h3{font-size:12.5px;color:#123e74;margin:11px 0 4px;padding-left:9px;border-left:3px solid #ef8a1c;line-height:1.2;}
      p{margin:3px 0;text-align:justify;}
      ul{margin:3px 0 4px;padding-left:22px;}
      li{margin:2px 0;}
      .info{margin-top:6px;border:1px solid #d8e0ea;border-radius:9px;overflow:hidden;}
      table.f{width:100%;border-collapse:collapse;table-layout:fixed;}
      table.f td{padding:7px 13px;font-size:12px;border-bottom:1px solid #edf1f6;vertical-align:middle;}
      table.f tr:last-child td{border-bottom:none;}
      table.f tr:nth-child(odd){background:#fafbfd;}
      .lbl{color:#62748a;font-size:10.5px;font-weight:600;width:23%;white-space:nowrap;}
      .val{font-weight:700;font-size:13px;color:#0d1b2a;border-bottom:1px solid #c2ccd8;min-height:18px;display:block;padding:0 2px 2px;}
      .warn{margin:11px 0;padding:9px 13px;border:1px solid #f0cf86;background:#fff8e7;font-size:10.5px;border-radius:7px;color:#7a5a06;}
      .sign{display:flex;justify-content:space-between;gap:18px;margin-top:22px;font-size:12px;}
      .sign .ln{border-bottom:1px solid #2a3a49;display:inline-block;min-width:150px;}
      .foot{margin-top:16px;padding-top:8px;border-top:1px solid #e7ecf1;text-align:center;font-size:9px;color:#9aa7b6;}
      @media print{
        html,body{background:#fff;}
        .page{width:auto;min-height:auto;margin:0;padding:0;box-shadow:none;}
        .warn,table.f tr:nth-child(odd){-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      }
      @page{size:A4;margin:13mm 15mm;}
    </style></head><body>
      <div class="page">
        <div class="head"><img class="logoA" src="${logo1}" alt=""/><img class="logoB" src="${logo2}" alt=""/></div>
        <div class="ent">${legal.entity}</div>
        <div class="rule"><i></i></div>
        <div class="docno">${t.no} ____________</div>
        <div class="title">${t.title}</div>
        <div class="sub">${sub}</div>
        <h3>${t.s1h}</h3><p>${t.s1.replace('{ADDR}', addr)}</p>
        <h3>${t.s2h}</h3><p>${t.s2}</p>
        <h3>${t.s3h}</h3><p>${t.s3lead}</p><ul>${t.obl.map(o => `<li>${o}</li>`).join('')}</ul>
        <h3>${t.s4h}</h3><p>${t.s4}</p>
        <h3>${t.s5h}</h3>
        <div class="info"><table class="f">
          <tr><td class="lbl">${t.f.cit}</td><td><span class="val">${esc(guest.country || '')}</span></td>
              <td class="lbl">${t.f.phone}</td><td><span class="val">${esc(guest.phone || '')}</span></td></tr>
          <tr><td class="lbl">${t.f.name}</td><td colspan="3"><span class="val">${esc(guest.fullName || '')}</span></td></tr>
          <tr><td class="lbl">${t.f.pass}</td><td><span class="val">${esc(guest.passport || '')}</span></td>
              <td class="lbl">${t.f.birth}</td><td><span class="val">${esc(guest.birthDate ? fd(guest.birthDate) : '')}</span></td></tr>
          <tr><td class="lbl">${t.f.cin}</td><td><span class="val">${esc(fd(guest.checkInDate))}</span></td>
              <td class="lbl">${t.f.cout}</td><td><span class="val">${esc(fd(guest.checkOutDate))} ${days}</span></td></tr>
          <tr><td class="lbl">${t.f.room}</td><td><span class="val">${esc(guest.roomNumber || '')}</span></td>
              <td class="lbl">${t.f.bed}</td><td><span class="val">${esc(guest.bedId || '')}</span></td></tr>
        </table></div>
        <div class="warn">⚠️ ${t.warn}</div>
        <h3>${t.s6h}</h3>
        <div class="sign"><span>${t.sigN}: <span class="ln"></span></span><span>${t.sigS}: <span class="ln"></span></span><span>${t.sigD}: <span class="ln" style="min-width:90px"></span></span></div>
        <div class="foot">${legal.entity} · ${addr}</div>
      </div>
    </body></html>`;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 350);
};

// ─── Country list for replace form ─────────────────────────────────────────
const COUNTRIES_LIST = [
    'Узбекистан','Россия','Казахстан','Таджикистан','Кыргызстан',
    'Украина','Беларусь','Азербайджан','Грузия','Армения',
    'Германия','США','Великобритания','Франция','Италия','Испания',
    'Китай','Индия','Турция','ОАЭ','Саудовская Аравия','Иран',
    'Пакистан','Бангладеш','Афганистан','Монголия',
];

// --- GuestDetailsModal ---
const compressPhotoGDM = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
            const MAX = 640;
            const scale = Math.min(1, MAX / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width  = Math.round(img.width  * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
});

const GuestDetailsModal = ({ guest, room, currentUser, clients = [], guests = [], cadastreRegs = [], onClose, onUpdate, onPayment, onSuperPayment, onCheckOut, onEmehmonDepart, emehmonDepartingIds, onSplit, onOpenMove, onDelete, notify, onReduceDays, onActivateBooking, onReduceDaysNoRefund, hostelInfo, lang, initialView = 'dashboard', onExtend, onTrimDays, isOnline = true, onOpenHistory, onTopUpBalance, onKppConfirm, onKppReset, onPriceRequest, onUpgradeTariff, priceWhitelist = [] }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    if (!guest) { onClose(); return null; }

    const totalPaid = getTotalPaid(guest);
    const debt = (guest.totalPrice || 0) - totalPaid;
    
    const [currentView, setCurrentView] = useState(initialView); 
    const [payCash, setPayCash] = useState('');
    const [payCard, setPayCard] = useState('');
    const [payQR, setPayQR] = useState('');
    const [payTransfer, setPayTransfer] = useState('');
    const [payBalance, setPayBalance] = useState(0);
    const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);
    const [extendDays, setExtendDays] = useState(1);
    const [showPriceReq, setShowPriceReq] = useState(false);
    const [reqPrice, setReqPrice] = useState('');
    const [checkoutManualRefund, setCheckoutManualRefund] = useState('');
    const [checkoutBalanceChoice, setCheckoutBalanceChoice] = useState('balance'); // 'refund' | 'balance' | 'mix'
    const [checkoutMixBalance, setCheckoutMixBalance] = useState('');
    const [checkoutMixRefund,  setCheckoutMixRefund]  = useState('');
    const photoInputRef = useRef(null);
    const handlePhotoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const b64 = await compressPhotoGDM(file);
        onUpdate(guest.id, { passportPhoto: b64 });
        notify('Фото паспорта сохранено', 'success');
    };

    const toDateInput = (val) => {
        if (!val) return '';
        if (typeof val === 'string' && val.length >= 10) return val.slice(0, 10);
        return '';
    };
    const [editForm, setEditForm] = useState({ 
        fullName: guest.fullName || '', 
        birthDate: toDateInput(guest.birthDate), 
        passport: guest.passport || '', 
        passportIssueDate: toDateInput(guest.passportIssueDate),
        phone: guest.phone || '',
        country: guest.country || 'Узбекистан',
        kppDate: toDateInput(guest.kppDate),
        pricePerNight: guest.pricePerNight || 0
    });
    const [splitStartDate, setSplitStartDate] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0];
    });
    const [kppResetModal, setKppResetModal] = useState(false);
    const [kppResetDate, setKppResetDate] = useState('');
    const [emehmonCfgOpen, setEmehmonCfgOpen] = useState(false);
    const [splitReturnDate, setSplitReturnDate] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() + 2); return d.toISOString().split('T')[0];
    });
    const [reduceDaysNoRefund, setReduceDaysNoRefund] = useState(1);
    const [trimDays, setTrimDays] = useState(1);
    const [superPayAmount, setSuperPayAmount] = useState('');
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [newStartDate, setNewStartDate] = useState(() => {
        try { return guest.checkInDate ? new Date(guest.checkInDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]; }
        catch(e) { return new Date().toISOString().split('T')[0]; }
    });

    // --- Replace guest state ---
    const [replaceTab,     setReplaceTab]     = useState('db');
    const [replaceSearch,  setReplaceSearch]  = useState('');
    const [selectedClient, setSelectedClient] = useState(null);
    const [replaceNew,     setReplaceNew]     = useState({
        fullName: '', passport: '', birthDate: '', country: 'Узбекистан', phone: '', passportIssueDate: ''
    });

    const isBooking    = guest.status === 'booking';
    const isCheckedOut = guest.status === 'checked_out';
    const isAdmin      = currentUser.role === 'admin' || currentUser.role === 'super';
    const canMoveDate  = isAdmin || currentUser.login === 'fazliddin';
    const canEditPrice = isAdmin || currentUser.login === 'fazliddin'; // редактировать цену в карточке — только Fazliddin/админ
    const canPay = !isAdmin
        && !(guest.hostelId === 'hostel1' && currentUser.permissions?.canPayInHostel1 === false)
        && !(guest.hostelId === 'hostel2' && currentUser.permissions?.canPayInHostel2 === false);

    const today    = new Date();
    const checkIn  = new Date(guest.checkInDate);
    const daysStayed = Math.min(Math.max(1, Math.ceil((today - checkIn)/(1000*60*60*24))), parseInt(guest.days));
    const actualCost = daysStayed * parseInt(guest.pricePerNight);
    const balance    = totalPaid - actualCost;
    // Тарифные правила: цена ниже минимума комнаты = пакет/скидка → продление
    // только пакетом. Минимум и мин.дни — по комнате/филиалу/дате заезда (utils/pricing).
    const _priceDate = guest.checkInDate ? new Date(guest.checkInDate) : new Date();
    const MIN_NIGHT_PRICE = minNightPrice(guest.hostelId, guest.roomNumber, _priceDate);
    const PACKAGE_MIN_DAYS = packageMinDays(_priceDate);
    const guestRate = parseInt(guest.pricePerNight) || 0;
    const isBelowMinRate = guestRate > 0 && guestRate < MIN_NIGHT_PRICE;
    // Понижение цены одобрено: флаг на госте ИЛИ паспорт в списке разрешённых
    const normPass = (p) => (p || '').replace(/\s/g, '').toUpperCase();
    const wlEntry = priceWhitelist.find(w => normPass(w.passport || w.id) === normPass(guest.passport));
    const isPriceApproved = !!guest.priceReductionAllowed || !!wlEntry;
    const approvedPrice = parseInt(guest.approvedPrice) || parseInt(wlEntry?.price) || 0;
    const extRate = (isPriceApproved && approvedPrice > 0) ? approvedPrice : guestRate;
    // Пакет-онли действует, только если понижение НЕ одобрено
    const packageOnly = isBelowMinRate && !isPriceApproved;
    // Невозвратный пакетный тариф: при выселении переплата не возвращается (пакет сгорает)
    const isNonRefundable = !!guest.nonRefundable || guest.tariff === 'package';
    const alreadySettledRefund = Math.max(0, Number(guest.refundSettledAmount || 0));
    const refundableNow = isNonRefundable ? 0 : (balance > 0 ? Math.max(0, balance - alreadySettledRefund) : 0);

    // Для тарифа ниже 70 000 (без одобрения) продление только пакетом — минимум 10 дней
    useEffect(() => {
        if (currentView === 'extend' && packageOnly) {
            setExtendDays(d => Math.max(parseInt(d) || 1, PACKAGE_MIN_DAYS));
        }
    }, [currentView, packageOnly]);

    // Bonus days: first check guest.bonusDaysAdded (already applied), then client remaining balance
    const normStr = s => (s || '').replace(/\s/g, '').toUpperCase();
    const clientRecord = clients.find(c =>
        (c.passport && guest.passport && normStr(c.passport) === normStr(guest.passport)) ||
        (guest.fullName && normStr(c.fullName) === normStr(guest.fullName))
    );
    const clientBalance = clientRecord?.balance || 0;
    const bonusDays = (guest.bonusDaysAdded || 0) > 0
        ? (guest.bonusDaysAdded || 0)
        : (clientRecord?.bonusDays || 0);

    // For trimDays view — effective end date includes bonus
    const bonusDaysAvailForTrim = guest.bonusCheckOutDate
        ? Math.max(0, Math.round((new Date(guest.bonusCheckOutDate).getTime() - new Date(guest.checkOutDate).getTime()) / 86400000))
        : 0;
    const effectiveEndDateForTrim = guest.bonusCheckOutDate ? new Date(guest.bonusCheckOutDate) : new Date(guest.checkOutDate);
    const maxTrimDays = Math.max(1, parseInt(guest.days||1) - 1 + bonusDaysAvailForTrim);
    const regularDaysToTrimPreview = Math.max(0, trimDays - bonusDaysAvailForTrim);

    const disableWheel = e => e.target.blur();
    const goBack = () => { setCurrentView('dashboard'); setPayCash(''); setPayCard(''); setPayQR(''); setPayBalance(0); };

    // Вычисляем конфликт: следующий гость на том же месте после окончания текущей брони
    const extendConflict = useMemo(() => {
        if (!guests?.length) return null;
        const baseCo = (guest.bonusCheckOutDate && new Date(guest.bonusCheckOutDate) > new Date(guest.checkOutDate))
            ? guest.bonusCheckOutDate : guest.checkOutDate;
        const baseDate = new Date(baseCo);
        baseDate.setHours(12, 0, 0, 0);
        const nextConflict = guests
            .filter(g =>
                g.id !== guest.id &&
                g.roomId === guest.roomId &&
                String(g.bedId) === String(guest.bedId) &&
                (g.status === 'booking' || g.status === 'active') &&
                new Date(g.checkInDate) >= baseDate
            )
            .sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate))[0];
        if (!nextConflict) return null;
        const maxDays = Math.max(0, Math.floor((new Date(nextConflict.checkInDate) - baseDate) / (1000 * 60 * 60 * 24)));
        return { maxDays, nextGuest: nextConflict, isOver: (parseInt(extendDays) || 1) > maxDays };
    }, [guests, guest, extendDays]);

    const applyMagnet = field => {
        const extCost = currentView === 'extend' ? extendDays * extRate : 0;
        const total  = debt + extCost;
        const others = (field !== 'payCash'     ? (parseInt(payCash)||0)     : 0)
                     + (field !== 'payCard'     ? (parseInt(payCard)||0)     : 0)
                     + (field !== 'payQR'       ? (parseInt(payQR)||0)       : 0)
                     + (field !== 'payTransfer' ? (parseInt(payTransfer)||0) : 0)
                     + payBalance;
        const rem = Math.max(0, total - others);
        if (field === 'payCash')     setPayCash(String(rem));
        if (field === 'payCard')     setPayCard(String(rem));
        if (field === 'payQR')       setPayQR(String(rem));
        if (field === 'payTransfer') setPayTransfer(String(rem));
    };

    const handlePayDebt = async () => {
        if (isPaymentSubmitting) return;
        const c=parseInt(payCash)||0, cd=parseInt(payCard)||0, q=parseInt(payQR)||0, tr=parseInt(payTransfer)||0, b=payBalance||0;
        if (c+cd+q+tr+b<=0) return notify('Введите сумму','error');
        setIsPaymentSubmitting(true);
        try {
            await onPayment(guest.id, {cash:c, card:cd, qr:q, transfer:tr, balance:b});
        } catch(e) {
            notify(e.message || 'Ошибка оплаты', 'error');
        } finally {
            setIsPaymentSubmitting(false);
        }
    };

    // Скрытый вызов «Зачёт суммы»: долгое нажатие (1.5с) на иконку «Чек».
    // Пункта в меню для fazliddin нет — чтобы подменный кассир на общем логине не видел соблазна.
    // Операция всё равно пишется в аудит-лог (см. handleSuperPayment).
    const canSuperPay = currentUser.role === 'super' || currentUser.login === 'fazliddin';
    const superPayHoldRef = useRef(null);
    const superPayTriggeredRef = useRef(false);
    const startSuperPayHold = () => {
        if (!canSuperPay || isCheckedOut) return;
        superPayHoldRef.current = setTimeout(() => {
            superPayTriggeredRef.current = true;
            setCurrentView('superPay');
        }, 1500);
    };
    const cancelSuperPayHold = () => {
        if (superPayHoldRef.current) { clearTimeout(superPayHoldRef.current); superPayHoldRef.current = null; }
    };

    const handleSuperPaymentLocal = async () => {
        const amount = parseInt(superPayAmount) || 0;
        if (amount <= 0) return notify('Введите сумму', 'error');
        if (isPaymentSubmitting) return;
        setIsPaymentSubmitting(true);
        try {
            if (onSuperPayment) await onSuperPayment(guest.id, amount);
            setSuperPayAmount('');
        } catch(e) {
            notify(e.message || 'Ошибка', 'error');
        } finally {
            setIsPaymentSubmitting(false);
        }
    };

    const handleUpgrade = () => {
        if (!onUpgradeTariff) return;
        const days = parseInt(guest.days) || 0;
        const newTotal = MIN_NIGHT_PRICE * days;
        const extra = Math.max(0, newTotal - totalPaid);
        const msg = `Перевести гостя на тариф ${MIN_NIGHT_PRICE.toLocaleString()} сум/ночь?\n\nСумма за ${days} дн.: ${newTotal.toLocaleString()} сум.`
            + (extra > 0 ? `\nДоплата за уже прожитые дни: ${extra.toLocaleString()} сум.` : '');
        if (window.confirm(msg)) {
            onUpgradeTariff(guest, MIN_NIGHT_PRICE);
            onClose();
        }
    };

    const handleExtend = async () => {
        const days = parseInt(extendDays); if (!days) return;
        // Тариф ниже 70 000 без одобрения — продлевать можно только пакетом (минимум 10 дней)
        if (packageOnly && days < PACKAGE_MIN_DAYS) {
            return notify(`Тариф ниже ${MIN_NIGHT_PRICE.toLocaleString()} — продление только пакетом (мин. ${PACKAGE_MIN_DAYS} дн.) или по одобрению админа`, 'error');
        }
        // Блокируем продление, если конфликт с другим заселением
        if (extendConflict?.isOver) {
            const d = new Date(extendConflict.nextGuest.checkInDate).toLocaleDateString('ru-RU');
            return notify(`Нельзя продлить: ${extendConflict.nextGuest.fullName} заезжает ${d} на это место. Макс. ${extendConflict.maxDays} дн.`, 'error');
        }
        setIsPaymentSubmitting(true);
        // Прибавляем к существующим значениям — не пересчитываем из временных меток,
        // чтобы избежать ошибок округления при смеси date-only и ISO-строк
        const existingDays = parseInt(guest.days) || 0;
        const newDays  = existingDays + days;
        // По одобренному понижению — считаем доплату по одобренной цене
        const newTotal = (guest.totalPrice || 0) + extRate * days;

        // Если есть активный бонусный период — продлеваем ОТ конца бонуса, чтобы
        // бонус остался на своих ячейках (посередине бара), а не сдвигался в конец
        const baseCo = (guest.bonusCheckOutDate && new Date(guest.bonusCheckOutDate) > new Date(guest.checkOutDate))
            ? guest.bonusCheckOutDate
            : guest.checkOutDate;
        const coMs    = new Date(baseCo).getTime();
        const baseDate = new Date(coMs);
        baseDate.setHours(12, 0, 0, 0);
        const newCoDate = new Date(baseDate);
        newCoDate.setDate(newCoDate.getDate() + days);
        const newCheckOut = newCoDate.toISOString();

        // Если нет интернета — игнорируем оплату, иначе данные не сохранятся
        const c=isOnline?(parseInt(payCash)||0):0, cd=isOnline?(parseInt(payCard)||0):0, q=isOnline?(parseInt(payQR)||0):0;

        if (onExtend) {
            // Апп-уровень: с поддержкой undo
            await onExtend(guest.id, {
                extendDays: days,
                payCash: c, payCard: cd, payQR: q,
                prevDays:          parseInt(guest.days),
                prevTotalPrice:    guest.totalPrice || 0,
                prevCheckOut:      guest.checkOutDate,
                prevBonusCheckOut: guest.bonusCheckOutDate || null,
                prevStatus:        guest.status,
                newDays, newTotalPrice: newTotal, newCheckOut,
            });
            setIsPaymentSubmitting(false);
        } else {
            // fallback: прямой вызов
            onUpdate(guest.id, { days: newDays, totalPrice: newTotal, status:'active', checkOutDate: newCheckOut });
            if (c+cd+q>0) {
                setTimeout(()=>{ onPayment(guest.id,{cash:c,card:cd,qr:q}); notify(`Продлено на ${days} дн.`,'success'); setIsPaymentSubmitting(false); goBack(); },300);
            } else { notify(`Продлено на ${days} дн. (в долг)`,'success'); setIsPaymentSubmitting(false); goBack(); }
        }
    };

    const handleDoCheckout = () => {
        if (checkoutBalanceChoice === 'balance') {
            onCheckOut(guest, { totalPrice: actualCost, refundAmount: refundableNow, leaveOnBalance: true });
        } else if (checkoutBalanceChoice === 'mix') {
            const mbRaw = parseInt(checkoutMixBalance) || 0;
            const mrRaw = parseInt(checkoutMixRefund)  || 0;
            const mb = Math.max(0, Math.min(mbRaw, refundableNow));
            const mr = Math.max(0, Math.min(mrRaw, Math.max(0, refundableNow - mb)));
            onCheckOut(guest, { totalPrice: actualCost, refundAmount: mr, mixBalanceAmount: mb, leaveOnBalance: false });
        } else {
            const refundRaw = checkoutManualRefund ? parseInt(checkoutManualRefund) : refundableNow;
            const refund = Math.max(0, Math.min(refundRaw || 0, refundableNow));
            onCheckOut(guest, { totalPrice: actualCost, refundAmount: refund, leaveOnBalance: false });
        }
    };

    const handleDoSplit = () => {
        const s0 = new Date(guest.checkInDate); s0.setHours(0,0,0,0);
        const ss = new Date(splitStartDate);    ss.setHours(0,0,0,0);
        const se = new Date(splitReturnDate);   se.setHours(0,0,0,0);
        if (ss <= s0) return notify('Дата паузы после заезда','error');
        if (se <= ss) return notify('Возврат позже ухода','error');
        const ms = 1000*60*60*24;
        const before = Math.floor((ss-s0)/ms), gap = Math.floor((se-ss)/ms);
        if (before >= parseInt(guest.days)) return notify('Дата паузы превышает срок','error');
        onSplit(guest, before, gap); onClose();
    };

    const handleReplaceFromDB = () => {
        if (!selectedClient) return notify('Выберите гостя из списка', 'error');
        const { fullName, passport, birthDate, country, phone, passportIssueDate } = selectedClient;
        onUpdate(guest.id, { fullName, passport, birthDate: birthDate||'', country: country||'Узбекистан', phone: phone||'', passportIssueDate: passportIssueDate||'' });
        notify('Гость заменён ✓', 'success');
        goBack();
    };
    const handleReplaceNew = () => {
        if (!replaceNew.fullName.trim()) return notify('Введите ФИО', 'error');
        onUpdate(guest.id, { ...replaceNew });
        notify('Гость заменён ✓', 'success');
        goBack();
    };

    const handleSaveInfo    = () => {
        const updates = { 
            ...editForm, 
            fullName: (editForm.fullName || '').toUpperCase(),
            passport: (editForm.passport || '').toUpperCase(),
            totalPrice: parseInt(editForm.pricePerNight) * parseInt(guest.days) 
        };
        // Если kppDate не заполнен — не затирать существующее значение
        if (!updates.kppDate && guest.kppDate) updates.kppDate = guest.kppDate;
        // kppRegistered не трогаем, если дата не изменилась
        if (updates.kppDate === toDateInput(guest.kppDate)) updates.kppRegistered = guest.kppRegistered;
        onUpdate(guest.id, updates);
        goBack();
    };

    const copyRegistrationData = () => {
        const birthDateFormatted = guest.birthDate ? new Date(guest.birthDate).toLocaleDateString('ru-RU') : '—';
        const issueDateFormatted = guest.passportIssueDate ? new Date(guest.passportIssueDate).toLocaleDateString('ru-RU') : '—';
        const text = `${guest.fullName || '—'}\nДата рожд.: ${birthDateFormatted}\nПаспорт: ${guest.passport || '—'}\nВыдан: ${issueDateFormatted}\nСтрана: ${guest.country || '—'}`;
        navigator.clipboard.writeText(text).then(() => {
            notify('Данные скопированы', 'success');
        }).catch(() => {
            notify('Ошибка копирования', 'error');
        });
    };
    const handleDelete      = () => { setConfirmDeleteOpen(true); };
    const handleReduceNR    = () => { onReduceDaysNoRefund(guest, parseInt(reduceDaysNoRefund)); onClose(); };
    const handleMoveBooking = () => {
        const s = new Date(newStartDate); s.setHours(12,0,0,0);
        // Вычисляем фактическую продолжительность из хранимых дат (не из guest.days,
        // который мог устареть после drag/resize в календаре)
        const ciMs  = guest.checkInDate ? new Date(guest.checkInDate).getTime() : 0;
        const coFld = guest.checkOutDate ? new Date(guest.checkOutDate).getTime() : 0;
        const actualDays = (ciMs && coFld > ciMs)
            ? Math.max(parseInt(guest.days) || 1, Math.round((coFld - ciMs) / 86400000))
            : parseInt(guest.days) || 1;
        const stay = getStayDetails(s.toISOString(), actualDays);
        const moveData = { checkInDate: s.toISOString(), checkOutDate: stay.end.toISOString() };
        // Shift bonusCheckOutDate by the same delta if it exists
        if (guest.bonusCheckOutDate) {
            const oldIn = new Date(guest.checkInDate); oldIn.setHours(12,0,0,0);
            const deltaMs = s.getTime() - oldIn.getTime();
            moveData.bonusCheckOutDate = new Date(new Date(guest.bonusCheckOutDate).getTime() + deltaMs).toISOString();
        }
        onUpdate(guest.id, moveData);
        notify('Дата изменена!'); goBack();
    };
    const handlePrint = type => printDocument(type, guest, hostelInfo);

    const hdr = (title, back) => (
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 bg-white shrink-0">
            {back && <button onClick={goBack} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400"><ChevronLeft size={20}/></button>}
            <span className="font-black text-slate-800 text-lg">{title}</span>
            <button onClick={onClose} className="ml-auto p-1.5 hover:bg-slate-100 rounded-full text-slate-400"><X size={20}/></button>
        </div>
    );

    const payFields = (
        <div className="space-y-3">
            {[
                ['payCash','Наличные',<DollarSign size={16}/>, payCash, setPayCash],
                ['payCard','Карта',<CreditCard size={16}/>, payCard, setPayCard],
                ['payQR','QR',<QrCode size={16}/>, payQR, setPayQR],
                ['payTransfer','Перечисление',<ArrowRightLeft size={16}/>, payTransfer, setPayTransfer],
            ].map(([f,pl,ic,val,setter])=>(
                <div key={f} className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">{ic}</div>
                    <input type="text" inputMode="numeric" className="w-full pl-9 pr-9 py-3 border-2 border-slate-200 rounded-xl font-bold text-slate-800 focus:border-emerald-500 outline-none"
                        placeholder={pl}
                        value={fmtSum(val)}
                        onChange={e=>setter(parseSum(e.target.value))}
                        onWheel={disableWheel}/>
                    <button onClick={()=>applyMagnet(f)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg"><Magnet size={15}/></button>
                </div>
            ))}
            {clientBalance > 0 && (
                <div className="flex items-center justify-between px-3 py-2.5 border-2 rounded-xl border-blue-200 bg-blue-50">
                    <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                        <span>💳</span> Баланс счёта: <span className="text-blue-900">{clientBalance.toLocaleString()} сум</span>
                    </div>
                    {payBalance > 0
                        ? <button onClick={()=>setPayBalance(0)} className="px-3 py-1 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700">✕ Убрать</button>
                        : <button onClick={()=>setPayBalance(Math.min(clientBalance, Math.max(0, debt - (parseInt(payCash)||0) - (parseInt(payCard)||0) - (parseInt(payQR)||0))))} className="px-3 py-1 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700">Списать</button>
                    }
                </div>
            )}
            {payBalance > 0 && (
                <div className="text-xs text-blue-700 font-semibold text-center">
                    💳 Со счёта спишется: <b>{payBalance.toLocaleString()} сум</b>
                </div>
            )}
        </div>
    );

    const MenuButton = ({ icon: Icon, label, color, onClick, subLabel }) => {
        const themes = {
            emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100',
            blue:    'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100',
            rose:    'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100',
            amber:   'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100',
            slate:   'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
        };
        return (
            <button onClick={onClick} className={`w-full p-4 rounded-2xl border transition-colors flex flex-col items-center justify-center gap-1 ${themes[color]}`}>
                <Icon size={28} className="mb-1 opacity-90"/>
                <span className="font-bold text-sm leading-tight">{label}</span>
                {subLabel && <span className="text-[10px] opacity-70 font-medium leading-none">{subLabel}</span>}
            </button>
        );
    };

    return (
        <>
        <div className="modal-centered fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 animate-in fade-in duration-150">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

                {currentView === 'dashboard' && (
                    <div className="flex flex-col overflow-hidden bg-slate-50 h-full">
                        <div className="px-5 pt-4 pb-3 border-b border-slate-100 bg-white shrink-0 flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                {guest.country && COUNTRY_FLAGS[guest.country]
                                    ? <Flag code={COUNTRY_FLAGS[guest.country]} size={36} className="rounded-md shrink-0"/>
                                    : <div className="w-9 h-9 bg-slate-100 rounded-md flex items-center justify-center shrink-0"><User size={20} className="text-slate-400"/></div>}
                                <div>
                                    <h2 className="font-black text-slate-800 text-lg leading-tight">{guest.fullName}</h2>
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                        <span className="text-xs text-slate-400">К.{guest.roomNumber} · Место {guest.bedId}</span>
                                        {isBooking    && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">БРОНЬ</span>}
                                        {isCheckedOut && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">ВЫЕХАЛ</span>}
                                        {isNonRefundable && <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">ПАКЕТ · невозвр.</span>}
                                        {!isNonRefundable && isBelowMinRate && (
                                            isPriceApproved
                                                ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">✓ снижение одобрено</span>
                                                : <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">тариф &lt;70к · только пакет</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 shrink-0"><X size={20}/></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 pb-8 space-y-3">
                            {!isBooking && (
                                <div className={`rounded-xl p-3 border flex items-center justify-between bg-white ${debt > 0 ? 'border-rose-200' : 'border-emerald-200'}`}>
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">{t('debtBalance')}</div>
                                        {debt > 0
                                            ? <div className="text-xl font-black text-rose-600">⚠{debt.toLocaleString()}</div>
                                            : <div className="text-xl font-black text-emerald-600">{t('paidFull')}</div>}
                                    </div>
                                    <div className="text-right text-xs text-slate-400 space-y-0.5">
                                        <div>{t('total')}: <span className="font-bold text-slate-600">{(guest.totalPrice||0).toLocaleString()}</span></div>
                                        <div>{t('paid')}: <span className="font-bold text-emerald-600">{totalPaid.toLocaleString()}</span></div>
                                    </div>
                                </div>
                            )}

                            {clientBalance > 0 && (
                                <div className="rounded-xl p-3 border border-blue-200 bg-blue-50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">💳</span>
                                        <div className="text-xs text-blue-700 font-bold">Баланс счёта</div>
                                    </div>
                                    <div className="text-xl font-black text-blue-600">{clientBalance.toLocaleString()} сум</div>
                                </div>
                            )}

                            {clientRecord && debt < 0 && !isCheckedOut && !isBooking && onTopUpBalance && !guest.overpayTransferred && (
                                <div className="rounded-xl p-3 border border-violet-200 bg-violet-50 flex items-center justify-between">
                                    <div>
                                        <div className="text-[10px] font-bold text-violet-500 uppercase mb-0.5">Переплата</div>
                                        <div className="text-lg font-black text-violet-700">{Math.abs(debt).toLocaleString()} сум</div>
                                    </div>
                                    <button
                                        onClick={() => { onUpdate(guest.id, { overpayTransferred: true }); onTopUpBalance(clientRecord.id, Math.abs(debt), 'balance', true); notify('Переплата перемещена на баланс', 'success'); }}
                                        className="px-3 py-2 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 transition-colors"
                                    >💳 На баланс</button>
                                </div>
                            )}

                            {bonusDays > 0 && (
                                <div className="rounded-xl p-3 border border-orange-200 bg-orange-50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">🎁</span>
                                        <div>
                                            <div className="text-xs text-orange-700">
                                                {(guest.bonusDaysAdded || 0) > 0
                                                    ? 'Начислено гостю по реферальной'
                                                    : 'Доступно к использованию'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-3xl font-black text-orange-500">{bonusDays}</div>
                                </div>
                            )}

                            <div className="bg-white rounded-xl border border-slate-200 p-3">
                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">{t('accommodation')}</div>
                                <div className="grid grid-cols-4 gap-1 text-center">
                                    {[
                                        [t('arrivalLabel'),  new Date(guest.checkInDate).toLocaleDateString(lang === 'uz' ? 'uz-UZ' : 'ru',{day:'2-digit',month:'2-digit'})],
                                        [t('checkoutDate'),  new Date(guest.checkOutDate).toLocaleDateString(lang === 'uz' ? 'uz-UZ' : 'ru',{day:'2-digit',month:'2-digit'})],
                                        [t('days'),   guest.days],
                                        [t('tariff'),  parseInt(guest.pricePerNight).toLocaleString()],
                                    ].map(([l,v])=>(
                                        <div key={l}>
                                            <div className="text-[10px] text-slate-400">{l}</div>
                                            <div className="font-black text-slate-700 text-sm">{v}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 p-3">
                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center justify-between">
                                    <span>{t('personalData')}</span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={copyRegistrationData} className="flex items-center gap-1 text-emerald-500 hover:text-emerald-700 text-[10px] font-bold" title="Копировать данные для регистрации"><Copy size={12}/> Копировать</button>
                                        <button onClick={()=>photoInputRef.current?.click()} className="flex items-center gap-1 text-indigo-500 hover:text-indigo-700 text-[10px] font-bold"><Camera size={12}/> Фото</button>
                                        <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload}/>
                                    </div>
                                </div>
                                {guest.passportPhoto && (
                                    <div className="mb-2 relative inline-block">
                                        <img src={guest.passportPhoto} alt="Паспорт" className="h-20 rounded-xl border border-slate-200 object-cover shadow-sm"/>
                                        <button onClick={()=>onUpdate(guest.id,{passportPhoto:''})} className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-xs font-bold">×</button>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                    {[
                                        [t('passport'),    guest.passport || '—'],
                                        [t('birthDateShort'), guest.birthDate ? new Date(guest.birthDate).toLocaleDateString(lang === 'uz' ? 'uz-UZ' : 'ru') : '—'],
                                        [t('issuedLabel'),      guest.passportIssueDate ? new Date(guest.passportIssueDate).toLocaleDateString(lang === 'uz' ? 'uz-UZ' : 'ru') : '—'],
                                        [t('phone'),    guest.phone || '—'],
                                        [t('country'),     guest.country || '—'],
                                        [t('payment'),     [guest.paidCash>0&&`Нал:${(+guest.paidCash).toLocaleString()}`, guest.paidCard>0&&`Карта:${(+guest.paidCard).toLocaleString()}`, guest.paidQR>0&&`QR:${(+guest.paidQR).toLocaleString()}`].filter(Boolean).join(' · ')||'—'],
                                    ].map(([l,v])=>(
                                        <div key={l}>
                                            <span className="text-[10px] text-slate-400">{l}: </span>
                                            <span className="text-xs font-semibold text-slate-700">{v}</span>
                                        </div>
                                    ))}
                                </div>
                                {(() => {
                                    const digits = (guest.phone || '').replace(/\D/g, '');
                                    if (digits.length < 7) return null;
                                    return (
                                        <div className="flex gap-2 mt-2">
                                            <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer"
                                               className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors">
                                                <span>💬</span> WhatsApp
                                            </a>
                                            <a href={`https://t.me/+${digits}`} target="_blank" rel="noopener noreferrer"
                                               className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-colors">
                                                <span>✈️</span> Telegram
                                            </a>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Печать договора клиента — выбор языка */}
                            <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(15,150,136,0.12)' }}><FileText size={17} className="text-teal-600"/></div>
                                    <span className="text-sm font-bold text-slate-700">Распечатать договор</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {[['uz','UZ','uz'],['ru','RU','ru'],['en','EN','gb']].map(([lc,lbl,flag])=>(
                                        <button key={lc} onClick={()=>printContract(guest, hostelInfo, lc)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black border border-slate-200 text-slate-600 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 transition-colors">
                                            <span className={`fi fi-${flag} rounded-sm`} style={{ width: 18, height: 13, backgroundSize: 'cover' }}/>{lbl}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {(() => {
                                const normStr2 = s => (s || '').replace(/\s/g, '').toUpperCase();
                                const cadReg = cadastreRegs.find(r =>
                                    r.status !== 'removed' &&
                                    (r.guestId === guest.id ||
                                    (r.passport && guest.passport && normStr2(r.passport) === normStr2(guest.passport)))
                                );
                                if (!cadReg) return null;
                                const daysLeft = Math.ceil((new Date(cadReg.endDate + 'T23:59:59') - Date.now()) / 86400000);
                                const isExpired = daysLeft < 0;
                                const isExpiring = !isExpired && daysLeft <= 3;
                                return (
                                    <div className={`rounded-xl p-3 border ${
                                        isExpired  ? 'bg-rose-50 border-rose-300' :
                                        isExpiring ? 'bg-amber-50 border-amber-300' :
                                                     'bg-emerald-50 border-emerald-200'
                                    }`}>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">🏠 Регистрация по кадастру</div>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="space-y-0.5">
                                                {cadReg.cadastreAddress && <div className="text-xs text-slate-500">📍 {cadReg.cadastreAddress}</div>}
                                                <div className="text-xs font-semibold text-slate-700">
                                                    {cadReg.startDate} → {cadReg.endDate} ({cadReg.days || '?'} дн.)
                                                </div>
                                                <div className={`text-xs font-bold mt-0.5 ${
                                                    isExpired  ? 'text-rose-600' :
                                                    isExpiring ? 'text-amber-700' :
                                                                 'text-emerald-700'
                                                }`}>
                                                    {isExpired
                                                        ? `❌ Истекла ${Math.abs(daysLeft)} дн. назад`
                                                        : isExpiring
                                                            ? `⚠️ Осталось ${daysLeft} дн.`
                                                            : `✅ Активна, осталось ${daysLeft} дн.`}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {guest.kppDate && guest.country && guest.country !== 'Узбекистан' && (() => {
                                // День прибытия = 1. Срок без регистрации зависит от гражданства.
                                const regWindow = getRegistrationWindow(guest.country);
                                const days = getKppDayNumber(guest.kppDate);
                                const deadline = getKppDeadline(guest.kppDate, regWindow);
                                const needsReg = days >= regWindow - 1 && !guest.kppRegistered;
                                const overdue = days > regWindow && !guest.kppRegistered;
                                const isSuper = currentUser?.role === 'super' || currentUser?.role === 'admin' || currentUser?.login === 'fazliddin';
                                return (
                                    <div className={`rounded-xl p-3 border ${needsReg ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'}`}>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">КПП / Регистрация</div>
                                        <div className="flex items-center justify-between gap-2">
                                            <div>
                                                <div className="text-xs font-semibold text-slate-700">Дата КПП: {new Date(guest.kppDate).toLocaleDateString('ru-RU')}</div>
                                                {deadline && (
                                                    <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
                                                        Регистрация до: <span className={overdue ? 'text-rose-600 font-bold' : 'text-slate-700 font-bold'}>{deadline.toLocaleDateString('ru-RU')}</span> <span className="text-slate-400">({regWindow} дн.)</span>
                                                    </div>
                                                )}
                                                <div className={`text-xs font-bold mt-0.5 ${needsReg ? 'text-amber-700' : 'text-slate-500'}`}>
                                                    {guest.kppRegistered
                                                        ? '\u2705 Регистрация подтверждена'
                                                        : overdue
                                                            ? `⚠️ Просрочено! Прошло ${days} дн. — срочно зарегистрировать!`
                                                            : needsReg
                                                            ? `\u26a0\ufe0f Прошло ${days} дн. — нужна регистрация!`
                                                            : `День ${days} из ${regWindow}`}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1.5 shrink-0">
                                                {needsReg && onKppConfirm && (
                                                    <button
                                                        onClick={() => { onKppConfirm(guest.id); notify('Регистрация подтверждена', 'success'); }}
                                                        className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 transition-colors"
                                                    >Подтвердить</button>
                                                )}
                                                {isSuper && onKppReset && (
                                                    <button
                                                        onClick={() => { setKppResetDate(new Date().toISOString().slice(0,10)); setKppResetModal(true); }}
                                                        className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600 rounded-xl text-[10px] font-bold transition-colors border border-slate-200"
                                                    >↺ Сбросить</button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {guest.country && window.electronAPI?.openEmehmon && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        {(() => {
                                            // «Оформить (прибытие)» прячем, если уже зарегистрирован в e-mehmon
                                            // или есть активная регистрация по кадастру.
                                            const normP = s => (s || '').replace(/\s/g, '').toUpperCase();
                                            const hasCadastre = cadastreRegs.some(r =>
                                                r.status !== 'removed' &&
                                                (r.guestId === guest.id ||
                                                 (r.passport && guest.passport && normP(r.passport) === normP(guest.passport))));
                                            if (guest.emehmonReg || hasCadastre) return null;
                                            return (
                                                <button
                                                    onClick={() => { openEmehmonArrival(guest); notify('Открываю e-mehmon — нажмите «Заполнить из Hostella»', 'info'); }}
                                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-bold hover:bg-indigo-100 transition-colors"
                                                >
                                                    🌐 Оформить (прибытие)
                                                </button>
                                            );
                                        })()}
                                        {(isAdmin || currentUser.login === 'fazliddin') && (
                                            <button onClick={() => setEmehmonCfgOpen(true)} title="Доступы e-mehmon"
                                                className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                                                <Settings size={16} />
                                            </button>
                                        )}
                                    </div>
                                    {isCheckedOut && (() => {
                                        const departing = emehmonDepartingIds && typeof emehmonDepartingIds.has === 'function' && emehmonDepartingIds.has(guest.id);
                                        return (
                                            <button
                                                disabled={departing}
                                                onClick={() => {
                                                    if (onEmehmonDepart) onEmehmonDepart(guest);
                                                    else { openEmehmonDeparture(guest); notify('Открываю e-mehmon — «Выселить» или «Печать»', 'info'); }
                                                }}
                                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-bold hover:bg-rose-100 transition-colors disabled:opacity-50"
                                            >
                                                {departing ? '⏳ Вывожу из e-mehmon…' : '✈️ Вывести из e-mehmon (фон)'}
                                            </button>
                                        );
                                    })()}
                                </div>
                            )}

                            {guest.country && !isBooking && (
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
                                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer select-none">
                                        <input type="checkbox" className="w-4 h-4 rounded accent-indigo-600"
                                            checked={!!guest.emehmonReg}
                                            onChange={e => onUpdate(guest.id, { emehmonReg: e.target.checked, emehmonRegAt: e.target.checked ? new Date().toISOString() : '' })} />
                                        Зарегистрирован в e-mehmon
                                    </label>
                                    {isCheckedOut && (
                                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer select-none">
                                            <input type="checkbox" className="w-4 h-4 rounded accent-emerald-600"
                                                checked={!!guest.emehmonOut}
                                                onChange={e => onUpdate(guest.id, { emehmonOut: e.target.checked, emehmonOutAt: e.target.checked ? new Date().toISOString() : '' })} />
                                            Выведен из e-mehmon
                                        </label>
                                    )}
                                </div>
                            )}

                            {isBooking ? (
                                <div className="space-y-2">
                                    <div className="bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl text-amber-800 text-sm font-bold flex items-center gap-2"><Clock size={15}/> {t('bookingPending')}</div>
                                    <button onClick={()=>onActivateBooking(guest)} className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold">{t('checkin')}</button>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={()=>setCurrentView('moveDate')} className="py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 flex items-center justify-center gap-1"><Calendar size={14}/> {t('postpone')}</button>
                                        <button onClick={handleDelete} className="py-2.5 rounded-xl border border-rose-200 text-rose-600 font-bold text-sm hover:bg-rose-50 flex items-center justify-center gap-1"><Trash2 size={14}/> {t('cancel')}</button>
                                    </div>
                                </div>
                            ) : !isCheckedOut ? (
                                <>
                                <div className="grid grid-cols-2 gap-2">
                                    {canPay && (
                                        <button onClick={()=>setCurrentView('pay')} className="py-3 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 flex items-center justify-center gap-1.5"><Wallet size={15}/> {t('payment')}</button>
                                    )}
                                    <button onClick={()=>setCurrentView('extend')}   className="py-3 rounded-xl bg-sky-500    text-white font-bold text-sm hover:bg-sky-600    flex items-center justify-center gap-1.5"><Clock size={15}/> {t('extend')}</button>
                                    <button onClick={()=>setCurrentView('split')}    className="py-3 rounded-xl bg-amber-400  text-white font-bold text-sm hover:bg-amber-500  flex items-center justify-center gap-1.5"><Split size={15}/> {t('pauseBtn')}</button>
                                    <button onClick={()=>setCurrentView('checkout')} className="py-3 rounded-xl bg-rose-500   text-white font-bold text-sm hover:bg-rose-600   flex items-center justify-center gap-1.5"><LogOut size={15}/> {t('evict')}</button>
                                </div>
                                {isBelowMinRate && onUpgradeTariff && (
                                    <button onClick={handleUpgrade} className="w-full mt-2 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 flex items-center justify-center gap-1.5">
                                        ⬆️ Перейти на тариф {MIN_NIGHT_PRICE.toLocaleString()}
                                    </button>
                                )}
                                </>
                            ) : null}
                        </div>

                        <div className="px-4 py-3 border-t border-slate-100 bg-white shrink-0 flex items-center gap-1 flex-wrap">
                            {!isBooking && (
                                <>
                                    <button
                                        onClick={()=>{ if (superPayTriggeredRef.current) { superPayTriggeredRef.current = false; return; } handlePrint('check'); }}
                                        onPointerDown={startSuperPayHold}
                                        onPointerUp={cancelSuperPayHold}
                                        onPointerLeave={cancelSuperPayHold}
                                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg" title="Чек"><Printer size={17}/></button>
                                    <button onClick={() => {
                                        setEditForm({
                                            fullName: guest.fullName || '',
                                            birthDate: toDateInput(guest.birthDate),
                                            passport: guest.passport || '',
                                            passportIssueDate: toDateInput(guest.passportIssueDate),
                                            phone: guest.phone || '',
                                            country: guest.country || 'Узбекистан',
                                            kppDate: toDateInput(guest.kppDate),
                                            pricePerNight: guest.pricePerNight || 0,
                                        });
                                        setCurrentView('edit');
                                    }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Редактировать"><Edit size={17}/></button>
                                </>
                            )}
                            {!isCheckedOut && canMoveDate && <button onClick={()=>setCurrentView('moveDate')} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Перенос дат"><CalendarDays size={17}/></button>}
                            {!isCheckedOut && canMoveDate && <button onClick={()=>setCurrentView('trimDays')} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Срезать дни"><Scissors size={17}/></button>}
                            {onOpenHistory && (
                                <button
                                    onClick={onOpenHistory}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                    title="История заселений клиента"
                                ><History size={17}/></button>
                            )}
                            {!isCheckedOut && <button onClick={onOpenMove} className="ml-auto text-slate-500 hover:text-slate-800 font-bold text-xs flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg"><ArrowLeftRight size={13}/> Переместить</button>}
                            {!isCheckedOut && (
                                <button onClick={() => { setReplaceTab('db'); setReplaceSearch(''); setSelectedClient(null); setCurrentView('replaceGuest'); }}
                                    className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Заменить гостя">
                                    <UserX size={17}/>
                                </button>
                            )}
                            {isAdmin && <button onClick={handleDelete} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Удалить"><Trash2 size={17}/></button>}
                            {isAdmin && !isCheckedOut && <button onClick={()=>setCurrentView('admin')} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Админ"><Lock size={17}/></button>}
                            {isCheckedOut && <button onClick={()=>{ if(confirm('Восстановить гостя как активного?')) { const restoredCo = (() => { try { const ci = new Date(guest.checkInDate); const d = new Date(ci); d.setDate(d.getDate() + parseInt(guest.days || 0)); d.setHours(12, 0, 0, 0); return d.toISOString(); } catch { return guest.checkOutDate; } })(); onUpdate(guest.id, { status: 'active', autoCheckedOut: false, systemComment: '', checkOutDate: restoredCo }); notify('Гость восстановлен', 'success'); onClose(); }}} className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-violet-100 text-violet-700 hover:bg-violet-200 rounded-lg text-xs font-bold" title="Восстановить гостя"><RotateCcw size={14}/> {t('restoreGuest')}</button>}
                        </div>
                    </div>
                )}

                {currentView === 'pay' && (
                    <div className="flex flex-col overflow-hidden">
                        {hdr(t('payment'), true)}
                        <div className="flex-1 p-5 overflow-y-auto space-y-4">
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                                <div className="flex justify-between"><span className="text-xs text-slate-400 uppercase font-bold">{t('debt')}</span><span className="font-black text-rose-600 text-xl">{debt.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-xs text-slate-400 uppercase font-bold">{t('paying')}</span><span className="font-black text-emerald-600 text-xl">+{((parseInt(payCash)||0)+(parseInt(payCard)||0)+(parseInt(payQR)||0)+(parseInt(payTransfer)||0)+payBalance).toLocaleString()}</span></div>
                                <div className="flex justify-between pt-2 border-t border-dashed border-slate-200"><span className="text-xs text-slate-400 uppercase font-bold">{t('willRemain')}</span><span className="font-bold text-slate-500">{Math.max(0,debt-((parseInt(payCash)||0)+(parseInt(payCard)||0)+(parseInt(payQR)||0)+(parseInt(payTransfer)||0)+payBalance)).toLocaleString()}</span></div>
                            </div>
                            {payFields}
                            {!isOnline && (
                                <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs font-semibold">
                                    📶 Оффлайн — оплата сохранится и синхронизируется при подключении
                                </div>
                            )}
                            <button onClick={handlePayDebt} disabled={isPaymentSubmitting} className="w-full py-3.5 text-white rounded-xl font-bold shadow-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2">
                                {isPaymentSubmitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                                ПОДТВЕРДИТЬ ОПЛАТУ
                            </button>
                        </div>
                    </div>
                )}

                {currentView === 'extend' && (
                    <div className="flex flex-col overflow-hidden h-full">
                        {hdr(t('extendTitle'), true)}
                        <div className="flex-1 p-5 overflow-y-auto space-y-4">
                            {isPriceApproved && (
                                <div className="flex items-start gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-300 rounded-xl">
                                    <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5"/>
                                    <p className="text-xs text-emerald-700 font-semibold leading-snug">
                                        Понижение цены <b>одобрено</b>: {approvedPrice.toLocaleString()} сум/ночь. Можно продлевать по 1 дню по этой цене.
                                    </p>
                                </div>
                            )}
                            {packageOnly && (
                                <div className="px-3 py-2.5 bg-orange-50 border border-orange-300 rounded-xl space-y-2">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5"/>
                                        <p className="text-xs text-orange-700 font-semibold leading-snug">
                                            Тариф ниже {MIN_NIGHT_PRICE.toLocaleString()} сум — продление <b>только пакетом</b> (мин. {PACKAGE_MIN_DAYS} дн.). Для продления по 1 дню нужно одобрение админа.
                                        </p>
                                    </div>
                                    {onPriceRequest && (
                                        !showPriceReq ? (
                                            <button onClick={() => { setShowPriceReq(true); setReqPrice(String(guestRate)); }}
                                                className="w-full py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center justify-center gap-1.5">
                                                🔻 Запрос на понижение цены
                                            </button>
                                        ) : (
                                            <div className="space-y-2 bg-white rounded-xl p-2.5 border border-orange-200">
                                                <label className="text-[11px] font-bold text-slate-500 uppercase">Желаемая цена (сум/ночь)</label>
                                                <input type="number" className="w-full p-2.5 text-center border border-slate-200 rounded-xl outline-none font-bold focus:border-orange-400" placeholder="Цена" value={reqPrice} onChange={e=>setReqPrice(e.target.value)} onWheel={disableWheel}/>
                                                <div className="flex gap-2">
                                                    <button onClick={() => setShowPriceReq(false)} className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50">Отмена</button>
                                                    <button onClick={() => { onPriceRequest(guest, parseInt(reqPrice)||0); setShowPriceReq(false); }}
                                                        disabled={!((parseInt(reqPrice)||0) > 0)}
                                                        className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-xs font-bold">Отправить админу</button>
                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
                            )}
                            <div className="flex items-center justify-center gap-5">
                                <button onClick={()=>setExtendDays(Math.max(packageOnly ? PACKAGE_MIN_DAYS : 1, extendDays-1))} className="w-14 h-14 rounded-2xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center hover:bg-slate-200"><Minus size={28}/></button>
                                <div className="text-center">
                                    <input type="number" className="w-20 text-center text-5xl font-black text-slate-800 bg-transparent outline-none" value={extendDays} onChange={e=>setExtendDays(Math.max(packageOnly ? PACKAGE_MIN_DAYS : 1,parseInt(e.target.value)||1))} onWheel={disableWheel}/>
                                    <div className="text-slate-400 font-bold text-xs uppercase">{t('days')}</div>
                                </div>
                                <button onClick={()=>setExtendDays(d=>d+1)} className="w-14 h-14 rounded-2xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center hover:bg-slate-200"><Plus size={28}/></button>
                            </div>
                            <div className="flex gap-2 justify-center">{(packageOnly ? [10,20,30] : [1,3,7,30]).map(d=><button key={d} onClick={()=>setExtendDays(d)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 text-sm font-bold hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600">+{d}</button>)}</div>
                            {extendConflict && (
                                <div className="flex items-start gap-2 p-3 rounded-xl border bg-amber-50 border-amber-300">
                                    <span className="text-amber-500 text-base shrink-0">⚠️</span>
                                    <div>
                                        <div className="font-black text-amber-700 text-sm">Место занято через {extendConflict.maxDays} дн.</div>
                                        <div className="text-xs text-amber-600 mt-0.5">
                                            <b>{extendConflict.nextGuest.fullName}</b> заезжает {new Date(extendConflict.nextGuest.checkInDate).toLocaleDateString('ru-RU')}.
                                            Максимум: <b>{extendConflict.maxDays} дн.</b>
                                            {extendConflict.isOver && <span className="ml-1 text-rose-600 font-black"> ❌ Невозможно!</span>}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {!isAdmin && (
                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                                <div className="text-xs font-bold text-slate-400 uppercase mb-3">Оплатить сейчас (опц.)</div>
                                {payFields}
                            </div>
                            )}
                            <div className="flex justify-between items-center px-1">
                                <span className="text-slate-500 font-bold">{t('cost')}:</span>
                                <span className="text-2xl font-black text-indigo-600">+{(extendDays*extRate).toLocaleString()}</span>
                            </div>
                            {!isOnline && ((parseInt(payCash)||0)+(parseInt(payCard)||0)+(parseInt(payQR)||0)) > 0 && (
                                <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs font-semibold">
                                    📶 Оффлайн — оплата сохранится и синхронизируется при подключении
                                </div>
                            )}
                            <button onClick={handleExtend} disabled={isPaymentSubmitting} className={`w-full py-3.5 text-white rounded-xl font-black shadow-lg disabled:opacity-60 flex items-center justify-center gap-2 ${(!isAdmin && (parseInt(payCash)||0)+(parseInt(payCard)||0)+(parseInt(payQR)||0))>0?'bg-emerald-600 hover:bg-emerald-700':'bg-indigo-600 hover:bg-indigo-700'}`}>
                                {isPaymentSubmitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                                {(!isAdmin && ((parseInt(payCash)||0)+(parseInt(payCard)||0)+(parseInt(payQR)||0))>0)?t('payAndExtend'):t('extendInDebt')}
                            </button>
                        </div>
                    </div>
                )}

                {currentView === 'checkout' && (
                    <div className="flex flex-col overflow-hidden h-full">
                        {hdr(t('evict'), true)}
                        <div className="p-5 flex-1 overflow-y-auto space-y-4">
                            {isNonRefundable && (
                                <div className="flex items-start gap-2 px-3 py-3 bg-rose-50 border-2 border-rose-300 rounded-xl">
                                    <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5"/>
                                    <div>
                                        <p className="text-sm text-rose-700 font-bold">Невозвратный пакетный тариф</p>
                                        <p className="text-xs text-rose-600 font-semibold mt-0.5">При выселении пакет сгорает полностью — возврат оплаченной суммы не предусмотрен.</p>
                                    </div>
                                </div>
                            )}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                                <div className="flex justify-between"><span className="text-slate-500">{t('stayed')}</span><span className="font-bold">{daysStayed} {t('daysShort')}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">{t('cost')}</span><span className="font-bold">{actualCost.toLocaleString()}</span></div>
                                <div className="h-px bg-slate-200"/>
                                <div className="flex justify-between"><span className="text-slate-500">{t('paid')}</span><span className="font-bold text-emerald-600">{totalPaid.toLocaleString()}</span></div>
                            </div>
                            {balance < 0 ? (
                                <div className="p-4 bg-rose-50 border-2 border-rose-100 rounded-xl text-center">
                                    <div className="text-rose-400 font-bold text-xs uppercase mb-1">Долг</div>
                                    <div className="text-3xl font-black text-rose-600">{Math.abs(balance).toLocaleString()}</div>
                                </div>
                            ) : (
                                <div className="p-4 bg-emerald-50 border-2 border-emerald-100 rounded-xl">
                                    <div className="text-emerald-500 font-bold text-xs uppercase mb-1 text-center">К возврату</div>
                                    <div className="text-3xl font-black text-emerald-600 text-center mb-3">{refundableNow.toLocaleString()} сум</div>
                                    {refundableNow <= 0 && alreadySettledRefund > 0 && (
                                        <p className="text-xs text-slate-500 font-semibold text-center mb-2">
                                            Переплата уже была обработана ранее: {alreadySettledRefund.toLocaleString()} сум
                                        </p>
                                    )}
                                    {refundableNow > 0 && (
                                        <>
                                            <div className="grid grid-cols-3 gap-1.5 mb-3">
                                                <button
                                                    onClick={() => { setCheckoutBalanceChoice('balance'); setCheckoutManualRefund(''); setCheckoutMixBalance(''); setCheckoutMixRefund(''); }}
                                                    className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${checkoutBalanceChoice === 'balance' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'}`}
                                                >
                                                    💳 На баланс
                                                </button>
                                                <button
                                                    onClick={() => { setCheckoutBalanceChoice('refund'); setCheckoutManualRefund(''); setCheckoutMixBalance(''); setCheckoutMixRefund(''); }}
                                                    className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${checkoutBalanceChoice === 'refund' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'}`}
                                                >
                                                    💸 Вернуть
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setCheckoutBalanceChoice('mix');
                                                        setCheckoutManualRefund('');
                                                        const half = Math.floor(refundableNow / 2);
                                                        setCheckoutMixBalance(String(half));
                                                        setCheckoutMixRefund(String(refundableNow - half));
                                                    }}
                                                    className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${checkoutBalanceChoice === 'mix' ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-violet-300'}`}
                                                >
                                                    🔀 Микс
                                                </button>
                                            </div>

                                            {checkoutBalanceChoice === 'refund' && (
                                                <input type="number" className="w-full p-2.5 text-center border border-emerald-200 rounded-xl outline-none font-bold" placeholder="Сумма возврата (опц.)" value={checkoutManualRefund} onChange={e=>setCheckoutManualRefund(e.target.value)}/>
                                            )}
                                            {checkoutBalanceChoice === 'balance' && (
                                                <p className="text-xs text-blue-600 font-semibold text-center">Сумма будет зачислена на баланс клиента и учтена при следующем заселении</p>
                                            )}
                                            {checkoutBalanceChoice === 'mix' && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-blue-600 w-20 shrink-0">💳 Баланс</span>
                                                        <input
                                                            type="number"
                                                            className="flex-1 p-2 text-center border border-blue-200 rounded-xl outline-none font-bold text-sm"
                                                            placeholder="0"
                                                            value={checkoutMixBalance}
                                                            onChange={e => {
                                                                const v = e.target.value;
                                                                setCheckoutMixBalance(v);
                                                                setCheckoutMixRefund(String(Math.max(0, refundableNow - (parseInt(v) || 0))));
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-emerald-600 w-20 shrink-0">💸 Наличные</span>
                                                        <input
                                                            type="number"
                                                            className="flex-1 p-2 text-center border border-emerald-200 rounded-xl outline-none font-bold text-sm"
                                                            placeholder="0"
                                                            value={checkoutMixRefund}
                                                            onChange={e => {
                                                                const v = e.target.value;
                                                                setCheckoutMixRefund(v);
                                                                setCheckoutMixBalance(String(Math.max(0, refundableNow - (parseInt(v) || 0))));
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between px-1">
                                                        <span className="text-xs text-slate-400">Итого: {((parseInt(checkoutMixBalance)||0) + (parseInt(checkoutMixRefund)||0)).toLocaleString()} / {refundableNow.toLocaleString()}</span>
                                                        <button
                                                            onClick={() => { const h = Math.floor(refundableNow/2); setCheckoutMixBalance(String(h)); setCheckoutMixRefund(String(refundableNow-h)); }}
                                                            className="text-xs font-bold text-violet-600 hover:text-violet-800"
                                                        >50/50</button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                            <button onClick={handleDoCheckout} disabled={isPaymentSubmitting} className="w-full py-3.5 bg-rose-600 text-white rounded-xl font-black shadow-xl shadow-rose-200 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed">{t('confirmEviction')}</button>
                        </div>
                    </div>
                )}

                {currentView === 'edit' && (
                    <div className="flex flex-col overflow-hidden h-full">
                        {hdr('Редактирование', true)}
                        <div className="p-5 flex-1 space-y-3 overflow-y-auto">
                            <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">ФИО</label><input className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold" value={editForm.fullName} onChange={e=>setEditForm({...editForm,fullName:e.target.value})} onBlur={e=>setEditForm({...editForm,fullName:e.target.value.toUpperCase()})}/></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Паспорт</label><input className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold" value={editForm.passport} onChange={e=>setEditForm({...editForm,passport:e.target.value})} onBlur={e=>setEditForm({...editForm,passport:e.target.value.toUpperCase()})}/></div>
                                <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Дата рожд.</label><input type="date" className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold" value={editForm.birthDate} onChange={e=>setEditForm({...editForm,birthDate:e.target.value})}/></div>
                                <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Выдан</label><input type="date" className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold" value={editForm.passportIssueDate} onChange={e=>setEditForm({...editForm,passportIssueDate:e.target.value})}/></div>
                                <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Телефон</label><input className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold" value={editForm.phone} onChange={e=>setEditForm({...editForm,phone:e.target.value})}/></div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Страна</label>
                                <select className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold bg-white" value={editForm.country||'Узбекистан'} onChange={e=>setEditForm({...editForm,country:e.target.value})}>
                                    {COUNTRIES_LIST.map(c=><option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            {editForm.country && editForm.country !== 'Узбекистан' && (
                                <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Дата прохода КПП</label><input type="date" className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold" value={editForm.kppDate} onChange={e=>setEditForm({...editForm,kppDate:e.target.value})}/></div>
                            )}
                            <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Тариф/ночь</label>
                                {canEditPrice ? (
                                    <input type="number" className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold" value={editForm.pricePerNight} onChange={e=>setEditForm({...editForm,pricePerNight:e.target.value})}/>
                                ) : (
                                    <div className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold bg-slate-50 text-slate-500 flex items-center justify-between">
                                        <span>{(parseInt(editForm.pricePerNight)||0).toLocaleString()} сум</span>
                                        <span className="text-[10px] text-slate-400 flex items-center gap-1"><Lock size={11}/> только Fazliddin</span>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Фото паспорта</label>
                                <button type="button" onClick={()=>photoInputRef.current?.click()} className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-bold text-sm flex items-center justify-center gap-2 hover:border-indigo-300 hover:text-indigo-600">
                                    <Camera size={16}/> {guest.passportPhoto ? 'Заменить фото' : 'Загрузить фото'}
                                </button>
                                {guest.passportPhoto && <img src={guest.passportPhoto} alt="Паспорт" className="mt-2 h-24 rounded-xl border border-slate-200 object-cover"/>}
                            </div>
                            <button onClick={handleSaveInfo} className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold mt-2">СОХРАНИТЬ</button>
                        </div>
                    </div>
                )}

                {currentView === 'split' && (
                    <div className="flex flex-col overflow-hidden h-full">
                        {hdr('Пауза', true)}
                        <div className="p-5 flex-1 flex flex-col space-y-4 overflow-y-auto">
                            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-900 font-medium">Выберите даты отсутствия. Место освободится на это время.</div>
                            <div><label className="font-bold block mb-1.5 text-sm text-slate-500">Дата уезда</label><input type="date" className="w-full p-3.5 border-2 border-slate-200 rounded-xl text-base font-bold" value={splitStartDate} onChange={e=>setSplitStartDate(e.target.value)}/></div>
                            <div><label className="font-bold block mb-1.5 text-sm text-slate-500">Дата возвращения</label><input type="date" className="w-full p-3.5 border-2 border-slate-200 rounded-xl text-base font-bold" value={splitReturnDate} onChange={e=>setSplitReturnDate(e.target.value)}/></div>
                            <div className="mt-auto text-center text-sm font-bold text-slate-500">Пауза: <span className="text-amber-600 text-lg">{Math.max(0,Math.ceil((new Date(splitReturnDate)-new Date(splitStartDate))/(1000*60*60*24)))} дн.</span></div>
                            <button onClick={handleDoSplit} className="w-full py-3.5 bg-amber-500 text-white rounded-xl font-bold">ПОДТВЕРДИТЬ ПАУЗУ</button>
                        </div>
                    </div>
                )}

                {currentView === 'admin' && (
                    <div className="flex flex-col overflow-hidden h-full">
                        {hdr('Админ', true)}
                        <div className="p-5 space-y-4 overflow-y-auto">
                            <div className="p-4 border-2 border-amber-200 bg-amber-50 rounded-xl space-y-3">
                                <div className="text-xs font-bold text-amber-700 uppercase">Сократить дни (без возврата)</div>
                                <div className="flex gap-2">
                                    <input type="number" className="w-20 p-2.5 border rounded-xl font-bold text-center" value={reduceDaysNoRefund} onChange={e=>setReduceDaysNoRefund(e.target.value)}/>
                                    <button onClick={handleReduceNR} className="flex-1 px-3 py-2.5 bg-amber-500 text-white rounded-xl font-bold text-sm">Сократить</button>
                                </div>
                            </div>
                            <div className="p-4 border-2 border-rose-200 bg-rose-50 rounded-xl space-y-3">
                                <div className="text-xs font-bold text-rose-700 uppercase">Опасная зона</div>
                                {!isCheckedOut && <button onClick={()=>setCurrentView('checkout')} className="w-full py-3 bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center gap-2"><LogOut size={15}/> ПРИНУДИТЕЛЬНО ВЫСЕЛИТЬ</button>}
                                <button onClick={handleDelete} className="w-full py-3 bg-rose-600 text-white rounded-xl font-bold flex items-center justify-center gap-2"><Trash2 size={15}/> УДАЛИТЬ ГОСТЯ</button>
                            </div>
                            {currentUser.role === 'super' && !isCheckedOut && (
                                <button onClick={()=>setCurrentView('superPay')} className="w-full py-3 bg-violet-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-violet-700 transition-colors">
                                    <ShieldCheck size={15}/> Зачёт суммы
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {currentView === 'superPay' && (
                    <div className="flex flex-col overflow-hidden h-full">
                        {hdr('Зачёт суммы', true)}
                        <div className="p-5 space-y-4">
                            <div className="p-4 border-2 border-violet-200 bg-violet-50 rounded-xl space-y-1">
                                <div className="text-xs font-bold text-violet-700 uppercase">Текущий долг</div>
                                <div className="text-2xl font-black text-violet-800">{debt.toLocaleString()} сум</div>
                            </div>
                            {guest.superAdjusted ? (
                                <div className="text-xs text-violet-500 font-semibold">Ранее зачтено: {(guest.superAdjusted).toLocaleString()} сум</div>
                            ) : null}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Сумма к зачёту</label>
                                <input type="number" className="w-full p-4 border-2 border-violet-200 rounded-xl font-bold text-xl text-center focus:border-violet-400 outline-none"
                                    placeholder="0" value={superPayAmount} onChange={e => setSuperPayAmount(e.target.value)} onWheel={disableWheel}/>
                            </div>
                            <button onClick={handleSuperPaymentLocal} className="w-full py-3.5 text-white rounded-xl font-bold flex items-center justify-center gap-2" style={{background:'#7c3aed'}}>
                                <ShieldCheck size={16}/> ЗАЧЕСТЬ СУММУ
                            </button>
                            <p className="text-xs text-slate-400 text-center">Не учитывается как выручка, но фиксируется в истории операций</p>
                        </div>
                    </div>
                )}

                {currentView === 'trimDays' && (
                    <div className="flex flex-col overflow-hidden h-full">
                        {hdr('✂️ Срезать дни', true)}
                        <div className="p-5 flex-1 overflow-y-auto space-y-4">
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                <div className="text-xs font-bold text-amber-700 uppercase mb-1">Текущий срок</div>
                                <div className="text-2xl font-black text-amber-800">
                                    {guest.bonusCheckOutDate
                                        ? `${guest.days} дн. + ${bonusDaysAvailForTrim}б → ${effectiveEndDateForTrim.toLocaleDateString('ru')}`
                                        : `${guest.days} дн. → ${new Date(guest.checkOutDate).toLocaleDateString('ru')}`
                                    }
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Срезать дней</label>
                                <div className="flex items-center gap-3">
                                    <button onClick={()=>setTrimDays(d=>Math.max(1,d-1))} className="w-12 h-12 rounded-xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center hover:bg-slate-200 text-2xl font-bold">−</button>
                                    <input type="number" min="1" max={maxTrimDays}
                                        className="flex-1 p-3 border-2 border-slate-200 rounded-xl font-black text-3xl text-center focus:border-amber-400 outline-none"
                                        value={trimDays}
                                        onChange={e=>setTrimDays(Math.max(1, Math.min(maxTrimDays, parseInt(e.target.value)||1)))}
                                        onWheel={disableWheel}/>
                                    <button onClick={()=>setTrimDays(d=>Math.min(maxTrimDays,d+1))} className="w-12 h-12 rounded-xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center hover:bg-slate-200 text-2xl font-bold">+</button>
                                </div>
                            </div>
                            {trimDays >= 1 && (
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 flex justify-between">
                                    <span>Новый выезд:</span>
                                    <span className="font-black text-amber-700">
                                        {(()=>{
                                            if (trimDays <= bonusDaysAvailForTrim) {
                                                const d = new Date(guest.bonusCheckOutDate);
                                                d.setDate(d.getDate() - trimDays);
                                                return `${d.toLocaleDateString('ru')} · ${guest.days} дн. (бонус -${trimDays}д)`;
                                            }
                                            const d = new Date(guest.checkOutDate);
                                            d.setDate(d.getDate() - regularDaysToTrimPreview);
                                            return `${d.toLocaleDateString('ru')} · ${Math.max(1, parseInt(guest.days||1) - regularDaysToTrimPreview)} дн.`;
                                        })()}
                                    </span>
                                </div>
                            )}
                            {trimDays > 0 && regularDaysToTrimPreview > 0 && parseInt(guest.pricePerNight) > 0 && (
                                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-semibold text-emerald-700 flex justify-between">
                                    <span>Изменение цены:</span>
                                    <span className="font-black">−{(regularDaysToTrimPreview*parseInt(guest.pricePerNight)).toLocaleString()} сум</span>
                                </div>
                            )}
                            {trimDays > 0 && trimDays <= bonusDaysAvailForTrim && (
                                <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-sm font-semibold text-orange-700">
                                    Срезаются только бонусные дни — цена не изменится
                                </div>
                            )}
                            <button
                                onClick={()=>{ if(onTrimDays) onTrimDays(guest.id, trimDays); }}
                                className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black shadow-lg"
                            >
                                СРЕЗАТЬ {trimDays} {trimDays===1?'ДЕНЬ':trimDays<5?'ДНЯ':'ДНЕЙ'}
                            </button>
                            <p className="text-xs text-slate-400 text-center">Отменить можно через кнопку «Отмена действий» в течение 30 мин.</p>
                        </div>
                    </div>
                )}

                {currentView === 'moveDate' && (
                    <div className="flex flex-col overflow-hidden">
                        {hdr('Перенос даты', true)}
                        <div className="p-5">
                            <label className="font-bold block mb-2 text-sm text-slate-500">Новая дата заезда</label>
                            <input type="date" className="w-full p-4 border-2 border-slate-200 rounded-xl font-bold text-lg mb-5" value={newStartDate} onChange={e=>setNewStartDate(e.target.value)}/>
                            <button onClick={handleMoveBooking} className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold">СОХРАНИТЬ</button>
                        </div>
                    </div>
                )}

                {/* ───────────────── ЗАМЕНИТЬ ГОСТЯ ───────────────── */}
                {currentView === 'replaceGuest' && (() => {
                    const INP2 = "w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:border-amber-400 outline-none";
                    const q = replaceSearch.toLowerCase();
                    const filteredClients = clients.filter(c =>
                        (c.fullName || '').toLowerCase().includes(q) ||
                        (c.passport || '').toLowerCase().includes(q)
                    ).slice(0, 40);

                    return (
                        <div className="flex flex-col overflow-hidden h-full">
                            {hdr('Заменить гостя', true)}

                            {/* Tabs */}
                            <div className="flex border-b border-slate-100 bg-white shrink-0">
                                {[['db','Из базы клиентов'],['new','Ввести вручную']].map(([tab, label]) => (
                                    <button key={tab} onClick={() => setReplaceTab(tab)}
                                        className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 ${
                                            replaceTab === tab
                                                ? 'border-amber-500 text-amber-700'
                                                : 'border-transparent text-slate-400 hover:text-slate-600'
                                        }`}>
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {/* Tab: from DB */}
                            {replaceTab === 'db' && (
                                <div className="flex flex-col flex-1 overflow-hidden">
                                    {/* Search */}
                                    <div className="px-4 pt-3 pb-2 bg-slate-50 border-b border-slate-100 shrink-0">
                                        <div className="relative">
                                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                autoFocus
                                                className="w-full pl-9 pr-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:border-amber-400 outline-none"
                                                placeholder="ФИО или паспорт..."
                                                value={replaceSearch}
                                                onChange={e => { setReplaceSearch(e.target.value); setSelectedClient(null); }}
                                            />
                                        </div>
                                    </div>

                                    {/* Client list */}
                                    <div className="flex-1 overflow-y-auto">
                                        {filteredClients.length === 0 ? (
                                            <div className="py-10 text-center text-slate-400 text-sm">
                                                {replaceSearch ? 'Ничего не найдено' : 'Начните вводить ФИО или паспорт'}
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-slate-50">
                                                {filteredClients.map(c => {
                                                    const isSel = selectedClient?.id === c.id || selectedClient?.passport === c.passport;
                                                    const flagCode = COUNTRY_FLAGS[c.country];
                                                    return (
                                                        <button key={c.id || c.passport}
                                                            onClick={() => setSelectedClient(c)}
                                                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                                                                isSel
                                                                    ? 'bg-amber-50 border-l-4 border-amber-400'
                                                                    : 'hover:bg-slate-50 border-l-4 border-transparent'
                                                            }`}>
                                                            {flagCode
                                                                ? <span className={`fi fi-${flagCode.toLowerCase()}`} style={{ width: 24, height: 16, display: 'inline-block', objectFit: 'cover', borderRadius: 2, verticalAlign: 'middle', flexShrink: 0, backgroundSize: 'cover' }} />
                                                                : <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center shrink-0"><User size={12} className="text-slate-400" /></div>
                                                            }
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-bold text-sm text-slate-800 truncate">{c.fullName}</div>
                                                                <div className="text-[11px] text-slate-400 font-mono">{c.passport || '—'} {c.country ? `· ${c.country}` : ''}</div>
                                                            </div>
                                                            {isSel && <div className="w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center shrink-0"><span className="text-white text-[10px] font-black">✓</span></div>}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Confirm */}
                                    {selectedClient && (
                                        <div className="p-4 border-t border-slate-100 bg-white shrink-0">
                                            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                                                <div className="font-black text-slate-800 truncate">{selectedClient.fullName}</div>
                                                <div className="text-[11px] text-slate-500 font-mono mt-0.5">{selectedClient.passport} · {selectedClient.country}</div>
                                            </div>
                                            <button onClick={handleReplaceFromDB}
                                                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-sm shadow-amber-100 transition-colors">
                                                ПОДТВЕРДИТЬ ЗАМЕНУ
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Tab: manual */}
                            {replaceTab === 'new' && (
                                <div className="flex-1 overflow-y-auto p-4 pb-8 space-y-3">
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
                                        Заменит ФИО, паспорт и личные данные гостя. Комната, даты и оплата останутся.
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">ФИО *</label>
                                        <input className={INP2} placeholder="ИВАНОВ ИВАН ИВАНОВИЧ"
                                            value={replaceNew.fullName}
                                            onChange={e => setReplaceNew({...replaceNew, fullName: e.target.value.toUpperCase()})} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Паспорт</label>
                                            <input className={INP2} placeholder="AA1234567"
                                                value={replaceNew.passport}
                                                onChange={e => setReplaceNew({...replaceNew, passport: e.target.value.toUpperCase()})} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Дата рожд.</label>
                                            <input type="date" className={INP2}
                                                value={replaceNew.birthDate}
                                                onChange={e => setReplaceNew({...replaceNew, birthDate: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Выдан</label>
                                            <input type="date" className={INP2}
                                                value={replaceNew.passportIssueDate}
                                                onChange={e => setReplaceNew({...replaceNew, passportIssueDate: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Телефон</label>
                                            <input className={INP2} placeholder="+998..."
                                                value={replaceNew.phone}
                                                onChange={e => setReplaceNew({...replaceNew, phone: e.target.value})} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Страна</label>
                                        <div className="relative">
                                            <select className={INP2 + ' pr-8 appearance-none'}
                                                value={replaceNew.country}
                                                onChange={e => setReplaceNew({...replaceNew, country: e.target.value})}>
                                                {COUNTRIES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                                        </div>
                                    </div>
                                    <button onClick={handleReplaceNew}
                                        className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black shadow-sm shadow-amber-100 transition-colors mt-2">
                                        СОХРАНИТЬ И ЗАМЕНИТЬ
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })()}

            </div>
        </div>

        <ConfirmDialog
            open={confirmDeleteOpen}
            title={t('deleteGuest')}
            message={`${guest.fullName || ''}${guest.roomNumber ? ` — К.${guest.roomNumber}` : ''}`}
            confirmText={t('delete')}
            onConfirm={() => { setConfirmDeleteOpen(false); onDelete(guest); }}
            onCancel={() => setConfirmDeleteOpen(false)}
            lang={lang}
        />

        {emehmonCfgOpen && (
            <EmehmonAccountsModal onClose={() => setEmehmonCfgOpen(false)} notify={notify} />
        )}

        {kppResetModal && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
                    <div className="h-1 bg-rose-500 w-full"/>
                    <div className="p-5 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                                <span className="text-lg">↺</span>
                            </div>
                            <div>
                                <div className="font-black text-slate-800 text-sm">Сбросить отсчёт КПП</div>
                                <div className="text-xs text-slate-500 mt-0.5">Подтверждение регистрации будет снято</div>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Новая дата пересечения КПП</label>
                            <input
                                type="date"
                                value={kppResetDate}
                                onChange={e => setKppResetDate(e.target.value)}
                                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-rose-400 outline-none"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Оставьте поле пустым, чтобы сохранить текущую дату КПП</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setKppResetModal(false)}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
                            >Отмена</button>
                            <button
                                onClick={() => {
                                    onKppReset(guest.id, kppResetDate || null);
                                    setKppResetModal(false);
                                    notify('Отсчёт КПП сброшен', 'success');
                                }}
                                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm"
                            >Сбросить</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        </>
    );
};

export default GuestDetailsModal;
