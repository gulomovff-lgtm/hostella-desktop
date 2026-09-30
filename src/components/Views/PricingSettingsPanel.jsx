import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Save, CalendarClock, DollarSign, Send, ChevronDown, ChevronUp, Coffee } from 'lucide-react';
import { plansOf, newPriceCandidates, planConfig } from '../../utils/stayPlans';
import { getConfig, saveAppConfig } from '../../utils/appConfig';
import { PAY_TYPES, normalizePayType } from '../../utils/emehmonDeparture';
import TRANSLATIONS from '../../constants/translations';

// Надёжный уникальный id сезона (Date.now() при быстрых кликах давал дубли → баг правки)
let _seasonSeq = 0;
const newSeasonId = () => `s_${Date.now().toString(36)}_${_seasonSeq++}`;

// Редактор ценообразования: минимумы по комнатам/филиалам, пакет, сезоны (по датам),
// отдельный бот одобрения цены. Токен — в Secret Manager (PRICE_BOT_TOKEN), не в Firestore.

const inp = 'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500';
const HOSTELS = [{ id: 'hostel1', labelKey: 'psHostel1' }, { id: 'hostel2', labelKey: 'psHostel2' }];

const roomsObjToRows = (obj = {}) => Object.entries(obj).map(([room, price]) => ({ room: String(room), price: String(price) }));
const rowsToObj = (rows = []) => {
    const o = {};
    rows.forEach(r => { const k = String(r.room || '').trim(); const v = parseInt(r.price) || 0; if (k && v > 0) o[k] = v; });
    return o;
};
const mkSet = (block, pkgMin, pkgPrice) => ({
    packageMinDays: String(pkgMin ?? 10),
    packagePrice: String(pkgPrice ?? 65000),
    hostel1: { default: String(block?.hostel1?.default ?? 70000), rooms: roomsObjToRows(block?.hostel1?.rooms) },
    hostel2: { default: String(block?.hostel2?.default ?? 65000), rooms: roomsObjToRows(block?.hostel2?.rooms) },
});
const toBlock = (set) => ({
    hostel1: { default: parseInt(set.hostel1.default) || 0, rooms: rowsToObj(set.hostel1.rooms) },
    hostel2: { default: parseInt(set.hostel2.default) || 0, rooms: rowsToObj(set.hostel2.rooms) },
});

// Редактор одного «набора цен» (базовый или сезонный)
const SetEditor = ({ set, onChange, showPackage = true, t = (k) => k }) => {
    const upd = (patch) => onChange({ ...set, ...patch });
    const updHostel = (hid, patch) => onChange({ ...set, [hid]: { ...set[hid], ...patch } });
    const addRoom = (hid) => updHostel(hid, { rooms: [...set[hid].rooms, { room: '', price: '' }] });
    const setRoom = (hid, i, key, val) => {
        const rows = set[hid].rooms.slice(); rows[i] = { ...rows[i], [key]: val };
        updHostel(hid, { rooms: rows });
    };
    const delRoom = (hid, i) => updHostel(hid, { rooms: set[hid].rooms.filter((_, j) => j !== i) });

    return (
        <div className="space-y-4">
            {showPackage && (
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">{t('psPkgMinDays')}</label>
                        <input className={inp} type="number" value={set.packageMinDays} onChange={e => upd({ packageMinDays: e.target.value })} />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">{t('psPkgPrice')}</label>
                        <input className={inp} type="number" value={set.packagePrice} onChange={e => upd({ packagePrice: e.target.value })} />
                    </div>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {HOSTELS.map(h => (
                    <div key={h.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                        <div className="font-black text-sm text-slate-700">{t(h.labelKey)}</div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">{t('psDefaultMin')}</label>
                            <input className={inp} type="number" value={set[h.id].default} onChange={e => updHostel(h.id, { default: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <div className="text-[10px] font-bold text-slate-400 uppercase">{t('psRoomMins')}</div>
                            {set[h.id].rooms.map((r, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                    <input className={inp + ' w-20'} placeholder={t('psRoomShort')} value={r.room} onChange={e => setRoom(h.id, i, 'room', e.target.value)} />
                                    <input className={inp + ' flex-1'} type="number" placeholder={t('psPricePh')} value={r.price} onChange={e => setRoom(h.id, i, 'price', e.target.value)} />
                                    <button onClick={() => delRoom(h.id, i)} className="p-2 text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button>
                                </div>
                            ))}
                            <button onClick={() => addRoom(h.id)} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"><Plus size={13} /> {t('psAddRoom')}</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Тарифы «без завтрака / с завтраком» по филиалу (utils/stayPlans.js)
const mkPlans = (plans) => Object.fromEntries(HOSTELS.map(h => {
    const x = plans?.[h.id] || {};
    return [h.id, {
        enabled: !!x.enabled, from: x.from || '',
        localRoom: String(x.local?.room ?? ''), localFull: String(x.local?.full ?? ''),
        foreignRoom: String(x.foreign?.room ?? ''), foreignFull: String(x.foreign?.full ?? ''),
        nightEnabled: !!x.night?.enabled, nightPrice: String(x.night?.price ?? ''),
    }];
}));
const plansToCfg = (st) => Object.fromEntries(HOSTELS.map(h => {
    const x = st[h.id];
    return [h.id, {
        enabled: !!x.enabled, from: /^\d{4}-\d{2}-\d{2}$/.test(x.from) ? x.from : '',
        local:   { room: parseInt(x.localRoom) || 0,   full: parseInt(x.localFull) || 0 },
        foreign: { room: parseInt(x.foreignRoom) || 0, full: parseInt(x.foreignFull) || 0 },
        // ночной заезд: граждане Узбекистана, с 23:00 до 07:00, место до 07:00 утра
        night: { enabled: !!x.nightEnabled && (parseInt(x.nightPrice) || 0) > 0, price: parseInt(x.nightPrice) || 0, fromHour: 23, toHour: 7, localOnly: true },
    }];
}));

const PricingSettingsPanel = ({ notify, lang = 'ru', guests = [], catalog = [], onApplyNewPrices }) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;
    const cfg = getConfig();
    const p = cfg.pricing || {};
    const [chatIds, setChatIds] = useState((cfg.priceApprovalChatIds || []).join(', '));
    const [base, setBase] = useState(() => mkSet(p.base, p.packageMinDays, p.packagePrice));
    const [seasons, setSeasons] = useState(() => (p.seasons || []).map((s) => ({
        id: newSeasonId(), open: false, name: s.name || '', from: s.from || '', to: s.to || '',
        ...mkSet(s.base, s.packageMinDays ?? p.packageMinDays, s.packagePrice ?? p.packagePrice),
    })));
    const [saving, setSaving] = useState(false);
    const [plans, setPlans] = useState(() => mkPlans(plansOf(cfg)));
    const updPlan = (hid, patch) => setPlans(p => ({ ...p, [hid]: { ...p[hid], ...patch } }));
    // Рецепт завтрака: продукты склада на одну порцию — списываются при выдаче
    const [recipe, setRecipe] = useState(() => Object.fromEntries(HOSTELS.map(h =>
        [h.id, (cfg.breakfastRecipe?.[h.id] || []).map(r => ({ itemId: r.itemId, qty: String(r.qty) }))])));
    const products = useMemo(() => (catalog || []).filter(i => i.kind === 'product' && i.active !== false), [catalog]);
    const setRecipeRow = (hid, i, patch) => setRecipe(r => ({ ...r, [hid]: r[hid].map((x, j) => j === i ? { ...x, ...patch } : x) }));
    // Перевод живущих на новые цены: список — по сохранённой схеме
    const [applying, setApplying] = useState('');
    // Ставки, которые указываются в поле «Сумма оплаты» портала e-mehmon
    const [emLocal, setEmLocal] = useState(String(cfg.emehmonAmountLocal ?? 30000));
    const [emForeign, setEmForeign] = useState(String(cfg.emehmonAmountForeign ?? 50000));
    // Тип оплаты в окне Check-Out при выводе: окна с вопросом больше нет, ставится всем.
    const [emPayType, setEmPayType] = useState(normalizePayType(cfg.emehmonPayType));

    const addSeason = () => setSeasons(s => [...s, { id: newSeasonId(), open: true, name: '', from: '', to: '', ...mkSet(p.base, p.packageMinDays, p.packagePrice) }]);
    const updSeason = (id, patch) => setSeasons(s => s.map(x => x.id === id ? { ...x, ...patch } : x));
    const delSeason = (id) => setSeasons(s => s.filter(x => x.id !== id));

    const save = async () => {
        setSaving(true);
        try {
            const pricing = {
                packageMinDays: parseInt(base.packageMinDays) || 10,
                packagePrice: parseInt(base.packagePrice) || 65000,
                base: toBlock(base),
                package: p.package || { hostel1: { default: 0, rooms: {} }, hostel2: { default: 0, rooms: {} } },
                plans: plansToCfg(plans),
                seasons: seasons.filter(s => s.from && s.to).map(s => ({
                    id: s.id, name: s.name, from: s.from, to: s.to,
                    packageMinDays: parseInt(s.packageMinDays) || undefined,
                    packagePrice: parseInt(s.packagePrice) || undefined,
                    base: toBlock(s),
                })),
            };
            await saveAppConfig({
                pricing,
                priceApprovalChatIds: chatIds.split(',').map(x => x.trim()).filter(Boolean),
                emehmonAmountLocal: parseInt(emLocal) || 30000,
                emehmonAmountForeign: parseInt(emForeign) || 50000,
                emehmonPayType: normalizePayType(emPayType),
                breakfastRecipe: Object.fromEntries(HOSTELS.map(h => [h.id, recipe[h.id]
                    .map(r => ({ itemId: r.itemId, qty: Math.round((parseFloat(String(r.qty).replace(',', '.')) || 0) * 100) / 100 }))
                    .filter(r => r.itemId && r.qty > 0)])),
            });
            notify?.(t('psSavedOk'), 'success');
        } catch (e) {
            notify?.(t('psSaveError').replace('{msg}', e?.message || e), 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-5 max-w-4xl">
            {/* Бот одобрения цены */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="font-black text-slate-800 flex items-center gap-2"><Send size={16} className="text-indigo-600" /> {t('psBotTitle')}</div>
                <p className="text-xs text-slate-400">{t('psBotHint')} <b>/start</b>.</p>
                <p className="text-[11px] text-slate-400 bg-slate-50 border border-slate-200 rounded-lg p-2">🔒 {t('psTokenNote')} <code>firebase functions:secrets:set PRICE_BOT_TOKEN</code>.</p>
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">{t('psChatIdLabel')}</label>
                    <input className={inp} value={chatIds} onChange={e => setChatIds(e.target.value)} placeholder="6953132612, 7029598539" autoComplete="off" />
                </div>
            </div>

            {/* Ставки e-mehmon (налоговая отчётность) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="font-black text-slate-800 flex items-center gap-2">🧾 {t('psEmTitle')}</div>
                <p className="text-xs text-slate-400">{t('psEmHint')}</p>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">🇺🇿 {t('psEmLocal')}</label>
                        <input className={inp} value={emLocal} inputMode="numeric"
                            onChange={e => setEmLocal(e.target.value.replace(/\D/g, ''))} placeholder="30000" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">🌍 {t('psEmForeign')}</label>
                        <input className={inp} value={emForeign} inputMode="numeric"
                            onChange={e => setEmForeign(e.target.value.replace(/\D/g, ''))} placeholder="50000" />
                    </div>
                </div>
                <div className="max-w-xs">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">{t('psEmPayType')}</label>
                    <select className={inp} value={emPayType} onChange={e => setEmPayType(e.target.value)}>
                        {PAY_TYPES.map(p => <option key={p.value} value={p.value}>{p.literal || t(p.labelKey)}</option>)}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">{t('psEmPayTypeHint')}</p>
                </div>
            </div>

            {/* Тарифы без завтрака / с завтраком */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="font-black text-slate-800 flex items-center gap-2"><Coffee size={16} className="text-amber-600" /> {t('planSettingsTitle')}</div>
                <p className="text-xs text-slate-400">{t('planSettingsHint')}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {HOSTELS.map(h => {
                        const x = plans[h.id];
                        const saved = planConfig(h.id, new Date(), cfg);
                        const cands = saved ? newPriceCandidates(guests, h.id, cfg) : [];
                        const priceInp = (key, label) => (
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">{label}</label>
                                <input className={inp} inputMode="numeric" value={x[key]} disabled={!x.enabled}
                                    onChange={e => updPlan(h.id, { [key]: e.target.value.replace(/\D/g, '') })} />
                            </div>
                        );
                        return (
                            <div key={h.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                                <label className="flex items-center gap-2 font-black text-sm text-slate-700">
                                    <input type="checkbox" checked={x.enabled} onChange={e => updPlan(h.id, { enabled: e.target.checked })} />
                                    {t(h.labelKey)}
                                </label>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">{t('planFrom')}</label>
                                    <input className={inp} type="date" value={x.from} disabled={!x.enabled} onChange={e => updPlan(h.id, { from: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {priceInp('localRoom', '🇺🇿 ' + t('planRoom'))}
                                    {priceInp('localFull', '🇺🇿 ☕ ' + t('planFull'))}
                                    {priceInp('foreignRoom', '🌍 ' + t('planRoom'))}
                                    {priceInp('foreignFull', '🌍 ☕ ' + t('planFull'))}
                                </div>
                                <div className="flex items-end gap-2">
                                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 pb-2.5 shrink-0">
                                        <input type="checkbox" checked={x.nightEnabled} disabled={!x.enabled} onChange={e => updPlan(h.id, { nightEnabled: e.target.checked })} />
                                        🌙 {t('nightPromoSetting')}
                                    </label>
                                    <div className="flex-1">{priceInp('nightPrice', '🇺🇿 23:00–07:00')}</div>
                                </div>
                                {/* Рецепт завтрака: что уходит со склада на одну порцию */}
                                <div className="pt-1 space-y-1.5">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase">{t('bfRecipeTitle')}</div>
                                    {recipe[h.id].map((r, i) => (
                                        <div key={i} className="flex items-center gap-1.5">
                                            <select className={inp + ' flex-1'} value={r.itemId} onChange={e => setRecipeRow(h.id, i, { itemId: e.target.value })}>
                                                <option value="">—</option>
                                                {products.map(p => <option key={p.id} value={p.id}>{p.emoji ? p.emoji + ' ' : ''}{p.name}</option>)}
                                            </select>
                                            <input className={inp + ' w-20'} inputMode="decimal" placeholder={t('bfQtyPh')} value={r.qty}
                                                onChange={e => setRecipeRow(h.id, i, { qty: e.target.value.replace(/[^\d.,]/g, '') })} />
                                            <button onClick={() => setRecipe(rr => ({ ...rr, [h.id]: rr[h.id].filter((_, j) => j !== i) }))} className="p-2 text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button>
                                        </div>
                                    ))}
                                    <button onClick={() => setRecipe(rr => ({ ...rr, [h.id]: [...rr[h.id], { itemId: '', qty: '1' }] }))}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"><Plus size={13} /> {t('bfRecipeAdd')}</button>
                                    {!products.length && <p className="text-[11px] text-slate-400">{t('bfRecipeNoProducts')}</p>}
                                </div>
                                {/* Новые цены для уже живущих (решение владельца: с 1-го для всех) */}
                                {saved && onApplyNewPrices && cands.length > 0 && (
                                    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 space-y-2">
                                        <p className="text-xs font-semibold text-amber-800">{t('planMigrateHint').replace('{date}', saved.from.split('-').reverse().join('.')).replace('{n}', cands.length)}</p>
                                        <div className="max-h-40 overflow-auto text-[11px] text-slate-600 space-y-0.5">
                                            {cands.map(c => (
                                                <div key={c.guest.id} className="flex justify-between gap-2">
                                                    <span className="truncate">№{c.guest.roomNumber} · {c.guest.fullName}</span>
                                                    <span className="tabular-nums shrink-0">{c.oldPrice.toLocaleString()} → <b>{c.newPrice.toLocaleString()}</b> × {c.remaining}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <button disabled={!!applying}
                                            onClick={async () => {
                                                if (!window.confirm(t('planMigrateConfirm').replace('{n}', cands.length))) return;
                                                setApplying(h.id);
                                                try { await onApplyNewPrices(h.id); } finally { setApplying(''); }
                                            }}
                                            className="w-full py-2 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 disabled:opacity-50">
                                            {applying === h.id ? t('psSaving') : t('planMigrateBtn').replace('{n}', cands.length)}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Базовые цены */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="font-black text-slate-800 flex items-center gap-2"><DollarSign size={16} className="text-emerald-600" /> {t('psBaseTitle')}</div>
                <p className="text-xs text-slate-400">{t('psBaseHint')}</p>
                <SetEditor set={base} onChange={setBase} t={t} />
            </div>

            {/* Сезоны */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="font-black text-slate-800 flex items-center gap-2"><CalendarClock size={16} className="text-amber-600" /> {t('psSeasonsTitle')}</div>
                    <button onClick={addSeason} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 flex items-center gap-1"><Plus size={13} /> {t('psSeasonBtn')}</button>
                </div>
                <p className="text-xs text-slate-400">{t('psSeasonsHint1')} <b>{t('psMmDd')}</b> {t('psSeasonsHint2')}</p>
                {seasons.length === 0 && <p className="text-xs text-slate-400 italic">{t('psSeasonsEmpty')}</p>}
                {seasons.map(s => (
                    <div key={s.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <button type="button" onClick={() => updSeason(s.id, { open: !s.open })}
                                className="p-2 rounded-lg text-slate-500 hover:bg-amber-100 shrink-0" title={s.open ? t('msCollapse') : t('psExpand')}>
                                {s.open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <input className={inp + ' flex-1 min-w-[120px]'} placeholder={t('psSeasonNamePh')} value={s.name} onChange={e => updSeason(s.id, { name: e.target.value })} />
                            <input className={inp + ' w-24'} placeholder={t('psMmDd')} value={s.from} onChange={e => updSeason(s.id, { from: e.target.value })} />
                            <span className="text-slate-400">→</span>
                            <input className={inp + ' w-24'} placeholder={t('psMmDd')} value={s.to} onChange={e => updSeason(s.id, { to: e.target.value })} />
                            <button type="button" onClick={() => delSeason(s.id)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0" title={t('psDelSeason')}><Trash2 size={16} /></button>
                        </div>
                        {s.open && <SetEditor set={s} onChange={(ns) => updSeason(s.id, ns)} t={t} />}
                    </div>
                ))}
            </div>

            <button onClick={save} disabled={saving}
                className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <Save size={16} /> {saving ? t('psSaving') : t('psSavePrices')}
            </button>
        </div>
    );
};

export default PricingSettingsPanel;
