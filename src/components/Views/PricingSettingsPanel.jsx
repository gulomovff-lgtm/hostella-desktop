import React, { useState } from 'react';
import { Plus, Trash2, Save, CalendarClock, DollarSign, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { getConfig, saveAppConfig } from '../../utils/appConfig';

// Надёжный уникальный id сезона (Date.now() при быстрых кликах давал дубли → баг правки)
let _seasonSeq = 0;
const newSeasonId = () => `s_${Date.now().toString(36)}_${_seasonSeq++}`;

// Редактор ценообразования: минимумы по комнатам/филиалам, пакет, сезоны (по датам),
// отдельный бот одобрения цены. Сохраняется в appConfig.pricing / priceBotToken.

const inp = 'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500';
const HOSTELS = [{ id: 'hostel1', label: 'Хостел №1' }, { id: 'hostel2', label: 'Хостел №2' }];

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
const SetEditor = ({ set, onChange, showPackage = true }) => {
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
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Пакет: мин. дней</label>
                        <input className={inp} type="number" value={set.packageMinDays} onChange={e => upd({ packageMinDays: e.target.value })} />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Пакет: цена/ночь</label>
                        <input className={inp} type="number" value={set.packagePrice} onChange={e => upd({ packagePrice: e.target.value })} />
                    </div>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {HOSTELS.map(h => (
                    <div key={h.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                        <div className="font-black text-sm text-slate-700">{h.label}</div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Минимум по умолчанию</label>
                            <input className={inp} type="number" value={set[h.id].default} onChange={e => updHostel(h.id, { default: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Минимумы по комнатам</div>
                            {set[h.id].rooms.map((r, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                    <input className={inp + ' w-20'} placeholder="комн." value={r.room} onChange={e => setRoom(h.id, i, 'room', e.target.value)} />
                                    <input className={inp + ' flex-1'} type="number" placeholder="цена" value={r.price} onChange={e => setRoom(h.id, i, 'price', e.target.value)} />
                                    <button onClick={() => delRoom(h.id, i)} className="p-2 text-slate-400 hover:text-rose-600"><Trash2 size={15} /></button>
                                </div>
                            ))}
                            <button onClick={() => addRoom(h.id)} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"><Plus size={13} /> Добавить комнату</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const PricingSettingsPanel = ({ notify }) => {
    const cfg = getConfig();
    const p = cfg.pricing || {};
    const [botToken, setBotToken] = useState(cfg.priceBotToken || '');
    const [chatIds, setChatIds] = useState((cfg.priceApprovalChatIds || []).join(', '));
    const [base, setBase] = useState(() => mkSet(p.base, p.packageMinDays, p.packagePrice));
    const [seasons, setSeasons] = useState(() => (p.seasons || []).map((s) => ({
        id: newSeasonId(), open: false, name: s.name || '', from: s.from || '', to: s.to || '',
        ...mkSet(s.base, s.packageMinDays ?? p.packageMinDays, s.packagePrice ?? p.packagePrice),
    })));
    const [saving, setSaving] = useState(false);

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
                seasons: seasons.filter(s => s.from && s.to).map(s => ({
                    id: s.id, name: s.name, from: s.from, to: s.to,
                    packageMinDays: parseInt(s.packageMinDays) || undefined,
                    packagePrice: parseInt(s.packagePrice) || undefined,
                    base: toBlock(s),
                })),
            };
            await saveAppConfig({
                pricing,
                priceBotToken: botToken.trim(),
                priceApprovalChatIds: chatIds.split(',').map(x => x.trim()).filter(Boolean),
            });
            notify?.('Цены сохранены', 'success');
        } catch (e) {
            notify?.('Ошибка сохранения: ' + (e?.message || e), 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-5 max-w-4xl">
            {/* Бот одобрения цены */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="font-black text-slate-800 flex items-center gap-2"><Send size={16} className="text-indigo-600" /> Бот одобрения понижения цены</div>
                <p className="text-xs text-slate-400">Отдельный токен бота (пусто = общий бот). Chat ID одобряющих — через запятую. Одобряющий должен написать боту <b>/start</b>.</p>
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Токен бота (необязательно)</label>
                    <input className={inp} value={botToken} onChange={e => setBotToken(e.target.value)} placeholder="123456:ABC… (пусто = общий бот)" autoComplete="off" />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Chat ID одобряющих</label>
                    <input className={inp} value={chatIds} onChange={e => setChatIds(e.target.value)} placeholder="6953132612, 7029598539" autoComplete="off" />
                </div>
            </div>

            {/* Базовые цены */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="font-black text-slate-800 flex items-center gap-2"><DollarSign size={16} className="text-emerald-600" /> Базовые минимумы и пакет</div>
                <p className="text-xs text-slate-400">Минимальная цена ночи (ниже неё — пакет или запрос на понижение). Действует, когда не активен ни один сезон.</p>
                <SetEditor set={base} onChange={setBase} />
            </div>

            {/* Сезоны */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="font-black text-slate-800 flex items-center gap-2"><CalendarClock size={16} className="text-amber-600" /> Сезоны (по датам)</div>
                    <button onClick={addSeason} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 flex items-center gap-1"><Plus size={13} /> Сезон</button>
                </div>
                <p className="text-xs text-slate-400">Даты в формате <b>ММ-ДД</b> (напр. 06-01 → 08-31). Зима с переходом года — тоже ок (12-01 → 02-28). Активный сезон переопределяет базовые цены.</p>
                {seasons.length === 0 && <p className="text-xs text-slate-400 italic">Сезонов нет — действуют базовые цены круглый год.</p>}
                {seasons.map(s => (
                    <div key={s.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <button type="button" onClick={() => updSeason(s.id, { open: !s.open })}
                                className="p-2 rounded-lg text-slate-500 hover:bg-amber-100 shrink-0" title={s.open ? 'Свернуть' : 'Развернуть'}>
                                {s.open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <input className={inp + ' flex-1 min-w-[120px]'} placeholder="Название (Лето)" value={s.name} onChange={e => updSeason(s.id, { name: e.target.value })} />
                            <input className={inp + ' w-24'} placeholder="ММ-ДД" value={s.from} onChange={e => updSeason(s.id, { from: e.target.value })} />
                            <span className="text-slate-400">→</span>
                            <input className={inp + ' w-24'} placeholder="ММ-ДД" value={s.to} onChange={e => updSeason(s.id, { to: e.target.value })} />
                            <button type="button" onClick={() => delSeason(s.id)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0" title="Удалить сезон"><Trash2 size={16} /></button>
                        </div>
                        {s.open && <SetEditor set={s} onChange={(ns) => updSeason(s.id, ns)} />}
                    </div>
                ))}
            </div>

            <button onClick={save} disabled={saving}
                className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <Save size={16} /> {saving ? 'Сохранение…' : 'Сохранить цены'}
            </button>
        </div>
    );
};

export default PricingSettingsPanel;
