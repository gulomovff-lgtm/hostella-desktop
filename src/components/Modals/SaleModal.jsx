import React, { useMemo, useState, useEffect } from 'react';
import { X, Plus, Minus, Trash2, Check, ShoppingBag } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import { fmtSum, parseSum } from '../../utils/helpers';
import { buildLines, linesTotal, stockOf, stockShortages, PAY_METHODS } from '../../utils/shop';

const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5';
const inputCls = 'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:border-orange-400 outline-none';
const money = (n) => (Number(n) || 0).toLocaleString('ru-RU');

/**
 * Продажа услуги или товара: гостю (в счёт или сразу) или «с улицы» (только
 * сразу). Цены позиций справочника — из справочника; разовую услугу кассир
 * вводит сам. Товар без остатка в филиале не продаётся.
 */
const SaleModal = ({ guest = null, catalog = [], hostels = [], defaultHostelId = '', lang = 'ru', onSubmit, onClose }) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;
    const fixedHostel = guest?.hostelId || '';
    const [hostelId, setHostelId] = useState(fixedHostel || (defaultHostelId && defaultHostelId !== 'all' ? defaultHostelId : '') || hostels[0]?.id || 'hostel1');
    const [filter, setFilter] = useState('all');
    const [cart, setCart] = useState([]);                  // [{ key, itemId?, name?, price?, qty }]
    const [manual, setManual] = useState({ name: '', price: '' });
    const [mode, setMode] = useState(guest ? 'account' : 'paid');
    const [method, setMethod] = useState('cash');
    const [busy, setBusy] = useState(false);

    const items = useMemo(() => (catalog || []).filter(i => i.active !== false)
        .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'service' ? -1 : 1) || String(a.name).localeCompare(String(b.name))), [catalog]);
    const shown = items.filter(i => filter === 'all' || i.kind === filter);
    const lines = useMemo(() => buildLines(cart, catalog), [cart, catalog]);
    const total = linesTotal(lines);
    const shortages = useMemo(() => stockShortages(lines, catalog, hostelId), [lines, catalog, hostelId]);
    const inCart = (itemId) => cart.filter(c => c.itemId === itemId).reduce((s, c) => s + c.qty, 0);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [busy, onClose]);

    const addItem = (it) => {
        setCart(c => {
            // Остаток проверяем по актуальной корзине, а не по снимку рендера —
            // иначе двойной клик клал в корзину больше, чем есть на складе.
            const have = c.filter(x => x.itemId === it.id).reduce((s, x) => s + x.qty, 0);
            if (it.kind === 'product' && have >= stockOf(it, hostelId)) return c;
            const i = c.findIndex(x => x.itemId === it.id);
            if (i >= 0) return c.map((x, j) => j === i ? { ...x, qty: x.qty + 1 } : x);
            return [...c, { key: it.id, itemId: it.id, qty: 1 }];
        });
    };
    const addManual = () => {
        const name = manual.name.trim();
        const price = parseInt(manual.price) || 0;
        if (!name || price <= 0) return;
        setCart(c => [...c, { key: 'm' + Date.now(), name, price, qty: 1 }]);
        setManual({ name: '', price: '' });
    };
    const bump = (key, d) => setCart(c => c.map(x => {
        if (x.key !== key) return x;
        const it = x.itemId ? catalog.find(i => i.id === x.itemId) : null;
        const cap = it?.kind === 'product' ? stockOf(it, hostelId) : Infinity;
        return { ...x, qty: Math.max(1, Math.min(cap, x.qty + d)) };
    }));
    const remove = (key) => setCart(c => c.filter(x => x.key !== key));

    const submit = async () => {
        if (busy || !lines.length || shortages.length) return;
        setBusy(true);
        try {
            const ok = await onSubmit?.({ guest, hostelId, cart: cart.map(({ key, ...rest }) => rest), mode, method });
            if (ok !== false) onClose?.();
        } finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: 'rgba(8,18,20,0.55)' }}
            onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose?.(); }}>
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '92vh' }}>
                <div className="shrink-0 px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0"><ShoppingBag size={18} /></div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-black text-slate-800 truncate">{guest ? t('shSaleToGuest').replace('{name}', guest.fullName || '') : t('shSaleWalkIn')}</h2>
                        <p className="text-xs text-slate-400">{guest ? `№${guest.roomNumber || '—'}` : t('shWalkInHint')}</p>
                    </div>
                    {!fixedHostel && hostels.length > 1 && (
                        <select className={inputCls + ' w-auto'} value={hostelId} onChange={e => { setHostelId(e.target.value); setCart(c => c.filter(x => !x.itemId || catalog.find(i => i.id === x.itemId)?.kind !== 'product')); }}>
                            {hostels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                        </select>
                    )}
                    <button onClick={onClose} disabled={busy} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-y-auto grid md:grid-cols-[1fr_320px]">
                    {/* Справочник */}
                    <div className="p-4 space-y-3 border-b md:border-b-0 md:border-r border-slate-100">
                        <div className="flex gap-1.5">
                            {['all', 'service', 'product'].map(f => (
                                <button key={f} onClick={() => setFilter(f)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${filter === f ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>
                                    {t('shFilter_' + f)}
                                </button>
                            ))}
                        </div>
                        {shown.length === 0 ? (
                            <div className="text-sm text-slate-400 py-6 text-center">{t('shCatalogEmpty')}</div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {shown.map(it => {
                                    const left = it.kind === 'product' ? stockOf(it, hostelId) - inCart(it.id) : null;
                                    const off = it.kind === 'product' && left <= 0;
                                    return (
                                        <button key={it.id} type="button" disabled={off} onClick={() => addItem(it)}
                                            className={`text-left p-2.5 rounded-xl border transition-colors ${off ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed' : 'border-slate-200 hover:border-teal-300 hover:bg-teal-50'}`}>
                                            <div className="text-sm font-bold text-slate-800 leading-tight">{it.emoji ? `${it.emoji} ` : ''}{it.name}</div>
                                            <div className="mt-1 flex items-center justify-between gap-1">
                                                <span className="text-xs font-black text-teal-700 tabular-nums">{money(it.price)}</span>
                                                {it.kind === 'product' && (
                                                    <span className={`text-[10.5px] font-black px-1.5 py-0.5 rounded-full ${left > 0 ? 'bg-slate-100 text-slate-500' : 'bg-rose-50 text-rose-600'}`}>{t('shLeft').replace('{n}', Math.max(0, left))}</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <div className="pt-2 border-t border-slate-100">
                            <label className={labelCls}>{t('shManualService')}</label>
                            <div className="flex gap-2">
                                <input className={inputCls} value={manual.name} onChange={e => setManual(m => ({ ...m, name: e.target.value }))} placeholder={t('shManualNamePh')} />
                                <input className={inputCls + ' w-32 tabular-nums'} inputMode="numeric" value={fmtSum(manual.price)} onChange={e => setManual(m => ({ ...m, price: String(parseSum(e.target.value) || '') }))} placeholder={t('shPricePh')}
                                    onKeyDown={e => { if (e.key === 'Enter') addManual(); }} />
                                <button onClick={addManual} className="px-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0"><Plus size={16} /></button>
                            </div>
                        </div>
                    </div>

                    {/* Корзина и оплата */}
                    <div className="p-4 flex flex-col gap-3 bg-slate-50/60">
                        <div className={labelCls}>{t('shCart')}</div>
                        {lines.length === 0 ? (
                            <div className="text-sm text-slate-400">{t('shCartEmpty')}</div>
                        ) : (
                            <div className="space-y-1.5">
                                {cart.map(c => {
                                    const l = buildLines([c], catalog)[0];
                                    if (!l) return null;
                                    return (
                                        <div key={c.key} className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-2.5 py-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold text-slate-800 truncate">{l.name}</div>
                                                <div className="text-[11px] text-slate-400 tabular-nums">{money(l.price)} × {l.qty}</div>
                                            </div>
                                            <button onClick={() => bump(c.key, -1)} className="p-1 rounded-md hover:bg-slate-100 text-slate-500"><Minus size={13} /></button>
                                            <span className="w-5 text-center text-sm font-black tabular-nums">{l.qty}</span>
                                            <button onClick={() => bump(c.key, 1)} className="p-1 rounded-md hover:bg-slate-100 text-slate-500"><Plus size={13} /></button>
                                            <span className="w-16 text-right text-sm font-black tabular-nums">{money(l.sum)}</span>
                                            <button onClick={() => remove(c.key)} className="p-1 rounded-md hover:bg-rose-50 text-rose-400"><Trash2 size={13} /></button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {shortages.length > 0 && (
                            <div className="text-xs font-bold text-rose-600">{shortages.map(s => t('shShortage').replace('{name}', s.name).replace('{have}', s.have)).join('; ')}</div>
                        )}

                        {guest && (
                            <div>
                                <div className={labelCls}>{t('shPayMode')}</div>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {['account', 'paid'].map(m => (
                                        <button key={m} onClick={() => setMode(m)}
                                            className={`py-2 rounded-xl text-xs font-bold border ${mode === m ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>
                                            {t('shMode_' + m)}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1">{t('shModeHint_' + mode)}</p>
                            </div>
                        )}
                        {mode === 'paid' && (
                            <div>
                                <div className={labelCls}>{t('shMethod')}</div>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {PAY_METHODS.map(m => (
                                        <button key={m} onClick={() => setMethod(m)}
                                            className={`py-2 rounded-xl text-xs font-bold border ${method === m ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                                            {t('spM_' + m)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mt-auto pt-3 border-t border-slate-200 flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-500">{t('shTotal')}</span>
                            <span className="text-xl font-black text-slate-800 tabular-nums">{money(total)} <span className="text-xs font-bold text-slate-400">{t('sum')}</span></span>
                        </div>
                        <button onClick={submit} disabled={busy || !lines.length || shortages.length > 0}
                            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50">
                            <Check size={16} /> {mode === 'account' ? t('shSubmitAccount') : t('shSubmitPaid')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SaleModal;
