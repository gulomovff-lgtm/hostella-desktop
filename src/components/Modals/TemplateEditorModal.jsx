import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    X, FileText, Save, Printer, Eye, Code2, RefreshCw, Columns,
    Search, Copy, Download, ZoomIn, ZoomOut, Check, Plus, Receipt, Contact,
} from 'lucide-react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../../firebase';
import { getConfig } from '../../utils/appConfig';

// ─── Default templates ────────────────────────────────────────────────────────
const DEFAULT_RECEIPT = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;padding:20px;max-width:320px;margin:0 auto;font-size:12px;}
  .logo{text-align:center;margin-bottom:12px;}
  .logo img{max-height:60px;max-width:200px;object-fit:contain;}
  .hostel-name{text-align:center;font-size:16px;font-weight:bold;color:#1a3c40;margin-bottom:4px;}
  .hostel-info{text-align:center;color:#666;font-size:10px;margin-bottom:16px;}
  h2{text-align:center;font-size:13px;border-top:2px dashed #ccc;border-bottom:2px dashed #ccc;padding:6px 0;margin:12px 0;}
  .row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dotted #eee;}
  .row span:last-child{font-weight:bold;}
  .total{display:flex;justify-content:space-between;padding:8px 0;font-size:14px;font-weight:bold;border-top:2px solid #1a3c40;margin-top:8px;}
  .footer{text-align:center;color:#999;font-size:9px;margin-top:16px;border-top:1px dashed #ccc;padding-top:8px;}
  .qr{text-align:center;margin-top:10px;}
  .qr img{width:90px;height:90px;}
</style></head><body>
<div class="logo">{{LOGO}}</div>
<div class="hostel-name">{{HOSTEL_NAME}}</div>
<div class="hostel-info">{{HOSTEL_ADDRESS}} | {{HOSTEL_PHONE}}</div>
<h2>ЧЕК / КВИТАНЦИЯ</h2>
<div class="row"><span>Документ №:</span><span>{{REG_NUMBER}}</span></div>
<div class="row"><span>Гость:</span><span>{{GUEST_NAME}}</span></div>
<div class="row"><span>Комната:</span><span>{{ROOM_NUMBER}}</span></div>
<div class="row"><span>Место:</span><span>{{BED_ID}}</span></div>
<div class="row"><span>Заезд:</span><span>{{CHECK_IN}}</span></div>
<div class="row"><span>Выезд:</span><span>{{CHECK_OUT}}</span></div>
<div class="row"><span>Ночей:</span><span>{{DAYS}}</span></div>
<div class="row"><span>Цена/ночь:</span><span>{{PRICE_PER_NIGHT}}</span></div>
<div class="total"><span>ИТОГО:</span><span>{{TOTAL_PRICE}}</span></div>
<div class="row"><span>Способ оплаты:</span><span>{{PAYMENT_METHOD}}</span></div>
<div class="row"><span>Оплачено:</span><span>{{PAID}}</span></div>
<div class="row"><span>Долг:</span><span>{{DEBT}}</span></div>
<div class="qr">{{QR}}</div>
<div class="footer">{{DATE}} | Кассир: {{STAFF_NAME}}<br>{{FOOTER}}</div>
</body></html>`;

const DEFAULT_REG_CARD = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;padding:30px;font-size:12px;line-height:1.5;}
  .header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #1a3c40;padding-bottom:12px;margin-bottom:20px;}
  .logo img{max-height:70px;max-width:180px;object-fit:contain;}
  .hostel-info{text-align:right;color:#333;}
  h2{font-size:16px;text-align:center;text-transform:uppercase;letter-spacing:2px;margin:0 0 20px;}
  table{width:100%;border-collapse:collapse;}
  td{border:1px solid #ccc;padding:7px 10px;vertical-align:top;}
  td:first-child{font-weight:bold;width:35%;background:#f5f5f5;color:#555;}
  .signature-row{margin-top:30px;display:flex;justify-content:space-between;}
  .sig-block{text-align:center;width:45%;}
  .sig-line{border-top:1px solid #333;padding-top:4px;font-size:10px;color:#666;margin-top:30px;}
</style></head><body>
<div class="header">
  <div class="logo">{{LOGO}}</div>
  <div class="hostel-info"><strong>{{HOSTEL_NAME}}</strong><br>{{HOSTEL_ADDRESS}}<br>{{HOSTEL_PHONE}}</div>
</div>
<h2>Регистрационная карта гостя</h2>
<table>
  <tr><td>ФИО</td><td>{{GUEST_NAME}}</td></tr>
  <tr><td>Паспорт / Документ</td><td>{{PASSPORT}}</td></tr>
  <tr><td>Дата рождения</td><td>{{BIRTH_DATE}}</td></tr>
  <tr><td>Гражданство</td><td>{{COUNTRY}}</td></tr>
  <tr><td>Телефон</td><td>{{PHONE}}</td></tr>
  <tr><td>Дата заезда</td><td>{{CHECK_IN}}</td></tr>
  <tr><td>Дата выезда</td><td>{{CHECK_OUT}}</td></tr>
  <tr><td>Номер комнаты</td><td>{{ROOM_NUMBER}}</td></tr>
  <tr><td>Место</td><td>{{BED_ID}}</td></tr>
  <tr><td>Цель визита</td><td>{{PURPOSE}}</td></tr>
</table>
<div class="signature-row">
  <div class="sig-block"><div class="sig-line">Подпись гостя / Signature</div></div>
  <div class="sig-block"><div class="sig-line">Администратор / Receptionist</div></div>
</div>
</body></html>`;

// QR placeholder image (preview only) — encodes sample text via public QR service
const qrImg = (text) =>
    `<img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(text)}" alt="QR"/>`;

// ─── Variable replacements for preview ────────────────────────────────────────
const SAMPLE_VARS = {
    '{{LOGO}}':           '<img src="https://hostella.uz/logo.png" alt="logo"/>',
    '{{HOSTEL_NAME}}':    'Hostella №1',
    '{{HOSTEL_ADDRESS}}': 'ул. Шота Руставели, 35',
    '{{HOSTEL_PHONE}}':   '+998 90 123-45-67',
    '{{GUEST_NAME}}':     'ИВАНОВ ИВАН ИВАНОВИЧ',
    '{{PASSPORT}}':       'AB1234567',
    '{{BIRTH_DATE}}':     '01.01.1990',
    '{{COUNTRY}}':        'Россия',
    '{{PHONE}}':          '+7 900 000-00-00',
    '{{CHECK_IN}}':       '22.02.2026',
    '{{CHECK_OUT}}':      '25.02.2026',
    '{{DAYS}}':           '3',
    '{{PRICE_PER_NIGHT}}': '70 000 сум',
    '{{TOTAL_PRICE}}':    '210 000 сум',
    '{{PAID}}':           '200 000 сум',
    '{{DEBT}}':           '10 000 сум',
    '{{DISCOUNT}}':       '0 сум',
    '{{TAX}}':            '0 сум',
    '{{PAYMENT_METHOD}}': 'Наличные',
    '{{ROOM_NUMBER}}':    '102',
    '{{BED_ID}}':         '4',
    '{{REG_NUMBER}}':     '000128',
    '{{DATE}}':           new Date().toLocaleString('ru'),
    '{{STAFF_NAME}}':     'Дилафруз',
    '{{PURPOSE}}':        'Туризм',
    '{{FOOTER}}':         'Спасибо за визит!',
    '{{QR}}':             qrImg('HOSTELLA-RECEIPT-000128'),
};

const applyVars = (html) => {
    let result = html;
    Object.entries(SAMPLE_VARS).forEach(([key, val]) => {
        result = result.split(key).join(val);
    });
    return result;
};

// Экранирование значений, подставляемых в HTML-шаблон чека. Данные гостя могут
// прийти из внешнего источника (веб-бронирование), поэтому ФИО/паспорт/коммент и
// т.п. вставляем только как текст — иначе возможен stored-XSS при печати чека.
const escHtmlValue = (s) => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Разрешаем логотип только по http(s)/data:image-URL, всё остальное отбрасываем.
const safeLogoUrl = (url) => {
    const u = String(url || '').trim();
    if (/^https?:\/\//i.test(u) || /^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(u)) {
        return u.replace(/"/g, '&quot;');
    }
    return '';
};

export const applyGuestVars = (html, guest, room, staff, hostelSettings) => {
    const cfg = getConfig();
    const cur = cfg.currency || 'сум';
    const money = (n) => `${(Number(n) || 0).toLocaleString()} ${cur}`;
    const hostelCfg = hostelSettings?.[room?.hostelId || 'hostel1'] || {};
    const totalPaid = (parseInt(guest.paidCash) || 0) + (parseInt(guest.paidCard) || 0) + (parseInt(guest.paidQR) || 0) + (parseInt(guest.amountPaid) || 0);
    const debt      = Math.max(0, (guest.totalPrice || 0) - totalPaid);
    const logoSrc   = safeLogoUrl(hostelCfg.logoUrl);
    const logoHtml  = logoSrc ? `<img src="${logoSrc}" alt="logo"/>` : '';
    const footer    = (cfg.receiptFooter || 'Спасибо за визит!');
    const regNo     = guest.regNumber || guest.receiptNo || guest.id || '';
    const qrPayload = `${hostelCfg.name || ''} | ${guest.fullName || ''} | ${regNo}`;
    const qrHtml    = cfg.receiptShowQr ? qrImg(qrPayload) : '';
    const vars = {
        '{{LOGO}}':           logoHtml,
        '{{HOSTEL_NAME}}':    hostelCfg.name || 'Хостел',
        '{{HOSTEL_ADDRESS}}': hostelCfg.address || '',
        '{{HOSTEL_PHONE}}':   hostelCfg.phone || '',
        '{{GUEST_NAME}}':     guest.fullName || '',
        '{{PASSPORT}}':       guest.passport || '',
        '{{BIRTH_DATE}}':     guest.birthDate ? new Date(guest.birthDate).toLocaleDateString('ru') : '',
        '{{COUNTRY}}':        guest.country || '',
        '{{PHONE}}':          guest.phone || '',
        '{{CHECK_IN}}':       guest.checkInDate  ? new Date(guest.checkInDate).toLocaleDateString('ru')  : '',
        '{{CHECK_OUT}}':      guest.checkOutDate ? new Date(guest.checkOutDate).toLocaleDateString('ru') : '',
        '{{DAYS}}':           String(guest.days || 1),
        '{{PRICE_PER_NIGHT}}': money(guest.pricePerNight),
        '{{TOTAL_PRICE}}':    money(guest.totalPrice),
        '{{PAID}}':           money(totalPaid),
        '{{DEBT}}':           money(debt),
        '{{DISCOUNT}}':       money(guest.discount),
        '{{TAX}}':            money(guest.tax),
        '{{PAYMENT_METHOD}}': guest.paymentMethod || (guest.paidCard ? 'Карта' : guest.paidQR ? 'QR' : 'Наличные'),
        '{{ROOM_NUMBER}}':    guest.roomNumber || (room?.number || ''),
        '{{BED_ID}}':         String(guest.bedId || ''),
        '{{REG_NUMBER}}':     String(regNo),
        '{{DATE}}':           new Date().toLocaleString('ru'),
        '{{STAFF_NAME}}':     staff?.name || '',
        '{{PURPOSE}}':        guest.purpose || '',
        '{{FOOTER}}':         footer,
        '{{QR}}':             qrHtml,
    };
    // {{LOGO}} и {{QR}} — это заведомо безопасный HTML, собранный выше (src уже
    // провалидирован). Все остальные значения экранируем как текст.
    const RAW_HTML_KEYS = new Set(['{{LOGO}}', '{{QR}}']);
    let result = html;
    Object.entries(vars).forEach(([k, v]) => {
        const safeVal = RAW_HTML_KEYS.has(k) ? v : escHtmlValue(v);
        result = result.split(k).join(safeVal);
    });
    return result;
};

// ─── Variable palette (grouped) ───────────────────────────────────────────────
const VAR_GROUPS = [
    { group: 'Хостел', items: [
        { v: '{{LOGO}}',           d: 'Логотип' },
        { v: '{{HOSTEL_NAME}}',    d: 'Название' },
        { v: '{{HOSTEL_ADDRESS}}', d: 'Адрес' },
        { v: '{{HOSTEL_PHONE}}',   d: 'Телефон' },
    ]},
    { group: 'Гость', items: [
        { v: '{{GUEST_NAME}}', d: 'ФИО' },
        { v: '{{PASSPORT}}',   d: 'Паспорт' },
        { v: '{{BIRTH_DATE}}', d: 'Дата рождения' },
        { v: '{{COUNTRY}}',    d: 'Гражданство' },
        { v: '{{PHONE}}',      d: 'Телефон гостя' },
        { v: '{{PURPOSE}}',    d: 'Цель визита' },
    ]},
    { group: 'Проживание', items: [
        { v: '{{CHECK_IN}}',    d: 'Заезд' },
        { v: '{{CHECK_OUT}}',   d: 'Выезд' },
        { v: '{{DAYS}}',        d: 'Ночей' },
        { v: '{{ROOM_NUMBER}}', d: 'Комната' },
        { v: '{{BED_ID}}',      d: 'Место' },
    ]},
    { group: 'Оплата', items: [
        { v: '{{PRICE_PER_NIGHT}}', d: 'Цена/ночь' },
        { v: '{{TOTAL_PRICE}}',     d: 'Итого' },
        { v: '{{PAID}}',            d: 'Оплачено' },
        { v: '{{DEBT}}',            d: 'Долг' },
        { v: '{{DISCOUNT}}',        d: 'Скидка' },
        { v: '{{TAX}}',             d: 'Налог/комиссия' },
        { v: '{{PAYMENT_METHOD}}',  d: 'Способ оплаты' },
    ]},
    { group: 'Прочее', items: [
        { v: '{{DATE}}',        d: 'Дата и время' },
        { v: '{{STAFF_NAME}}',  d: 'Кассир' },
        { v: '{{REG_NUMBER}}',  d: '№ документа' },
        { v: '{{FOOTER}}',      d: 'Подпись чека' },
        { v: '{{QR}}',          d: 'QR-код' },
    ]},
];

// ─── Insertable snippets ──────────────────────────────────────────────────────
const SNIPPETS = [
    { label: 'Строка',       code: '\n<div class="row"><span>Метка:</span><span>{{TOTAL_PRICE}}</span></div>' },
    { label: 'Разделитель',  code: '\n<hr style="border:none;border-top:1px dashed #ccc;margin:8px 0">' },
    { label: 'Заголовок',    code: '\n<h2>ЗАГОЛОВОК</h2>' },
    { label: 'Подпись',      code: '\n<div class="footer">{{FOOTER}}</div>' },
    { label: 'QR-код',       code: '\n<div class="qr">{{QR}}</div>' },
];

// Paper presets — width of the preview "sheet" in px
const PAPER = [
    { id: '58', label: '58 мм', w: 220 },
    { id: '80', label: '80 мм', w: 320 },
    { id: 'a4', label: 'A4',    w: 794 },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
const TemplateEditorModal = ({ onClose, notify }) => {
    const TEMPLATES_DOC = doc(db, ...PUBLIC_DATA_PATH, 'settings', 'templates');

    const [tab,       setTab      ] = useState('receipt');   // 'receipt' | 'regcard'
    const [viewMode,  setViewMode ] = useState('split');     // 'preview' | 'split' | 'code'
    const [receipt,   setReceipt  ] = useState(DEFAULT_RECEIPT);
    const [regCard,   setRegCard  ] = useState(DEFAULT_REG_CARD);
    const [saving,    setSaving   ] = useState(false);
    const [loading,   setLoading  ] = useState(true);
    const [dirty,     setDirty    ] = useState(false);
    const [search,    setSearch   ] = useState('');
    const [paper,     setPaper    ] = useState('80');
    const [zoom,      setZoom     ] = useState(1);
    const [copied,    setCopied   ] = useState('');
    const [confirmReset, setConfirmReset] = useState(false);
    const textareaRef = useRef();

    // On phones default to preview-only (no room for split)
    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 768) setViewMode('preview');
    }, []);

    // ESC to close
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const template    = tab === 'receipt' ? receipt : regCard;
    const setTemplate = (val) => {
        setDirty(true);
        if (tab === 'receipt') setReceipt(typeof val === 'function' ? val(receipt) : val);
        else setRegCard(typeof val === 'function' ? val(regCard) : val);
    };

    useEffect(() => {
        getDoc(TEMPLATES_DOC)
            .then(snap => {
                if (snap.exists()) {
                    const d = snap.data();
                    if (d.receipt) setReceipt(d.receipt);
                    if (d.regCard) setRegCard(d.regCard);
                }
            })
            .catch(e => notify?.('Ошибка загрузки шаблонов: ' + e.message, 'error'))
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(TEMPLATES_DOC, { receipt, regCard }, { merge: true });
            setDirty(false);
            notify?.('Шаблоны сохранены', 'success');
        } catch (e) {
            notify?.('Ошибка: ' + e.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const doReset = () => {
        setTemplate(tab === 'receipt' ? DEFAULT_RECEIPT : DEFAULT_REG_CARD);
        setConfirmReset(false);
        notify?.('Шаблон сброшен к стандартному', 'info');
    };

    const handlePrintPreview = () => {
        const uid = 'hp-print-' + Date.now();
        const style = document.createElement('style');
        style.id = uid + '-style';
        style.textContent = [
            '@media print {',
            '  body > *:not(#' + uid + ') { display: none !important; }',
            '  #' + uid + ' { display: block !important; }',
            '}',
        ].join('\n');
        const container = document.createElement('div');
        container.id = uid;
        container.style.display = 'none';
        container.innerHTML = applyVars(template);
        document.head.appendChild(style);
        document.body.appendChild(container);
        setTimeout(() => {
            window.print();
            setTimeout(() => { style.remove(); container.remove(); }, 2000);
        }, 150);
    };

    const insertAtCursor = (text) => {
        const el = textareaRef.current;
        if (el && (viewMode === 'code' || viewMode === 'split')) {
            const start = el.selectionStart ?? template.length;
            const end   = el.selectionEnd   ?? template.length;
            const newVal = template.substring(0, start) + text + template.substring(end);
            setTemplate(newVal);
            requestAnimationFrame(() => {
                el.selectionStart = el.selectionEnd = start + text.length;
                el.focus();
            });
        } else {
            setTemplate(t => t + text);
        }
    };

    const copyVar = (v) => {
        insertAtCursor(v);
        setCopied(v);
        setTimeout(() => setCopied(c => (c === v ? '' : c)), 900);
    };

    const handleCopyHtml = async () => {
        try { await navigator.clipboard.writeText(template); notify?.('HTML скопирован', 'success'); }
        catch { notify?.('Не удалось скопировать', 'error'); }
    };

    const handleDownloadHtml = () => {
        const blob = new Blob([template], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tab === 'receipt' ? 'cheque' : 'reg-card'}-template.html`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const preview = useMemo(() => applyVars(template), [template]);
    const paperW = (PAPER.find(p => p.id === paper) || PAPER[1]).w;

    const filteredGroups = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return VAR_GROUPS;
        return VAR_GROUPS
            .map(g => ({ ...g, items: g.items.filter(it => it.v.toLowerCase().includes(q) || it.d.toLowerCase().includes(q)) }))
            .filter(g => g.items.length);
    }, [search]);

    const ToolBtn = ({ active, onClick, children, title }) => (
        <button title={title} onClick={onClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${active ? 'bg-white text-violet-700 shadow-sm' : 'bg-white/15 text-white hover:bg-white/25'}`}>
            {children}
        </button>
    );

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm md:p-4"
            style={{ WebkitAppRegion: 'no-drag' }}>
            <div className="bg-white w-full h-full md:rounded-2xl md:max-w-6xl md:h-[92vh] flex flex-col overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <FileText size={18} className="text-white/80 shrink-0"/>
                        <span className="font-black text-white truncate">Редактор шаблонов</span>
                        {dirty && <span className="text-[10px] font-bold text-amber-200 bg-amber-500/30 px-2 py-0.5 rounded-full shrink-0">не сохранено</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleSave} disabled={saving}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-white rounded-lg text-xs font-black disabled:opacity-60">
                            <Save size={13}/>{saving ? 'Сохр...' : 'Сохранить'}
                        </button>
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full text-white">
                            <X size={15}/>
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-2 px-4 sm:px-6 py-2.5 bg-gradient-to-r from-violet-600/95 to-indigo-600/95 border-t border-white/10 shrink-0 overflow-x-auto scrollbar-hide">
                    {/* Doc tabs */}
                    <div className="flex gap-1 bg-black/15 rounded-xl p-1 shrink-0">
                        {[['receipt','Чек',Receipt],['regcard','Регкарта',Contact]].map(([k, l, Icon]) => (
                            <button key={k} onClick={() => setTab(k)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${tab === k ? 'bg-white text-violet-700 shadow-sm' : 'text-white/80 hover:text-white'}`}>
                                <Icon size={13}/>{l}
                            </button>
                        ))}
                    </div>
                    <div className="w-px h-6 bg-white/20 shrink-0"/>
                    {/* View mode */}
                    <div className="flex gap-1 shrink-0">
                        <ToolBtn active={viewMode==='preview'} onClick={() => setViewMode('preview')} title="Только просмотр"><Eye size={13}/><span className="hidden sm:inline">Просмотр</span></ToolBtn>
                        <ToolBtn active={viewMode==='split'} onClick={() => setViewMode('split')} title="Код + просмотр"><Columns size={13}/><span className="hidden sm:inline">Разделить</span></ToolBtn>
                        <ToolBtn active={viewMode==='code'} onClick={() => setViewMode('code')} title="Только код"><Code2 size={13}/><span className="hidden sm:inline">Код</span></ToolBtn>
                    </div>
                    <div className="w-px h-6 bg-white/20 shrink-0"/>
                    {/* Paper + zoom (preview-related) */}
                    <div className="flex gap-1 shrink-0">
                        {PAPER.map(p => (
                            <ToolBtn key={p.id} active={paper===p.id} onClick={() => setPaper(p.id)} title={`Формат ${p.label}`}>{p.label}</ToolBtn>
                        ))}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <ToolBtn onClick={() => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(2)))} title="Уменьшить"><ZoomOut size={13}/></ToolBtn>
                        <span className="text-[11px] font-bold text-white/90 w-9 text-center">{Math.round(zoom*100)}%</span>
                        <ToolBtn onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(2)))} title="Увеличить"><ZoomIn size={13}/></ToolBtn>
                    </div>
                    <div className="w-px h-6 bg-white/20 shrink-0"/>
                    {/* Actions */}
                    <div className="flex gap-1 shrink-0 ml-auto">
                        <ToolBtn onClick={handlePrintPreview} title="Печать"><Printer size={13}/><span className="hidden lg:inline">Печать</span></ToolBtn>
                        <ToolBtn onClick={handleCopyHtml} title="Копировать HTML"><Copy size={13}/></ToolBtn>
                        <ToolBtn onClick={handleDownloadHtml} title="Скачать .html"><Download size={13}/></ToolBtn>
                        <ToolBtn onClick={() => setConfirmReset(true)} title="Сбросить к стандарту"><RefreshCw size={13}/></ToolBtn>
                    </div>
                </div>

                {/* Body */}
                <div className="flex flex-1 min-h-0">
                    {/* Left: Variables + snippets */}
                    <div className="w-56 shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col">
                        <div className="p-3 border-b border-slate-200">
                            <div className="relative">
                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск переменной…"
                                    className="w-full pl-8 pr-2 py-2 text-xs rounded-lg border border-slate-200 outline-none focus:border-violet-400 bg-white"/>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1.5">Нажмите — вставится в текст</div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-3">
                            {filteredGroups.map(g => (
                                <div key={g.group}>
                                    <div className="text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">{g.group}</div>
                                    <div className="space-y-1">
                                        {g.items.map(({ v, d }) => (
                                            <button key={v} onClick={() => copyVar(v)}
                                                className="w-full text-left px-2 py-1.5 hover:bg-violet-50 rounded-lg transition-colors group flex items-center justify-between gap-1">
                                                <span className="min-w-0">
                                                    <span className="block text-[10px] font-black text-violet-600 font-mono truncate">{v}</span>
                                                    <span className="block text-[10px] text-slate-400 group-hover:text-violet-500 truncate">{d}</span>
                                                </span>
                                                {copied === v
                                                    ? <Check size={13} className="text-emerald-500 shrink-0"/>
                                                    : <Plus size={12} className="text-slate-300 group-hover:text-violet-500 shrink-0"/>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {!filteredGroups.length && <div className="text-xs text-slate-400 text-center py-4">Ничего не найдено</div>}

                            {/* Snippets */}
                            <div>
                                <div className="text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">Блоки</div>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {SNIPPETS.map(s => (
                                        <button key={s.label} onClick={() => insertAtCursor(s.code)}
                                            className="px-2 py-1.5 text-[10px] font-bold text-slate-600 bg-white hover:bg-violet-50 hover:text-violet-700 border border-slate-200 rounded-lg transition-colors">
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: code + preview */}
                    <div className="flex-1 flex min-w-0">
                        {(viewMode === 'code' || viewMode === 'split') && (
                            <textarea
                                ref={textareaRef}
                                className={`${viewMode === 'split' ? 'w-1/2 border-r border-slate-800' : 'w-full'} p-4 font-mono text-xs resize-none outline-none border-none bg-slate-950 text-emerald-300 leading-relaxed`}
                                value={template}
                                onChange={e => setTemplate(e.target.value)}
                                spellCheck={false}
                            />
                        )}
                        {(viewMode === 'preview' || viewMode === 'split') && (
                            <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} bg-slate-100 overflow-auto p-4 flex justify-center`}>
                                <div style={{ width: paperW * zoom, transition: 'width .15s' }} className="shrink-0">
                                    <div style={{ width: paperW, transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
                                        <iframe
                                            key={preview + paperW}
                                            srcDoc={preview}
                                            className="bg-white shadow-xl rounded-sm border-none w-full"
                                            style={{ height: tab === 'receipt' ? 560 : 720 }}
                                            title="preview"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Reset confirm */}
            {confirmReset && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmReset(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center"><RefreshCw size={18} className="text-amber-600"/></div>
                            <div className="font-black text-slate-800">Сбросить шаблон?</div>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">Текущий <b>{tab === 'receipt' ? 'чек' : 'регкарта'}</b> вернётся к стандартному виду. Это действие нельзя отменить.</p>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setConfirmReset(false)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">Отмена</button>
                            <button onClick={doReset} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-amber-500 hover:bg-amber-600">Сбросить</button>
                        </div>
                    </div>
                </div>
            )}

            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"/>
                </div>
            )}
        </div>
    );
};

export default TemplateEditorModal;
export { DEFAULT_RECEIPT, DEFAULT_REG_CARD };
