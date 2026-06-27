import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, Printer, FileText, Users, Search, GripVertical, Coffee, Sparkles } from 'lucide-react';
import { printGroupReceipt, RECEIPT_TITLES } from '../../utils/groupReceipt';
import DatePicker from '../UI/DatePicker';

const BRAND = '#0f9688';
const emptyRow = () => ({ fullName: '', passport: '', days: '' });
const uid = () => Math.random().toString(36).slice(2, 9);
const HOSTELS = [
    { id: 'hostel1', label: 'Хостел №1 · Сабирова Ш. Б.' },
    { id: 'hostel2', label: 'Хостел №2 · Юлдашев А. И.' },
];
const SERVICE_PRESETS = {
    ru: ['Завтрак', 'Стирка', 'Уборка', 'Трансфер', 'Прачечная', 'Аренда'],
    uz: ['Nonushta', 'Kir yuvish', 'Tozalash', 'Transfer', 'Kirxona', 'Ijara'],
};
const daysBetween = (from, to) => {
    if (!from || !to) return 0;
    const d = Math.round((new Date(to) - new Date(from)) / 86400000);
    return d > 0 ? d : 0;
};
const norm = (s) => (s || '').replace(/\s/g, '').toUpperCase();

const GroupReceiptModal = ({ open, onClose, defaultHostelId = 'hostel1', activeGuests = [] }) => {
    const [hostelId, setHostelId] = useState(defaultHostelId);
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [periodFrom, setPeriodFrom] = useState('');
    const [periodTo, setPeriodTo] = useState('');
    const [defaultDays, setDefaultDays] = useState('');
    const [rate, setRate] = useState('');
    const [rows, setRows] = useState([emptyRow()]);

    // Заголовок документа и язык печати (RU/UZ)
    const [lang, setLang] = useState('ru');
    const [title, setTitle] = useState(RECEIPT_TITLES.ru);
    const switchLang = (l) => {
        // Авто-перевод заголовка-по-умолчанию; кастомный заголовок не трогаем
        setTitle(t => (!t.trim() || t === RECEIPT_TITLES.ru || t === RECEIPT_TITLES.uz) ? RECEIPT_TITLES[l] : t);
        setLang(l);
    };

    // Доп. услуги (произвольные цены)
    const [services, setServices] = useState([]);
    // Произвольные текстовые блоки (с перетаскиванием)
    const [blocks, setBlocks] = useState([]);
    const [dragIdx, setDragIdx] = useState(null);

    // Пикер «из проживающих»
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerSearch, setPickerSearch] = useState('');
    const [picked, setPicked] = useState(() => new Set());

    const rateNum = Number(rate) || 0;
    const sumOf = (r) => (Number(r.days) || 0) * rateNum;
    const stayTotal = useMemo(() => rows.reduce((s, r) => s + sumOf(r), 0), [rows, rateNum]);
    const svcSum = (s) => (Number(s.qty) > 0 ? Number(s.qty) : 1) * (Number(s.price) || 0);
    const servicesTotal = useMemo(() => services.reduce((acc, x) => acc + svcSum(x), 0), [services]);
    const grandTotal = stayTotal + servicesTotal;
    const filled = rows.filter(r => (r.fullName || '').trim());

    // Ключи уже добавленных гостей — чтобы не дублировать в пикере
    const addedKeys = useMemo(() => {
        const s = new Set();
        rows.forEach(r => { if (r.passport) s.add('p:' + norm(r.passport)); if (r.fullName) s.add('n:' + norm(r.fullName)); });
        return s;
    }, [rows]);

    // Активные гости, сгруппированные по комнатам
    const guestsByRoom = useMemo(() => {
        const q = pickerSearch.trim().toLowerCase();
        const list = activeGuests.filter(g =>
            !q ||
            (g.fullName || '').toLowerCase().includes(q) ||
            (g.passport || '').toLowerCase().includes(q) ||
            String(g.roomNumber || '').includes(q)
        );
        const groups = {};
        for (const g of list) {
            const key = g.roomNumber || g.roomId || '—';
            if (!groups[key]) groups[key] = [];
            groups[key].push(g);
        }
        return Object.entries(groups)
            .map(([room, gs]) => ({ room, guests: gs }))
            .sort((a, b) => {
                const an = parseInt(a.room, 10), bn = parseInt(b.room, 10);
                return (isNaN(an) ? Infinity : an) - (isNaN(bn) ? Infinity : bn);
            });
    }, [activeGuests, pickerSearch]);

    if (!open) return null;

    // ── Строки гостей ──
    const upd = (i, k, v) => setRows(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
    const addRow = () => setRows(r => r.length >= 20 ? r : [...r, emptyRow()]);
    const delRow = (i) => setRows(r => r.length === 1 ? [emptyRow()] : r.filter((_, idx) => idx !== i));
    const applyDaysToAll = (d) => setRows(r => r.map(row => ({ ...row, days: d === '' ? '' : String(d) })));

    const onPeriod = (from, to) => {
        const d = daysBetween(from || periodFrom, to || periodTo);
        if (d > 0) { setDefaultDays(String(d)); applyDaysToAll(d); }
    };
    const onDefaultDays = (v) => { setDefaultDays(v); applyDaysToAll(v); };

    // ── Пикер «из проживающих» ──
    const isGuestAdded = (g) => addedKeys.has('p:' + norm(g.passport)) || addedKeys.has('n:' + norm(g.fullName));
    const togglePick = (id) => setPicked(s => {
        const next = new Set(s);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });
    const addPicked = () => {
        const toAdd = activeGuests.filter(g => picked.has(String(g.id)) && !isGuestAdded(g));
        if (toAdd.length) {
            setRows(r => {
                const base = r.filter(x => x.fullName.trim());
                const extra = toAdd.map(g => ({
                    fullName: g.fullName || '',
                    passport: g.passport || '',
                    days: defaultDays || String(g.days || ''),
                }));
                return [...base, ...extra].slice(0, 20);
            });
        }
        setPicked(new Set());
        setPickerSearch('');
        setPickerOpen(false);
    };

    // ── Доп. услуги ──
    const addService = (name = '') => setServices(s => [...s, { name, qty: '1', price: '' }]);
    const updService = (i, k, v) => setServices(s => s.map((x, idx) => idx === i ? { ...x, [k]: v } : x));
    const delService = (i) => setServices(s => s.filter((_, idx) => idx !== i));

    // ── Текстовые блоки (drag-reorder) ──
    const addBlock = (text = '') => setBlocks(b => [...b, { id: uid(), text }]);
    const updBlock = (id, text) => setBlocks(b => b.map(x => x.id === id ? { ...x, text } : x));
    const delBlock = (id) => setBlocks(b => b.filter(x => x.id !== id));
    const onBlockDrop = (i) => {
        setBlocks(b => {
            if (dragIdx === null || dragIdx === i) return b;
            const next = [...b];
            const [moved] = next.splice(dragIdx, 1);
            next.splice(i, 0, moved);
            return next;
        });
        setDragIdx(null);
    };
    const addAutoBlock = () => {
        const n = filled.length;
        const money = (v) => v.toLocaleString('ru-RU');
        const fmtLoc = (d) => d ? new Date(d).toLocaleDateString(lang === 'uz' ? 'uz-UZ' : 'ru-RU') : '';
        const qOf = (s) => Number(s.qty) > 0 ? Number(s.qty) : 1;
        const svc = services.filter(s => (s.name || '').trim() && Number(s.price) > 0);
        let text;
        if (lang === 'uz') {
            const per = (periodFrom && periodTo) ? ` ${fmtLoc(periodFrom)} – ${fmtLoc(periodTo)} davrida` : '';
            const svcLine = svc.length ? ` Qo‘shimcha xizmatlar: ${svc.map(s => `${s.name} ×${qOf(s)} — ${money(svcSum(s))} so‘m`).join(', ')}.` : '';
            text = `Ushbu hujjat ${n} kishidan iborat guruhning${per} yashaganini tasdiqlaydi.${svcLine} Jami to‘lov summasi: ${money(grandTotal)} so‘m.`;
        } else {
            const per = (periodFrom && periodTo) ? ` в период с ${fmtLoc(periodFrom)} по ${fmtLoc(periodTo)}` : '';
            const svcLine = svc.length ? ` Дополнительные услуги: ${svc.map(s => `${s.name} ×${qOf(s)} — ${money(svcSum(s))} сум`).join(', ')}.` : '';
            text = `Настоящим подтверждается проживание группы из ${n} чел.${per}.${svcLine} Общая сумма к оплате: ${money(grandTotal)} сум.`;
        }
        addBlock(text);
    };

    const doPrint = () => {
        const list = filled.map(r => ({
            fullName: r.fullName.trim(),
            passport: r.passport.trim(),
            days: r.days,
            totalPrice: sumOf(r),
        }));
        if (!list.length) return;
        printGroupReceipt(list, hostelId, {
            date, periodFrom, periodTo, rate: rateNum,
            title: title.trim() || RECEIPT_TITLES[lang], lang,
            services: services.filter(s => (s.name || '').trim() && Number(s.price) > 0)
                .map(s => ({ name: s.name.trim(), qty: Number(s.qty) > 0 ? Number(s.qty) : 1, price: Number(s.price) || 0 })),
            blocks: blocks.map(b => (b.text || '').trim()).filter(Boolean),
        });
    };

    const inp = 'w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500';
    const lbl = 'text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1 block';
    const sectionTitle = 'text-xs font-black text-slate-500 uppercase tracking-wide';

    return (
        <div className="fixed inset-0 z-[200] flex items-stretch sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4">
            <div className="relative bg-white w-full sm:max-w-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-screen sm:max-h-[94vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(15,150,136,0.12)' }}><FileText size={18} style={{ color: BRAND }}/></div>
                        <div>
                            <div className="font-black text-slate-800">Лист в бухгалтерию</div>
                            <div className="text-xs text-slate-400">Список группы, доп. услуги и текст</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={18}/></button>
                </div>

                {/* Controls */}
                <div className="px-5 py-3 border-b border-slate-100 shrink-0 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={lbl}>Хостел / реквизиты</label>
                            <select className={inp} value={hostelId} onChange={e => setHostelId(e.target.value)}>
                                {HOSTELS.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>Дата документа</label>
                            <DatePicker value={date} onChange={setDate} className={inp} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                        <div>
                            <label className={lbl}>Заголовок документа</label>
                            <input className={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder={RECEIPT_TITLES[lang]} />
                        </div>
                        <div>
                            <label className={lbl}>Язык документа</label>
                            <div className="flex rounded-lg overflow-hidden border border-slate-200 w-fit">
                                {[['ru', 'RU'], ['uz', 'UZ']].map(([l, t]) => (
                                    <button key={l} type="button" onClick={() => switchLang(l)}
                                        className={`px-5 py-1.5 text-sm font-bold transition-colors ${lang === l ? 'text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                                        style={lang === l ? { background: BRAND } : undefined}>
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                            <label className={lbl}>Проживали с</label>
                            <DatePicker value={periodFrom} onChange={v => { setPeriodFrom(v); onPeriod(v, periodTo); }} className={inp} placeholder="дата" />
                        </div>
                        <div>
                            <label className={lbl}>по</label>
                            <DatePicker value={periodTo} onChange={v => { setPeriodTo(v); onPeriod(periodFrom, v); }} className={inp} placeholder="дата" />
                        </div>
                        <div>
                            <label className={lbl}>Дней (всем)</label>
                            <input className={inp + ' text-center'} type="number" min="1" value={defaultDays} onChange={e => onDefaultDays(e.target.value)} placeholder="напр. 2"/>
                        </div>
                        <div>
                            <label className={lbl}>Ставка, сум/ночь</label>
                            <input className={inp + ' text-right'} type="number" min="0" value={rate} onChange={e => setRate(e.target.value)} placeholder="напр. 50000"/>
                        </div>
                    </div>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-5 py-3 space-y-5">
                    {/* ── Гости ── */}
                    <div>
                        <div className="hidden sm:grid grid-cols-[26px_1fr_150px_64px_120px_26px] gap-2 px-1 pb-1 text-[10px] font-black text-slate-400 uppercase">
                            <span className="text-center">№</span><span>Ф.И.О.</span><span>Паспорт</span><span className="text-center">Дней</span><span className="text-right">Сумма</span><span/>
                        </div>
                        <div className="space-y-2">
                            {rows.map((r, i) => (
                                <div key={i} className="grid grid-cols-[26px_1fr_64px_26px] sm:grid-cols-[26px_1fr_150px_64px_120px_26px] gap-2 items-center">
                                    <span className="text-center text-xs font-black text-slate-400">{i + 1}</span>
                                    <input className={inp} placeholder="Фамилия Имя Отчество" value={r.fullName} onChange={e => upd(i, 'fullName', e.target.value.toUpperCase())}/>
                                    <input className={`${inp} hidden sm:block`} placeholder="Паспорт" value={r.passport} onChange={e => upd(i, 'passport', e.target.value.toUpperCase())}/>
                                    <input className={inp + ' text-center'} type="number" min="1" placeholder="дн." value={r.days} onChange={e => upd(i, 'days', e.target.value)}/>
                                    <div className="hidden sm:block text-right text-sm font-bold text-slate-700 tabular-nums">{sumOf(r) ? sumOf(r).toLocaleString('ru-RU') : '—'}</div>
                                    <button onClick={() => delRow(i)} className="text-slate-300 hover:text-rose-500 flex justify-center"><Trash2 size={15}/></button>
                                    <div className="col-span-4 sm:hidden grid grid-cols-2 gap-2 -mt-1 items-center">
                                        <input className={inp} placeholder="Паспорт" value={r.passport} onChange={e => upd(i, 'passport', e.target.value.toUpperCase())}/>
                                        <div className="text-right text-sm font-bold text-slate-700 tabular-nums">{sumOf(r) ? sumOf(r).toLocaleString('ru-RU') + ' сум' : '—'}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                            <button onClick={addRow} disabled={rows.length >= 20}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                                <Plus size={15}/> Строка
                            </button>
                            {activeGuests.length > 0 && (
                                <button onClick={() => setPickerOpen(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100">
                                    <Users size={15}/> Из проживающих
                                </button>
                            )}
                            <div className="ml-auto text-sm"><span className="text-slate-400">Проживание:</span> <b className="text-slate-800">{stayTotal.toLocaleString('ru-RU')} сум</b> <span className="text-slate-400">· {filled.length} чел.</span></div>
                        </div>
                    </div>

                    {/* ── Доп. услуги ── */}
                    <div className="border-t border-slate-100 pt-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className={sectionTitle}>Доп. услуги</span>
                            {servicesTotal > 0 && <span className="text-sm font-bold text-slate-700">{servicesTotal.toLocaleString('ru-RU')} сум</span>}
                        </div>
                        {services.length > 0 && (
                            <div className="space-y-2 mb-2">
                                <div className="grid grid-cols-[1fr_48px_92px_84px_24px] gap-1.5 px-1 text-[10px] font-black text-slate-400 uppercase">
                                    <span>Услуга</span><span className="text-center">Кол</span><span className="text-right">Цена</span><span className="text-right">Сумма</span><span/>
                                </div>
                                {services.map((s, i) => (
                                    <div key={i} className="grid grid-cols-[1fr_48px_92px_84px_24px] gap-1.5 items-center">
                                        <input className={inp} placeholder="Услуга (напр. Завтрак)" value={s.name} onChange={e => updService(i, 'name', e.target.value)}/>
                                        <input className={inp + ' text-center px-1'} type="number" min="1" placeholder="1" value={s.qty} onChange={e => updService(i, 'qty', e.target.value)}/>
                                        <input className={inp + ' text-right'} type="number" min="0" placeholder="Цена" value={s.price} onChange={e => updService(i, 'price', e.target.value)}/>
                                        <div className="text-right text-sm font-bold text-slate-700 tabular-nums">{svcSum(s) ? svcSum(s).toLocaleString('ru-RU') : '—'}</div>
                                        <button onClick={() => delService(i)} className="text-slate-300 hover:text-rose-500 flex justify-center"><Trash2 size={15}/></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <button onClick={() => addService('')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50">
                                <Plus size={15}/> Услуга
                            </button>
                            {(SERVICE_PRESETS[lang] || SERVICE_PRESETS.ru).map(p => (
                                <button key={p} onClick={() => addService(p)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50">
                                    <Coffee size={12}/> {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Доп. текст / описание ── */}
                    <div className="border-t border-slate-100 pt-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className={sectionTitle}>Доп. текст / описание</span>
                            <span className="text-[10px] text-slate-400">перетаскивай за <GripVertical size={11} className="inline -mt-0.5"/> для порядка</span>
                        </div>
                        {blocks.length > 0 && (
                            <div className="space-y-2 mb-2">
                                {blocks.map((b, i) => (
                                    <div key={b.id}
                                        onDragOver={e => { e.preventDefault(); }}
                                        onDrop={() => onBlockDrop(i)}
                                        className={`flex gap-2 items-start rounded-lg ${dragIdx === i ? 'opacity-50' : ''}`}>
                                        <span draggable
                                            onDragStart={() => setDragIdx(i)}
                                            onDragEnd={() => setDragIdx(null)}
                                            className="mt-2 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 shrink-0">
                                            <GripVertical size={16}/>
                                        </span>
                                        <textarea className={inp + ' min-h-[58px] resize-y leading-snug'} rows={2}
                                            placeholder="Произвольный текст для документа…"
                                            value={b.text} onChange={e => updBlock(b.id, e.target.value)}/>
                                        <button onClick={() => delBlock(b.id)} className="mt-2 text-slate-300 hover:text-rose-500 shrink-0"><Trash2 size={15}/></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <button onClick={() => addBlock('')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50">
                                <Plus size={15}/> Блок
                            </button>
                            <button onClick={addAutoBlock}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100">
                                <Sparkles size={14}/> Авто-описание
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100 shrink-0">
                    <div className="text-sm mr-auto">
                        <span className="text-slate-400">Итого:</span> <b className="text-slate-800 text-base">{grandTotal.toLocaleString('ru-RU')} сум</b>
                        {servicesTotal > 0 && <span className="text-slate-400 text-xs"> (прож. {stayTotal.toLocaleString('ru-RU')} + услуги {servicesTotal.toLocaleString('ru-RU')})</span>}
                    </div>
                    <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50">Закрыть</button>
                    <button onClick={doPrint} disabled={!filled.length}
                        className="px-5 py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40" style={{ background: BRAND }}>
                        <Printer size={16}/> Печать листа
                    </button>
                </div>

                {/* ── Пикер: из проживающих по комнатам ── */}
                {pickerOpen && (
                    <div className="absolute inset-0 z-10 bg-white sm:rounded-2xl flex flex-col">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                            <div className="font-black text-slate-800 flex items-center gap-2"><Users size={18} style={{ color: BRAND }}/> Из проживающих</div>
                            <button onClick={() => { setPickerOpen(false); setPicked(new Set()); setPickerSearch(''); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={18}/></button>
                        </div>
                        <div className="px-5 py-3 border-b border-slate-100 shrink-0">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input className={inp + ' pl-8'} placeholder="Поиск по имени, паспорту, комнате…" value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}/>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
                            {guestsByRoom.length === 0 ? (
                                <div className="py-12 text-center text-slate-400">
                                    <Users size={36} className="mx-auto mb-2 opacity-30"/>
                                    <p className="text-sm font-semibold">Нет проживающих</p>
                                </div>
                            ) : guestsByRoom.map(group => (
                                <div key={group.room} className="space-y-1.5">
                                    <div className="text-xs font-black text-slate-500 uppercase tracking-wide">Комната {group.room} <span className="text-slate-300 font-normal">· {group.guests.length}</span></div>
                                    <div className="grid gap-1.5">
                                        {group.guests.map(g => {
                                            const added = isGuestAdded(g);
                                            const sel = picked.has(String(g.id));
                                            return (
                                                <button key={g.id} type="button" disabled={added}
                                                    onClick={() => togglePick(String(g.id))}
                                                    className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl border transition-colors ${added ? 'border-slate-100 bg-slate-50 opacity-60 cursor-default' : sel ? 'border-teal-400 bg-teal-50' : 'border-slate-200 hover:border-teal-300 hover:bg-teal-50/50'}`}>
                                                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${sel ? 'bg-teal-500 border-teal-500 text-white' : 'border-slate-300'}`}>{sel ? '✓' : ''}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-slate-800 truncate">{g.fullName}</p>
                                                        <p className="text-[11px] text-slate-400 truncate">{g.passport || '—'}{g.country ? ` · ${g.country}` : ''}</p>
                                                    </div>
                                                    {added && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 border border-slate-200 shrink-0">в списке</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 px-5 py-4 border-t border-slate-100 shrink-0">
                            <button onClick={() => { setPickerOpen(false); setPicked(new Set()); setPickerSearch(''); }} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50">Отмена</button>
                            <button onClick={addPicked} disabled={picked.size === 0}
                                className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40" style={{ background: BRAND }}>
                                <Plus size={16}/> Добавить выбранных ({picked.size})
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GroupReceiptModal;
