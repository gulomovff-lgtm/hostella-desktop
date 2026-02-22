import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Save, Printer, Eye, Code2, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../../firebase';

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
</style></head><body>
<div class="logo">{{LOGO}}</div>
<div class="hostel-name">{{HOSTEL_NAME}}</div>
<div class="hostel-info">{{HOSTEL_ADDRESS}} | {{HOSTEL_PHONE}}</div>
<h2>ЧЕК / КВИТАНЦИЯ</h2>
<div class="row"><span>Гость:</span><span>{{GUEST_NAME}}</span></div>
<div class="row"><span>Комната:</span><span>{{ROOM_NUMBER}}</span></div>
<div class="row"><span>Место:</span><span>{{BED_ID}}</span></div>
<div class="row"><span>Заезд:</span><span>{{CHECK_IN}}</span></div>
<div class="row"><span>Выезд:</span><span>{{CHECK_OUT}}</span></div>
<div class="row"><span>Дней:</span><span>{{DAYS}}</span></div>
<div class="row"><span>Цена/ночь:</span><span>{{PRICE_PER_NIGHT}} сум</span></div>
<div class="total"><span>ИТОГО:</span><span>{{TOTAL_PRICE}} сум</span></div>
<div class="row"><span>Оплачено:</span><span>{{PAID}} сум</span></div>
<div class="row"><span>Долг:</span><span>{{DEBT}} сум</span></div>
<div class="footer">{{DATE}} | Кассир: {{STAFF_NAME}}<br>Спасибо за визит!</div>
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
    '{{PRICE_PER_NIGHT}}': '70 000',
    '{{TOTAL_PRICE}}':    '210 000',
    '{{PAID}}':           '200 000',
    '{{DEBT}}':           '10 000',
    '{{ROOM_NUMBER}}':    '102',
    '{{BED_ID}}':         '4',
    '{{DATE}}':           new Date().toLocaleString('ru'),
    '{{STAFF_NAME}}':     'Дилафруз',
    '{{PURPOSE}}':        'Туризм',
};

const applyVars = (html) => {
    let result = html;
    Object.entries(SAMPLE_VARS).forEach(([key, val]) => {
        result = result.split(key).join(val);
    });
    return result;
};

export const applyGuestVars = (html, guest, room, staff, hostelSettings) => {
    const hostelCfg = hostelSettings?.[room?.hostelId || 'hostel1'] || {};
    const totalPaid = (parseInt(guest.paidCash) || 0) + (parseInt(guest.paidCard) || 0) + (parseInt(guest.paidQR) || 0) + (parseInt(guest.amountPaid) || 0);
    const debt      = Math.max(0, (guest.totalPrice || 0) - totalPaid);
    const logoHtml  = hostelCfg.logoUrl ? `<img src="${hostelCfg.logoUrl}" alt="logo"/>` : '';
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
        '{{PRICE_PER_NIGHT}}': (guest.pricePerNight || 0).toLocaleString(),
        '{{TOTAL_PRICE}}':    (guest.totalPrice || 0).toLocaleString(),
        '{{PAID}}':           totalPaid.toLocaleString(),
        '{{DEBT}}':           debt.toLocaleString(),
        '{{ROOM_NUMBER}}':    guest.roomNumber || (room?.number || ''),
        '{{BED_ID}}':         String(guest.bedId || ''),
        '{{DATE}}':           new Date().toLocaleString('ru'),
        '{{STAFF_NAME}}':     staff?.name || '',
        '{{PURPOSE}}':        guest.purpose || '',
    };
    let result = html;
    Object.entries(vars).forEach(([k, v]) => { result = result.split(k).join(v); });
    return result;
};

// ─── Variable Palette ─────────────────────────────────────────────────────────
const VARS_LIST = [
    { v: '{{LOGO}}',           d: 'Логотип хостела' },
    { v: '{{HOSTEL_NAME}}',    d: 'Название хостела' },
    { v: '{{HOSTEL_ADDRESS}}', d: 'Адрес' },
    { v: '{{HOSTEL_PHONE}}',   d: 'Телефон хостела' },
    { v: '{{GUEST_NAME}}',     d: 'ФИО гостя' },
    { v: '{{PASSPORT}}',       d: 'Паспорт' },
    { v: '{{BIRTH_DATE}}',     d: 'Дата рождения' },
    { v: '{{COUNTRY}}',        d: 'Гражданство' },
    { v: '{{PHONE}}',          d: 'Телефон' },
    { v: '{{CHECK_IN}}',       d: 'Дата заезда' },
    { v: '{{CHECK_OUT}}',      d: 'Дата выезда' },
    { v: '{{DAYS}}',           d: 'Дней' },
    { v: '{{PRICE_PER_NIGHT}}',d: 'Цена/ночь' },
    { v: '{{TOTAL_PRICE}}',    d: 'Итого' },
    { v: '{{PAID}}',           d: 'Оплачено' },
    { v: '{{DEBT}}',           d: 'Долг' },
    { v: '{{ROOM_NUMBER}}',    d: 'Номер комнаты' },
    { v: '{{BED_ID}}',         d: 'Место' },
    { v: '{{DATE}}',           d: 'Дата и время' },
    { v: '{{STAFF_NAME}}',     d: 'Имя кассира' },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
const TemplateEditorModal = ({ onClose, notify }) => {
    const TEMPLATES_DOC = doc(db, ...PUBLIC_DATA_PATH, 'settings', 'templates');

    const [tab,       setTab      ] = useState('receipt');  // 'receipt' | 'regcard'
    const [viewMode,  setViewMode ] = useState('preview');  // 'preview' | 'code'
    const [receipt,   setReceipt  ] = useState(DEFAULT_RECEIPT);
    const [regCard,   setRegCard  ] = useState(DEFAULT_REG_CARD);
    const [saving,    setSaving   ] = useState(false);
    const [loading,   setLoading  ] = useState(true);
    const iframeRef  = useRef();
    const textareaRef = useRef();

    // ESC to close
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const template    = tab === 'receipt' ? receipt : regCard;
    const setTemplate = tab === 'receipt' ? setReceipt : setRegCard;

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
            notify?.('Шаблоны сохранены', 'success');
        } catch (e) {
            notify?.('Ошибка: ' + e.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        if (window.confirm('Сбросить шаблон до значений по умолчанию?')) {
            setTemplate(tab === 'receipt' ? DEFAULT_RECEIPT : DEFAULT_REG_CARD);
        }
    };

    const handlePrintPreview = () => {
        // Inject print container + @media print style, then window.print()
        // This approach works reliably in both Electron and browser
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
            setTimeout(() => {
                style.remove();
                container.remove();
            }, 2000);
        }, 150);
    };

    const insertVar = (v) => {
        const el = textareaRef.current;
        if (el && viewMode === 'code') {
            const start = el.selectionStart ?? template.length;
            const end   = el.selectionEnd   ?? template.length;
            const newVal = template.substring(0, start) + v + template.substring(end);
            setTemplate(newVal);
            requestAnimationFrame(() => {
                el.selectionStart = el.selectionEnd = start + v.length;
                el.focus();
            });
        } else {
            setTemplate(t => t + v);
        }
    };

    const preview = applyVars(template);

    return (
        <div className="fixed inset-0 z-50 flex items-stretch bg-slate-900/70 backdrop-blur-sm"
            style={{ WebkitAppRegion: 'no-drag' }}>
            <div className="bg-white w-full flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-gradient-to-r from-violet-600 to-indigo-600 shrink-0">
                    <div className="flex items-center gap-3">
                        <FileText size={18} className="text-white/80"/>
                        <span className="font-black text-white">Редактор шаблонов</span>
                        <div className="flex gap-1 ml-2">
                            {[['receipt','Чек'],['regcard','Регкарта']].map(([k, l]) => (
                                <button key={k} onClick={() => setTab(k)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${tab === k ? 'bg-white text-violet-700' : 'bg-white/20 text-white hover:bg-white/30'}`}>
                                    {l}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setViewMode(v => v === 'preview' ? 'code' : 'preview')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold">
                            {viewMode === 'preview' ? <Code2 size={13}/> : <Eye size={13}/>}
                            {viewMode === 'preview' ? 'Код' : 'Просмотр'}
                        </button>
                        <button onClick={handlePrintPreview}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold">
                            <Printer size={13}/> Печать
                        </button>
                        <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold">
                            <RefreshCw size={13}/> Сброс
                        </button>
                        <button onClick={handleSave} disabled={saving}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-white rounded-lg text-xs font-black">
                            <Save size={13}/>
                            {saving ? 'Сохр...' : 'Сохранить'}
                        </button>
                        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full text-white ml-1">
                            <X size={14}/>
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex flex-1 min-h-0">
                    {/* Left: Variables */}
                    <div className="w-52 shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto p-3">
                        <div className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-wider">Переменные</div>
                        <div className="space-y-1">
                            {VARS_LIST.map(({ v, d }) => (
                                <button key={v} onClick={() => insertVar(v)}
                                    className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors group">
                                    <div className="text-[10px] font-black text-indigo-600 font-mono">{v}</div>
                                    <div className="text-[10px] text-slate-400 group-hover:text-indigo-500">{d}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right: Code/Preview pane */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {viewMode === 'code' ? (
                            <textarea
                                ref={textareaRef}
                                className="flex-1 p-4 font-mono text-xs text-slate-800 resize-none outline-none border-none bg-slate-950 text-green-300 leading-relaxed"
                                value={template}
                                onChange={e => setTemplate(e.target.value)}
                                spellCheck={false}
                            />
                        ) : (
                            <iframe
                                ref={iframeRef}
                                key={preview}
                                srcDoc={preview}
                                className="flex-1 border-none bg-white"
                                title="preview"
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TemplateEditorModal;
export { DEFAULT_RECEIPT, DEFAULT_REG_CARD };
