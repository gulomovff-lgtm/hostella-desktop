import React, { useState, useMemo, useEffect } from 'react';
import { Gift, Search, Link2, Check, ChevronDown, ChevronRight, Plus, Minus, Send } from 'lucide-react';
import { doc, onSnapshot, setDoc, getDoc, updateDoc, deleteDoc, collection, query, orderBy, limit, writeBatch, increment } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../../firebase';
import TRANSLATIONS from '../../constants/translations';
import { logAction } from '../../utils/auditLog';
import { refNightsOf, refBonusFor, refStayState, newRefCode, normPhone9 } from '../../utils/referral';

/**
 * «Бонусы» — реферальная программа (владелец 2026-09-28).
 * Приглашённый живёт → пригласившему за каждые сутки сумма из настроек;
 * после выезда без долга сервер (functions/referralFunctions.js) сам кладёт
 * её на баланс клиента и пишет в журнал referralLedger. Клиент видит всё в боте
 * @Hostellauzbot. Здесь: настройки, пригласившие и их гости, журнал,
 * привязка Telegram по коду из бота, ручная корректировка (админ).
 */

const P = (...p) => [...PUBLIC_DATA_PATH, ...p];
const fmt = (n) => (Number(n) || 0).toLocaleString('ru-RU');
const dm = (d) => { const x = new Date(d || 0); return x.getTime() ? x.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'; };
const norm = (s) => String(s || '').toLowerCase();

const ReferralView = ({ clients = [], guests = [], currentUser, showNotification, lang = 'ru' }) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super';
    const staffId = currentUser?.id || currentUser?.login || '';
    const [settings, setSettings] = useState(null);
    const [form, setForm] = useState(null);
    const [ledger, setLedger] = useState([]);
    const [open, setOpen] = useState(null);
    const [q, setQ] = useState('');
    const [link, setLink] = useState({ code: '', q: '', clientId: '' });
    const [adj, setAdj] = useState({ q: '', clientId: '', amount: '', sign: 1, note: '' });
    const [busy, setBusy] = useState(false);

    useEffect(() => onSnapshot(doc(db, ...P('settings', 'referralProgram')), (s) => {
        const d = s.exists() ? s.data() : {};
        setSettings({ active: !!d.active, ratePerNight: Number(d.ratePerNight) || 0, maxNightsPerStay: Number(d.maxNightsPerStay) || 0 });
    }, () => setSettings({ active: false, ratePerNight: 0, maxNightsPerStay: 0 })), []);
    useEffect(() => { if (settings && !form) setForm({ ...settings }); }, [settings, form]);
    useEffect(() => onSnapshot(query(collection(db, ...P('referralLedger')), orderBy('date', 'desc'), limit(300)),
        (s) => setLedger(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => setLedger([])), []);

    const clientById = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);

    // Пригласившие: у кого есть приглашённые проживания или код
    const referrers = useMemo(() => {
        const stays = new Map();
        for (const g of guests) {
            if (!g?.referrerClientId || (g.status !== 'active' && g.status !== 'checked_out')) continue;
            if (!stays.has(g.referrerClientId)) stays.set(g.referrerClientId, []);
            stays.get(g.referrerClientId).push(g);
        }
        // Начислено = бонусы за проживания (на самих проживаниях) + ручные корректировки из журнала
        const adjusts = new Map();
        for (const l of ledger) if (l.type === 'adjust') adjusts.set(l.referrerClientId, (adjusts.get(l.referrerClientId) || 0) + (Number(l.amount) || 0));
        const ids = new Set([...stays.keys(), ...clients.filter(c => c.refCode || c.tgChatId).map(c => c.id)]);
        return [...ids].map(id => {
            const c = clientById.get(id) || { id, fullName: '—' };
            const list = (stays.get(id) || []).sort((a, b) => String(b.checkInDate || '').localeCompare(String(a.checkInDate || '')));
            const rows = list.map(g => {
                const st = refStayState(g);
                const nights = refNightsOf(g);
                const amount = st === 'credited' ? Number(g.refBonusCredited) || 0 : refBonusFor(nights, settings || {}).amount;
                return { g, st, nights, amount };
            });
            return {
                c, rows,
                invited: new Set(list.map(g => g.refereeClientId || g.passportClean || g.fullName)).size,
                living: rows.filter(r => r.st === 'living').length,
                pending: rows.filter(r => r.st !== 'credited').reduce((s, r) => s + r.amount, 0),
                credited: rows.filter(r => r.st === 'credited').reduce((s, r) => s + r.amount, 0) + (adjusts.get(id) || 0),
            };
        }).filter(r => !q || norm(r.c.fullName).includes(norm(q)) || norm(r.c.refCode).includes(norm(q)) || norm(r.c.phone).includes(norm(q)))
          .sort((a, b) => (b.credited + b.pending) - (a.credited + a.pending) || String(a.c.fullName).localeCompare(String(b.c.fullName)));
    }, [guests, clients, clientById, ledger, settings, q]);

    const clientSearch = (text) => {
        const s = norm(text).trim();
        if (s.length < 2) return [];
        const ph = normPhone9(text);
        return clients.filter(c => norm(c.fullName).includes(s) || norm(c.passport).replace(/\s/g, '').includes(s.replace(/\s/g, ''))
            || (ph && normPhone9(c.phone) === ph) || norm(c.refCode) === s).slice(0, 8);
    };

    const saveSettings = async () => {
        const rate = Math.max(0, Math.round(Number(String(form.ratePerNight).replace(/\D/g, '')) || 0));
        const cap = Math.max(0, Math.round(Number(String(form.maxNightsPerStay).replace(/\D/g, '')) || 0));
        if (form.active && !rate) { showNotification?.(t('rfErrRate'), 'error'); return; }
        try {
            await setDoc(doc(db, ...P('settings', 'referralProgram')), { active: !!form.active, ratePerNight: rate, maxNightsPerStay: cap, updatedAt: new Date().toISOString(), updatedBy: staffId }, { merge: true });
            logAction(currentUser, 'referral_settings', { active: !!form.active, ratePerNight: rate, maxNightsPerStay: cap });
            showNotification?.(t('rfSaved'), 'success');
        } catch (e) { showNotification?.(t('rfErr') + e.message, 'error'); }
    };

    const giveCode = async (c) => {
        const code = newRefCode(clients);
        if (!code) return;
        try { await updateDoc(doc(db, ...P('clients', c.id)), { refCode: code }); showNotification?.(t('rfCodeGiven').replace('{code}', code), 'success'); }
        catch (e) { showNotification?.(t('rfErr') + e.message, 'error'); }
    };

    // Привязка Telegram: гость нажал в боте «Получить код», показывает 6 цифр
    const linkTelegram = async () => {
        const code = link.code.replace(/\D/g, '');
        const c = clientById.get(link.clientId);
        if (code.length !== 6 || !c) { showNotification?.(t('rfLinkFill'), 'error'); return; }
        setBusy(true);
        try {
            const ref = doc(db, ...P('tgLinkCodes', code));
            const s = await getDoc(ref);
            if (!s.exists()) { showNotification?.(t('rfLinkBad'), 'error'); return; }
            const d = s.data();
            if (new Date(d.expiresAt).getTime() < Date.now()) { await deleteDoc(ref).catch(() => {}); showNotification?.(t('rfLinkExpired'), 'error'); return; }
            const other = clients.find(x => x.tgChatId === d.chatId && x.id !== c.id);
            if (other) await updateDoc(doc(db, ...P('clients', other.id)), { tgChatId: null });
            await updateDoc(doc(db, ...P('clients', c.id)), {
                tgChatId: d.chatId, tgLinkedAt: new Date().toISOString(), tgLinkedBy: staffId,
                ...(c.refCode ? {} : { refCode: newRefCode(clients) }),
            });
            await deleteDoc(ref).catch(() => {});
            logAction(currentUser, 'referral_tg_link', { clientId: c.id, clientName: c.fullName });
            showNotification?.(t('rfLinked').replace('{name}', c.fullName), 'success');
            setLink({ code: '', q: '', clientId: '' });
        } catch (e) { showNotification?.(t('rfErr') + e.message, 'error'); }
        finally { setBusy(false); }
    };

    // Ручная корректировка (админ): запись в журнал + баланс клиента, одним пакетом
    const adjust = async () => {
        const c = clientById.get(adj.clientId);
        const amt = Math.round(Number(String(adj.amount).replace(/\D/g, '')) || 0) * adj.sign;
        if (!c || !amt || !adj.note.trim()) { showNotification?.(t('rfAdjFill'), 'error'); return; }
        setBusy(true);
        try {
            const b = writeBatch(db);
            b.set(doc(collection(db, ...P('referralLedger'))), {
                type: 'adjust', referrerClientId: c.id, amount: amt, note: adj.note.trim().slice(0, 200),
                balanceBefore: Number(c.balance) || 0, staffId, date: new Date().toISOString(),
            });
            b.update(doc(db, ...P('clients', c.id)), { balance: increment(amt), refBonusTotal: increment(amt) });
            await b.commit();
            logAction(currentUser, 'referral_adjust', { clientId: c.id, clientName: c.fullName, amount: amt, note: adj.note.trim() });
            showNotification?.(t('rfAdjDone'), 'success');
            setAdj({ q: '', clientId: '', amount: '', sign: 1, note: '' });
        } catch (e) { showNotification?.(t('rfErr') + e.message, 'error'); }
        finally { setBusy(false); }
    };

    const stLabel = { credited: t('rfStCredited'), living: t('rfStLiving'), debt: t('rfStDebt'), pending: t('rfStPending') };
    const stCls = { credited: 'bg-emerald-50 text-emerald-700', living: 'bg-indigo-50 text-indigo-700', debt: 'bg-rose-50 text-rose-700', pending: 'bg-amber-50 text-amber-700' };
    const card = 'bg-white border border-slate-200 rounded-2xl p-4 shadow-sm';
    const inp = 'px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-400';
    const totals = referrers.reduce((a, r) => ({ credited: a.credited + r.credited, pending: a.pending + r.pending, invited: a.invited + r.invited }), { credited: 0, pending: 0, invited: 0 });

    const ClientPicker = ({ value, text, onText, onPick }) => {
        const picked = clientById.get(value);
        const list = picked ? [] : clientSearch(text);
        return (
            <div className="relative">
                {picked ? (
                    <div className={inp + ' flex items-center justify-between gap-2'}>
                        <span className="font-semibold truncate">{picked.fullName}</span>
                        <button onClick={() => onPick('')} className="text-xs text-slate-400 hover:text-rose-500">✕</button>
                    </div>
                ) : (
                    <input className={inp + ' w-full'} value={text} onChange={e => onText(e.target.value)} placeholder={t('rfClientPh')} />
                )}
                {list.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-auto">
                        {list.map(c => (
                            <button key={c.id} onClick={() => onPick(c.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                                <span className="font-semibold">{c.fullName}</span> <span className="text-xs text-slate-400">{c.passport || ''} {c.phone || ''}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="p-3 md:p-6 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
                <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center"><Gift size={20} className="text-white" /></div>
                <div>
                    <h2 className="font-black text-xl text-slate-800">{t('rfTitle')}</h2>
                    <p className="text-xs text-slate-500">{t('rfSubtitle')}</p>
                </div>
                <span className={`ml-auto text-xs font-black px-3 py-1.5 rounded-full ${settings?.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {settings?.active ? t('rfOn').replace('{rate}', fmt(settings.ratePerNight)) : t('rfOff')}
                </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
                {[[t('rfTotInvited'), totals.invited], [t('rfTotCredited'), fmt(totals.credited)], [t('rfTotPending'), fmt(totals.pending)]].map(([l, v]) => (
                    <div key={l} className={card + ' !p-3'}><div className="text-[10px] font-bold uppercase text-slate-400">{l}</div><div className="text-lg font-black text-slate-800">{v}</div></div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {isAdmin && form && (
                    <div className={card + ' space-y-3'}>
                        <div className="font-black text-slate-800">{t('rfSettings')}</div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} /> {t('rfActive')}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <label className="text-xs font-bold text-slate-500">{t('rfRate')}
                                <input className={inp + ' w-full mt-1'} inputMode="numeric" value={form.ratePerNight || ''} onChange={e => setForm(f => ({ ...f, ratePerNight: e.target.value.replace(/\D/g, '') }))} placeholder="5000" /></label>
                            <label className="text-xs font-bold text-slate-500">{t('rfMaxNights')}
                                <input className={inp + ' w-full mt-1'} inputMode="numeric" value={form.maxNightsPerStay || ''} onChange={e => setForm(f => ({ ...f, maxNightsPerStay: e.target.value.replace(/\D/g, '') }))} placeholder="0" /></label>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug">{t('rfRulesHint')}</p>
                        <button onClick={saveSettings} className="px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-bold flex items-center gap-1.5"><Check size={14} /> {t('rfSave')}</button>
                    </div>
                )}

                <div className={card + ' space-y-3'}>
                    <div className="font-black text-slate-800 flex items-center gap-2"><Link2 size={16} /> {t('rfLinkTitle')}</div>
                    <p className="text-[11px] text-slate-500 leading-snug">{t('rfLinkHint')}</p>
                    <div className="grid grid-cols-[110px_1fr] gap-2">
                        <input className={inp + ' tabular-nums tracking-widest text-center font-black'} inputMode="numeric" maxLength={6} value={link.code} onChange={e => setLink(l => ({ ...l, code: e.target.value.replace(/\D/g, '') }))} placeholder="000000" />
                        <ClientPicker value={link.clientId} text={link.q} onText={v => setLink(l => ({ ...l, q: v }))} onPick={id => setLink(l => ({ ...l, clientId: id }))} />
                    </div>
                    <button disabled={busy} onClick={linkTelegram} className="px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"><Send size={14} /> {t('rfLinkBtn')}</button>
                </div>

                {isAdmin && (
                    <div className={card + ' space-y-3'}>
                        <div className="font-black text-slate-800">{t('rfAdjTitle')}</div>
                        <ClientPicker value={adj.clientId} text={adj.q} onText={v => setAdj(a => ({ ...a, q: v }))} onPick={id => setAdj(a => ({ ...a, clientId: id }))} />
                        <div className="flex gap-2">
                            <button onClick={() => setAdj(a => ({ ...a, sign: a.sign * -1 }))} className={`px-3 rounded-xl border text-sm font-black ${adj.sign > 0 ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-rose-200 text-rose-700 bg-rose-50'}`}>{adj.sign > 0 ? <Plus size={14} /> : <Minus size={14} />}</button>
                            <input className={inp + ' flex-1 tabular-nums'} inputMode="numeric" value={adj.amount} onChange={e => setAdj(a => ({ ...a, amount: e.target.value.replace(/\D/g, '') }))} placeholder={t('rfAdjAmount')} />
                        </div>
                        <input className={inp + ' w-full'} value={adj.note} onChange={e => setAdj(a => ({ ...a, note: e.target.value }))} placeholder={t('rfAdjNote')} />
                        <button disabled={busy} onClick={adjust} className="px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-bold disabled:opacity-50">{t('rfAdjBtn')}</button>
                    </div>
                )}
            </div>

            <div className={card + ' !p-0 overflow-hidden'}>
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                    <div className="font-black text-slate-800 flex-1">{t('rfReferrers')}</div>
                    <div className="relative"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input className={inp + ' pl-7 w-48'} value={q} onChange={e => setQ(e.target.value)} placeholder={t('rfSearch')} /></div>
                </div>
                {referrers.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">{t('rfEmpty')}</div> : referrers.map(r => (
                    <div key={r.c.id} className="border-b border-slate-50">
                        <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/60 cursor-pointer" onClick={() => setOpen(open === r.c.id ? null : r.c.id)}>
                            {open === r.c.id ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm text-slate-800 truncate">{r.c.fullName}</div>
                                <div className="text-[11px] text-slate-500 flex gap-2 flex-wrap">
                                    {r.c.refCode ? <span className="font-mono font-bold text-slate-700">{r.c.refCode}</span>
                                        : <button onClick={(e) => { e.stopPropagation(); giveCode(r.c); }} className="text-indigo-600 font-bold hover:underline">{t('rfGiveCode')}</button>}
                                    <span>{r.c.tgChatId ? '✈️ ' + t('rfTgYes') : t('rfTgNo')}</span>
                                    <span>{t('rfInvitedN').replace('{n}', r.invited)}{r.living ? ` · ${t('rfLivingN').replace('{n}', r.living)}` : ''}</span>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-sm font-black text-emerald-700 tabular-nums">{fmt(r.credited)}</div>
                                {r.pending > 0 && <div className="text-[11px] text-amber-600 tabular-nums">+{fmt(r.pending)} {t('rfPendingShort')}</div>}
                            </div>
                        </div>
                        {open === r.c.id && (
                            <div className="px-10 pb-3 space-y-1">
                                {r.rows.length === 0 ? <div className="text-xs text-slate-400">{t('rfNoStays')}</div> : r.rows.map(({ g, st, nights, amount }) => (
                                    <div key={g.id} className="flex items-center gap-2 text-xs">
                                        <span className="flex-1 truncate text-slate-700">{g.fullName} <span className="text-slate-400">{dm(g.checkInDate)} → {dm(g.checkOutDate)}</span></span>
                                        <span className="text-slate-500">{t('rfNights').replace('{n}', nights)}</span>
                                        <span className={`px-2 py-0.5 rounded-full font-bold ${stCls[st]}`}>{stLabel[st]}</span>
                                        <span className="w-20 text-right font-black tabular-nums">{fmt(amount)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className={card + ' !p-0 overflow-hidden'}>
                <div className="px-4 py-3 border-b border-slate-100 font-black text-slate-800">{t('rfLedger')}</div>
                {ledger.length === 0 ? <div className="p-6 text-center text-sm text-slate-400">{t('rfLedgerEmpty')}</div> : ledger.slice(0, 100).map(l => (
                    <div key={l.id} className="flex items-center gap-3 px-4 py-2 border-b border-slate-50 text-sm">
                        <span className="w-16 text-xs text-slate-400">{dm(l.date)}</span>
                        <span className="flex-1 min-w-0 truncate">
                            <span className="font-semibold text-slate-800">{clientById.get(l.referrerClientId)?.fullName || '—'}</span>
                            <span className="text-xs text-slate-500"> · {l.type === 'accrual' ? t('rfLedgerAccrual').replace('{name}', l.guestName || '—').replace('{n}', l.nights || 0).replace('{rate}', fmt(l.rate)) : `${t('rfLedgerAdjust')}: ${l.note || ''}`}</span>
                        </span>
                        <span className={`font-black tabular-nums ${Number(l.amount) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{Number(l.amount) >= 0 ? '+' : ''}{fmt(l.amount)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ReferralView;
