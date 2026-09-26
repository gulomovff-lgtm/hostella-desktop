import React, { useMemo, useState } from 'react';
import { ShoppingBag, Package, ListChecks, Plus, X, Pencil, RotateCcw, Check, ImagePlus, Trash2 } from 'lucide-react';
import { resizeImage } from '../../utils/imageResize';
import TRANSLATIONS from '../../constants/translations';
import { fmtSum } from '../../utils/helpers';
import { salesSummary, canCancelSale, stockOf, KINDS } from '../../utils/shop';
import { stableView } from '../UI/stableView';

const money = (n) => (Number(n) || 0).toLocaleString('ru-RU');
const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5';
const inputCls = 'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:border-orange-400 outline-none';

/**
 * «Услуги и товары»: продажи за день, склад напитков, справочник.
 * Продавать может любой сотрудник; склад и справочник правит админ.
 */
const ShopView = ({
    catalog = [], sales = [], stockMoves = [], users = [], shifts = [], currentUser, hostels = [], selectedHostelFilter = 'all', lang = 'ru',
    onNewSale, onCancelSale, onSaveItem, onStockIn, onStockAdjust,
}) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super';
    const [tab, setTab] = useState('sales');
    const [day, setDay] = useState(dayKey(new Date()));
    const [editItem, setEditItem] = useState(null);     // позиция справочника в правке ({} — новая)
    const [stockForm, setStockForm] = useState(null);   // { item, mode: 'in'|'adjust', hostelId, qty, unitCost, payFromCash, actual }
    const hostelOk = (h) => !selectedHostelFilter || selectedHostelFilter === 'all' || h === selectedHostelFilter;
    const shownHostels = hostels.filter(h => hostelOk(h.id));
    const staffName = (id) => users.find(u => u.id === id || u.login === id)?.name || '—';
    // Открытая смена хостела — для «оплачено из кассы смены»
    const openShiftOf = (hid) => (shifts || []).find(sh => sh && !sh.endTime && sh.hostelId === hid) || null;
    const defaultPayFrom = (hid) => (openShiftOf(hid) ? 'shift' : 'admin');

    const daySales = useMemo(() => (sales || [])
        .filter(s => s && hostelOk(s.hostelId) && s.date && dayKey(new Date(s.date)) === day)
        .sort((a, b) => String(b.date).localeCompare(String(a.date))), [sales, day, selectedHostelFilter]); // eslint-disable-line react-hooks/exhaustive-deps
    const sum = useMemo(() => salesSummary(daySales), [daySales]);
    const products = useMemo(() => (catalog || []).filter(i => i.kind === 'product').sort((a, b) => String(a.name).localeCompare(String(b.name))), [catalog]);
    const moves = useMemo(() => (stockMoves || []).filter(m => hostelOk(m.hostelId)).slice(0, 40), [stockMoves, selectedHostelFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    const tabs = [
        { id: 'sales', icon: ShoppingBag, label: t('shTabSales') },
        { id: 'stock', icon: Package, label: t('shTabStock') },
        ...(isAdmin ? [{ id: 'catalog', icon: ListChecks, label: t('shTabCatalog') }] : []),
    ];

    const saveStock = async () => {
        const f = stockForm;
        const ok = f.mode === 'in'
            ? await onStockIn?.({ item: f.item, hostelId: f.hostelId, qty: parseInt(f.qty) || 0, unitCost: parseInt(f.unitCost) || 0,
                payFrom: f.payFrom, shiftId: f.payFrom === 'shift' ? openShiftOf(f.hostelId)?.id : null })
            : await onStockAdjust?.({ item: f.item, hostelId: f.hostelId, actual: parseInt(f.actual) });
        if (ok) setStockForm(null);
    };
    const closeItem = () => { if (editItem?.photoPreview) URL.revokeObjectURL(editItem.photoPreview); setEditItem(null); };
    const saveItem = async () => {
        const { photoPreview, priceFocused, ...item } = editItem; // eslint-disable-line no-unused-vars
        if (await onSaveItem?.(item)) { if (photoPreview) URL.revokeObjectURL(photoPreview); setEditItem(null); }
    };
    const pickPhoto = async (file) => {
        if (!file) return;
        try {
            const blob = await resizeImage(file);
            setEditItem(x => { if (x?.photoPreview) URL.revokeObjectURL(x.photoPreview); return { ...x, photoFile: blob, photoPreview: URL.createObjectURL(blob), removePhoto: false }; });
        } catch { window.alert(t('shPhotoBad')); }
    };
    const Thumb = ({ item, size = 'w-8 h-8' }) => item.photoUrl
        ? <img src={item.photoUrl} alt="" loading="lazy" className={`${size} rounded-lg object-cover border border-slate-200 shrink-0`} />
        : <span className={`${size} rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-base shrink-0`}>{item.emoji || (item.kind === 'product' ? '🥤' : '🧺')}</span>;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                <h1 className="text-xl md:text-2xl font-black text-slate-800">{t('shTitle')}</h1>
                <span className="text-sm text-slate-400">{t('shSubtitle')}</span>
                <button onClick={() => onNewSale?.()} className="ml-auto flex items-center gap-1.5 px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold shadow-sm">
                    <Plus size={15} /> {t('shNewSale')}
                </button>
            </div>

            <div className="flex gap-1.5">
                {tabs.map(tb => (
                    <button key={tb.id} onClick={() => setTab(tb.id)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold border ${tab === tb.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>
                        <tb.icon size={14} /> {tb.label}
                    </button>
                ))}
            </div>

            {tab === 'sales' && (
                <>
                    <div className="flex flex-wrap items-center gap-3">
                        <input type="date" className={inputCls + ' w-auto'} value={day} onChange={e => setDay(e.target.value)} />
                        <div className="flex flex-wrap gap-2 text-sm">
                            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 font-bold tabular-nums">{t('shSumPaid')}: {money(sum.paid)}</span>
                            <span className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 font-bold tabular-nums">{t('shSumAccount')}: {money(sum.account)}</span>
                            <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-bold tabular-nums">{t('shSumCount').replace('{n}', sum.count)}</span>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                        {daySales.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm">{t('shNoSales')}</div>
                        ) : daySales.map(s => {
                            const off = s.status === 'cancelled';
                            return (
                                <div key={s.id} className={`flex items-center gap-3 px-4 py-3 ${off ? 'opacity-50' : ''}`}>
                                    <span className={`w-1 self-stretch rounded-full ${off ? 'bg-slate-300' : s.mode === 'account' ? 'bg-indigo-400' : 'bg-emerald-400'}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-sm font-bold text-slate-800 truncate ${off ? 'line-through' : ''}`}>
                                            {s.guestName || t('shWalkIn')}{s.roomNumber ? <span className="text-slate-400 font-semibold"> · №{s.roomNumber}</span> : null}
                                        </div>
                                        <div className="text-xs text-slate-500 truncate">{(s.items || []).map(l => `${l.name}${l.qty > 1 ? ` ×${l.qty}` : ''}`).join(', ')}</div>
                                        <div className="text-[11px] text-slate-400 tabular-nums">{new Date(s.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} · {s.staffName || staffName(s.staffId)}</div>
                                    </div>
                                    <span className={`text-[10.5px] font-black px-2 py-0.5 rounded-full ${off ? 'bg-slate-100 text-slate-500' : s.mode === 'account' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                        {off ? t('shCancelledPill') : s.mode === 'account' ? t('shMode_account') : t('spM_' + (s.method || 'cash'))}
                                    </span>
                                    <span className="w-24 text-right font-black tabular-nums text-slate-800">{money(s.total)}</span>
                                    {!off && canCancelSale(s, currentUser) ? (
                                        <button onClick={() => { if (window.confirm(t('shCancelConfirm'))) onCancelSale?.(s); }} title={t('shCancel')}
                                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50"><RotateCcw size={14} /></button>
                                    ) : <span className="w-7" />}
                                </div>
                            );
                        })}
                    </div>
                    {sum.items.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-200 p-4">
                            <div className={labelCls}>{t('shByItems')}</div>
                            <div className="space-y-1">
                                {sum.items.map(i => (
                                    <div key={i.name} className="flex justify-between text-sm">
                                        <span className="text-slate-700">{i.name} <span className="text-slate-400 tabular-nums">×{i.qty}</span></span>
                                        <span className="font-bold tabular-nums">{money(i.sum)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {tab === 'stock' && (
                <>
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                                    <th className="text-left px-4 py-2.5">{t('shItem')}</th>
                                    <th className="text-right px-4 py-2.5">{t('shPrice')}</th>
                                    {shownHostels.map(h => <th key={h.id} className="text-right px-4 py-2.5">{h.name}</th>)}
                                    {isAdmin && <th className="px-4 py-2.5" />}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {products.length === 0 ? (
                                    <tr><td colSpan={3 + shownHostels.length} className="p-8 text-center text-slate-400">{t('shNoProducts')}</td></tr>
                                ) : products.map(p => (
                                    <tr key={p.id} className={p.active === false ? 'opacity-50' : ''}>
                                        <td className="px-4 py-2.5 font-bold text-slate-800"><span className="flex items-center gap-2"><Thumb item={p} />{p.name}</span></td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">{money(p.price)}</td>
                                        {shownHostels.map(h => {
                                            const n = stockOf(p, h.id);
                                            return <td key={h.id} className={`px-4 py-2.5 text-right font-black tabular-nums ${n <= 0 ? 'text-rose-600' : n <= 5 ? 'text-amber-600' : 'text-slate-800'}`}>{n}</td>;
                                        })}
                                        {isAdmin && (
                                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                                <button onClick={() => setStockForm({ item: p, mode: 'in', hostelId: shownHostels[0]?.id || 'hostel1', qty: '', unitCost: p.costPrice ? String(p.costPrice) : '', payFrom: defaultPayFrom(shownHostels[0]?.id || 'hostel1') })}
                                                    className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold">{t('shStockIn')}</button>
                                                <button onClick={() => setStockForm({ item: p, mode: 'adjust', hostelId: shownHostels[0]?.id || 'hostel1', actual: String(stockOf(p, shownHostels[0]?.id || 'hostel1')) })}
                                                    className="ml-1.5 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50">{t('shStockAdjust')}</button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {moves.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-200 p-4">
                            <div className={labelCls}>{t('shMoves')}</div>
                            <div className="divide-y divide-slate-100">
                                {moves.map(m => (
                                    <div key={m.id} className="flex items-center gap-3 py-1.5 text-sm">
                                        <span className="w-28 text-xs text-slate-400 tabular-nums">{new Date(m.date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                        <span className="flex-1 min-w-0 truncate text-slate-700">{m.itemName} <span className="text-slate-400">· {t('shReason_' + m.reason)}</span></span>
                                        <span className={`font-black tabular-nums ${m.qty > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{m.qty > 0 ? '+' : ''}{m.qty}</span>
                                        <span className="w-24 text-right text-xs text-slate-400">{staffName(m.staffId)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {tab === 'catalog' && isAdmin && (
                <div className="space-y-3">
                    <button onClick={() => setEditItem({ name: '', kind: 'service', price: '', emoji: '', active: true })}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold">
                        <Plus size={15} /> {t('shAddItem')}
                    </button>
                    <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                        {(catalog || []).length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm">{t('shCatalogEmpty')}</div>
                        ) : [...catalog].sort((a, b) => (a.kind === b.kind ? String(a.name).localeCompare(String(b.name)) : a.kind === 'service' ? -1 : 1)).map(i => (
                            <div key={i.id} className={`flex items-center gap-3 px-4 py-2.5 ${i.active === false ? 'opacity-50' : ''}`}>
                                <Thumb item={i} size="w-10 h-10" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-slate-800 truncate">{i.name}</div>
                                    <div className="text-[11px] text-slate-400">{t('shKind_' + i.kind)}{i.active === false ? ` · ${t('shHidden')}` : ''}</div>
                                </div>
                                <span className="font-black tabular-nums">{money(i.price)}</span>
                                <button onClick={() => setEditItem({ ...i, price: String(i.price || '') })} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><Pencil size={14} /></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Правка позиции справочника */}
            {editItem && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: 'rgba(8,18,20,0.55)' }}
                    onMouseDown={e => { if (e.target === e.currentTarget) closeItem(); }}>
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-black text-slate-800">{editItem.id ? t('shEditItem') : t('shAddItem')}</h2>
                            <button onClick={closeItem} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
                        </div>
                        {/* Фото позиции: видно на плитке продажи, в справочнике и на складе */}
                        <div className="flex items-center gap-3">
                            {(() => {
                                const src = editItem.photoPreview || (!editItem.removePhoto && editItem.photoUrl) || '';
                                return src
                                    ? <img src={src} alt="" className="w-20 h-20 rounded-xl object-cover border border-slate-200" />
                                    : <div className="w-20 h-20 rounded-xl bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center text-slate-300"><ImagePlus size={22} /></div>;
                            })()}
                            <div className="flex flex-col gap-1.5">
                                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer">
                                    <ImagePlus size={14} /> {(editItem.photoPreview || (!editItem.removePhoto && editItem.photoUrl)) ? t('shPhotoChange') : t('shPhotoAdd')}
                                    <input type="file" accept="image/*" className="hidden" onChange={e => { pickPhoto(e.target.files?.[0]); e.target.value = ''; }} />
                                </label>
                                {(editItem.photoPreview || (!editItem.removePhoto && editItem.photoUrl)) && (
                                    <button onClick={() => setEditItem(x => { if (x.photoPreview) URL.revokeObjectURL(x.photoPreview); return { ...x, photoFile: null, photoPreview: '', removePhoto: !!x.photoUrl }; })}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50"><Trash2 size={13} /> {t('shPhotoRemove')}</button>
                                )}
                                <span className="text-[11px] text-slate-400">{t('shPhotoHint')}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-[64px_1fr] gap-2">
                            <div><label className={labelCls}>{t('shEmoji')}</label><input className={inputCls + ' text-center'} value={editItem.emoji || ''} onChange={e => setEditItem(x => ({ ...x, emoji: e.target.value }))} placeholder="☕" /></div>
                            <div><label className={labelCls}>{t('shItemName')}</label><input className={inputCls} value={editItem.name} onChange={e => setEditItem(x => ({ ...x, name: e.target.value }))} autoFocus /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className={labelCls}>{t('shKind')}</label>
                                <select className={inputCls} value={editItem.kind} onChange={e => setEditItem(x => ({ ...x, kind: e.target.value }))}>
                                    {KINDS.map(k => <option key={k} value={k}>{t('shKind_' + k)}</option>)}
                                </select>
                            </div>
                            <div><label className={labelCls}>{t('shPrice')}</label><input className={inputCls + ' tabular-nums'} inputMode="numeric" value={editItem.priceFocused ? String(editItem.price ?? '') : fmtSum(editItem.price)}
                                onFocus={() => setEditItem(x => ({ ...x, priceFocused: true }))} onBlur={() => setEditItem(x => ({ ...x, priceFocused: false }))}
                                onChange={e => setEditItem(x => ({ ...x, price: e.target.value.replace(/\D/g, '') }))} /></div>
                        </div>
                        <p className="text-[11px] text-slate-400">{t('shKindHint')}</p>
                        {editItem.id && (
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                                <input type="checkbox" checked={editItem.active !== false} onChange={e => setEditItem(x => ({ ...x, active: e.target.checked }))} /> {t('shActive')}
                            </label>
                        )}
                        <button onClick={saveItem} className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm flex items-center justify-center gap-1.5"><Check size={15} /> {t('spSave')}</button>
                    </div>
                </div>
            )}

            {/* Приход / инвентаризация */}
            {stockForm && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: 'rgba(8,18,20,0.55)' }}
                    onMouseDown={e => { if (e.target === e.currentTarget) setStockForm(null); }}>
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-black text-slate-800">{stockForm.mode === 'in' ? t('shStockIn') : t('shStockAdjust')} · {stockForm.item.name}</h2>
                            <button onClick={() => setStockForm(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
                        </div>
                        <div>
                            <label className={labelCls}>{t('spHostel')}</label>
                            <select className={inputCls} value={stockForm.hostelId} onChange={e => setStockForm(f => ({ ...f, hostelId: e.target.value, ...(f.mode === 'adjust' ? { actual: String(stockOf(f.item, e.target.value)) } : { payFrom: f.payFrom === 'none' ? 'none' : defaultPayFrom(e.target.value) }) }))}>
                                {shownHostels.map(h => <option key={h.id} value={h.id}>{h.name} · {t('shLeft').replace('{n}', stockOf(stockForm.item, h.id))}</option>)}
                            </select>
                        </div>
                        {stockForm.mode === 'in' ? (
                            <>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><label className={labelCls}>{t('shQty')}</label><input className={inputCls + ' tabular-nums'} inputMode="numeric" value={stockForm.qty} onChange={e => setStockForm(f => ({ ...f, qty: e.target.value.replace(/\D/g, '') }))} autoFocus /></div>
                                    <div><label className={labelCls}>{t('shUnitCost')}</label><input className={inputCls + ' tabular-nums'} inputMode="numeric" value={stockForm.costFocused ? stockForm.unitCost : fmtSum(stockForm.unitCost)}
                                        onFocus={() => setStockForm(f => ({ ...f, costFocused: true }))} onBlur={() => setStockForm(f => ({ ...f, costFocused: false }))}
                                        onChange={e => setStockForm(f => ({ ...f, unitCost: e.target.value.replace(/\D/g, '') }))} /></div>
                                </div>
                                <div className="text-sm text-slate-500">{t('shPurchaseTotal')}: <b className="tabular-nums text-slate-800">{money((parseInt(stockForm.qty) || 0) * (parseInt(stockForm.unitCost) || 0))}</b></div>
                                {/* Откуда деньги за закупку — выбирает админ */}
                                <div>
                                    <label className={labelCls}>{t('shPayFromTitle')}</label>
                                    <div className="space-y-1.5">
                                        {(() => {
                                            const sh = openShiftOf(stockForm.hostelId);
                                            return [
                                                { v: 'shift', label: sh ? t('shPayFromShift').replace('{name}', sh.staffName || staffName(sh.staffId)) : t('shPayFromShiftNone'), hint: t('shPayFromShiftHint'), off: !sh },
                                                { v: 'admin', label: t('shPayFromAdmin'), hint: t('shPayFromAdminHint') },
                                                { v: 'none', label: t('shPayFromNone'), hint: '' },
                                            ].map(o => (
                                                <label key={o.v} className={`flex items-start gap-2 px-3 py-2 rounded-xl border text-sm ${o.off ? 'opacity-50 cursor-not-allowed border-slate-100' : stockForm.payFrom === o.v ? 'border-orange-300 bg-orange-50 cursor-pointer' : 'border-slate-200 cursor-pointer'}`}>
                                                    <input type="radio" name="payFrom" className="mt-0.5" disabled={o.off} checked={stockForm.payFrom === o.v} onChange={() => setStockForm(f => ({ ...f, payFrom: o.v }))} />
                                                    <span><span className="font-bold text-slate-700">{o.label}</span>{o.hint && <span className="block text-[11px] text-slate-400">{o.hint}</span>}</span>
                                                </label>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div><label className={labelCls}>{t('shActualQty')}</label><input className={inputCls + ' tabular-nums'} inputMode="numeric" value={stockForm.actual} onChange={e => setStockForm(f => ({ ...f, actual: e.target.value.replace(/\D/g, '') }))} autoFocus /></div>
                        )}
                        <button onClick={saveStock} className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm flex items-center justify-center gap-1.5"><Check size={15} /> {t('spSave')}</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// Перерисовка — только когда поменялись данные экрана (см. UI/stableView.jsx)
export default stableView(ShopView);
