import React, { useEffect, useRef, useState } from 'react';
import { HardHat, ChevronDown, ChevronRight, LogOut, Pencil, Check, X } from 'lucide-react';
import TRANSLATIONS from '../../../constants/translations';
import { fmt } from './shared';

/**
 * Раздел договора «Рабочие» (решения владельца 20.11.2026): кто живёт по
 * договору, где, с какого дня и сколько суток. Выселяют рабочих только здесь —
 * кассир и админ; в общих окнах у них нет кнопок «Выселить/Продлить/Оплатить».
 * Подтверждение — в самой карточке (confirm() в программе не показывается).
 */
const num = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 9999; };
/** Рабочие по комнатам: [номер комнаты, рабочие по местам], комнаты по возрастанию. */
const byRoom = (list) => {
    const m = new Map();
    for (const w of list) {
        const k = String(w.roomNumber || '—');
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(w);
    }
    return [...m.entries()]
        .sort((a, b) => num(a[0]) - num(b[0]) || a[0].localeCompare(b[0]))
        .map(([k, l]) => [k, l.sort((a, b) => num(a.bedId) - num(b.bedId))]);
};

const WorkersSection = ({ group, lang, actions, focus }) => {
    const t = k => TRANSLATIONS[lang]?.[k] || k;
    const workers = group.workers || [];
    const living = workers.filter(w => w.status === 'active');
    const left = workers.filter(w => w.status !== 'active');
    const [open, setOpen] = useState(!!focus || living.length > 0);
    const [showLeft, setShowLeft] = useState(false);
    const [confirm, setConfirm] = useState(null); // { ids, label }
    const [busy, setBusy] = useState(false);
    // Правка специальности (кассир и админ, 20.11.2026): { ids, value, key }
    const [specEdit, setSpecEdit] = useState(null);
    const ref = useRef(null);

    const saveSpec = async () => {
        if (!specEdit || busy) return;
        const value = specEdit.value.trim();
        if (!value) return;
        setBusy(true);
        try { await actions.updateWorkers(specEdit.ids, { specialty: value }); setSpecEdit(null); }
        finally { setBusy(false); }
    };
    const specInput = (key) => specEdit?.key === key && (
        <span className="inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <input autoFocus value={specEdit.value} placeholder={t('cwSpecialtyPh')}
                onChange={e => setSpecEdit(s => ({ ...s, value: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') saveSpec(); if (e.key === 'Escape') setSpecEdit(null); }}
                className="w-36 px-2 py-0.5 rounded-md border border-slate-300 text-[12px] font-semibold text-slate-700 bg-white" />
            <button type="button" disabled={busy || !specEdit.value.trim()} onClick={saveSpec} title={t('save')}
                className="w-6 h-6 rounded-md flex items-center justify-center bg-teal-600 text-white disabled:opacity-40"><Check size={12} /></button>
            <button type="button" onClick={() => setSpecEdit(null)} title={t('cwNo')}
                className="w-6 h-6 rounded-md flex items-center justify-center border border-slate-200 text-slate-500"><X size={12} /></button>
        </span>
    );

    useEffect(() => {
        if (!focus) return;
        setOpen(true);
        try { ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { /* старый движок */ }
    }, [focus]);

    const doCheckout = async () => {
        if (!confirm || busy) return;
        setBusy(true);
        try { await actions.checkOutWorkers(confirm.ids); }
        finally { setBusy(false); setConfirm(null); }
    };

    const row = (w) => (
        <div key={w.id} className={`flex items-center gap-2 px-3 py-2 ${w.status === 'active' ? '' : 'opacity-60'}`}>
            <div className="flex-1 min-w-0">
                <button type="button" onClick={() => actions.openGuest(w.id)} className="block w-full text-left text-[13px] font-bold text-slate-800 truncate">{w.fullName || '—'}</button>
                <div className="text-[11px] text-slate-500 truncate">
                    {specEdit?.key === w.id ? specInput(w.id) : (
                        <>
                            {w.specialty ? <span className="font-semibold text-slate-600">{w.specialty}</span> : null}
                            {w.status === 'active' && (
                                <button type="button" title={t('cwEditSpecialty')}
                                    onClick={() => setSpecEdit({ key: w.id, ids: [w.id], value: w.specialty || '' })}
                                    className="inline-flex align-middle ml-1 w-5 h-5 items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"><Pencil size={11} /></button>
                            )}
                        </>
                    )}
                    {w.specialty ? ' · ' : ''}
                    {t('room')} {w.roomNumber || '—'}, {t('bed')} {w.bedId || '—'}
                    {' · '}{t('cwSince').replace('{date}', new Date(w.checkInDate).toLocaleDateString('ru-RU'))}
                </div>
            </div>
            <div className="text-right shrink-0">
                <div className="text-[12px] font-black text-slate-700 tabular-nums">{t('cwDays').replace('{n}', w.days)}</div>
                <div className="text-[11px] text-slate-400 tabular-nums">{fmt(w.charge)} {t('sum')}</div>
            </div>
            {w.status === 'active' && (
                <button type="button" title={t('cwCheckout')}
                    onClick={() => setConfirm({ ids: [w.id], label: t('cwConfirmOne').replace('{name}', w.fullName || '') })}
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                    <LogOut size={15} />
                </button>
            )}
        </div>
    );

    return (
        <div ref={ref} className="border-t border-slate-100">
            <button type="button" onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2">
                    <HardHat size={15} className="text-slate-400" />
                    <span className="text-sm font-bold text-slate-700">{t('cwWorkers')}</span>
                    <span className="text-[10.5px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 tabular-nums">{living.length}</span>
                    {group.workerNights > 0 && <span className="text-xs text-slate-400 tabular-nums">{group.workerNights} {t('msPersonNightsWord')}</span>}
                </div>
                {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
            </button>
            {open && (
                <div className="px-4 pb-4 space-y-2.5">
                    {workers.length === 0 ? (
                        <div className="text-xs text-slate-400">{t('cwEmpty')}</div>
                    ) : (
                        <>
                            {living.length > 0 && (
                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t('cwLiving').replace('{n}', living.length)}</div>
                            )}
                            {/* По комнатам (просьба владельца 20.11.2026): комната — блок, внутри по местам */}
                            {byRoom(living).map(([roomNo, list]) => (
                                <div key={roomNo} className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                                    <div className="px-3 py-1.5 flex items-center gap-2 bg-slate-50 rounded-t-xl">
                                        <span className="text-[12px] font-black text-slate-700">{t('room')} {roomNo}</span>
                                        <span className="text-[10.5px] font-black px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 tabular-nums">{list.length}</span>
                                        {specEdit?.key === 'room:' + roomNo ? specInput('room:' + roomNo) : (
                                            <>
                                                {[...new Set(list.map(w => w.specialty).filter(Boolean))].length === 1 && (
                                                    <span className="text-[11px] font-semibold text-slate-500">👷 {list[0].specialty}</span>
                                                )}
                                                <button type="button" title={t('cwEditSpecialtyRoom')}
                                                    onClick={() => setSpecEdit({ key: 'room:' + roomNo, ids: list.map(w => w.id), value: list[0].specialty || '' })}
                                                    className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200">
                                                    <Pencil size={11} /> {t('cwSpecialty')}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                    {list.map(row)}
                                </div>
                            ))}
                            {left.length > 0 && (
                                <button type="button" onClick={() => setShowLeft(v => !v)}
                                    className="text-xs font-bold text-slate-500 hover:text-slate-700">
                                    {showLeft ? '▾' : '▸'} {t('cwLeft').replace('{n}', left.length)}
                                </button>
                            )}
                            {showLeft && left.length > 0 && (
                                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">{left.map(row)}</div>
                            )}
                            {living.length > 1 && !confirm && (
                                <button type="button"
                                    onClick={() => setConfirm({ ids: living.map(w => w.id), label: t('cwConfirmAll').replace('{n}', living.length) })}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-rose-200 text-rose-600 hover:bg-rose-50">
                                    <LogOut size={13} /> {t('cwCheckoutAll').replace('{n}', living.length)}
                                </button>
                            )}
                        </>
                    )}
                    {confirm && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 flex flex-wrap items-center gap-2">
                            <span className="flex-1 min-w-0 text-[13px] font-bold text-rose-700">{confirm.label}</span>
                            <button type="button" disabled={busy} onClick={doCheckout}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50">{t('cwCheckout')}</button>
                            <button type="button" disabled={busy} onClick={() => setConfirm(null)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-600">{t('cwNo')}</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default WorkersSection;
