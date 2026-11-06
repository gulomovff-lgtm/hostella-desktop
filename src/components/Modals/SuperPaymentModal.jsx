import React, { useMemo, useState, useEffect } from 'react';
import { X, Search, Check, User } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import { fmtSum, parseSum } from '../../utils/helpers';
import { METHODS, validatePaymentInput, searchGuests, editableReason } from '../../utils/paymentEdit';

const pad = (n) => String(n).padStart(2, '0');
/** ISO → значение для <input type="datetime-local"> в местном времени. */
const toLocalInput = (iso) => {
    const d = iso ? new Date(iso) : new Date();
    if (!Number.isFinite(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtDay = (iso) => { try { return iso ? new Date(iso).toLocaleDateString('ru-RU') : '—'; } catch { return '—'; } };
const paidOf = (g) => (typeof g?.amountPaid === 'number' ? g.amountPaid : (Number(g?.paidCash) || 0) + (Number(g?.paidCard) || 0) + (Number(g?.paidQR) || 0));

const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5';
const inputCls = 'w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:border-orange-400 outline-none';

/**
 * Ручная оплата от имени супера: любой день, любой кассир, любой проживающий.
 * Запись сохраняется в формате обычной оплаты из карточки гостя — в отчёте и
 * в смене кассира она неотличима от принятой на кассе (решение владельца).
 */
const SuperPaymentModal = ({ payment = null, users = [], guests = [], hostels = [], defaultHostelId = '', lang = 'ru', onSave, onClose }) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;
    const editing = !!payment?.id;
    const blocked = editing ? editableReason(payment) : '';

    const initialGuest = editing ? guests.find(g => g.id === payment.guestId) || null : null;
    const [hostelId, setHostelId] = useState(payment?.hostelId || initialGuest?.hostelId || defaultHostelId || hostels[0]?.id || 'hostel1');
    const [date, setDate] = useState(toLocalInput(payment?.date));
    const [staffId, setStaffId] = useState(payment?.staffId || '');
    const [guest, setGuest] = useState(initialGuest);
    const [q, setQ] = useState('');
    const [amount, setAmount] = useState(payment?.amount ? String(payment.amount) : '');
    const [method, setMethod] = useState(METHODS.includes(payment?.method) ? payment.method : 'cash');
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);

    // Кассиры филиала: сперва кассиры, затем остальные сотрудники.
    const staffList = useMemo(() => {
        const inHostel = (u) => !hostelId || u.hostelId === hostelId || u.hostelId === 'all' || (u.allowedHostels || []).includes(hostelId);
        const list = users.filter(u => inHostel(u) || u.id === staffId || u.login === staffId);
        const rank = (u) => (u.role === 'cashier' ? 0 : u.role === 'admin' ? 1 : 2);
        return [...list].sort((a, b) => rank(a) - rank(b) || String(a.name || '').localeCompare(String(b.name || '')));
    }, [users, hostelId, staffId]);

    // staffId в старых записях бывает логином — показываем выбор по id сотрудника
    useEffect(() => {
        if (!staffId) return;
        const byLogin = users.find(u => u.login === staffId && u.id !== staffId);
        if (byLogin) setStaffId(byLogin.id);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const found = useMemo(() => searchGuests(guests, q, { hostelId, limit: 30 }), [guests, q, hostelId]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [busy, onClose]);

    const submit = async () => {
        if (busy || blocked) return;
        const iso = date ? new Date(date).toISOString() : '';
        const input = { id: payment?.id || null, guestId: guest?.id || '', staffId, amount: parseInt(amount) || 0, method, date: iso, hostelId };
        const e = validatePaymentInput(input);
        if (e) { setErr(t('spErr_' + e)); return; }
        setErr('');
        setBusy(true);
        try {
            const ok = await onSave?.(input);
            if (ok !== false) onClose?.();
        } finally {
            setBusy(false);
        }
    };

    const debt = guest ? Math.max(0, (Number(guest.totalPrice) || 0) - paidOf(guest)) : 0;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: 'rgba(8,18,20,0.55)' }}
            onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose?.(); }}>
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '92vh' }}>
                <div className="shrink-0 px-5 py-4 border-b border-slate-100 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-black text-slate-800">{editing ? t('spTitleEdit') : t('spTitleAdd')}</h2>
                        <p className="text-xs text-slate-400 mt-0.5">{t('spSubtitle')}</p>
                    </div>
                    <button onClick={onClose} disabled={busy} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
                </div>

                {blocked ? (
                    <div className="p-5 text-sm text-amber-800 bg-amber-50">{t('spBlocked_' + blocked)}</div>
                ) : (
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>{t('spDate')}</label>
                            <input type="datetime-local" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div>
                            <label className={labelCls}>{t('spHostel')}</label>
                            <select className={inputCls} value={hostelId} onChange={e => { setHostelId(e.target.value); if (guest && (guest.hostelId || 'hostel1') !== e.target.value) setGuest(null); }}>
                                {hostels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>{t('spCashier')}</label>
                        <select className={inputCls} value={staffId} onChange={e => setStaffId(e.target.value)}>
                            <option value="">—</option>
                            {staffList.map(u => <option key={u.id} value={u.id}>{u.name || u.login}{u.role !== 'cashier' ? ` · ${u.role}` : ''}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className={labelCls}>{t('spGuest')}</label>
                        {guest ? (
                            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-teal-200 bg-teal-50">
                                <User size={16} className="text-teal-600 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-black text-slate-800 truncate">{guest.fullName}</div>
                                    <div className="text-[11px] text-slate-500 tabular-nums">
                                        №{guest.roomNumber || '—'} · {fmtDay(guest.checkInDate)} — {fmtDay(guest.checkOutDate)} · {guest.status === 'active' ? t('spLiving') : t('spLeft')}
                                        {debt > 0 && <span className="text-rose-600 font-bold"> · {t('spDebt').replace('{sum}', debt.toLocaleString('ru-RU'))}</span>}
                                    </div>
                                </div>
                                <button onClick={() => setGuest(null)} className="text-xs font-bold text-slate-500 hover:text-slate-800">{t('spChange')}</button>
                            </div>
                        ) : (
                            <>
                                <div className="relative">
                                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input className={inputCls + ' pl-9'} value={q} onChange={e => setQ(e.target.value)} placeholder={t('spGuestSearch')} autoFocus />
                                </div>
                                <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                                    {found.length === 0 ? (
                                        <div className="p-3 text-xs text-slate-400">{t('spNoGuests')}</div>
                                    ) : found.map(g => (
                                        <button key={g.id} type="button" onClick={() => { setGuest(g); setQ(''); }}
                                            className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2">
                                            <span className={`w-1 self-stretch rounded-full ${g.status === 'active' ? 'bg-teal-400' : 'bg-slate-300'}`} />
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-sm font-bold text-slate-800 truncate">{g.fullName}</span>
                                                <span className="block text-[11px] text-slate-500 tabular-nums">№{g.roomNumber || '—'} · {fmtDay(g.checkInDate)} — {fmtDay(g.checkOutDate)}{g.passport ? ` · ${g.passport}` : ''}</span>
                                            </span>
                                            <span className={`text-[10.5px] font-black px-2 py-0.5 rounded-full ${g.status === 'active' ? 'bg-teal-50 text-teal-600' : 'bg-slate-100 text-slate-500'}`}>
                                                {g.status === 'active' ? t('spLiving') : t('spLeft')}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>{t('spAmount')}</label>
                            <input type="text" inputMode="numeric" className={inputCls + ' tabular-nums'} value={fmtSum(amount)} onChange={e => setAmount(String(parseSum(e.target.value) || ''))} placeholder="0" />
                        </div>
                        <div>
                            <label className={labelCls}>{t('spMethod')}</label>
                            <select className={inputCls} value={method} onChange={e => setMethod(e.target.value)}>
                                {METHODS.map(m => <option key={m} value={m}>{t('spM_' + m)}</option>)}
                            </select>
                        </div>
                    </div>

                    {err && <div className="text-xs font-bold text-rose-600">{err}</div>}
                </div>
                )}

                <div className="shrink-0 px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button onClick={onClose} disabled={busy} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50">{t('spCancel')}</button>
                    {!blocked && (
                        <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-60">
                            <Check size={15} /> {t('spSave')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SuperPaymentModal;
