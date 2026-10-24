import React, { memo, useEffect, useMemo, useState } from 'react';
import { Plus, X, Search, Edit2, Check, Users, CalendarDays, ChevronDown, ChevronRight, DollarSign, Trash2, FileText, Archive, ArchiveRestore, EyeOff, ArrowLeftRight, Receipt } from 'lucide-react';
import TRANSLATIONS from '../../../constants/translations';
import { INP, GHOST_BTN, fmt, pmcFmtISO } from './shared';
import LocalNumInput from './LocalNumInput';
import PeriodMiniCalendar from './PeriodMiniCalendar';

// Сколько последних записей видно в свёрнутом списке периодов и доп. расходов
const RECENT_COUNT = 3;
// Сколько гостей рисуем в поиске участника (остальное — уточнить поиском)
const PICKER_LIMIT = 50;

const sd = (iso) => { if (!iso) return '—'; const [, m, d] = iso.split('-'); return `${parseInt(d)}.${m}`; };
// Вторичные кнопки карточки: одинаковая ширина, текст по центру
const ACT_BTN = GHOST_BTN + ' justify-center sm:flex-1 whitespace-nowrap';
const iconBtnDanger = 'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors';

// Свёрнутый список: последние добавленные сверху + «Показать все»
const RecentToggle = ({ total, open, onToggle, t }) => total > RECENT_COUNT && (
    <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors border-t border-slate-100">
        {open
            ? <><ChevronDown size={13} className="rotate-180" /> {t('msCollapse')}</>
            : <><ChevronDown size={13} /> {t('mslShowAll').replace('{n}', total)}</>}
    </button>
);

/**
 * Карточка договора. Своё состояние интерфейса (раскрытые разделы, формы,
 * поиск) держит внутри, а перерисовывается только когда поменялись ЕЁ данные
 * (group.sig) — ввод в одной карточке или открытие окна не перерисовывает
 * остальные. Действия приходят одним постоянным объектом `actions`.
 */
const GroupCard = ({ group, idx, lang, rooms, isAdmin, mergeMode, isSelected, groupedGuests, autoOpenMembers, actions }) => {
    const t = k => TRANSLATIONS[lang]?.[k] || k;
    const [membersOpen, setMembersOpen] = useState(!!autoOpenMembers);
    const [pickerOpen, setPickerOpen] = useState(!!autoOpenMembers);
    const [memberSearch, setMemberSearch] = useState('');
    const [calOpen, setCalOpen] = useState(false);
    const [editingName, setEditingName] = useState(null);
    const [extraForm, setExtraForm] = useState(null);     // { name, amount }
    const [writeOffForm, setWriteOffForm] = useState(null); // { reason, amount }
    const [allPeriods, setAllPeriods] = useState(false);
    const [allExtras, setAllExtras] = useState(false);

    // Только что созданная группа — сразу открыть выбор участников
    useEffect(() => { if (autoOpenMembers) { setMembersOpen(true); setPickerOpen(true); } }, [autoOpenMembers]);

    const memberKeySet = useMemo(() => new Set(group.memberKeys || []), [group.memberKeys]);
    const pickerList = useMemo(() => {
        if (!pickerOpen) return { rows: [], total: 0 };
        const q = memberSearch.trim().toLowerCase();
        const found = q ? groupedGuests.filter(g => g.name.toLowerCase().includes(q)) : groupedGuests;
        return { rows: found.slice(0, PICKER_LIMIT), total: found.length };
    }, [pickerOpen, memberSearch, groupedGuests]);

    // Последние добавленные — сверху (порядок добавления = _order)
    const periodsRecent = useMemo(() => [...group.manualEntries].sort((a, b) => b._order - a._order), [group.manualEntries]);
    const periodsShown = allPeriods ? periodsRecent : periodsRecent.slice(0, RECENT_COUNT);
    const extras = useMemo(() => group.extraCharges || [], [group.extraCharges]);
    const extrasRecent = useMemo(() => [...extras].reverse(), [extras]);
    const extrasShown = allExtras ? extrasRecent : extrasRecent.slice(0, RECENT_COUNT);

    const groupPaidPct = group.contractTotal > 0 ? Math.min(100, (group.amountPaid / group.contractTotal) * 100) : 0;
    const isPaid = group.contractTotal > 0 && group.debt <= 0;
    const isFinished = group.completed || group.closed;
    const balance = (group.amountPaid || 0) - (group.contractTotal || 0);
    const num = String(idx + 1).padStart(2, '0');

    const submitRename = async () => {
        const name = (editingName || '').trim();
        if (!name) return;
        await actions.renameGroup(group.id, name);
        setEditingName(null);
    };
    const submitExtra = () => { actions.addExtraCharge(group.id, extraForm.name, extraForm.amount); setExtraForm(null); };
    const submitWriteOff = () => { actions.addWriteOff(group.id, writeOffForm.reason, writeOffForm.amount); setWriteOffForm(null); };
    const closePicker = () => { setPickerOpen(false); setMemberSearch(''); };

    return (
        <div className={`bg-white rounded-2xl border overflow-hidden transition-colors ${isSelected ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-slate-200'} ${group.closed ? 'opacity-80' : ''}`}>

            {/* ─ Заголовок карточки ─ */}
            <div className="flex items-start gap-3 px-4 pt-4">
                {mergeMode && (
                    <button type="button" onClick={() => actions.toggleSelected(group.id)}
                        className={`mt-1.5 w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-teal-600 bg-teal-600' : 'border-slate-300 bg-white hover:border-teal-500'}`}>
                        {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                    </button>
                )}
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 text-sm font-black tabular-nums select-none">{num}</div>
                <div className="flex-1 min-w-0">
                    {editingName !== null ? (
                        <div className="flex items-center gap-1.5">
                            <input autoFocus value={editingName}
                                onChange={e => setEditingName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setEditingName(null); }}
                                className={INP + ' flex-1 min-w-0 font-bold'}
                            />
                            <button onClick={submitRename} title={t('mslSave')} className="w-9 h-9 rounded-lg flex items-center justify-center bg-indigo-500 hover:bg-indigo-600 text-white shrink-0"><Check size={15} /></button>
                            <button onClick={() => setEditingName(null)} title={t('cancel')} className="w-9 h-9 rounded-lg flex items-center justify-center border border-slate-200 text-slate-400 hover:bg-slate-50 shrink-0"><X size={15} /></button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-base font-black leading-tight ${group.closed ? 'text-slate-500' : 'text-slate-800'}`}>{group.name}</span>
                            {group.closed && <span className="text-[10.5px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{t('msClosedBadge')}</span>}
                            {!group.closed && group.completed && <span className="text-[10.5px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{t('msCompletedBadge')}</span>}
                            {isPaid && <span className="inline-flex items-center gap-1 text-[10.5px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600"><Check size={10} strokeWidth={3} /> {t('paid')}</span>}
                            {!isPaid && group.debt > 0 && group.contractTotal > 0 && <span className="text-[10.5px] font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 tabular-nums whitespace-nowrap">{t('mslDebtBadge').replace('{n}', fmt(group.debt))}</span>}
                        </div>
                    )}
                </div>
                {editingName === null && (
                    <div className="flex items-center gap-1 shrink-0 -mr-1">
                        {isAdmin && (
                            <select value={group.hostelId || ''} onChange={e => actions.updateGroup(group.id, { hostelId: e.target.value })}
                                className={`h-8 max-w-[120px] text-xs font-semibold rounded-lg px-2 border focus:outline-none ${group.hostelId ? 'border-slate-200 bg-white text-slate-500' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
                                <option value="">{t('msHostelOption')}</option>
                                <option value="hostel1">{t('expHostel1')}</option>
                                <option value="hostel2">{t('expHostel2')}</option>
                            </select>
                        )}
                        <button onClick={() => actions.deleteGroup(group.id)} title={t('mslDeleteGroup')}
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                            <Trash2 size={15} />
                        </button>
                    </div>
                )}
            </div>

            {/* ─ Цифры договора ─ */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px mx-4 mt-3 rounded-xl overflow-hidden border border-slate-100 bg-slate-100">
                {[
                    { label: t('ormColMembers'),      value: group.members.length, cls: 'text-slate-800' },
                    { label: t('msPersonNightsWord'), value: group.totalPersonNights.toLocaleString('ru-RU'), cls: 'text-teal-600' },
                    { label: t('msChargedUpper'),     value: group.contractTotal > 0 ? fmt(group.contractTotal) : '—', cls: 'text-slate-800',
                      sub: group.extraTotal > 0 ? `+${fmt(group.extraTotal)} ${t('msExtraShort')}` : null },
                    { label: t('msPaidUpper'),        value: group.amountPaid > 0 ? fmt(group.amountPaid) : '—', cls: group.amountPaid > 0 ? 'text-emerald-600' : 'text-slate-400' },
                ].map(s => (
                    <div key={s.label} className="bg-white px-2.5 py-2 min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">{s.label}</div>
                        <div className={`text-sm font-black tabular-nums truncate ${s.cls}`}>{s.value}</div>
                        {s.sub && <div className="text-[10px] text-slate-400 tabular-nums truncate">{s.sub}</div>}
                    </div>
                ))}
            </div>
            {group.contractTotal > 0 && (
                <div className="mx-4 mt-2 h-1.5 rounded-full overflow-hidden bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${groupPaidPct}%` }} />
                </div>
            )}

            {/* ─ Ставка и действия ─ */}
            <div className="px-4 pt-3 pb-4 space-y-2.5">
                {/* Ставка слева — главное действие (оплата) справа */}
                {!isFinished && (
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                            <label className="text-xs font-bold text-slate-500 whitespace-nowrap">{t('mslRatePerPn')}</label>
                            <LocalNumInput value={group.contractRate || ''} onCommit={val => actions.updateGroup(group.id, { contractRate: val })}
                                placeholder="0"
                                className={INP + ' w-28 text-right font-bold tabular-nums'} />
                            <span className="text-xs text-slate-400">{t('sum')}</span>
                        </div>
                        <button onClick={() => actions.pay(group.id)}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-700 text-white transition-colors">
                            <DollarSign size={15} /> {t('rpmAccept')}
                        </button>
                    </div>
                )}
                {!isFinished && !group.contractRate && <div className="text-xs text-amber-700">{t('mslRateHint')}</div>}
                {/* Вторичные действия — одинаковой ширины, в одну строку (на узком экране — по две) */}
                <div className="grid grid-cols-2 sm:flex gap-2">
                    <button onClick={() => actions.report(group.id)} className={ACT_BTN}><FileText size={14} /> {t('msReport')}</button>
                    {!isFinished && (
                        <>
                            {balance !== 0 && (
                                <button onClick={() => actions.transfer(group.id)}
                                    title={balance < 0 ? t('msTransferDebtTitleFull').replace('{n}', fmt(-balance)) : t('msTransferOverpayTitleFull').replace('{n}', fmt(balance))}
                                    className={ACT_BTN}>
                                    <ArrowLeftRight size={14} /> {t('mslBalance')}
                                </button>
                            )}
                            <button onClick={() => setEditingName(group.name)} className={ACT_BTN}><Edit2 size={13} /> {t('mslRename')}</button>
                            <button onClick={() => actions.complete(group.id)} title={t('msCompleteContractTitle')} className={ACT_BTN}><Check size={14} /> {t('finish')}</button>
                        </>
                    )}
                    {group.completed && !group.closed && (
                        <>
                            <button onClick={() => actions.toggleGroupClosed(group.id, true)} title={t('msToArchiveTitle')} className={ACT_BTN}><Archive size={14} /> {t('expToArchive')}</button>
                            <button onClick={() => actions.updateGroup(group.id, { completed: false, completedAt: null })} title={t('msResumeTitle')} className={ACT_BTN}><ArchiveRestore size={14} /> {t('msResume')}</button>
                        </>
                    )}
                    {group.closed && (
                        <button onClick={() => actions.toggleGroupClosed(group.id, false)} title={t('msReturnFromArchiveTitle')} className={ACT_BTN}><ArchiveRestore size={14} /> {t('returnBtn')}</button>
                    )}
                </div>
            </div>

            {/* ─ Участники ─ */}
            <div className="border-t border-slate-100">
                <button type="button"
                    onClick={() => { if (membersOpen) closePicker(); setMembersOpen(o => !o); }}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2">
                        <Users size={15} className="text-slate-400" />
                        <span className="text-sm font-bold text-slate-700">{t('msParticipants')}</span>
                        <span className="text-[10.5px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 tabular-nums">{group.members.length}</span>
                        {group.autoPersonNights > 0 && <span className="text-xs text-slate-400 tabular-nums">{group.autoPersonNights} {t('msPersonNightsWord')}</span>}
                    </div>
                    {membersOpen ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                </button>
                {membersOpen && (
                    <div className="px-4 pb-4 space-y-2.5">
                        {group.members.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                                {group.members.map(member => (
                                    <span key={member.key} className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-900 border border-teal-100">
                                        {member.name}<span className="text-teal-600 tabular-nums">{member.totalNights} {t('sutShort')}</span>
                                        <button onClick={() => actions.toggleMember(group.id, member.key)} title={t('mslRemoveFromGroup')}
                                            className="w-5 h-5 rounded-full flex items-center justify-center text-teal-600 hover:bg-rose-100 hover:text-rose-600 transition-colors"><X size={11} /></button>
                                    </span>
                                ))}
                            </div>
                        ) : !pickerOpen && (
                            <div className="text-xs text-slate-400">{t('mslNoMembers')}</div>
                        )}
                        <button onClick={() => { if (pickerOpen) closePicker(); else setPickerOpen(true); }}
                            className={pickerOpen ? 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 text-white' : GHOST_BTN}>
                            {pickerOpen ? <><Check size={13} /> {t('done')}</> : <><Plus size={13} /> {t('mslAddMembers')}</>}
                        </button>
                        {pickerOpen && (
                            <div className="rounded-xl overflow-hidden border border-slate-200">
                                <div className="relative border-b border-slate-100">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                                    <input autoFocus value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder={t('mslSearchGuest')}
                                        className="w-full pl-9 pr-3 py-2.5 text-sm focus:outline-none bg-white text-slate-700" />
                                </div>
                                <div className="max-h-56 overflow-y-auto">
                                    {pickerList.rows.length === 0
                                        ? <div className="text-sm text-center py-3 text-slate-400">{t('msNotFound')}</div>
                                        : pickerList.rows.map(guest => {
                                            const inGroup = memberKeySet.has(guest.key);
                                            return (
                                                <button key={guest.key} onClick={() => actions.toggleMember(group.id, guest.key)}
                                                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left border-b border-slate-50 last:border-0 transition-colors ${inGroup ? 'bg-teal-50' : 'hover:bg-slate-50'}`}>
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-semibold truncate text-slate-700">{guest.name}</div>
                                                        <div className="text-xs text-slate-400 tabular-nums">{guest.stayCount} {t('msStaysShort')} · {guest.totalNights} {t('sutShort')}</div>
                                                    </div>
                                                    <div className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${inGroup ? 'border-teal-500 bg-teal-500' : 'border-slate-300'}`}>
                                                        {inGroup && <Check size={12} className="text-white" strokeWidth={3} />}
                                                    </div>
                                                </button>
                                            );
                                        })
                                    }
                                    {pickerList.total > pickerList.rows.length && (
                                        <div className="text-xs text-center py-2.5 px-3 text-slate-500 bg-slate-50">
                                            {t('mslMoreGuests').replace('{k}', pickerList.rows.length).replace('{n}', pickerList.total)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ─ Периоды проживания ─ */}
            <div className="border-t border-slate-100">
                <div className="flex items-center justify-between gap-2 px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <CalendarDays size={15} className="text-slate-400" />
                        <span className="text-sm font-bold text-slate-700">{t('msPeriods')}</span>
                        <span className="text-[10.5px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 tabular-nums">{group.manualEntries.length}</span>
                        {group.manualPersonNights > 0 && <span className="text-xs text-slate-400 tabular-nums">{group.manualPersonNights} {t('msPersonNightsWord')}</span>}
                    </div>
                    <button type="button" onClick={() => setCalOpen(o => !o)}
                        className={calOpen ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-white border border-slate-800' : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:border-slate-300'}>
                        <CalendarDays size={13} /> {t('calendar')}{calOpen ? <X size={12} className="ml-0.5" /> : null}
                    </button>
                </div>
                {calOpen && (
                    <PeriodMiniCalendar
                        entries={group.manualEntries}
                        onAddPeriod={(ci, co) => actions.addEntryDates(group.id, ci, co)}
                        onEditPeriod={(id) => actions.openEntry(group.id, id)}
                        onDeletePeriod={(id) => actions.removeEntry(group.id, id)}
                        lang={lang}
                    />
                )}
                {group.manualEntries.length > 0 && (
                    <div className="mx-4 mb-2 rounded-xl border border-slate-100 overflow-hidden">
                        {group.manualEntries.length > RECENT_COUNT && !allPeriods && (
                            <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                {t('mslLastN').replace('{k}', RECENT_COUNT).replace('{n}', group.manualEntries.length)}
                            </div>
                        )}
                        {periodsShown.map(entry => {
                            const wgs = (entry.workerGroups || []).filter(wg => wg.specialty);
                            const roomLabels = Array.isArray(entry.roomIds) && entry.roomIds.length > 0
                                ? entry.roomIds.map(id => { const r = rooms.find(x => x.id === id || x.number === id); return r ? `№${r.number}` : `№${id}`; }).join(' ')
                                : '';
                            const details = [
                                entry.nights > 0 ? `${entry.nights} ${t('ormNochShort')}.` : '',
                                entry.people > 0 ? `${entry.people} ${t('msPeopleWord')}` : t('mslPeopleNotSet'),
                                roomLabels,
                            ].filter(Boolean).join(' · ');
                            const openEdit = () => actions.openEntry(group.id, entry.id);
                            return (
                                <div key={entry.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                    <button type="button" onClick={openEdit} className="flex-1 min-w-0 text-left">
                                        <div className="text-sm font-bold text-slate-700 tabular-nums">
                                            {entry.checkIn && entry.checkOut
                                                ? `${sd(entry.checkIn)} → ${sd(entry.checkOut)}`
                                                : entry.nights > 0 ? `${entry.nights} ${t('nightsMany')}` : t('msNoDates')}
                                        </div>
                                        <div className="text-xs text-slate-500 truncate tabular-nums">{details}</div>
                                        {wgs.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {wgs.map((wg, wi) => (
                                                    <span key={wg.id || wi} className="text-[11px] px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-900"><b className="tabular-nums">{wg.count || 0}</b> {wg.specialty}</span>
                                                ))}
                                            </div>
                                        )}
                                    </button>
                                    {entry.personNights > 0 && (
                                        <div className="text-right shrink-0">
                                            <div className="text-sm font-black text-teal-600 tabular-nums">{entry.personNights}</div>
                                            <div className="text-[10px] text-slate-400">{t('msPersonNightsWord')}</div>
                                        </div>
                                    )}
                                    <button onClick={openEdit}
                                        className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:border-slate-300">
                                        {t('changeTitle')}
                                    </button>
                                    <button onClick={() => actions.removeEntry(group.id, entry.id)} title={t('msmDeletePeriod')} className={iconBtnDanger}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            );
                        })}
                        <RecentToggle total={group.manualEntries.length} open={allPeriods} onToggle={() => setAllPeriods(o => !o)} t={t} />
                        {group.manualEntries.length > 1 && (
                            <div className="flex justify-between px-3 py-2 bg-slate-50 text-xs border-t border-slate-100">
                                <span className="font-bold text-slate-500">{t('mslPeriodsTotal')}</span>
                                <span className="font-black text-teal-600 tabular-nums">{group.manualPersonNights} {t('msPersonNightsWord')}</span>
                            </div>
                        )}
                    </div>
                )}
                <div className="px-4 pb-4">
                    <button onClick={() => actions.addEntryDates(group.id, pmcFmtISO(new Date()), pmcFmtISO(new Date(Date.now() + 86400000)))}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-sm font-bold text-slate-500 hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50 transition-colors">
                        <Plus size={15} /> {t('msAddPeriod')}
                    </button>
                </div>
            </div>

            {/* ─ Доп. расходы (произвольные позиции: стирка, транспорт, питание…) ─ */}
            {(!isFinished || extras.length > 0) && (
                <div className="border-t border-slate-100">
                    <div className="flex items-center gap-2 px-4 py-3">
                        <Receipt size={15} className="text-slate-400" />
                        <span className="text-sm font-bold text-slate-700">{t('msExtraCharges')}</span>
                        <span className="text-[10.5px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 tabular-nums">{extras.length}</span>
                        {group.extraTotal > 0 && <span className="text-xs text-slate-500 font-bold tabular-nums">+{fmt(group.extraTotal)} {t('sum')}</span>}
                    </div>
                    {extras.length > 0 && (
                        <div className="mx-4 mb-2 rounded-xl border border-slate-100 overflow-hidden">
                            {extrasShown.map(charge => (
                                <div key={charge.id} className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 last:border-0">
                                    <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">
                                        {(charge.transferTo || charge.transferFrom) && <ArrowLeftRight size={12} className="inline mr-1 text-amber-700" />}{charge.name}
                                    </span>
                                    {charge.date && <span className="text-xs text-slate-400 shrink-0 tabular-nums">{charge.date.slice(5).split('-').reverse().join('.')}</span>}
                                    <span className="text-sm font-bold text-slate-800 shrink-0 tabular-nums">{fmt(parseInt(charge.amount, 10) || 0)}</span>
                                    {!isFinished && (
                                        <button onClick={() => actions.removeExtraCharge(group.id, charge.id)} title={t('delete')} className={iconBtnDanger}><Trash2 size={14} /></button>
                                    )}
                                </div>
                            ))}
                            <RecentToggle total={extras.length} open={allExtras} onToggle={() => setAllExtras(o => !o)} t={t} />
                        </div>
                    )}
                    {!isFinished && (
                        <div className="px-4 pb-4">
                            {extraForm ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <input autoFocus value={extraForm.name}
                                        onChange={e => setExtraForm(f => ({ ...f, name: e.target.value }))}
                                        onKeyDown={e => { if (e.key === 'Enter') submitExtra(); if (e.key === 'Escape') setExtraForm(null); }}
                                        placeholder={t('msExtraNamePlaceholder')}
                                        className={INP + ' flex-1 min-w-[160px]'} />
                                    <input value={extraForm.amount}
                                        onChange={e => setExtraForm(f => ({ ...f, amount: e.target.value.replace(/[^\d-]/g, '') }))}
                                        onKeyDown={e => { if (e.key === 'Enter') submitExtra(); if (e.key === 'Escape') setExtraForm(null); }}
                                        placeholder={t('amount')} inputMode="numeric"
                                        className={INP + ' w-28 text-right font-bold tabular-nums'} />
                                    <button onClick={submitExtra}
                                        disabled={!extraForm.name.trim() || !(parseInt(extraForm.amount, 10))}
                                        className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40">{t('add')}</button>
                                    <button onClick={() => setExtraForm(null)} title={t('cancel')} className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"><X size={14} /></button>
                                </div>
                            ) : (
                                <button onClick={() => setExtraForm({ name: '', amount: '' })} className={GHOST_BTN}>
                                    <Plus size={13} /> {t('addExpense2')}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ─ Списание долга: только админ, в отчёты не попадает ─ */}
            {isAdmin && ((group.writeOffs || []).length > 0 || (!group.closed && group.debt > 0)) && (
                <div className="border-t border-slate-100 bg-violet-50/40">
                    <div className="flex items-center gap-2 px-4 py-3 flex-wrap">
                        <EyeOff size={15} className="text-violet-500" />
                        <span className="text-sm font-bold text-violet-700">{t('msWriteOffNoun')}</span>
                        {(group.writeOffTotal || 0) > 0 && <span className="text-xs font-bold text-violet-600 tabular-nums">−{fmt(group.writeOffTotal)} {t('sum')}</span>}
                        <span className="text-xs text-slate-400">· {t('msNotInReports')}</span>
                    </div>
                    {(group.writeOffs || []).length > 0 && (
                        <div className="mx-4 mb-2 rounded-xl border border-slate-200 bg-white overflow-hidden">
                            {group.writeOffs.map(charge => (
                                <div key={charge.id} className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 last:border-0">
                                    <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">{charge.name}</span>
                                    {charge.date && <span className="text-xs text-slate-400 shrink-0 tabular-nums">{charge.date.slice(5).split('-').reverse().join('.')}</span>}
                                    <span className="text-sm font-bold text-violet-600 shrink-0 tabular-nums">−{fmt(Math.abs(parseInt(charge.amount, 10) || 0))}</span>
                                    <button onClick={() => actions.removeWriteOff(group.id, charge.id)} title={t('cancel')} className={iconBtnDanger}><X size={14} /></button>
                                </div>
                            ))}
                        </div>
                    )}
                    {!group.closed && (
                        <div className="px-4 pb-4">
                            {writeOffForm ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <input autoFocus value={writeOffForm.reason}
                                        onChange={e => setWriteOffForm(f => ({ ...f, reason: e.target.value }))}
                                        onKeyDown={e => { if (e.key === 'Enter') submitWriteOff(); if (e.key === 'Escape') setWriteOffForm(null); }}
                                        placeholder={t('msWriteOffReasonPlaceholder')}
                                        className={INP + ' flex-1 min-w-[160px]'} />
                                    <input value={writeOffForm.amount}
                                        onChange={e => setWriteOffForm(f => ({ ...f, amount: e.target.value.replace(/\D/g, '') }))}
                                        onKeyDown={e => { if (e.key === 'Enter') submitWriteOff(); if (e.key === 'Escape') setWriteOffForm(null); }}
                                        placeholder={t('amount')} inputMode="numeric"
                                        className={INP + ' w-28 text-right font-bold tabular-nums'} />
                                    <button onClick={submitWriteOff}
                                        disabled={!(parseInt(writeOffForm.amount, 10) > 0)}
                                        className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40">{t('writeOff')}</button>
                                    <button onClick={() => setWriteOffForm(null)} title={t('cancel')} className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"><X size={14} /></button>
                                </div>
                            ) : group.debt > 0 && (
                                <button onClick={() => setWriteOffForm({ reason: '', amount: String(Math.max(0, group.debt)) })} className={GHOST_BTN}>
                                    <EyeOff size={13} /> {t('msWriteOffDebt')}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Перерисовка карточки — только когда поменялись её данные (sig) или общий вид.
// actions — постоянный объект, его не сравниваем.
const same = (a, b) =>
    a.group.sig === b.group.sig && a.idx === b.idx && a.lang === b.lang && a.rooms === b.rooms &&
    a.isAdmin === b.isAdmin && a.mergeMode === b.mergeMode && a.isSelected === b.isSelected &&
    a.groupedGuests === b.groupedGuests && a.autoOpenMembers === b.autoOpenMembers;

export default memo(GroupCard, same);
