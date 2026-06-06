import React, { useState, useMemo, useEffect } from 'react';
import { X, Users, Plus, Trash2, DollarSign, CreditCard, QrCode, Magnet, ArrowRightLeft } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import { fmtSum, parseSum } from '../../utils/helpers';

const MODAL_STYLE = `
    @keyframes gci-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes gci-card-in { from { opacity: 0; transform: scale(0.97) translateY(14px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    .gci-backdrop { animation: gci-backdrop-in 0.2s ease forwards; }
    .gci-card { animation: gci-card-in 0.28s cubic-bezier(0.34,1.3,0.64,1) forwards; will-change: transform, opacity; }
`;

// price helper (mirrors CheckInModal)
const getRoomPrice = (room, bedId) => {
    if (!room) return 0;
    const lower = parseInt(room.prices?.lower) || parseInt(room.price) || 0;
    const upper = parseInt(room.prices?.upper);
    if (!upper || upper === lower) return lower;
    const cap    = parseInt(room.capacity) || 1;
    const bedNum = parseInt(bedId);
    if (!bedNum) return lower;
    return bedNum > Math.ceil(cap / 2) ? upper : lower;
};

const EMPTY_GUEST = {
    fullName: '',
    passport: '',
    country: 'Узбекистан',
    bedId: '',
    paidCash: '',
    paidCard: '',
    paidQR: '',
    paidTransfer: '',
};

const inputClass = "w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none text-sm font-medium text-slate-800 transition-all";

// ─── Main ─────────────────────────────────────────────────────────────────────
const GroupCheckInModal = ({ allRooms = [], guests = [], onClose, onSubmitOne, notify, lang, currentUser, checkInHour = 14, checkOutHour = 12 }) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;

    const today = new Date().toISOString().split('T')[0];

    const [selectedRoomId, setSelectedRoomId] = useState(allRooms[0]?.id || '');
    const [checkInDate, setCheckInDate]         = useState(today);
    const [days, setDays]                       = useState(1);
    const [commonPrice, setCommonPrice]         = useState(''); // единая цена для всех
    const [guestList, setGuestList]             = useState([{ ...EMPTY_GUEST, id: Date.now() }]);
    const [submitting, setSubmitting]           = useState(false);

    const room = allRooms.find(r => r.id === selectedRoomId);

    // ESC to close
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const freeBeds = useMemo(() => {
        if (!room) return [];
        const now = new Date();
        const occupied = new Set(
            guests
                .filter(g => g.roomId === selectedRoomId && g.status === 'active')
                .filter(g => !g.checkOutDate || now < new Date(g.checkOutDate))
                .map(g => String(g.bedId))
        );
        // Also count beds already staged in guestList
        const staged = new Set(guestList.filter(g => g.bedId).map(g => String(g.bedId)));
        return Array.from({ length: room.capacity || 0 }, (_, i) => {
            const id = String(i + 1);
            return { id, occupied: occupied.has(id), staged: staged.has(id) };
        });
    }, [room, guests, selectedRoomId, guestList]);

    const addGuest = () => {
        if (guestList.length >= (room?.capacity || 1)) {
            notify?.( t('noFreeBeds'), 'error');
            return;
        }
        setGuestList(prev => [...prev, { ...EMPTY_GUEST, id: Date.now() }]);
    };

    const removeGuest = (id) => {
        setGuestList(prev => prev.filter(g => g.id !== id));
    };

    const updateGuest = (id, field, value) => {
        setGuestList(prev => prev.map(g => {
            if (g.id !== id) return g;
            const processed = (field === 'fullName' || field === 'passport') ? value.toUpperCase() : value;
            // When bed changes, auto-fill price
            if (field === 'bedId') {
                return { ...g, bedId: value };
            }
            return { ...g, [field]: processed };
        }));
    };

    // если задана единая цена – используем её, иначе ценовой тариф
    const priceForGuest = (g) => { const m = parseInt(commonPrice); return m > 0 ? m : getRoomPrice(room, g.bedId); };
    const totalForGuest = (g) => priceForGuest(g) * (parseInt(days) || 1);
    const paidForGuest  = (g) => (parseInt(g.paidCash) || 0) + (parseInt(g.paidCard) || 0) + (parseInt(g.paidQR) || 0) + (parseInt(g.paidTransfer) || 0);

    const applyMagnet = (guestId, field) => {
        const g = guestList.find(x => x.id === guestId);
        if (!g) return;
        const total  = totalForGuest(g);
        const others = (field !== 'paidCash'     ? (parseInt(g.paidCash)     || 0) : 0)
                     + (field !== 'paidCard'     ? (parseInt(g.paidCard)     || 0) : 0)
                     + (field !== 'paidQR'       ? (parseInt(g.paidQR)       || 0) : 0)
                     + (field !== 'paidTransfer' ? (parseInt(g.paidTransfer) || 0) : 0);
        updateGuest(guestId, field, String(Math.max(0, total - others)));
    };

    const handleSubmit = async () => {
        const invalid = guestList.find(g => !g.fullName.trim() || !g.bedId);
        if (invalid) {
            notify?.(t('fillNameAndBed'), 'error');
            return;
        }
        // Check duplicate beds
        const beds = guestList.map(g => g.bedId);
        if (new Set(beds).size !== beds.length) {
            notify?.( t('duplicateBeds'), 'error');
            return;
        }
        setSubmitting(true);
        try {
            const nowTs = new Date();
            for (const g of guestList) {
                const checkIn = new Date(checkInDate);
                checkIn.setHours(checkInHour, 0, 0, 0);
                const checkOut = new Date(checkIn);
                checkOut.setDate(checkOut.getDate() + (parseInt(days) || 1));
                checkOut.setHours(checkOutHour, 0, 0, 0);
                // Ранний заезд: фиксируем фактическое время прихода, если расчётный час
                // заезда сегодня ещё не наступил (иначе кровать ошибочно «свободна» до 14:00).
                if (checkIn > nowTs && checkIn.toDateString() === nowTs.toDateString()) {
                    checkIn.setTime(nowTs.getTime());
                }
                const price  = priceForGuest(g);
                const total  = price * (parseInt(days) || 1);
                const paid   = paidForGuest(g);
                await onSubmitOne({
                    roomId:     room.id,
                    roomNumber: room.number,
                    bedId:      g.bedId,
                    fullName:   g.fullName,
                    passport:   g.passport,
                    country:    g.country,
                    phone:      '',
                    birthDate:  '',
                    passportIssueDate: '',
                    checkInDate:  checkIn.toISOString(),
                    checkOutDate: checkOut.toISOString(),
                    days,
                    pricePerNight: price,
                    totalPrice: total,
                    amountPaid: paid,
                    paidCash:     parseInt(g.paidCash)     || 0,
                    paidCard:     parseInt(g.paidCard)     || 0,
                    paidQR:       parseInt(g.paidQR)       || 0,
                    paidTransfer: parseInt(g.paidTransfer) || 0,
                    status: 'active',
                });
            }
            notify?.(`Заселено ${guestList.length} гостей`, 'success');
            onClose();
        } catch (e) {
            notify?.('Ошибка: ' + e.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const canSubmit = !submitting && guestList.every(g => g.fullName.trim() && g.bedId);
    const grandTotal = guestList.reduce((s, g) => s + totalForGuest(g), 0);

    return (
        <>
        <style>{MODAL_STYLE}</style>
        <div className="gci-backdrop fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(15,30,32,0.7)' }}>
            <div className="gci-card w-full max-w-3xl flex flex-col" style={{ borderRadius: 24, boxShadow: '0 32px 80px rgba(0,0,0,0.35)', maxHeight: '95vh', overflow: 'hidden', background: '#fff' }}>
                {/* Header */}
                <div style={{ background: '#1a3c40', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: -40, right: 60, width: 130, height: 130, borderRadius: '50%', background: 'rgba(94,234,212,0.06)', pointerEvents: 'none' }}/>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(94,234,212,0.12)', border: '1px solid rgba(94,234,212,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Users size={18} color="#5eead4"/>
                        </div>
                        <div>
                            <div style={{ color: 'rgba(158,205,208,0.55)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>{t('checkinGroupTitle')}</div>
                            <div style={{ color: '#e2f7f8', fontSize: 14, fontWeight: 700 }}>
                                {guestList.length} {lang === 'uz' ? 'mehmon' : 'гостей'} {grandTotal > 0 ? '· ' + grandTotal.toLocaleString() + (lang === 'uz' ? " so'm" : ' сум') : ''}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.15)', borderRadius: 8, padding: 8, cursor: 'pointer', color: '#5eead4', display: 'flex' }}>
                        <X size={16}/>
                    </button>
                </div>

                {/* Common settings */}
                <div className="px-6 pt-5 pb-4 shrink-0" style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1.5 block">{t('room')}</label>
                            <select className={inputClass} value={selectedRoomId} onChange={e => setSelectedRoomId(e.target.value)}>
                                {allRooms.map(r => <option key={r.id} value={r.id}>№{r.number} — {r.capacity} мест</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1.5 block">{t('checkIn')}</label>
                            <input type="date" className={inputClass} value={checkInDate} onChange={e => setCheckInDate(e.target.value)}/>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1.5 block">{t('days')}</label>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setDays(d => Math.max(1, d - 1))} className="w-8 h-9 bg-slate-200 hover:bg-slate-300 rounded-lg font-bold text-slate-600 flex items-center justify-center text-sm">−</button>
                                <input type="number" className={`${inputClass} text-center`} value={days} onChange={e => setDays(Math.max(1, parseInt(e.target.value) || 1))}/>
                                <button onClick={() => setDays(d => d + 1)} className="w-8 h-9 bg-slate-200 hover:bg-slate-300 rounded-lg font-bold text-slate-600 flex items-center justify-center text-sm">+</button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1.5 block">{t('pricePerNightAll')}</label>
                            <div className="relative">
                                <input type="text" inputMode="numeric" className={`${inputClass} pr-12`}
                                    placeholder={room ? String(parseInt(room.price) || 0) : '0'}
                                    value={fmtSum(commonPrice)}
                                    onChange={e => setCommonPrice(parseSum(e.target.value))}/>
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">сум</span>
                            </div>
                        </div>
                    </div>
                    {/* Free beds map */}
                    {room && (
                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-400">{t('bedsLabel')}</span>
                            {freeBeds.map(b => (
                                <span key={b.id} className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${
                                    b.occupied ? 'bg-rose-100 text-rose-500 border-rose-200' :
                                    b.staged   ? 'bg-teal-100 text-teal-700 border-teal-200' :
                                    'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}>
                                    {b.id} {b.occupied ? '🔒' : b.staged ? '✎' : '✓'}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Guest list */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {guestList.map((g, idx) => {
                        const price  = priceForGuest(g);
                        const total  = price * (parseInt(days) || 1);
                        const paid   = paidForGuest(g);
                        const debt   = Math.max(0, total - paid);
                        const hostelId = currentUser?.hostelId;
                        const canPay = currentUser?.role !== 'admin'
                            && !(hostelId === 'hostel1' && currentUser?.permissions?.canPayInHostel1 === false)
                            && !(hostelId === 'hostel2' && currentUser?.permissions?.canPayInHostel2 === false);
                        return (
                            <div key={g.id} className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(15,150,136,0.2)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                                <div className="flex items-center justify-between px-4 py-3" style={{ background: '#f0fdfa', borderBottom: '1px solid rgba(15,150,136,0.12)' }}>
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-black" style={{ background: '#0f9688' }}>{idx + 1}</div>
                                        <span className="text-sm font-bold text-slate-700">{g.fullName || `${t('guestNum')} ${idx + 1}`}</span>
                                        {g.bedId && <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(15,150,136,0.12)', color: '#0f766e' }}>{t('bed2')} {g.bedId}</span>}
                                        {total > 0 && <span className="text-xs text-slate-400 font-semibold">{total.toLocaleString()} сум</span>}
                                        {debt > 0 && <span className="text-xs text-rose-600 font-bold">долг: {debt.toLocaleString()}</span>}
                                    </div>
                                    {guestList.length > 1 && (
                                        <button onClick={() => removeGuest(g.id)} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={15}/></button>
                                    )}
                                </div>
                                <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {/* Место */}
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">{t('bed2')} *</label>
                                        <select className={inputClass} value={g.bedId}
                                            onChange={e => updateGuest(g.id, 'bedId', e.target.value)}>
                                            <option value="">{t('selectOption')}</option>
                                            {freeBeds.filter(b => !b.occupied && (!b.staged || b.id === g.bedId)).map(b => (
                                                <option key={b.id} value={b.id}>{t('bed2')} {b.id}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {/* ФИО */}
                                    <div className="md:col-span-2">
                                        <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">{t('guestName')} *</label>
                                        <input className={inputClass} placeholder="ИВАНОВ ИВАН ИВАНОВИЧ" value={g.fullName}
                                            onChange={e => updateGuest(g.id, 'fullName', e.target.value)}/>
                                    </div>
                                    {/* Страна */}
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">{t('country')}</label>
                                        <input className={inputClass} placeholder="Узбекистан" value={g.country}
                                            onChange={e => updateGuest(g.id, 'country', e.target.value)}/>
                                    </div>
                                    {/* Паспорт */}
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">{t('passport')}</label>
                                        <input className={inputClass} placeholder="AB1234567" value={g.passport}
                                            onChange={e => updateGuest(g.id, 'passport', e.target.value)}/>
                                    </div>
                                    {/* Оплата */}
                                    {canPay && (
                                        <>
                                            {[['paidCash', DollarSign, t('cashShort')], ['paidCard', CreditCard, t('cardShort')], ['paidQR', QrCode, 'QR'], ['paidTransfer', ArrowRightLeft, 'Перечисл.']].map(([field, Icon, lbl]) => (
                                                <div key={field}>
                                                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">{lbl}</label>
                                                    <div className="relative">
                                                        <Icon size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                                                        <input type="text" inputMode="numeric" className={`${inputClass} pl-7 pr-7`} value={fmtSum(g[field])}
                                                            onChange={e => updateGuest(g.id, field, parseSum(e.target.value))}/>
                                                        <button onClick={() => applyMagnet(g.id, field)}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-teal-400 hover:text-teal-600">
                                                            <Magnet size={12}/>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 shrink-0 flex items-center justify-between gap-3" style={{ borderTop: '1px solid #f1f5f9', background: '#fff' }}>
                    <button onClick={addGuest} disabled={guestList.length >= (room?.capacity || 1)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-40" style={{ border: '2px dashed rgba(15,150,136,0.4)', color: '#0f9688' }}
                        onMouseEnter={e => e.currentTarget.style.background='rgba(15,150,136,0.06)'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <Plus size={16}/>
                        {t('addGuest')}
                    </button>
                    <div className="flex items-center gap-3">{grandTotal > 0 && (
                            <span className="text-sm font-bold text-slate-600 hidden md:block">{t('total')}: {grandTotal.toLocaleString()} {lang === 'uz' ? "so'm" : 'сум'}</span>
                        )}<button onClick={onClose} className="px-4 py-2.5 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors text-sm">
                            {t('cancel')}
                        </button>
                        <button onClick={handleSubmit} disabled={!canSubmit}
                            className="flex items-center gap-2 px-6 py-2.5 text-white rounded-xl font-black transition-opacity disabled:opacity-50 text-sm"
                            style={{ background: 'linear-gradient(135deg,#0f9688,#0d7a6e)', boxShadow: '0 4px 14px rgba(15,150,136,0.3)' }}
                            onMouseEnter={e => e.currentTarget.style.opacity='0.9'}
                            onMouseLeave={e => e.currentTarget.style.opacity='1'}>
                            <Users size={16}/>
                            {submitting ? t('checkingIn') : `${t('checkin')} ${guestList.length} ${lang === 'uz' ? 'mehmon' : 'гостей'}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
        </>
    );
};

export default GroupCheckInModal;
