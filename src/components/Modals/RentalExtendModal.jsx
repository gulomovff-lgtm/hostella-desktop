import React, { useState, useMemo } from 'react';
import {
    X, Plus, Minus, DollarSign, CreditCard, QrCode, Magnet,
    RefreshCw, LogOut, Receipt, CalendarDays, BedDouble, CheckCircle2,
    ChevronRight, AlertTriangle,
} from 'lucide-react';

const STYLE = `
@keyframes pos-in {
  from { opacity:0; transform:translateY(24px) scale(0.97); }
  to   { opacity:1; transform:translateY(0)    scale(1);    }
}
.pos-modal { animation: pos-in 0.2s cubic-bezier(0.22,1,0.36,1) both; }
.pos-input-ext {
  width:100%;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.pos-input-ext:focus {
  border-color: #0f9688;
  box-shadow: 0 0 0 3px rgba(15,150,136,0.12);
}
.receipt-divider-ext {
  border: none;
  border-top: 2px dashed #e2e8f0;
  margin: 0;
}
`;

const Section = ({ icon: Icon, title, right }) => (
    <div className="flex items-center justify-between py-2" style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#94a3b8' }}>
        <span className="flex items-center gap-1.5">
            {Icon && <Icon size={11} />}
            {title}
        </span>
        {right && <span>{right}</span>}
    </div>
);

const PayRow = ({ icon: Icon, label, value, onChange, onMagnet, accent }) => (
    <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
            <Icon size={13} className="text-white" />
        </div>
        <span className="w-12 shrink-0" style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>{label}</span>
        <div className="relative flex-1">
            <input
                type="number"
                className="pos-input-ext pr-9 text-right"
                placeholder="0"
                value={value}
                onChange={e => onChange(e.target.value)}
            />
            <button
                type="button"
                onClick={onMagnet}
                title="Заполнить остаток"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-teal-500 transition-colors"
            >
                <Magnet size={13} />
            </button>
        </div>
        {parseInt(value) > 0 && <span className="text-teal-600 font-black w-5" style={{ fontSize: 11 }}>✓</span>}
    </div>
);

const RentalExtendModal = ({ room, onClose, onExtend, onEndRental, notify, currentUser, guests = [] }) => {
    const rental = room?.rental;
    const [tab, setTab] = useState('extend');

    const [extDays, setExtDays] = useState(1);
    const [extCash, setExtCash] = useState('');
    const [extCard, setExtCard] = useState('');
    const [extQR,   setExtQR  ] = useState('');

    const [evCash, setEvCash] = useState('');
    const [evCard, setEvCard] = useState('');
    const [evQR,   setEvQR  ] = useState('');

    const [extCharge,     setExtCharge]     = useState('');   // сумма доплаты (ручной ввод)
    const [chargeTouched, setChargeTouched] = useState(false);

    const [busy, setBusy] = useState(false);

    const pricePerDay = parseInt(rental?.pricePerDay) || 0;

    // Авто-сумма = цена×дни, но кассир может изменить (важно для аренд без цены за сутки)
    const autoCharge = pricePerDay * extDays;
    const extCost = chargeTouched ? (parseInt(extCharge) || 0) : autoCharge;
    const chargeDisplay = chargeTouched
        ? (extCharge ? Number(extCharge).toLocaleString('ru-RU') : '')
        : (autoCharge ? autoCharge.toLocaleString('ru-RU') : '');
    const extPaid = (parseInt(extCash) || 0) + (parseInt(extCard) || 0) + (parseInt(extQR) || 0);

    const newCheckOut = useMemo(() => {
        const base = rental?.checkOutStr || rental?.checkOutDate?.slice(0, 10);
        if (!base) return '';
        const d = new Date(base + 'T12:00:00');
        d.setDate(d.getDate() + extDays);
        return d.toISOString().split('T')[0];
    }, [rental, extDays]);

    // Гости/брони которые конфликтуют с продлением
    const extConflicts = useMemo(() => {
        if (!newCheckOut || !rental?.checkOutDate) return [];
        const extStart = new Date(rental.checkOutDate);
        const extEnd   = new Date(newCheckOut + 'T12:00:00');
        return guests.filter(g => {
            if (g.roomId !== room?.id) return false;
            if (g.status === 'checked_out') return false;
            const ci = g.checkInDate ? new Date(g.checkInDate) : null;
            const co = g.checkOutDate ? new Date(g.checkOutDate) : null;
            if (!ci) return false;
            return ci < extEnd && (co ? co > extStart : true);
        });
    }, [guests, room?.id, rental?.checkOutDate, newCheckOut]);

    const newDays  = (rental?.days || 0) + extDays;
    const newTotal = (rental?.totalAmount || 0) + extCost;
    const newDebt  = Math.max(0, newTotal
        - (rental?.paidCash || 0) - (rental?.paidCard || 0) - (rental?.paidQR || 0)
        - extPaid);

    const applyExtMagnet = (field) => {
        const others = (field !== 'extCash' ? (parseInt(extCash) || 0) : 0)
                     + (field !== 'extCard' ? (parseInt(extCard) || 0) : 0)
                     + (field !== 'extQR'   ? (parseInt(extQR)   || 0) : 0);
        const rem = Math.max(0, extCost - others);
        if (field === 'extCash') setExtCash(String(rem));
        if (field === 'extCard') setExtCard(String(rem));
        if (field === 'extQR')   setExtQR(String(rem));
    };

    const existingDebt = Math.max(0,
        (rental?.totalAmount || 0)
        - (rental?.paidCash || 0) - (rental?.paidCard || 0) - (rental?.paidQR || 0)
    );
    const evPaid = (parseInt(evCash) || 0) + (parseInt(evCard) || 0) + (parseInt(evQR) || 0);
    const evDebt = Math.max(0, existingDebt - evPaid);

    const applyEvMagnet = (field) => {
        const others = (field !== 'evCash' ? (parseInt(evCash) || 0) : 0)
                     + (field !== 'evCard' ? (parseInt(evCard) || 0) : 0)
                     + (field !== 'evQR'   ? (parseInt(evQR)   || 0) : 0);
        const rem = Math.max(0, existingDebt - others);
        if (field === 'evCash') setEvCash(String(rem));
        if (field === 'evCard') setEvCard(String(rem));
        if (field === 'evQR')   setEvQR(String(rem));
    };

    const ledAmount   = tab === 'extend' ? extCost     : existingDebt;
    const ledDebt     = tab === 'extend' ? newDebt     : evDebt;
    const ledPaid     = tab === 'extend' ? extPaid     : evPaid;
    const activeColor = tab === 'extend' ? '#0f9688'   : '#f59e0b';

    const handleExtend = async () => {
        if (!extDays || extDays < 1) return;
        setBusy(true);
        try {
            await onExtend(room.id, {
                extDays,
                paidCash: parseInt(extCash) || 0,
                paidCard: parseInt(extCard) || 0,
                paidQR:   parseInt(extQR)   || 0,
                newCheckOut,
                newDays,
                newTotal,
            });
        } catch (e) {
            notify?.(e.message || 'Ошибка', 'error');
            setBusy(false);
        }
    };

    const handleEvict = async () => {
        setBusy(true);
        try {
            if (evPaid > 0) {
                await onExtend(room.id, {
                    extDays: 0,
                    paidCash: parseInt(evCash) || 0,
                    paidCard: parseInt(evCard) || 0,
                    paidQR:   parseInt(evQR)   || 0,
                    newCheckOut: rental?.checkOutStr || rental?.checkOutDate?.slice(0, 10),
                    newDays:  rental?.days || 0,
                    newTotal: rental?.totalAmount || 0,
                });
            }
            await onEndRental?.(room);
            onClose();
        } catch (e) {
            notify?.(e.message || 'Ошибка', 'error');
            setBusy(false);
        }
    };

    const tabs = [
        { id: 'extend', label: 'Продлить', icon: RefreshCw, color: '#0f9688' },
        { id: 'evict',  label: 'Выселить', icon: LogOut,    color: '#f59e0b' },
    ];

    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3">
            <style>{STYLE}</style>
            <div className={`pos-modal w-full ${tab === 'extend' ? 'max-w-2xl' : 'max-w-md'} flex flex-col max-h-[95vh] overflow-hidden rounded-2xl shadow-2xl transition-all`}
                style={{ background: '#1a3c40' }}>

                <div className="shrink-0 px-5 pt-5 pb-4 relative overflow-hidden">
                    {/* Декоративные круги */}
                    <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full pointer-events-none" style={{ background: 'rgba(94,234,212,0.06)' }}/>
                    <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full pointer-events-none" style={{ background: `${activeColor}1a` }}/>
                    <div className="relative z-10 flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                style={{ background: `linear-gradient(135deg,${activeColor},${tab === 'extend' ? '#0d7a6e' : '#ea580c'})`, transition: 'background .2s' }}>
                                {tab === 'extend' ? <RefreshCw size={15} className="text-white" /> : <LogOut size={15} className="text-white" />}
                            </div>
                            <div>
                                <div className="text-white font-black text-sm leading-tight">
                                    {tab === 'extend' ? 'Продление аренды' : 'Выселение'}
                                </div>
                                <div className="text-slate-500 text-[10px]">
                                    Комната {room?.number} · {rental?.tenantName}
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-slate-400 hover:text-white transition-colors">
                            <X size={15} />
                        </button>
                    </div>

                    <div className="relative z-10 rounded-xl px-4 py-3 flex items-end justify-between"
                        style={{ background: '#0e2428', border: '1px solid rgba(94,234,212,0.1)' }}>
                        <div>
                            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-0.5">
                                {tab === 'extend' ? 'Доплата' : 'Долг'}
                            </div>
                            <div className="font-mono font-black leading-none" style={{
                                fontSize: '26px',
                                color: ledAmount > 0 ? activeColor : '#374151',
                                textShadow: ledAmount > 0 ? `0 0 12px ${activeColor}66` : 'none',
                                transition: 'color .2s',
                            }}>
                                {ledAmount > 0 ? ledAmount.toLocaleString() : '0'}
                                <span className="ml-1.5" style={{ color: '#4b5563', fontSize: '11px' }}>СУМ</span>
                            </div>
                            {tab === 'extend' && pricePerDay > 0 && (
                                <div className="text-[10px] text-slate-600 mt-0.5 font-mono">
                                    {pricePerDay.toLocaleString()} x {extDays} дн.
                                </div>
                            )}
                            {tab === 'evict' && (
                                <div className="text-[10px] text-slate-600 mt-0.5 font-mono">
                                    {rental?.checkInDate?.slice(0,10)} - {rental?.checkOutStr || rental?.checkOutDate?.slice(0,10)}
                                </div>
                            )}
                        </div>
                        <div className="text-right">
                            {ledDebt > 0 && (
                                <div>
                                    <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Остаток</div>
                                    <div className="font-mono font-black text-rose-400 text-lg leading-tight">
                                        {ledDebt.toLocaleString()}
                                    </div>
                                </div>
                            )}
                            {ledDebt === 0 && ledPaid > 0 && (
                                <div className="flex items-center gap-1 text-teal-400 text-xs font-bold">
                                    <CheckCircle2 size={14} /> Оплачено
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="relative z-10 flex gap-1 mt-3">
                        {tabs.map(tb => (
                            <button key={tb.id}
                                onClick={() => setTab(tb.id)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all"
                                style={{
                                    fontSize: 11, fontWeight: 700,
                                    background: tab === tb.id ? tb.color : 'rgba(255,255,255,0.06)',
                                    color: tab === tb.id ? '#fff' : '#64748b',
                                }}>
                                <tb.icon size={11} />
                                {tb.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-white">

                    {tab === 'extend' && (
                        <div className="px-5 py-4">
                          <div className="grid md:grid-cols-2 gap-5">
                            {/* ЛЕВО — период, продление, доплата */}
                            <div className="space-y-4">
                            <div className="bg-slate-50 rounded-xl border border-slate-100 px-4 py-3">
                                <Section icon={CalendarDays} title="Текущий период" />
                                <div className="flex justify-between text-sm font-mono">
                                    <span className="text-slate-500">До:</span>
                                    <span className="font-bold text-slate-700">
                                        {rental?.checkOutStr || rental?.checkOutDate?.slice(0,10)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm font-mono mt-0.5">
                                    <span className="text-slate-500">Дней:</span>
                                    <span className="font-bold text-slate-700">{rental?.days}</span>
                                </div>
                            </div>

                            <div>
                                <Section icon={RefreshCw} title="Продлить на" />
                                <div className="flex items-center gap-3 mb-3">
                                    <button onClick={() => setExtDays(d => Math.max(1, d - 1))}
                                        className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-600 shrink-0 transition-colors">
                                        <Minus size={14} />
                                    </button>
                                    <input
                                        type="number"
                                        className="pos-input-ext text-center font-mono font-black text-xl"
                                        value={extDays}
                                        onChange={e => setExtDays(Math.max(1, parseInt(e.target.value) || 1))}
                                    />
                                    <button onClick={() => setExtDays(d => d + 1)}
                                        className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-600 shrink-0 transition-colors">
                                        <Plus size={14} />
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    {[1, 3, 7, 14, 30].map(d => (
                                        <button key={d} onClick={() => setExtDays(d)}
                                            className="flex-1 py-1.5 rounded-xl border text-xs font-bold transition-all"
                                            style={{
                                                background: extDays === d ? '#0f9688' : 'transparent',
                                                borderColor: extDays === d ? '#0f9688' : '#e2e8f0',
                                                color: extDays === d ? '#fff' : '#64748b',
                                            }}>
                                            +{d}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-xl px-4 py-3 flex items-center justify-between"
                                style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                <div>
                                    <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#16a34a' }}>Новая дата выезда</div>
                                    <div className="font-mono font-black text-lg" style={{ color: '#15803d' }}>{newCheckOut}</div>
                                </div>
                                <div className="text-right">
                                    <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#16a34a' }}>Итого дней</div>
                                    <div className="font-black text-lg" style={{ color: '#15803d' }}>{newDays}</div>
                                </div>
                            </div>

                            <div>
                                <Section icon={DollarSign} title="Сумма доплаты за продление"
                                    right={pricePerDay > 0 ? <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>{pricePerDay.toLocaleString()} × {extDays} дн.</span> : null} />
                                <div className="relative">
                                    <input type="text" inputMode="numeric" className="pos-input-ext pr-12 text-right font-mono font-black"
                                        placeholder="0"
                                        value={chargeDisplay}
                                        onChange={e => { setChargeTouched(true); setExtCharge(e.target.value.replace(/\D/g, '')); }} />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">сум</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Добавится к долгу аренды. {pricePerDay > 0 ? 'Подставлено авто — можно изменить.' : 'Цена за сутки не задана — укажите сумму вручную.'}
                                </p>
                            </div>

                            {extConflicts.length > 0 && (
                                <div className="flex items-start gap-2 px-3 py-2.5 bg-rose-50 border border-rose-200 rounded-xl">
                                    <AlertTriangle size={14} className="text-rose-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-rose-700 font-bold mb-1">Конфликт — продление невозможно:</p>
                                        {extConflicts.map(g => (
                                            <p key={g.id} className="text-[11px] text-rose-600">
                                                {g.fullName} · {g.status === 'booking' ? 'бронь' : 'заселён'} с {g.checkInDate?.slice(0,10)}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}
                            </div>

                            {/* ПРАВО — оплата */}
                            <div className="space-y-3 md:border-l md:border-slate-100 md:pl-5 border-t border-slate-100 pt-4 md:border-t-0 md:pt-0">
                                <Section icon={Receipt} title="Оплатить сейчас (опц.)"
                                    right={extPaid > 0 && newDebt === 0
                                        ? <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a' }}>Полная оплата</span>
                                        : extPaid > 0
                                            ? <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444' }}>Долг: {newDebt.toLocaleString()}</span>
                                            : null
                                    }
                                />
                                <PayRow icon={DollarSign} label="Нал."  value={extCash} onChange={setExtCash} onMagnet={() => applyExtMagnet('extCash')} accent="bg-teal-600" />
                                <PayRow icon={CreditCard} label="Карта" value={extCard} onChange={setExtCard} onMagnet={() => applyExtMagnet('extCard')} accent="bg-blue-500" />
                                <PayRow icon={QrCode}     label="QR"    value={extQR}   onChange={setExtQR}   onMagnet={() => applyExtMagnet('extQR')}   accent="bg-violet-500" />

                                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 space-y-1.5 mt-1">
                                    <div className="flex justify-between text-xs"><span className="text-slate-500">Доплата за продление</span><span className="font-mono font-bold text-slate-700">{extCost.toLocaleString()}</span></div>
                                    {extPaid > 0 && <div className="flex justify-between text-xs"><span className="text-slate-500">Внесено сейчас</span><span className="font-mono font-bold text-emerald-600">{extPaid.toLocaleString()}</span></div>}
                                    <div className="flex justify-between text-xs pt-1.5 border-t border-slate-200">
                                        <span className="font-bold text-slate-700">{newDebt > 0 ? 'Остаток долга' : 'Долг'}</span>
                                        <span className={`font-mono font-black ${newDebt > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>{newDebt.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                          </div>
                        </div>
                    )}

                    {tab === 'evict' && (
                        <div className="px-5 py-4 space-y-4">
                            <div className="bg-slate-50 rounded-xl border border-slate-100 px-4 py-3 space-y-2">
                                <Section icon={BedDouble} title="Итоги аренды" />
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Заехал:</span>
                                    <span className="font-bold text-slate-700 font-mono">{rental?.checkInDate?.slice(0,10)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Выезд:</span>
                                    <span className="font-bold text-slate-700 font-mono">{rental?.checkOutStr || rental?.checkOutDate?.slice(0,10)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Дней:</span>
                                    <span className="font-bold text-slate-700">{rental?.days}</span>
                                </div>
                                <hr className="receipt-divider-ext" />
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Начислено:</span>
                                    <span className="font-bold font-mono text-slate-700">{(rental?.totalAmount || 0).toLocaleString()}</span>
                                </div>
                                {(rental?.paidCash || 0) > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Нал. оплачено:</span>
                                        <span className="font-bold font-mono text-teal-700">{(rental.paidCash).toLocaleString()}</span>
                                    </div>
                                )}
                                {(rental?.paidCard || 0) > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Карта:</span>
                                        <span className="font-bold font-mono text-blue-700">{(rental.paidCard).toLocaleString()}</span>
                                    </div>
                                )}
                                {(rental?.paidQR || 0) > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">QR:</span>
                                        <span className="font-bold font-mono text-violet-700">{(rental.paidQR).toLocaleString()}</span>
                                    </div>
                                )}
                                {existingDebt > 0 ? (
                                    <div className="flex justify-between text-sm pt-1 border-t border-slate-200">
                                        <span className="font-bold text-rose-500">Долг:</span>
                                        <span className="font-black font-mono text-rose-500">{existingDebt.toLocaleString()}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 text-teal-600 text-sm font-bold pt-1 border-t border-slate-200">
                                        <CheckCircle2 size={14} /> Долгов нет
                                    </div>
                                )}
                            </div>

                            {existingDebt > 0 && (
                                <>
                                    <hr className="receipt-divider-ext" />
                                    <Section icon={Receipt} title="Принять оплату при выезде"
                                        right={evDebt === 0 && evPaid > 0
                                            ? <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a' }}>Закрыт</span>
                                            : evDebt > 0 && evPaid > 0
                                                ? <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444' }}>Долг: {evDebt.toLocaleString()}</span>
                                                : null
                                        }
                                    />
                                    <PayRow icon={DollarSign} label="Нал."  value={evCash} onChange={setEvCash} onMagnet={() => applyEvMagnet('evCash')} accent="bg-teal-600" />
                                    <PayRow icon={CreditCard} label="Карта" value={evCard} onChange={setEvCard} onMagnet={() => applyEvMagnet('evCard')} accent="bg-blue-500" />
                                    <PayRow icon={QrCode}     label="QR"    value={evQR}   onChange={setEvQR}   onMagnet={() => applyEvMagnet('evQR')}   accent="bg-violet-500" />
                                </>
                            )}

                            {evDebt > 0 && (
                                <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                                    <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-700 font-semibold">
                                        Остаток {evDebt.toLocaleString()} сум — выселение всё равно будет выполнено
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="shrink-0 px-4 py-3 flex items-center gap-2"
                    style={{ background: '#0f172a', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <button onClick={onClose}
                        className="px-4 py-2.5 text-slate-500 hover:text-slate-300 font-bold rounded-xl transition-colors text-sm">
                        Отмена
                    </button>

                    {tab === 'extend' && (
                        <button
                            onClick={handleExtend}
                            disabled={busy || extDays < 1 || extConflicts.length > 0}
                            className="flex-1 flex items-center justify-center gap-2 py-3 text-white rounded-xl font-black text-sm transition-all disabled:opacity-40"
                            style={{ background: !busy ? 'linear-gradient(135deg,#0f9688,#0d7a6e)' : '#374151' }}>
                            {busy
                                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <RefreshCw size={15} />
                            }
                            {extPaid > 0 ? `Оплатить и продлить на ${extDays} дн.` : `Продлить на ${extDays} дн.`}
                            <ChevronRight size={15} />
                        </button>
                    )}

                    {tab === 'evict' && (
                        <button
                            onClick={handleEvict}
                            disabled={busy}
                            className="flex-1 flex items-center justify-center gap-2 py-3 text-white rounded-xl font-black text-sm transition-all disabled:opacity-40"
                            style={{ background: !busy ? 'linear-gradient(135deg,#f59e0b,#ea580c)' : '#374151' }}>
                            {busy
                                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <LogOut size={15} />
                            }
                            {evPaid > 0 ? 'Принять оплату и выселить' : 'Выселить'}
                            <ChevronRight size={15} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RentalExtendModal;
