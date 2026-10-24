import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, Search, Loader2, Edit2, Check, Users, CalendarDays, ChevronDown, ChevronRight, DollarSign, Shuffle, Trash2, FileText, Archive, ArchiveRestore, EyeOff, ArrowLeftRight, Receipt } from 'lucide-react';
import {
    collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch, } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../../firebase';
import { sumCharges } from '../../utils/contractFinancials';
import { logAction } from '../../utils/auditLog';

import TRANSLATIONS from '../../constants/translations';
import { CONTRACT_GROUPS_KEY, COLLECTION, INP, LBL, GHOST_BTN, OVERLAY_STYLE, fmt, getStayNights, pluralGroups, computeEntry, pmcFmtISO } from './ManualStay/shared';
import PaymentModal from './ManualStay/PaymentModal';
import LocalNumInput from './ManualStay/LocalNumInput';
import PeriodMiniCalendar from './ManualStay/PeriodMiniCalendar';
import PeriodEditModal from './ManualStay/PeriodEditModal';
import OverallReportModal from './ManualStay/OverallReportModal';
import BrigadeReportModal from './ManualStay/BrigadeReportModal';
import { stableView } from '../UI/stableView';

const ManualStayView = ({ guests = [], rooms = [], currentUser, payments = [], hostelFilter = 'all', lang = 'ru' }) => {
    const t = k => TRANSLATIONS[lang]?.[k] || k;
    const [contractGroups, setContractGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [memberPickerGroupId, setMemberPickerGroupId] = useState(null);
    const [memberSearch, setMemberSearch] = useState('');
    const [editingGroup, setEditingGroup] = useState(null);
    const [payingGroup, setPayingGroup] = useState(null);
    const [reportGroup, setReportGroup] = useState(null);
    const [openSections, setOpenSections] = useState({});
    const [editEntryModal, setEditEntryModal] = useState(null); // { groupId, entryId } — попап редактирования периода
    const [extraForm, setExtraForm] = useState(null); // { groupId, name, amount } — форма доп. расхода
    const [writeOffForm, setWriteOffForm] = useState(null); // { groupId, reason, amount } — форма списания долга (админ)
    const [transferModal, setTransferModal] = useState(null); // { group, targetId, amount, toArchive } — перенос сальдо
    const [mergeMode, setMergeMode] = useState(false);
    const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
    const [payingMergedGroups, setPayingMergedGroups] = useState(null);
    const [groupFilter, setGroupFilter] = useState('active'); // active | closed | all
    const [reportOpen, setReportOpen] = useState(false);
    const [confirmComplete, setConfirmComplete] = useState(null); // группа для подтверждения завершения

    const toggleSection = (groupId, section) =>
        setOpenSections(s => ({ ...s, [`${groupId}:${section}`]: !s[`${groupId}:${section}`] }));
    const isSectionOpen = (groupId, section) => !!openSections[`${groupId}:${section}`];

    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super';

    useEffect(() => {
        const colRef = collection(db, ...COLLECTION);
        const unsub = onSnapshot(colRef, (snap) => {
            const hostelId = currentUser?.hostelId || '';
            const groups = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(g => isAdmin || !g.hostelId || g.hostelId === hostelId)
                .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
            setContractGroups(groups);
            setLoading(false);
            if (!snap.metadata.fromCache && snap.empty) {
                try {
                    const raw = localStorage.getItem(CONTRACT_GROUPS_KEY);
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            const batch = writeBatch(db);
                            parsed.forEach(g => {
                                if (!g.id) return;
                                batch.set(doc(db, ...COLLECTION, g.id), {
                                    name: g.name || '', memberKeys: g.memberKeys || [],
                                    contractRate: g.contractRate || '', amountPaid: 0,
                                    manualEntries: g.manualEntries || [], createdAt: Date.now(),
                                });
                            });
                            batch.commit().then(() => localStorage.removeItem(CONTRACT_GROUPS_KEY)).catch(console.error);
                        }
                    }
                } catch { }
            }
        }, (err) => { console.error('[ManualStay]', err); setLoading(false); });
        return () => unsub();
        // Фильтр внутри подписки читает филиал и роль — при их смене нужна новая подписка,
        // иначе список договоров остаётся отфильтрованным по прежнему пользователю.
    }, [currentUser?.hostelId, isAdmin]);

    const createGroup = async () => {
        const name = newGroupName.trim();
        if (!name) return;
        const id = `contract-${Date.now()}`;
        const newHostel = (effectiveHostel && effectiveHostel !== 'all')
            ? effectiveHostel
            : (currentUser?.hostelId && currentUser.hostelId !== 'all' ? currentUser.hostelId : 'hostel1');
        await setDoc(doc(db, ...COLLECTION, id), {
            name, memberKeys: [], contractRate: '', amountPaid: 0,
            manualEntries: [], createdAt: Date.now(),
            hostelId: newHostel,
        });
        setNewGroupName('');
        setCreating(false);
        setMemberPickerGroupId(id);
        setMemberSearch('');
    };

    const renameGroup = async () => {
        if (!editingGroup) return;
        const name = editingGroup.name.trim();
        if (!name) return;
        await updateDoc(doc(db, ...COLLECTION, editingGroup.id), { name });
        setEditingGroup(null);
    };

    const deleteGroup = async (groupId) => {
        const g = contractGroups.find(x => x.id === groupId);
        // Запрет удаления договора с непогашенным сальдо: иначе перенос долга на
        // «пустышку» + её удаление стирали бы долг мимо кассы и аудита.
        if (g && Math.abs(g.debt || 0) > 0) {
            window.alert(t('msDeleteContractDebtAlert').replace('{amount}', Math.abs(g.debt).toLocaleString()));
            return;
        }
        if (!window.confirm(t('msDeleteGroupConfirm'))) return;
        await deleteDoc(doc(db, ...COLLECTION, groupId));
        logAction(currentUser, 'contract_delete', { contractId: groupId, contractName: g?.name || '' });
        if (memberPickerGroupId === groupId) setMemberPickerGroupId(null);
    };

    const updateGroup = async (groupId, patch) => {
        await updateDoc(doc(db, ...COLLECTION, groupId), patch);
    };

    // Закрытие/возобновление договора — остаётся в истории, не удаляется
    // Завершить договор: становится неактивным (нельзя оплатить), но остаётся в отчёте.
    const markGroupCompleted = async (groupId) => {
        await updateDoc(doc(db, ...COLLECTION, groupId), { completed: true, completedAt: Date.now() });
    };

    const toggleGroupClosed = async (groupId, closed) => {
        await updateDoc(doc(db, ...COLLECTION, groupId), closed
            ? { closed: true, closedAt: Date.now() }
            : { closed: false, closedAt: null });
    };

    const toggleMember = async (groupId, memberKey) => {
        const group = contractGroups.find(g => g.id === groupId);
        if (!group) return;
        const keys = new Set(group.memberKeys || []);
        if (keys.has(memberKey)) keys.delete(memberKey); else keys.add(memberKey);
        await updateDoc(doc(db, ...COLLECTION, groupId), { memberKeys: [...keys] });
    };

    // Создание периода (кнопка «Добавить период» или день в мини-календаре). Сразу открываем на редактирование.
    const addEntryDates = async (groupId, checkIn, checkOut) => {
        const group = contractGroups.find(g => g.id === groupId);
        if (!group) return;
        const id = `e-${Date.now()}`;
        const entry = { id, checkIn, checkOut, roomIds: [], people: '' };
        await updateDoc(doc(db, ...COLLECTION, groupId), { manualEntries: [...(group.manualEntries || []), entry] });
        setEditEntryModal({ groupId, entryId: id });
    };

    const updateEntry = async (groupId, entryId, patch) => {
        const group = contractGroups.find(g => g.id === groupId);
        if (!group) return;
        const manualEntries = (group.manualEntries || []).map(e => e.id === entryId ? { ...e, ...patch } : e);
        await updateDoc(doc(db, ...COLLECTION, groupId), { manualEntries });
    };

    const removeEntry = async (groupId, entryId) => {
        const group = contractGroups.find(g => g.id === groupId);
        if (!group) return;
        const entry = (group.manualEntries || []).find(e => e.id === entryId);
        if (!entry) return;
        // Подтверждение: период влияет на начисление (чел-ночи × ставка)
        const fmtD = (iso) => { if (!iso) return '?'; const [, m, d] = iso.split('-'); return `${parseInt(d)}.${m}`; };
        const period = entry.checkIn && entry.checkOut
            ? `${fmtD(entry.checkIn)} → ${fmtD(entry.checkOut)}`
            : (entry.nights > 0 ? `${entry.nights} ${t('nightsMany')}` : t('msNoDates'));
        const people = (entry.workerGroups || []).reduce((s, wg) => s + (wg.specialty ? (parseInt(wg.count) || 0) : 0), 0)
            || parseInt(entry.people, 10) || 0;
        const peopleStr = people > 0 ? t('msPeopleParen').replace('{n}', people) : '';
        if (!window.confirm(t('msDeletePeriodConfirm').replace('{period}', period).replace('{people}', peopleStr))) return false;
        const manualEntries = (group.manualEntries || []).filter(e => e.id !== entryId);
        await updateDoc(doc(db, ...COLLECTION, groupId), { manualEntries });
    };

    // ── Доп. расходы договора: произвольные позиции (название + цена) ──
    // Прибавляются к «Начислено» и попадают в долг/отчёты.
    const addExtraCharge = async (groupId, name, amount) => {
        const group = contractGroups.find(g => g.id === groupId);
        const amt = parseInt(amount, 10) || 0;
        // Только положительные позиции. Отрицательная сумма раньше молча уменьшала
        // «Начислено» и обнуляла долг мимо админского списания (addWriteOff) и без
        // аудита — снижения долга обязаны идти через списание, а не сюда.
        if (!group || !name.trim() || amt <= 0) return;
        const charge = { id: `x-${Date.now()}`, name: name.trim(), amount: amt, date: new Date().toISOString().slice(0, 10) };
        await updateDoc(doc(db, ...COLLECTION, groupId), { extraCharges: [...(group.extraCharges || []), charge] });
    };
    const removeExtraCharge = async (groupId, chargeId) => {
        const group = contractGroups.find(g => g.id === groupId);
        if (!group) return;
        const charge = (group.extraCharges || []).find(c => c.id === chargeId);
        if (!charge) return;
        const amtStr = `${Math.abs(parseInt(charge.amount, 10) || 0).toLocaleString()} ${t('sum')}`;
        // Позиция переноса: удалять можно только ПАРОЙ — иначе сальдо «повисает».
        const linkedId = charge.transferTo || charge.transferFrom;
        if (linkedId) {
            const partner = contractGroups.find(g => g.id === linkedId);
            const dir = charge.transferTo
                ? t('msTransferDirTo').replace('{name}', partner?.name || '?')
                : t('msTransferDirFrom').replace('{name}', partner?.name || '?');
            if (!window.confirm(t('msCancelTransferConfirm').replace('{dir}', dir).replace('{amt}', amtStr))) return;
            await updateDoc(doc(db, ...COLLECTION, groupId), { extraCharges: (group.extraCharges || []).filter(c => c.id !== chargeId) });
            if (partner) {
                // Парную позицию ищем по pairId (новые переносы) или по связке id+сумма (старые)
                const pair = (partner.extraCharges || []).find(c =>
                    (charge.pairId && c.pairId === charge.pairId) ||
                    ((c.transferFrom === groupId || c.transferTo === groupId) &&
                     Math.abs(parseInt(c.amount, 10) || 0) === Math.abs(parseInt(charge.amount, 10) || 0)));
                if (pair) {
                    await updateDoc(doc(db, ...COLLECTION, partner.id),
                        { extraCharges: (partner.extraCharges || []).filter(c => c.id !== pair.id) });
                }
            }
            return;
        }
        // Обычный доп. расход — просим подтверждение (раньше удалялся мгновенно)
        if (!window.confirm(t('msDeleteChargeConfirm').replace('{name}', charge.name).replace('{amt}', amtStr))) return;
        await updateDoc(doc(db, ...COLLECTION, groupId), { extraCharges: (group.extraCharges || []).filter(c => c.id !== chargeId) });
    };

    // ── Списание долга (только админ) ──────────────────────────────────────
    // Уменьшает начисленную сумму договора, НЕ создавая платёжную запись:
    // деньги не проходят через кассу, смена и кассовые отчёты не меняются.
    // Хранится в extraCharges с флагом writeOff, поэтому из всех отчётов
    // (бригадный, общий, попапы аренды) позиция исключена — видит только админ
    // в карточке договора. Событие пишется в журнал действий.
    const addWriteOff = async (groupId, reason, amount) => {
        if (!isAdmin) return;
        const group = contractGroups.find(g => g.id === groupId);
        const amt = Math.abs(parseInt(amount, 10) || 0);
        if (!group || amt <= 0) return;
        const charge = {
            id: `w-${Date.now()}`,
            name: reason.trim() || t('msWriteOffNoun'),
            amount: -amt,                     // отрицательная — уменьшает «Начислено»
            date: new Date().toISOString().slice(0, 10),
            writeOff: true,
            by: currentUser?.name || currentUser?.login || '',
        };
        await updateDoc(doc(db, ...COLLECTION, groupId), { extraCharges: [...(group.extraCharges || []), charge] });
        logAction(currentUser, 'contract_writeoff', {
            contractId: groupId, contractName: group.name, amount: amt, reason: charge.name,
        });
    };
    const removeWriteOff = async (groupId, chargeId) => {
        if (!isAdmin) return;
        const group = contractGroups.find(g => g.id === groupId);
        const charge = (group?.extraCharges || []).find(c => c.id === chargeId);
        if (!charge) return;
        const amt = Math.abs(parseInt(charge.amount, 10) || 0);
        if (!window.confirm(t('msUndoWriteOffConfirm').replace('{name}', charge.name).replace('{amt}', amt.toLocaleString()))) return;
        await updateDoc(doc(db, ...COLLECTION, groupId), { extraCharges: (group.extraCharges || []).filter(c => c.id !== chargeId) });
        logAction(currentUser, 'contract_writeoff_undo', {
            contractId: groupId, contractName: group.name, amount: amt, reason: charge.name,
        });
    };

    // ── Перенос сальдо (долга или переплаты) на другой договор ──
    // Реализовано парой доп. расходов (±сумма), а не платёжными записями — чтобы
    // не искажать кассовые отчёты фиктивными деньгами. Сумма по двум договорам
    // сохраняется, источник обнуляется и (опционально) уходит в архив.
    const transferBalance = async (sourceDetailed, targetId, amount, toArchive) => {
        const source = contractGroups.find(g => g.id === sourceDetailed.id);
        const target = contractGroups.find(g => g.id === targetId);
        const amt = parseInt(amount, 10) || 0;
        if (!source || !target || amt <= 0 || source.id === target.id) return;
        const isDebt = (sourceDetailed.contractTotal || 0) > (sourceDetailed.amountPaid || 0);
        const today = new Date().toISOString().slice(0, 10);
        const ts = Date.now();
        // Долг: у источника снимаем начисление (−), цели добавляем (+).
        // Переплата: источнику доначисляем (+) до оплаченного, цели — кредит (−).
        const srcCharge = isDebt
            ? { id: `x-${ts}`,   name: t('msTransferDebtTo').replace('{name}', target.name),       amount: -amt, date: today, transferTo: target.id,     pairId: ts }
            : { id: `x-${ts}`,   name: t('msTransferOverpayTo').replace('{name}', target.name),   amount:  amt, date: today, transferTo: target.id,     pairId: ts };
        const tgtCharge = isDebt
            ? { id: `x-${ts+1}`, name: t('msDebtFromContract').replace('{name}', source.name),        amount:  amt, date: today, transferFrom: source.id,   pairId: ts }
            : { id: `x-${ts+1}`, name: t('msOverpayFromContract').replace('{name}', source.name),   amount: -amt, date: today, transferFrom: source.id,   pairId: ts };
        await updateDoc(doc(db, ...COLLECTION, source.id), { extraCharges: [...(source.extraCharges || []), srcCharge] });
        await updateDoc(doc(db, ...COLLECTION, target.id), { extraCharges: [...(target.extraCharges || []), tgtCharge] });
        if (toArchive) {
            await updateDoc(doc(db, ...COLLECTION, source.id),
                { completed: true, completedAt: ts, closed: true, closedAt: ts });
        }
    };

    const addWorkerGroup = async (groupId, entryId) => {
        const group = contractGroups.find(g => g.id === groupId);
        if (!group) return;
        const manualEntries = (group.manualEntries || []).map(e =>
            e.id !== entryId ? e : { ...e, workerGroups: [...(e.workerGroups || []), { id: `wg-${Date.now()}`, specialty: '', count: '' }] }
        );
        await updateDoc(doc(db, ...COLLECTION, groupId), { manualEntries });
    };

    // Сумма людей по бригаде (специальности с кол-вом). Если бригада заполнена —
    // общее кол-во людей берётся отсюда; если бригады нет — people вводится вручную.
    const brigadeTotal = (workerGroups) => (workerGroups || []).reduce((s, wg) => s + (wg.specialty ? (parseInt(wg.count) || 0) : 0), 0);

    const updateWorkerGroup = async (groupId, entryId, wgId, patch) => {
        const group = contractGroups.find(g => g.id === groupId);
        if (!group) return;
        const manualEntries = (group.manualEntries || []).map(e => {
            if (e.id !== entryId) return e;
            const workerGroups = (e.workerGroups || []).map(wg => wg.id === wgId ? { ...wg, ...patch } : wg);
            const bt = brigadeTotal(workerGroups);
            return { ...e, workerGroups, ...(bt > 0 ? { people: String(bt) } : {}) };
        });
        await updateDoc(doc(db, ...COLLECTION, groupId), { manualEntries });
    };

    const removeWorkerGroup = async (groupId, entryId, wgId) => {
        const group = contractGroups.find(g => g.id === groupId);
        if (!group) return;
        const manualEntries = (group.manualEntries || []).map(e => {
            if (e.id !== entryId) return e;
            const workerGroups = (e.workerGroups || []).filter(wg => wg.id !== wgId);
            const bt = brigadeTotal(workerGroups);
            return { ...e, workerGroups, ...(bt > 0 ? { people: String(bt) } : {}) };
        });
        await updateDoc(doc(db, ...COLLECTION, groupId), { manualEntries });
    };

    const groupedGuests = useMemo(() => {
        const map = new Map();
        guests.filter(g => g.status !== 'booking').forEach(g => {
            const key = (g.fullName || '—').trim();
            if (!map.has(key)) map.set(key, { key, name: key, stays: [] });
            map.get(key).stays.push(g);
        });
        return Array.from(map.values())
            .map(g => ({
                ...g,
                stayCount: g.stays.length,
                totalNights: g.stays.reduce((s, stay) => s + getStayNights(stay), 0),
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }, [guests]);

    const guestMap = useMemo(() => new Map(groupedGuests.map(g => [g.key, g])), [groupedGuests]);

    const detailedGroups = useMemo(() => {
        return contractGroups.map(group => {
            const members = (group.memberKeys || []).map(k => guestMap.get(k)).filter(Boolean);
            const rawEntries = Array.isArray(group.manualEntries) ? group.manualEntries : [];
            const entries = rawEntries.map(e => ({ ...e, ...computeEntry(e) }))
                .sort((a, b) => (a.checkIn || '').localeCompare(b.checkIn || ''));
            const autoPersonNights   = members.reduce((s, m) => s + m.totalNights, 0);
            const manualPersonNights = entries.reduce((s, e) => s + e.personNights, 0);
            const manualRoomNights   = entries.reduce((s, e) => s + e.roomNights, 0);
            const totalPersonNights  = autoPersonNights + manualPersonNights;
            const contractRate = parseInt(group.contractRate, 10) || 0;
            const rateTotal = contractRate > 0 ? contractRate * totalPersonNights : 0;
            // Доп. расходы и списания (формула = contractFinancials.js).
            // extraCharges отдаём БЕЗ списаний — отчёты берут именно его.
            const allCharges = Array.isArray(group.extraCharges) ? group.extraCharges : [];
            const extraCharges = allCharges.filter(c => !c.writeOff);
            const writeOffs = allCharges.filter(c => c.writeOff);
            const extraTotal = sumCharges(extraCharges);
            const writeOffTotal = -sumCharges(writeOffs) || 0;
            const contractTotal = rateTotal + extraTotal - writeOffTotal;
            // Compute amountPaid from payment records first, fallback to group.amountPaid (legacy)
            const groupPayments = payments.filter(p => p.contractGroupId === group.id);
            const paidFromRecords = groupPayments.reduce((s, p) => {
                const pAmt = (parseInt(p.cash)||0) + (parseInt(p.transfer)||0) + (parseInt(p.card)||0) + (parseInt(p.qr)||0);
                return s + (pAmt || parseInt(p.amount) || 0);
            }, 0);
            const amountPaid = paidFromRecords > 0 ? paidFromRecords : (parseInt(group.amountPaid, 10) || 0);
            const debt = contractTotal > 0 ? contractTotal - amountPaid : 0;
            return {
                ...group, members, manualEntries: entries,
                autoPersonNights, manualPersonNights, manualRoomNights, totalPersonNights,
                contractRate, rateTotal, extraCharges, extraTotal, contractTotal, amountPaid, debt,
                writeOffs, writeOffTotal,
            };
        });
    }, [contractGroups, guestMap, payments]);

    const filteredGuests = useMemo(() => {
        const q = memberSearch.trim().toLowerCase();
        return q ? groupedGuests.filter(g => g.name.toLowerCase().includes(q)) : groupedGuests;
    }, [groupedGuests, memberSearch]);

    // Ранее сохранённые специальности из всех договоров — для выбора при создании периода
    const savedSpecialties = useMemo(() => {
        const set = new Set();
        contractGroups.forEach(g => (g.manualEntries || []).forEach(e => (e.workerGroups || []).forEach(wg => {
            const s = (wg.specialty || '').trim();
            if (s) set.add(s);
        })));
        return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
    }, [contractGroups]);

    // Каждый договор привязан к хостелу. Показываем только договоры активного хостела.
    const effectiveHostel = (currentUser?.role === 'admin' || currentUser?.role === 'super')
        ? hostelFilter
        : (currentUser?.hostelId || 'all');
    const hostelGroups = useMemo(() => {
        if (!effectiveHostel || effectiveHostel === 'all') return detailedGroups;
        // Каждый договор привязан к хостелу. Легаси без hostelId считаем за hostel1,
        // чтобы они не показывались сразу в обоих хостелах.
        return detailedGroups.filter(g => (g.hostelId || 'hostel1') === effectiveHostel);
    }, [detailedGroups, effectiveHostel]);

    const closedCount = useMemo(() => hostelGroups.filter(g => g.closed).length, [hostelGroups]);
    const visibleGroups = useMemo(() => {
        if (groupFilter === 'closed') return hostelGroups.filter(g => g.closed);
        if (groupFilter === 'all') return hostelGroups;
        return hostelGroups.filter(g => !g.closed);
    }, [hostelGroups, groupFilter]);

    const globalStats = useMemo(() => ({
        nights:   visibleGroups.reduce((s, g) => s + g.totalPersonNights, 0),
        charged:  visibleGroups.reduce((s, g) => s + g.contractTotal, 0),
        paid:     visibleGroups.reduce((s, g) => s + g.amountPaid, 0),
        debt:     visibleGroups.reduce((s, g) => s + Math.max(0, g.debt), 0),
    }), [visibleGroups]);

    if (loading) return (
        <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-slate-400" />
        </div>
    );

    const paidPct = globalStats.charged > 0 ? Math.min(100, (globalStats.paid / globalStats.charged) * 100) : 0;
    const sd = (iso) => { if (!iso) return '—'; const [, m, d] = iso.split('-'); return `${parseInt(d)}.${m}`; };
    const chipCls = (on) => `px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${on ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`;
    const iconBtnDanger = 'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors';

    return (
        <div className="space-y-3">
            {payingGroup && (
                <PaymentModal group={payingGroup} currentUser={currentUser} onClose={() => setPayingGroup(null)} lang={lang} />
            )}
            {confirmComplete && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={OVERLAY_STYLE} onClick={() => setConfirmComplete(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-slate-100">
                                <Check size={18} className="text-slate-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">{t('msCompleteContractQ')}</h3>
                                <p className="text-sm text-slate-500">«{confirmComplete.name}»</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-500 mb-5">{t('msCompleteContractDesc')}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmComplete(null)}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                                {t('cancel')}
                            </button>
                            <button onClick={() => { markGroupCompleted(confirmComplete.id); setConfirmComplete(null); }}
                                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors">
                                {t('finish')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {payingMergedGroups && (
                <PaymentModal groups={payingMergedGroups} currentUser={currentUser} onClose={() => { setPayingMergedGroups(null); setMergeMode(false); setSelectedGroupIds(new Set()); }} lang={lang} />
            )}
            {transferModal && (() => {
                const src = transferModal.group;
                const balance = (src.amountPaid || 0) - (src.contractTotal || 0);
                const isDebt = balance < 0;
                const maxAmt = Math.abs(balance);
                const amt = parseInt(transferModal.amount, 10) || 0;
                // Цели: активные договоры того же экрана, кроме источника
                const targets = hostelGroups.filter(g => g.id !== src.id && !g.closed && !g.completed);
                const canSubmit = transferModal.targetId && amt > 0 && amt <= maxAmt;
                return (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={OVERLAY_STYLE} onClick={() => setTransferModal(null)}>
                        <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-50 text-amber-700"><ArrowLeftRight size={18} /></div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-slate-800">{isDebt ? t('msTransferDebtTitle') : t('msTransferOverpayTitle')}</h3>
                                    <p className="text-sm text-slate-500 truncate">{t('msTransferDirFrom').replace('{name}', src.name)}</p>
                                </div>
                            </div>
                            <div className={`rounded-xl px-4 py-3 mb-4 flex items-center justify-between ${isDebt ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                                <span className={`text-sm font-semibold ${isDebt ? 'text-rose-600' : 'text-emerald-600'}`}>{isDebt ? t('msDebtByContract') : t('msOverpayByContract')}</span>
                                <span className={`text-sm font-black tabular-nums ${isDebt ? 'text-rose-600' : 'text-emerald-600'}`}>{fmt(maxAmt)} {t('sum')}</span>
                            </div>
                            <label className={LBL}>{t('msTransferWhereTo')}</label>
                            <select value={transferModal.targetId}
                                onChange={e => setTransferModal(m => ({ ...m, targetId: e.target.value }))}
                                className={INP + ' w-full font-semibold mb-3'}>
                                <option value="">{t('msSelectContract')}</option>
                                {targets.map(g => (
                                    <option key={g.id} value={g.id}>
                                        {g.name}{(g.debt || 0) > 0 ? t('msDebtParen').replace('{n}', fmt(g.debt)) : ''}
                                    </option>
                                ))}
                            </select>
                            <label className={LBL}>{t('amount')}</label>
                            <input value={transferModal.amount} inputMode="numeric"
                                onChange={e => setTransferModal(m => ({ ...m, amount: e.target.value.replace(/\D/g, '') }))}
                                className={INP + ' w-full font-black tabular-nums mb-1'} />
                            {amt > maxAmt && <p className="text-xs text-rose-500 font-semibold mb-2">{t('maximum')} {fmt(maxAmt)} {t('sum')}</p>}
                            <label className="flex items-center gap-2 mt-3 mb-5 cursor-pointer select-none">
                                <input type="checkbox" checked={transferModal.toArchive}
                                    onChange={e => setTransferModal(m => ({ ...m, toArchive: e.target.checked }))}
                                    className="w-4 h-4 accent-orange-500" />
                                <span className="text-sm text-slate-600 font-medium">{t('msAfterTransferArchive')}</span>
                            </label>
                            {transferModal.toArchive && amt < maxAmt && (
                                <p className="text-xs text-amber-700 font-semibold mb-3">{t('msPartialTransferWarn').replace('{n}', fmt(maxAmt - amt))}</p>
                            )}
                            <div className="flex gap-3">
                                <button onClick={() => setTransferModal(null)}
                                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                                    {t('cancel')}
                                </button>
                                <button disabled={!canSubmit}
                                    onClick={async () => {
                                        await transferBalance(src, transferModal.targetId, amt, transferModal.toArchive);
                                        setTransferModal(null);
                                    }}
                                    className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors disabled:opacity-40">
                                    {transferModal.toArchive ? t('msTransferAndArchive') : t('msTransfer')}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
            {reportGroup && (
                <BrigadeReportModal group={reportGroup} onClose={() => setReportGroup(null)} lang={lang} />
            )}
            {reportOpen && (() => {
                const sel = selectedGroupIds.size ? visibleGroups.filter(g => selectedGroupIds.has(g.id)) : visibleGroups;
                const label = selectedGroupIds.size
                    ? t('msSelectedColon').replace('{n}', selectedGroupIds.size)
                    : (groupFilter === 'closed' ? t('msHistoryClosed') : groupFilter === 'all' ? t('msAllContracts') : t('msActiveContracts'));
                const hLabel = effectiveHostel === 'hostel1' ? t('expHostel1') : effectiveHostel === 'hostel2' ? t('expHostel2') : t('expAllHostels');
                return <OverallReportModal groups={sel} payments={payments} scopeLabel={label} hostelLabel={hLabel} lang={lang} onClose={() => setReportOpen(false)} />;
            })()}
            {editEntryModal && (() => {
                const g = contractGroups.find(x => x.id === editEntryModal.groupId);
                const en = g?.manualEntries?.find(e => e.id === editEntryModal.entryId);
                if (!g || !en) return null;
                return (
                    <PeriodEditModal
                        group={g} entry={en} rooms={rooms} savedSpecialties={savedSpecialties}
                        onUpdate={patch => updateEntry(g.id, en.id, patch)}
                        onRemove={() => removeEntry(g.id, en.id)}
                        onAddWG={() => addWorkerGroup(g.id, en.id)}
                        onUpdateWG={(wgId, patch) => updateWorkerGroup(g.id, en.id, wgId, patch)}
                        onRemoveWG={(wgId) => removeWorkerGroup(g.id, en.id, wgId)}
                        onClose={() => setEditEntryModal(null)}
                        lang={lang}
                    />
                );
            })()}

            {/* ─ Шапка: заголовок, действия, фильтры, итоги ─ */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-baseline gap-x-4 gap-y-1 flex-wrap">
                        <h2 className="text-xl md:text-2xl font-black text-slate-800">{t('msTitle')}</h2>
                        <span className="text-sm text-slate-400">{t('mslSubtitle')} · <span className="tabular-nums">{visibleGroups.length}</span> {lang === 'ru' ? pluralGroups(visibleGroups.length) : t('mslGroupsWord')}</span>
                    </div>
                    {!creating && (
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            {hostelGroups.length > 0 && (
                                <button onClick={() => setReportOpen(true)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors">
                                    <FileText size={15} /> {t('ormOverall')}
                                </button>
                            )}
                            {hostelGroups.length > 1 && (
                                <button onClick={() => { setMergeMode(m => !m); setSelectedGroupIds(new Set()); }}
                                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold border transition-colors ${mergeMode ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
                                    {mergeMode ? <X size={15} /> : <Shuffle size={15} />}
                                    {mergeMode ? t('mslMergeCancel') : t('mslMergePay')}
                                </button>
                            )}
                            <button onClick={() => setCreating(true)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-orange-500 hover:bg-orange-600 text-white transition-colors">
                                <Plus size={15} strokeWidth={2.5} /> {t('msNewGroup')}
                            </button>
                        </div>
                    )}
                </div>

                {creating && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap rounded-xl border border-orange-200 bg-orange-50 p-2.5">
                        <input autoFocus value={newGroupName}
                            onChange={e => setNewGroupName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') createGroup(); if (e.key === 'Escape') { setCreating(false); setNewGroupName(''); } }}
                            placeholder={t('msContractNamePlaceholder')}
                            className={INP + ' flex-1 min-w-[200px]'}
                        />
                        <button onClick={createGroup} disabled={!newGroupName.trim()}
                            className="px-4 py-2 rounded-xl text-sm font-bold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 transition-colors">
                            {t('msCreateGroup')}
                        </button>
                        <button onClick={() => { setCreating(false); setNewGroupName(''); }}
                            className="px-3 py-2 rounded-xl text-sm font-bold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
                            {t('cancel')}
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    {[
                        { id: 'active', label: t('active'),      n: hostelGroups.length - closedCount },
                        { id: 'closed', label: t('mslArchive'),  n: closedCount },
                        { id: 'all',    label: t('all'),         n: hostelGroups.length },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setGroupFilter(tab.id)} className={chipCls(groupFilter === tab.id)}>
                            {tab.label} · <span className="tabular-nums">{tab.n}</span>
                        </button>
                    ))}
                </div>

                {visibleGroups.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                        {[
                            { label: t('msPersonNightsUpper'), value: globalStats.nights.toLocaleString('ru-RU'), unit: t('msTotalLower'), cls: 'text-teal-600' },
                            { label: t('msChargedUpper'), value: fmt(globalStats.charged), unit: t('sum'), cls: 'text-slate-800' },
                            { label: t('msPaidUpper'),    value: fmt(globalStats.paid),    unit: t('sum'), cls: 'text-emerald-600' },
                            globalStats.debt > 0
                                ? { label: t('msDebtUpper'), value: fmt(globalStats.debt), unit: t('sum'), cls: 'text-rose-600', box: 'bg-rose-50 border-rose-100' }
                                : { label: t('msDebtUpper'), value: t('mslNoDebt'), unit: t('mslAllPaid'), cls: 'text-emerald-600' },
                        ].map(s => (
                            <div key={s.label} className={`rounded-xl border px-3.5 py-2.5 ${s.box || 'bg-slate-50 border-slate-100'}`}>
                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{s.label}</div>
                                <div className={`text-lg md:text-xl font-black tabular-nums leading-tight mt-0.5 ${s.cls}`}>{s.value}</div>
                                <div className="text-[11px] text-slate-400">{s.unit}</div>
                            </div>
                        ))}
                    </div>
                )}
                {globalStats.charged > 0 && (
                    <div className="mt-3">
                        <div className="flex justify-between mb-1 text-xs">
                            <span className="text-slate-500">{t('mslPaidOfCharged')}</span>
                            <span className={`font-bold tabular-nums ${paidPct >= 100 ? 'text-emerald-600' : 'text-slate-600'}`}>{paidPct.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden bg-slate-100">
                            <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${paidPct}%` }} />
                        </div>
                    </div>
                )}
            </div>

            {mergeMode && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm text-orange-700">
                    {t('mslMergeHint')}
                </div>
            )}

            {visibleGroups.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 py-12 text-center">
                    <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-slate-100">
                        <Users size={22} className="text-slate-400" />
                    </div>
                    <p className="text-slate-700 font-bold">{groupFilter === 'closed' ? t('mslEmptyArchive') : t('msNoGroups')}</p>
                    {groupFilter !== 'closed' && (
                        <>
                            <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">{t('mslEmptyHint')}</p>
                            <button onClick={() => setCreating(true)}
                                className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors">
                                <Plus size={15} /> {t('msCreateGroup')}
                            </button>
                        </>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
                {visibleGroups.map((group, idx) => {
                    const isMemberPickerOpen = memberPickerGroupId === group.id;
                    const isEditing = editingGroup?.id === group.id;
                    const membersOpen = isSectionOpen(group.id, 'members');
                    const calOpen = isSectionOpen(group.id, 'minical');
                    const groupPaidPct = group.contractTotal > 0 ? Math.min(100, (group.amountPaid / group.contractTotal) * 100) : 0;
                    const isPaid = group.contractTotal > 0 && group.debt <= 0;
                    const isFinished = group.completed || group.closed;
                    const balance = (group.amountPaid || 0) - (group.contractTotal || 0);
                    const num = String(idx + 1).padStart(2, '0');
                    const isSelected = selectedGroupIds.has(group.id);
                    const toggleSelected = () => setSelectedGroupIds(prev => { const n = new Set(prev); if (n.has(group.id)) n.delete(group.id); else n.add(group.id); return n; });

                    return (
                        <div key={group.id}
                            className={`bg-white rounded-2xl border overflow-hidden transition-colors ${isSelected ? 'border-orange-400 ring-2 ring-orange-500/20' : 'border-slate-200'} ${group.closed ? 'opacity-80' : ''}`}>

                            {/* ─ Заголовок карточки ─ */}
                            <div className="flex items-start gap-3 px-4 pt-4">
                                {mergeMode && (
                                    <button type="button" onClick={toggleSelected}
                                        className={`mt-1.5 w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-orange-500 bg-orange-500' : 'border-slate-300 bg-white hover:border-orange-400'}`}>
                                        {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                                    </button>
                                )}
                                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 text-sm font-black tabular-nums select-none">{num}</div>
                                <div className="flex-1 min-w-0">
                                    {isEditing ? (
                                        <div className="flex items-center gap-1.5">
                                            <input autoFocus value={editingGroup.name}
                                                onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })}
                                                onKeyDown={e => { if (e.key === 'Enter') renameGroup(); if (e.key === 'Escape') setEditingGroup(null); }}
                                                className={INP + ' flex-1 min-w-0 font-bold'}
                                            />
                                            <button onClick={renameGroup} title={t('mslSave')} className="w-9 h-9 rounded-lg flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white shrink-0"><Check size={15} /></button>
                                            <button onClick={() => setEditingGroup(null)} title={t('cancel')} className="w-9 h-9 rounded-lg flex items-center justify-center border border-slate-200 text-slate-400 hover:bg-slate-50 shrink-0"><X size={15} /></button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className={`text-base font-black leading-tight ${group.closed ? 'text-slate-500' : 'text-slate-800'}`}>{group.name}</span>
                                            {group.closed && <span className="text-[10.5px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{t('msClosedBadge')}</span>}
                                            {!group.closed && group.completed && <span className="text-[10.5px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{t('msCompletedBadge')}</span>}
                                            {isPaid && <span className="inline-flex items-center gap-1 text-[10.5px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600"><Check size={10} strokeWidth={3} /> {t('paid')}</span>}
                                            {!isPaid && group.debt > 0 && group.contractTotal > 0 && <span className="text-[10.5px] font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 tabular-nums">{t('mslDebtBadge').replace('{n}', fmt(group.debt))}</span>}
                                        </div>
                                    )}
                                    {isAdmin && !isEditing && (
                                        <select value={group.hostelId || ''} onChange={e => updateGroup(group.id, { hostelId: e.target.value })}
                                            className={`mt-1.5 text-xs rounded-lg px-2 py-1 border focus:outline-none ${group.hostelId ? 'border-slate-200 bg-white text-slate-600' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
                                            <option value="">{t('msHostelOption')}</option>
                                            <option value="hostel1">{t('expHostel1')}</option>
                                            <option value="hostel2">{t('expHostel2')}</option>
                                        </select>
                                    )}
                                </div>
                                {!isEditing && (
                                    <button onClick={() => deleteGroup(group.id)} title={t('mslDeleteGroup')}
                                        className="-mr-1 -mt-1 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                                        <Trash2 size={15} />
                                    </button>
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
                            <div className="px-4 pt-3 pb-4 space-y-3">
                                {!isFinished && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <label className="text-xs font-bold text-slate-500">{t('mslRatePerPn')}</label>
                                        <LocalNumInput value={group.contractRate || ''} onCommit={val => updateGroup(group.id, { contractRate: val })}
                                            placeholder="0"
                                            className={INP + ' w-28 text-right font-bold tabular-nums'} />
                                        <span className="text-xs text-slate-400">{t('sum')}</span>
                                        {!group.contractRate && <span className="text-xs text-amber-700">{t('mslRateHint')}</span>}
                                    </div>
                                )}
                                <div className="flex items-center gap-2 flex-wrap">
                                    {!isFinished && (
                                        <button onClick={() => setPayingGroup(group)}
                                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white transition-colors">
                                            <DollarSign size={14} /> {t('rpmAccept')}
                                        </button>
                                    )}
                                    <button onClick={() => setReportGroup(group)} className={GHOST_BTN}><FileText size={14} /> {t('msReport')}</button>
                                    {!isFinished && (
                                        <>
                                            {balance !== 0 && (
                                                <button onClick={() => setTransferModal({ group, targetId: '', amount: String(Math.abs(balance)), toArchive: true })}
                                                    title={balance < 0 ? t('msTransferDebtTitleFull').replace('{n}', fmt(-balance)) : t('msTransferOverpayTitleFull').replace('{n}', fmt(balance))}
                                                    className={GHOST_BTN}>
                                                    <ArrowLeftRight size={14} /> {t('mslBalance')}
                                                </button>
                                            )}
                                            <button onClick={() => setEditingGroup({ id: group.id, name: group.name })} className={GHOST_BTN}><Edit2 size={13} /> {t('mslRename')}</button>
                                            <button onClick={() => setConfirmComplete(group)} title={t('msCompleteContractTitle')} className={GHOST_BTN}><Check size={14} /> {t('finish')}</button>
                                        </>
                                    )}
                                    {group.completed && !group.closed && (
                                        <>
                                            <button onClick={() => toggleGroupClosed(group.id, true)} title={t('msToArchiveTitle')} className={GHOST_BTN}><Archive size={14} /> {t('expToArchive')}</button>
                                            <button onClick={() => updateGroup(group.id, { completed: false, completedAt: null })} title={t('msResumeTitle')} className={GHOST_BTN}><ArchiveRestore size={14} /> {t('msResume')}</button>
                                        </>
                                    )}
                                    {group.closed && (
                                        <button onClick={() => toggleGroupClosed(group.id, false)} title={t('msReturnFromArchiveTitle')} className={GHOST_BTN}><ArchiveRestore size={14} /> {t('returnBtn')}</button>
                                    )}
                                </div>
                            </div>

                            {/* ─ Участники ─ */}
                            <div className="border-t border-slate-100">
                                <button type="button"
                                    onClick={() => { toggleSection(group.id, 'members'); if (!isSectionOpen(group.id, 'members')) { setMemberPickerGroupId(null); setMemberSearch(''); } }}
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
                                                        <button onClick={() => toggleMember(group.id, member.key)} title={t('mslRemoveFromGroup')}
                                                            className="w-5 h-5 rounded-full flex items-center justify-center text-teal-600 hover:bg-rose-100 hover:text-rose-600 transition-colors"><X size={11} /></button>
                                                    </span>
                                                ))}
                                            </div>
                                        ) : !isMemberPickerOpen && (
                                            <div className="text-xs text-slate-400">{t('mslNoMembers')}</div>
                                        )}
                                        <button onClick={() => { if (isMemberPickerOpen) { setMemberPickerGroupId(null); setMemberSearch(''); } else { setMemberPickerGroupId(group.id); setMemberSearch(''); } }}
                                            className={isMemberPickerOpen ? 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-slate-800 text-white' : GHOST_BTN}>
                                            {isMemberPickerOpen ? <><Check size={13} /> {t('done')}</> : <><Plus size={13} /> {t('mslAddMembers')}</>}
                                        </button>
                                        {isMemberPickerOpen && (
                                            <div className="rounded-xl overflow-hidden border border-slate-200">
                                                <div className="relative border-b border-slate-100">
                                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                                                    <input autoFocus value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder={t('mslSearchGuest')}
                                                        className="w-full pl-9 pr-3 py-2.5 text-sm focus:outline-none bg-white text-slate-700" />
                                                </div>
                                                <div className="max-h-56 overflow-y-auto">
                                                    {filteredGuests.length === 0
                                                        ? <div className="text-sm text-center py-3 text-slate-400">{t('msNotFound')}</div>
                                                        : filteredGuests.map(guest => {
                                                            const inGroup = (group.memberKeys || []).includes(guest.key);
                                                            return (
                                                                <button key={guest.key} onClick={() => toggleMember(group.id, guest.key)}
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
                                    <button type="button" onClick={() => toggleSection(group.id, 'minical')}
                                        className={calOpen ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-white border border-slate-800' : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:border-slate-300'}>
                                        <CalendarDays size={13} /> {t('calendar')}{calOpen ? <X size={12} className="ml-0.5" /> : null}
                                    </button>
                                </div>
                                {calOpen && (
                                    <PeriodMiniCalendar
                                        entries={group.manualEntries}
                                        onAddPeriod={(ci, co) => addEntryDates(group.id, ci, co)}
                                        onEditPeriod={(id) => setEditEntryModal({ groupId: group.id, entryId: id })}
                                        onDeletePeriod={(id) => removeEntry(group.id, id)}
                                        lang={lang}
                                    />
                                )}
                                {group.manualEntries.length > 0 && (
                                    <div className="mx-4 mb-2 rounded-xl border border-slate-100 overflow-hidden">
                                        {group.manualEntries.map(entry => {
                                            const wgs = (entry.workerGroups || []).filter(wg => wg.specialty);
                                            const roomLabels = Array.isArray(entry.roomIds) && entry.roomIds.length > 0
                                                ? entry.roomIds.map(id => { const r = rooms.find(x => x.id === id || x.number === id); return r ? `№${r.number}` : `№${id}`; }).join(' ')
                                                : '';
                                            const details = [
                                                entry.nights > 0 ? `${entry.nights} ${t('ormNochShort')}.` : '',
                                                entry.people > 0 ? `${entry.people} ${t('msPeopleWord')}` : t('mslPeopleNotSet'),
                                                roomLabels,
                                            ].filter(Boolean).join(' · ');
                                            const openEdit = () => setEditEntryModal({ groupId: group.id, entryId: entry.id });
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
                                                        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:border-slate-300">
                                                        {t('changeTitle')}
                                                    </button>
                                                    <button onClick={() => removeEntry(group.id, entry.id)} title={t('msmDeletePeriod')} className={iconBtnDanger}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                        {group.manualEntries.length > 1 && (
                                            <div className="flex justify-between px-3 py-2 bg-slate-50 text-xs">
                                                <span className="font-bold text-slate-500">{t('mslPeriodsTotal')}</span>
                                                <span className="font-black text-teal-600 tabular-nums">{group.manualPersonNights} {t('msPersonNightsWord')}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="px-4 pb-4">
                                    <button onClick={() => addEntryDates(group.id, pmcFmtISO(new Date()), pmcFmtISO(new Date(Date.now() + 86400000)))}
                                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-sm font-bold text-slate-500 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition-colors">
                                        <Plus size={15} /> {t('msAddPeriod')}
                                    </button>
                                </div>
                            </div>

                            {/* ─ Доп. расходы (произвольные позиции: стирка, транспорт, питание…) ─ */}
                            {(!isFinished || (group.extraCharges || []).length > 0) && (
                                <div className="border-t border-slate-100">
                                    <div className="flex items-center gap-2 px-4 py-3">
                                        <Receipt size={15} className="text-slate-400" />
                                        <span className="text-sm font-bold text-slate-700">{t('msExtraCharges')}</span>
                                        <span className="text-[10.5px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 tabular-nums">{(group.extraCharges || []).length}</span>
                                        {group.extraTotal > 0 && <span className="text-xs text-slate-500 font-bold tabular-nums">+{fmt(group.extraTotal)} {t('sum')}</span>}
                                    </div>
                                    {(group.extraCharges || []).length > 0 && (
                                        <div className="mx-4 mb-2 rounded-xl border border-slate-100 overflow-hidden">
                                            {group.extraCharges.map(charge => (
                                                <div key={charge.id} className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 last:border-0">
                                                    <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">
                                                        {(charge.transferTo || charge.transferFrom) && <ArrowLeftRight size={12} className="inline mr-1 text-amber-700" />}{charge.name}
                                                    </span>
                                                    {charge.date && <span className="text-xs text-slate-400 shrink-0 tabular-nums">{charge.date.slice(5).split('-').reverse().join('.')}</span>}
                                                    <span className="text-sm font-bold text-slate-800 shrink-0 tabular-nums">{fmt(parseInt(charge.amount, 10) || 0)}</span>
                                                    {!isFinished && (
                                                        <button onClick={() => removeExtraCharge(group.id, charge.id)} title={t('delete')} className={iconBtnDanger}><Trash2 size={14} /></button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {!isFinished && (
                                        <div className="px-4 pb-4">
                                            {extraForm?.groupId === group.id ? (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <input autoFocus value={extraForm.name}
                                                        onChange={e => setExtraForm(f => ({ ...f, name: e.target.value }))}
                                                        onKeyDown={e => { if (e.key === 'Enter') { addExtraCharge(group.id, extraForm.name, extraForm.amount); setExtraForm(null); } if (e.key === 'Escape') setExtraForm(null); }}
                                                        placeholder={t('msExtraNamePlaceholder')}
                                                        className={INP + ' flex-1 min-w-[160px]'} />
                                                    <input value={extraForm.amount}
                                                        onChange={e => setExtraForm(f => ({ ...f, amount: e.target.value.replace(/[^\d-]/g, '') }))}
                                                        onKeyDown={e => { if (e.key === 'Enter') { addExtraCharge(group.id, extraForm.name, extraForm.amount); setExtraForm(null); } if (e.key === 'Escape') setExtraForm(null); }}
                                                        placeholder={t('amount')} inputMode="numeric"
                                                        className={INP + ' w-28 text-right font-bold tabular-nums'} />
                                                    <button onClick={() => { addExtraCharge(group.id, extraForm.name, extraForm.amount); setExtraForm(null); }}
                                                        disabled={!extraForm.name.trim() || !(parseInt(extraForm.amount, 10))}
                                                        className="shrink-0 px-4 py-2 rounded-lg text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40">{t('add')}</button>
                                                    <button onClick={() => setExtraForm(null)} title={t('cancel')} className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"><X size={14} /></button>
                                                </div>
                                            ) : (
                                                <button onClick={() => setExtraForm({ groupId: group.id, name: '', amount: '' })} className={GHOST_BTN}>
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
                                                    <button onClick={() => removeWriteOff(group.id, charge.id)} title={t('cancel')} className={iconBtnDanger}><X size={14} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {!group.closed && (
                                        <div className="px-4 pb-4">
                                            {writeOffForm?.groupId === group.id ? (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <input autoFocus value={writeOffForm.reason}
                                                        onChange={e => setWriteOffForm(f => ({ ...f, reason: e.target.value }))}
                                                        onKeyDown={e => { if (e.key === 'Enter') { addWriteOff(group.id, writeOffForm.reason, writeOffForm.amount); setWriteOffForm(null); } if (e.key === 'Escape') setWriteOffForm(null); }}
                                                        placeholder={t('msWriteOffReasonPlaceholder')}
                                                        className={INP + ' flex-1 min-w-[160px]'} />
                                                    <input value={writeOffForm.amount}
                                                        onChange={e => setWriteOffForm(f => ({ ...f, amount: e.target.value.replace(/\D/g, '') }))}
                                                        onKeyDown={e => { if (e.key === 'Enter') { addWriteOff(group.id, writeOffForm.reason, writeOffForm.amount); setWriteOffForm(null); } if (e.key === 'Escape') setWriteOffForm(null); }}
                                                        placeholder={t('amount')} inputMode="numeric"
                                                        className={INP + ' w-28 text-right font-bold tabular-nums'} />
                                                    <button onClick={() => { addWriteOff(group.id, writeOffForm.reason, writeOffForm.amount); setWriteOffForm(null); }}
                                                        disabled={!(parseInt(writeOffForm.amount, 10) > 0)}
                                                        className="shrink-0 px-4 py-2 rounded-lg text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40">{t('writeOff')}</button>
                                                    <button onClick={() => setWriteOffForm(null)} title={t('cancel')} className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"><X size={14} /></button>
                                                </div>
                                            ) : group.debt > 0 && (
                                                <button onClick={() => setWriteOffForm({ groupId: group.id, reason: '', amount: String(Math.max(0, group.debt)) })} className={GHOST_BTN}>
                                                    <EyeOff size={13} /> {t('msWriteOffDebt')}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ─ Панель общей оплаты ─ */}
            {mergeMode && selectedGroupIds.size >= 2 && (() => {
                const selGroups = detailedGroups.filter(g => selectedGroupIds.has(g.id));
                const totalDebt = selGroups.reduce((s, g) => s + (g.debt || 0), 0);
                const totalCharged = selGroups.reduce((s, g) => s + (g.contractTotal || 0), 0);
                return (
                    <div className="sticky bottom-4 mt-4 z-20">
                        <div className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3 bg-white border border-orange-200 shadow-xl">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-orange-50 text-orange-600 text-base font-black tabular-nums">{selectedGroupIds.size}</div>
                                <div className="min-w-0">
                                    <div className="text-sm font-bold text-slate-800">{t('msSelectedGroups').replace('{n}', selectedGroupIds.size)}</div>
                                    <div className="text-xs text-slate-500 tabular-nums">
                                        {totalCharged > 0 && <span>{t('expCharged')}: <b className="text-slate-700">{fmt(totalCharged)}</b></span>}
                                        {totalDebt > 0 && <span className="ml-2">{t('msDebtLower')}: <b className="text-rose-600">{fmt(totalDebt)}</b></span>}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setPayingMergedGroups(selGroups)}
                                className="shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors">
                                {t('msPayGroups').replace('{n}', selectedGroupIds.size)}
                            </button>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

// Перерисовка — только когда поменялись данные экрана (см. UI/stableView.jsx)
export default stableView(ManualStayView);
