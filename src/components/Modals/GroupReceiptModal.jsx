import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, Printer, FileText } from 'lucide-react';
import { printGroupReceipt } from '../../utils/groupReceipt';
import DatePicker from '../UI/DatePicker';

const BRAND = '#0f9688';
const emptyRow = () => ({ fullName: '', passport: '', days: '' });
const HOSTELS = [
    { id: 'hostel1', label: 'Хостел №1 · Сабирова Ш. Б.' },
    { id: 'hostel2', label: 'Хостел №2 · Юлдашев А. И.' },
];
const daysBetween = (from, to) => {
    if (!from || !to) return 0;
    const d = Math.round((new Date(to) - new Date(from)) / 86400000);
    return d > 0 ? d : 0;
};

const GroupReceiptModal = ({ open, onClose, defaultHostelId = 'hostel1', activeGuests = [] }) => {
    const [hostelId, setHostelId] = useState(defaultHostelId);
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [periodFrom, setPeriodFrom] = useState('');
    const [periodTo, setPeriodTo] = useState('');
    const [defaultDays, setDefaultDays] = useState('');
    const [rate, setRate] = useState('');
    const [rows, setRows] = useState([emptyRow()]);
    const [addId, setAddId] = useState('');

    const rateNum = Number(rate) || 0;
    const sumOf = (r) => (Number(r.days) || 0) * rateNum;
    const total = useMemo(() => rows.reduce((s, r) => s + sumOf(r), 0), [rows, rateNum]);
    const filled = rows.filter(r => (r.fullName || '').trim());

    if (!open) return null;

    const upd = (i, k, v) => setRows(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
    const addRow = () => setRows(r => r.length >= 20 ? r : [...r, emptyRow()]);
    const delRow = (i) => setRows(r => r.length === 1 ? [emptyRow()] : r.filter((_, idx) => idx !== i));
    const applyDaysToAll = (d) => setRows(r => r.map(row => ({ ...row, days: d === '' ? '' : String(d) })));

    // Период → дни → проставить всем
    const onPeriod = (from, to) => {
        const d = daysBetween(from || periodFrom, to || periodTo);
        if (d > 0) { setDefaultDays(String(d)); applyDaysToAll(d); }
    };
    const onDefaultDays = (v) => { setDefaultDays(v); applyDaysToAll(v); };

    // Добавить одного активного гостя (а не всех)
    const addGuest = (id) => {
        if (!id) return;
        const g = activeGuests.find(x => String(x.id) === String(id));
        if (!g) return;
        const row = { fullName: g.fullName || '', passport: g.passport || '', days: defaultDays || String(g.days || '') };
        setRows(r => {
            const base = r.filter(x => x.fullName.trim());
            return [...base, row].slice(0, 20);
        });
        setAddId('');
    };

    const doPrint = () => {
        const list = filled.map(r => ({
            fullName: r.fullName.trim(),
            passport: r.passport.trim(),
            days: r.days,
            totalPrice: sumOf(r),
        }));
        if (!list.length) return;
        printGroupReceipt(list, hostelId, { date, periodFrom, periodTo, rate: rateNum });
    };

    const inp = 'w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500';
    const lbl = 'text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1 block';

    return (
        <div className="fixed inset-0 z-[200] flex items-stretch sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4">
            <div className="bg-white w-full sm:max-w-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-screen sm:max-h-[94vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(15,150,136,0.12)' }}><FileText size={18} style={{ color: BRAND }}/></div>
                        <div>
                            <div className="font-black text-slate-800">Лист в бухгалтерию</div>
                            <div className="text-xs text-slate-400">Список группы (до 20 чел.)</div>
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

                {/* Rows */}
                <div className="flex-1 overflow-y-auto px-5 py-3">
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
                            <select value={addId} onChange={e => addGuest(e.target.value)}
                                className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-slate-200 text-slate-600 bg-white max-w-[220px]">
                                <option value="">+ Добавить гостя…</option>
                                {activeGuests.map(g => <option key={g.id} value={g.id}>{g.fullName}{g.roomNumber ? ` · к.${g.roomNumber}` : ''}</option>)}
                            </select>
                        )}
                        <div className="ml-auto text-sm"><span className="text-slate-400">Итого:</span> <b className="text-slate-800">{total.toLocaleString('ru-RU')} сум</b> <span className="text-slate-400">· {filled.length} чел.</span></div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-5 py-4 border-t border-slate-100 shrink-0">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50">Закрыть</button>
                    <button onClick={doPrint} disabled={!filled.length}
                        className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40" style={{ background: BRAND }}>
                        <Printer size={16}/> Печать листа
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GroupReceiptModal;
