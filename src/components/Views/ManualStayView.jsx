import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, Search, Loader2, Edit2, Check, Users, CalendarDays, ChevronDown, ChevronRight, CreditCard, DollarSign, Shuffle, Trash2, FileText, TrendingUp, Archive, ArchiveRestore, EyeOff } from 'lucide-react';
import {
    collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch, } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../../firebase';
import { sumCharges } from '../../utils/contractFinancials';
import { logAction } from '../../utils/auditLog';

import TRANSLATIONS from '../../constants/translations';
import { CONTRACT_GROUPS_KEY, COLLECTION, PAYMENTS_COLLECTION, TRANSFER_ENTITIES, INP, fmt, getStayNights, pluralGroups, computeEntry, ACCENT_COLORS } from './ManualStay/shared';
import RoomPicker from './ManualStay/RoomPicker';
import PaymentModal from './ManualStay/PaymentModal';
import WorkerGroupRow from './ManualStay/WorkerGroupRow';
import LocalNumInput from './ManualStay/LocalNumInput';
import PeriodMiniCalendar from './ManualStay/PeriodMiniCalendar';
import PeriodEditModal from './ManualStay/PeriodEditModal';
import OverallReportModal from './ManualStay/OverallReportModal';
import BrigadeReportModal from './ManualStay/BrigadeReportModal';

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
    const [openWorkerGroups, setOpenWorkerGroups] = useState({});
    const [editingEntryId, setEditingEntryId] = useState(null);
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

    const addEntry = async (groupId) => {
        const group = contractGroups.find(g => g.id === groupId);
        if (!group) return;
        const today = new Date().toISOString().slice(0, 10);
        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        const entry = { id: `e-${Date.now()}`, checkIn: today, checkOut: tomorrow, roomIds: [], people: '' };
        await updateDoc(doc(db, ...COLLECTION, groupId), { manualEntries: [...(group.manualEntries || []), entry] });
    };

    // Создание периода из мини-календаря (выбранный диапазон дат). Открываем на редактирование.
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
        if (!window.confirm(t('msDeletePeriodConfirm').replace('{period}', period).replace('{people}', peopleStr))) return;
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
            <Loader2 className="animate-spin" size={28} style={{ color: '#6366f1' }} />
        </div>
    );

    const paidPct = globalStats.charged > 0 ? Math.min(100, (globalStats.paid / globalStats.charged) * 100) : 0;
    const toggleWG = (entryId) => setOpenWorkerGroups(s => ({ ...s, [entryId]: !s[entryId] }));

    return (
        <div className="space-y-3">
            {payingGroup && (
                <PaymentModal group={payingGroup} currentUser={currentUser} onClose={() => setPayingGroup(null)} />
            )}
            {confirmComplete && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setConfirmComplete(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(99,102,241,0.15)' }}>
                                <Check size={18} className="text-indigo-500" />
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
                                className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold transition-colors">
                                {t('finish')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {payingMergedGroups && (
                <PaymentModal groups={payingMergedGroups} currentUser={currentUser} onClose={() => { setPayingMergedGroups(null); setMergeMode(false); setSelectedGroupIds(new Set()); }} />
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
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setTransferModal(null)}>
                        <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg" style={{ background: 'rgba(251,191,36,0.15)' }}>⇄</div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-slate-800">{isDebt ? t('msTransferDebtTitle') : t('msTransferOverpayTitle')}</h3>
                                    <p className="text-sm text-slate-500 truncate">{t('msTransferDirFrom').replace('{name}', src.name)}</p>
                                </div>
                            </div>
                            <div className={`rounded-xl px-4 py-3 mb-4 flex items-center justify-between ${isDebt ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                                <span className={`text-sm font-semibold ${isDebt ? 'text-rose-600' : 'text-emerald-600'}`}>{isDebt ? t('msDebtByContract') : t('msOverpayByContract')}</span>
                                <span className={`text-sm font-black ${isDebt ? 'text-rose-600' : 'text-emerald-600'}`}>{fmt(maxAmt)} {t('sum')}</span>
                            </div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t('msTransferWhereTo')}</label>
                            <select value={transferModal.targetId}
                                onChange={e => setTransferModal(m => ({ ...m, targetId: e.target.value }))}
                                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white mb-3">
                                <option value="">{t('msSelectContract')}</option>
                                {targets.map(g => (
                                    <option key={g.id} value={g.id}>
                                        {g.name}{(g.debt || 0) > 0 ? t('msDebtParen').replace('{n}', fmt(g.debt)) : ''}
                                    </option>
                                ))}
                            </select>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t('amount')}</label>
                            <input value={transferModal.amount} inputMode="numeric"
                                onChange={e => setTransferModal(m => ({ ...m, amount: e.target.value.replace(/\D/g, '') }))}
                                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 mb-1 font-mono" />
                            {amt > maxAmt && <p className="text-xs text-rose-500 font-semibold mb-2">{t('maximum')} {fmt(maxAmt)} {t('sum')}</p>}
                            <label className="flex items-center gap-2 mt-3 mb-5 cursor-pointer select-none">
                                <input type="checkbox" checked={transferModal.toArchive}
                                    onChange={e => setTransferModal(m => ({ ...m, toArchive: e.target.checked }))}
                                    className="w-4 h-4 accent-amber-500" />
                                <span className="text-sm text-slate-600 font-medium">{t('msAfterTransferArchive')}</span>
                            </label>
                            {transferModal.toArchive && amt < maxAmt && (
                                <p className="text-xs text-amber-600 font-semibold mb-3">{t('msPartialTransferWarn').replace('{n}', fmt(maxAmt - amt))}</p>
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
                                    className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors disabled:opacity-40">
                                    {transferModal.toArchive ? t('msTransferAndArchive') : t('msTransfer')}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
            {reportGroup && (
                <BrigadeReportModal group={reportGroup} onClose={() => setReportGroup(null)} />
            )}
            {reportOpen && (() => {
                const sel = selectedGroupIds.size ? visibleGroups.filter(g => selectedGroupIds.has(g.id)) : visibleGroups;
                const label = selectedGroupIds.size
                    ? t('msSelectedColon').replace('{n}', selectedGroupIds.size)
                    : (groupFilter === 'closed' ? t('msHistoryClosed') : groupFilter === 'all' ? t('msAllContracts') : t('msActiveContracts'));
                const hLabel = effectiveHostel === 'hostel1' ? t('expHostel1') : effectiveHostel === 'hostel2' ? t('expHostel2') : t('expAllHostels');
                return <OverallReportModal groups={sel} payments={payments} scopeLabel={label} hostelLabel={hLabel} onClose={() => setReportOpen(false)} />;
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
                    />
                );
            })()}

            <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0d2b30 0%, #1a3c40 100%)' }}>
                <div className="px-5 pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                            <div style={{ color: 'rgba(94,234,212,0.5)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                                {t('msTitle')}
                            </div>
                            <div style={{ marginTop: 4, lineHeight: 1.1 }}>
                                <span style={{ color: '#5eead4', fontSize: 28, fontWeight: 900 }}>{visibleGroups.length}</span>
                                {' '}
                                <span style={{ color: 'rgba(94,234,212,0.5)', fontSize: 15, fontWeight: 600 }}>{pluralGroups(visibleGroups.length)}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-2">
                                {[
                                    { id: 'active', label: t('active') },
                                    { id: 'closed', label: `${t('history')}${closedCount > 0 ? ` (${closedCount})` : ''}` },
                                    { id: 'all',    label: t('all') },
                                ].map(tab => (
                                    <button key={tab.id} onClick={() => setGroupFilter(tab.id)}
                                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all"
                                        style={groupFilter === tab.id
                                            ? { background: 'rgba(94,234,212,0.18)', color: '#5eead4', border: '1px solid rgba(94,234,212,0.4)' }
                                            : { background: 'transparent', color: 'rgba(94,234,212,0.5)', border: '1px solid rgba(94,234,212,0.12)' }}>
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {!creating ? (
                            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                {hostelGroups.length > 0 && (
                                    <button onClick={() => setReportOpen(true)}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-sm transition-all active:scale-[.97]"
                                        style={{ background: 'rgba(94,234,212,0.07)', color: 'rgba(94,234,212,0.6)', border: '1px solid rgba(94,234,212,0.15)' }}>
                                        <FileText size={13} /> {t('msReport')}
                                    </button>
                                )}
                                {hostelGroups.length > 1 && (
                                    <button onClick={() => { setMergeMode(m => !m); setSelectedGroupIds(new Set()); }}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-sm transition-all active:scale-[.97]"
                                        style={{ background: mergeMode ? 'rgba(94,234,212,0.2)' : 'rgba(94,234,212,0.07)', color: mergeMode ? '#5eead4' : 'rgba(94,234,212,0.6)', border: `1px solid ${mergeMode ? 'rgba(94,234,212,0.4)' : 'rgba(94,234,212,0.15)'}` }}
                                    >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6H5a2 2 0 00-2 2v8a2 2 0 002 2h3"/><path d="M16 6h3a2 2 0 012 2v8a2 2 0 01-2 2h-3"/><line x1="12" y1="6" x2="12" y2="18"/></svg>
                                        {mergeMode ? t('cancel') : t('msMerge')}
                                    </button>
                                )}
                            <button onClick={() => setCreating(true)}
                                className="shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold text-sm transition-all active:scale-[.97]"
                                style={{ background: 'rgba(94,234,212,0.1)', color: '#5eead4', border: '1px solid rgba(94,234,212,0.2)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(94,234,212,0.18)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(94,234,212,0.1)'}
                            >
                                <Plus size={13} strokeWidth={2.5} /> {t('msNewGroup')}
                            </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 rounded-xl px-3 py-1.5"
                                style={{ background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.2)' }}>
                                <input autoFocus value={newGroupName}
                                    onChange={e => setNewGroupName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') createGroup(); if (e.key === 'Escape') { setCreating(false); setNewGroupName(''); } }}
                                    placeholder={t('msContractNamePlaceholder')}
                                    className="flex-1 min-w-[160px] text-sm outline-none placeholder:opacity-40 bg-transparent"
                                    style={{ color: '#5eead4' }}
                                />
                                <button onClick={createGroup} className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                                    style={{ background: '#0f9688', color: '#fff' }}>
                                    {t('msCreate')}
                                </button>
                                <button onClick={() => { setCreating(false); setNewGroupName(''); }} style={{ color: 'rgba(94,234,212,0.45)' }} className="p-0.5">
                                    <X size={13} />
                                </button>
                            </div>
                        )}
                    </div>
                    {visibleGroups.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                            {[
                                { label: t('msPersonNightsUpper'), sub: t('msTotalLower'), value: globalStats.nights.toLocaleString(), red: false },
                                { label: t('msChargedUpper'),  sub: t('sum'),   value: fmt(globalStats.charged),           red: false },
                                { label: t('msPaidUpper'),   sub: t('sum'),   value: fmt(globalStats.paid),              red: false },
                                ...(globalStats.debt > 0 ? [{ label: t('msDebtUpper'), sub: t('sum'), value: fmt(globalStats.debt), red: true }] : []),
                            ].map(s => (
                                <div key={s.label} style={{ background: 'rgba(94,234,212,0.07)', border: '1px solid rgba(94,234,212,0.12)', borderRadius: 10, padding: '8px 12px' }}>
                                    <div style={{ color: 'rgba(94,234,212,0.4)', fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</div>
                                    <div style={{ color: s.red ? '#fca5a5' : '#5eead4', fontSize: 18, fontWeight: 900, lineHeight: 1.2, marginTop: 2 }}>{s.value}</div>
                                    <div style={{ color: 'rgba(94,234,212,0.25)', fontSize: 9 }}>{s.sub}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    {globalStats.charged > 0 && (
                        <div className="mt-2.5">
                            <div className="flex justify-between mb-1">
                                <span style={{ color: 'rgba(94,234,212,0.4)', fontSize: 9 }}>{t('payment')}</span>
                                <span style={{ color: paidPct >= 100 ? '#5eead4' : 'rgba(94,234,212,0.65)', fontSize: 9, fontWeight: 700 }}>{paidPct.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(94,234,212,0.1)' }}>
                                <div className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${paidPct}%`, background: paidPct >= 100 ? '#5eead4' : 'linear-gradient(90deg,#5eead4,#0f9688)' }} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {visibleGroups.length === 0 && (
                <div className="py-10 text-center">
                    <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.2)' }}>
                        <Users size={22} style={{ color: '#0f9688' }} />
                    </div>
                    <p className="text-slate-600 font-semibold">{groupFilter === 'closed' ? t('msNoClosedContracts') : t('msNoGroups')}</p>
                    {groupFilter !== 'closed' && (
                        <>
                            <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">{t('msCreateGroupHint')}</p>
                            <button onClick={() => setCreating(true)}
                                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
                                style={{ background: '#0f9688' }}>
                                <Plus size={13} /> {t('msCreateGroup')}
                            </button>
                        </>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {visibleGroups.map((group, idx) => {
                    const isMemberPickerOpen = memberPickerGroupId === group.id;
                    const isEditing = editingGroup?.id === group.id;
                    const membersOpen = isSectionOpen(group.id, 'members');
                    const groupPaidPct = group.contractTotal > 0 ? Math.min(100, (group.amountPaid / group.contractTotal) * 100) : 0;
                    const isPaid = group.contractTotal > 0 && group.debt <= 0;
                    const num = String(idx + 1).padStart(2, '0');

                    const isSelected = selectedGroupIds.has(group.id);

                    return (
                        <div key={group.id} className="rounded-xl overflow-hidden"
                            style={{ background: isSelected ? 'linear-gradient(135deg, #0f2e33 0%, #1e4a50 100%)' : 'linear-gradient(135deg, #0d2532 0%, #1a3640 100%)', border: isSelected ? '1.5px solid rgba(94,234,212,0.55)' : '1px solid rgba(94,234,212,0.2)', borderLeft: isSelected ? '3px solid #5eead4' : '3px solid #0f9688' }}>

                            {/* ─ Main row ─ */}
                            <div className="flex items-stretch">
                                {mergeMode && (
                                    <button type="button"
                                        onClick={() => setSelectedGroupIds(prev => { const n = new Set(prev); if (n.has(group.id)) n.delete(group.id); else n.add(group.id); return n; })}
                                        className="flex items-center justify-center px-2.5 shrink-0 transition-colors"
                                        style={{ background: isSelected ? 'rgba(94,234,212,0.15)' : 'rgba(94,234,212,0.04)', borderRight: '1px solid rgba(94,234,212,0.12)' }}>
                                        <div className="w-4 h-4 rounded border-2 flex items-center justify-center transition-all"
                                            style={{ borderColor: isSelected ? '#5eead4' : 'rgba(94,234,212,0.3)', background: isSelected ? '#5eead4' : 'transparent' }}>
                                            {isSelected && <Check size={8} color="#0d2532" strokeWidth={3} />}
                                        </div>
                                    </button>
                                )}
                                <div className="flex items-center justify-center px-3 shrink-0 select-none" style={{ background: 'rgba(94,234,212,0.07)', borderRight: '1px solid rgba(94,234,212,0.12)', minWidth: 42 }}>
                                    <span className="text-base font-black leading-none" style={{ color: '#5eead4' }}>{num}</span>
                                </div>
                                <div className="flex-1 min-w-0 px-3 py-2.5">
                                    {isEditing ? (
                                        <div className="flex items-center gap-1.5">
                                            <input autoFocus value={editingGroup.name}
                                                onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })}
                                                onKeyDown={e => { if (e.key === 'Enter') renameGroup(); if (e.key === 'Escape') setEditingGroup(null); }}
                                                className="flex-1 text-sm font-semibold outline-none border-b bg-transparent"
                                                style={{ borderColor: '#5eead4', color: '#e2f7f8' }}
                                            />
                                            <button onClick={renameGroup} className="p-1 rounded" style={{ background: 'rgba(94,234,212,0.15)', color: '#5eead4' }}><Check size={11} /></button>
                                            <button onClick={() => setEditingGroup(null)} className="p-1 rounded" style={{ color: 'rgba(94,234,212,0.4)' }}><X size={11} /></button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-sm font-semibold" style={{ color: group.closed ? 'rgba(226,247,248,0.55)' : '#e2f7f8' }}>{group.name}</span>
                                            {group.closed && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(148,163,184,0.18)', color: '#94a3b8' }}>{t('msClosedBadge')}</span>}
                                            {!group.closed && group.completed && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.18)', color: '#a5b4fc' }}>{t('msCompletedBadge')}</span>}
                                            {isPaid && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}><Check size={7} strokeWidth={3} /> {t('paid')}</span>}
                                            {!isPaid && group.debt > 0 && group.contractTotal > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>-{fmt(group.debt)}</span>}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        <span className="text-[11px]" style={{ color: 'rgba(94,234,212,0.5)' }}><b style={{ color: 'rgba(94,234,212,0.75)' }}>{group.members.length}</b> {t('msParticipantsShort')} · <b style={{ color: '#5eead4' }}>{group.totalPersonNights.toLocaleString()}</b> {t('msPersonNightsShort')}</span>
                                        {group.contractTotal > 0 && <span className="text-[11px]" style={{ color: 'rgba(94,234,212,0.5)' }}>{group.contractRate > 0 && <><b style={{ color: 'rgba(94,234,212,0.75)' }}>{fmt(group.contractRate)}</b>/{t('msPersonNightsShort')} · </>}{group.extraTotal > 0 && <><b style={{ color: '#fbbf24' }}>+{fmt(group.extraTotal)}</b> {t('msExtraShort')} · </>}<b style={{ color: '#e2f7f8' }}>{fmt(group.contractTotal)}</b>{group.amountPaid > 0 && <> · <b style={{ color: '#4ade80' }}>{fmt(group.amountPaid)}</b></>}</span>}
                                        {isAdmin && (
                                            <select value={group.hostelId || ''} onChange={e => updateGroup(group.id, { hostelId: e.target.value })}
                                                className="text-[10px] rounded px-1 py-0.5 focus:outline-none"
                                                style={{ background: 'rgba(94,234,212,0.07)', border: `1px solid ${group.hostelId ? 'rgba(94,234,212,0.2)' : '#f59e0b'}`, color: group.hostelId ? '#5eead4' : '#fbbf24' }}>
                                                <option value="">{t('msHostelOption')}</option>
                                                <option value="hostel1">{t('expHostel1')}</option>
                                                <option value="hostel2">{t('expHostel2')}</option>
                                            </select>
                                        )}
                                    </div>
                                    {group.contractTotal > 0 && (
                                        <div className="mt-1.5 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(94,234,212,0.1)' }}>
                                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${groupPaidPct}%`, background: isPaid ? '#4ade80' : 'linear-gradient(90deg,#5eead4,#0f9688)' }} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col justify-center gap-1.5 px-3 py-2.5 shrink-0" style={{ borderLeft: '1px solid rgba(94,234,212,0.12)' }}>
                                    {(group.completed || group.closed) ? (
                                        <>
                                            <button onClick={() => setReportGroup(group)} className="px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1" style={{ background: 'rgba(94,234,212,0.1)', color: '#5eead4' }}><FileText size={11} /> {t('msReport')}</button>
                                            {group.completed && !group.closed && (
                                                <button onClick={() => toggleGroupClosed(group.id, true)} title={t('msToArchiveTitle')} className="px-2 py-1.5 rounded-lg text-[10px] font-bold text-white flex items-center justify-center gap-1" style={{ background: '#6366f1' }}><Archive size={11} /> {t('expToArchive')}</button>
                                            )}
                                            {group.completed && !group.closed && (
                                                <button onClick={() => updateGroup(group.id, { completed: false, completedAt: null })}
                                                    title={t('msResumeTitle')}
                                                    className="px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"
                                                    style={{ background: 'rgba(94,234,212,0.1)', color: '#5eead4' }}>
                                                    <ArchiveRestore size={11} /> {t('msResume')}
                                                </button>
                                            )}
                                            {group.closed && (
                                                <button onClick={() => toggleGroupClosed(group.id, false)} title={t('msReturnFromArchiveTitle')} className="px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1" style={{ background: 'rgba(94,234,212,0.1)', color: '#5eead4' }}><ArchiveRestore size={11} /> {t('returnBtn')}</button>
                                            )}
                                            <button onClick={() => deleteGroup(group.id)} className="p-1.5 rounded transition-colors self-center" style={{ color: 'rgba(94,234,212,0.35)' }}
                                                onMouseEnter={e => e.currentTarget.style.color='#f87171'} onMouseLeave={e => e.currentTarget.style.color='rgba(94,234,212,0.35)'}><Trash2 size={10} /></button>
                                        </>
                                    ) : (
                                        <>
                                            <LocalNumInput value={group.contractRate || ''} onCommit={val => updateGroup(group.id, { contractRate: val })}
                                                placeholder={t('msRate')}
                                                className="w-20 px-2 py-1.5 text-[10px] text-right rounded-lg focus:outline-none font-mono"
                                                style={{ background: 'rgba(94,234,212,0.07)', border: '1px solid rgba(94,234,212,0.2)', color: '#5eead4' }} />
                                            <button onClick={() => setPayingGroup(group)} className="px-2 py-1.5 rounded-lg text-[10px] font-bold text-white" style={{ background: '#0f9688' }}>{t('msPay')}</button>
                                            {(() => {
                                                const balance = (group.amountPaid || 0) - (group.contractTotal || 0);
                                                if (balance === 0) return null;
                                                return (
                                                    <button onClick={() => setTransferModal({ group, targetId: '', amount: String(Math.abs(balance)), toArchive: true })}
                                                        title={balance < 0 ? t('msTransferDebtTitleFull').replace('{n}', fmt(-balance)) : t('msTransferOverpayTitleFull').replace('{n}', fmt(balance))}
                                                        className="px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"
                                                        style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                                                        ⇄ {t('msTransfer')}
                                                    </button>
                                                );
                                            })()}
                                            <div className="flex items-center justify-between gap-1">
                                                <button onClick={() => setEditingGroup({ id: group.id, name: group.name })} className="p-1.5 rounded transition-colors" style={{ color: 'rgba(94,234,212,0.35)' }}
                                                    onMouseEnter={e => e.currentTarget.style.color='#5eead4'} onMouseLeave={e => e.currentTarget.style.color='rgba(94,234,212,0.35)'}><Edit2 size={10} /></button>
                                                <button onClick={() => setReportGroup(group)} className="p-1.5 rounded transition-colors" style={{ color: 'rgba(94,234,212,0.35)' }}
                                                    onMouseEnter={e => e.currentTarget.style.color='#5eead4'} onMouseLeave={e => e.currentTarget.style.color='rgba(94,234,212,0.35)'}><FileText size={10} /></button>
                                                <button onClick={() => setConfirmComplete(group)} title={t('msCompleteContractTitle')}
                                                    className="p-1.5 rounded transition-colors" style={{ color: 'rgba(94,234,212,0.35)' }}
                                                    onMouseEnter={e => e.currentTarget.style.color='#6366f1'} onMouseLeave={e => e.currentTarget.style.color='rgba(94,234,212,0.35)'}><Check size={12} /></button>
                                                <button onClick={() => deleteGroup(group.id)} className="p-1.5 rounded transition-colors" style={{ color: 'rgba(94,234,212,0.35)' }}
                                                    onMouseEnter={e => e.currentTarget.style.color='#f87171'} onMouseLeave={e => e.currentTarget.style.color='rgba(94,234,212,0.35)'}><Trash2 size={10} /></button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* ─ Members accordion ─ */}
                            <div style={{ borderTop: '1px solid rgba(94,234,212,0.1)' }}>
                                <button type="button"
                                    onClick={() => { toggleSection(group.id, 'members'); if (!isSectionOpen(group.id, 'members')) { setMemberPickerGroupId(null); setMemberSearch(''); } }}
                                    className="w-full flex items-center justify-between px-3 py-1.5 transition-colors text-left"
                                    style={{ background: 'transparent' }}
                                    onMouseEnter={e => e.currentTarget.style.background='rgba(94,234,212,0.04)'}
                                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-medium" style={{ color: 'rgba(94,234,212,0.5)' }}>{t('msParticipants')}</span>
                                        {group.members.length > 0 && <span className="text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(94,234,212,0.15)', color: '#5eead4' }}>{group.members.length}</span>}
                                    </div>
                                    {membersOpen ? <ChevronDown size={10} style={{ color: 'rgba(94,234,212,0.4)' }} /> : <ChevronRight size={10} style={{ color: 'rgba(94,234,212,0.4)' }} />}
                                </button>
                                {membersOpen && (
                                    <div className="px-3 pb-2.5 space-y-2">
                                        {group.members.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {group.members.map(member => (
                                                    <span key={member.key} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] font-medium" style={{ background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.25)', color: '#5eead4' }}>
                                                        {member.name}<span style={{ opacity: 0.5, fontSize: 9 }}>{member.totalNights}{t('msNightShort')}</span>
                                                        <button onClick={() => toggleMember(group.id, member.key)} className="w-3 h-3 rounded-full flex items-center justify-center" style={{ opacity: 0.5, background: 'rgba(94,234,212,0.2)', color: '#5eead4' }}><X size={7} /></button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <button onClick={() => { if (isMemberPickerOpen) { setMemberPickerGroupId(null); setMemberSearch(''); } else { setMemberPickerGroupId(group.id); setMemberSearch(''); } }}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium border transition-all"
                                            style={isMemberPickerOpen
                                                ? { borderColor: 'rgba(94,234,212,0.4)', background: 'rgba(94,234,212,0.1)', color: '#5eead4' }
                                                : { borderColor: 'rgba(94,234,212,0.2)', color: 'rgba(94,234,212,0.5)', background: 'transparent' }}>
                                            <Plus size={8} style={{ transform: isMemberPickerOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s' }} />
                                            {isMemberPickerOpen ? t('msCollapse') : t('add')}
                                        </button>
                                        {isMemberPickerOpen && (
                                            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(94,234,212,0.2)' }}>
                                                <div className="relative">
                                                    <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgba(94,234,212,0.4)' }} />
                                                    <input autoFocus value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder={t('search')}
                                                        className="w-full pl-7 pr-2 py-1.5 text-[11px] focus:outline-none"
                                                        style={{ background: 'rgba(94,234,212,0.05)', color: '#e2f7f8', borderBottom: '1px solid rgba(94,234,212,0.12)' }} />
                                                </div>
                                                <div className="max-h-36 overflow-y-auto">
                                                    {filteredGuests.length === 0
                                                        ? <div className="text-[11px] text-center py-2" style={{ color: 'rgba(94,234,212,0.4)' }}>{t('msNotFound')}</div>
                                                        : filteredGuests.map(guest => {
                                                            const inGroup = (group.memberKeys || []).includes(guest.key);
                                                            return (
                                                                <button key={guest.key} onClick={() => toggleMember(group.id, guest.key)}
                                                                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left transition-colors"
                                                                    style={{ background: inGroup ? 'rgba(94,234,212,0.1)' : 'transparent', borderBottom: '1px solid rgba(94,234,212,0.07)' }}
                                                                    onMouseEnter={e => { if (!inGroup) e.currentTarget.style.background='rgba(94,234,212,0.05)'; }}
                                                                    onMouseLeave={e => { if (!inGroup) e.currentTarget.style.background='transparent'; }}>
                                                                    <div className="min-w-0">
                                                                        <div className="text-[11px] font-medium truncate" style={{ color: '#e2f7f8' }}>{guest.name}</div>
                                                                        <div className="text-[9px]" style={{ color: 'rgba(94,234,212,0.4)' }}>{guest.stayCount} {t('msStaysShort')} · {guest.totalNights} {t('sutShort')}</div>
                                                                    </div>
                                                                    <div className="shrink-0 w-3.5 h-3.5 rounded border-2 flex items-center justify-center"
                                                                        style={{ borderColor: inGroup ? '#5eead4' : 'rgba(94,234,212,0.3)', background: inGroup ? '#5eead4' : 'transparent' }}>
                                                                        {inGroup && <Check size={6} color="#0d2532" strokeWidth={3} />}
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

                            {/* ─ Periods (always open) ─ */}
                            <div style={{ borderTop: '1px solid rgba(94,234,212,0.1)' }}>
                                <div className="flex items-center justify-between px-3 py-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-medium" style={{ color: 'rgba(94,234,212,0.5)' }}>{t('msPeriods')}</span>
                                        {group.manualEntries.length > 0 && <span className="text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(94,234,212,0.12)', color: '#5eead4' }}>{group.manualEntries.length}</span>}
                                        {group.manualPersonNights > 0 && <span className="text-[9px]" style={{ color: 'rgba(94,234,212,0.4)' }}>+{group.manualPersonNights} {t('msPersonNightsShort')}</span>}
                                    </div>
                                    <button type="button" onClick={() => toggleSection(group.id, 'minical')}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors"
                                        style={isSectionOpen(group.id, 'minical')
                                            ? { background: 'rgba(94,234,212,0.18)', color: '#5eead4', border: '1px solid rgba(94,234,212,0.4)' }
                                            : { background: 'transparent', color: 'rgba(94,234,212,0.5)', border: '1px solid rgba(94,234,212,0.15)' }}>
                                        <CalendarDays size={9} /> {t('calendar')}
                                    </button>
                                </div>
                                {isSectionOpen(group.id, 'minical') && (
                                    <PeriodMiniCalendar
                                        entries={group.manualEntries}
                                        onAddPeriod={(ci, co) => addEntryDates(group.id, ci, co)}
                                        onEditPeriod={(id) => setEditEntryModal({ groupId: group.id, entryId: id })}
                                        onDeletePeriod={(id) => removeEntry(group.id, id)}
                                    />
                                )}
                                <div className="pb-2">
                                    {group.manualEntries.length > 0 && (
                                        <div className="mb-1">
                                            {group.manualEntries.map(entry => {
                                                const isEditingEntry = editingEntryId === entry.id;
                                                const wgOpen = !!openWorkerGroups[entry.id];
                                                const wgCount = (entry.workerGroups || []).filter(wg => wg.specialty).length;
                                                const sd = (iso) => { if (!iso) return '—'; const [,m,d]=iso.split('-'); return `${parseInt(d)}.${m}`; };
                                                const roomLabels = Array.isArray(entry.roomIds) && entry.roomIds.length > 0
                                                    ? entry.roomIds.map(id => { const r = rooms.find(x => x.id === id || x.number === id); return r ? `№${r.number}` : `№${id}`; }).join(' ')
                                                    : '';
                                                return (
                                                    <div key={entry.id} className="border-b last:border-0" style={{ borderColor: 'rgba(94,234,212,0.08)' }}>
                                                        {isEditingEntry ? (
                                                            <div className="px-3 py-2.5" style={{ background: 'rgba(94,234,212,0.04)' }}>
                                                                <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                                                                    <input type="date" value={entry.checkIn || ''} onChange={e => updateEntry(group.id, entry.id, { checkIn: e.target.value })}
                                                                        className="px-2 py-1.5 text-[11px] rounded-lg focus:outline-none"
                                                                        style={{ border: '1px solid rgba(94,234,212,0.25)', background: 'rgba(94,234,212,0.07)', color: '#e2f7f8' }} />
                                                                    <input type="date" value={entry.checkOut || ''} onChange={e => updateEntry(group.id, entry.id, { checkOut: e.target.value })}
                                                                        className="px-2 py-1.5 text-[11px] rounded-lg focus:outline-none"
                                                                        style={{ border: '1px solid rgba(94,234,212,0.25)', background: 'rgba(94,234,212,0.07)', color: '#e2f7f8' }} />
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <div className="flex-1 min-w-0"><RoomPicker rooms={rooms} selected={Array.isArray(entry.roomIds) ? entry.roomIds : []} onChange={roomIds => updateEntry(group.id, entry.id, { roomIds })} /></div>
                                                                    {(entry.workerGroups || []).reduce((s, wg) => s + (wg.specialty ? (parseInt(wg.count) || 0) : 0), 0) > 0 ? (
                                                                        <input type="text" readOnly title={t('msFromBrigade')}
                                                                            value={(entry.workerGroups || []).reduce((s, wg) => s + (wg.specialty ? (parseInt(wg.count) || 0) : 0), 0)}
                                                                            className="w-14 px-1.5 py-1.5 text-[11px] rounded-lg text-center font-bold"
                                                                            style={{ border: '1px solid rgba(94,234,212,0.25)', background: 'rgba(94,234,212,0.07)', color: '#5eead4' }} />
                                                                    ) : (
                                                                        <LocalNumInput placeholder={t('msPeoplePlaceholder')} value={entry.people || ''} onCommit={val => updateEntry(group.id, entry.id, { people: val })}
                                                                            className="w-14 px-1.5 py-1.5 text-[11px] rounded-lg focus:outline-none text-center"
                                                                            style={{ border: '1px solid rgba(94,234,212,0.25)', background: 'rgba(94,234,212,0.07)', color: '#e2f7f8' }} />
                                                                    )}
                                                                    <button onClick={() => setEditingEntryId(null)}
                                                                        className="shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white"
                                                                        style={{ background: '#0f9688' }}>
                                                                        {t('done')}
                                                                    </button>
                                                                </div>
                                                                <div className="mt-1.5 pt-1.5" style={{ borderTop: '1px solid rgba(94,234,212,0.1)' }}>
                                                                    <button type="button" onClick={() => toggleWG(entry.id)}
                                                                        className="inline-flex items-center gap-1 text-[9px] font-semibold transition-colors"
                                                                        style={{ color: 'rgba(94,234,212,0.5)' }}
                                                                        onMouseEnter={e => e.currentTarget.style.color='#5eead4'} onMouseLeave={e => e.currentTarget.style.color='rgba(94,234,212,0.5)'}>
                                                                        <ChevronRight size={8} style={{ transform: wgOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                                                                        {t('msBrigade')}{wgCount > 0 ? ` (${wgCount})` : ''}
                                                                    </button>
                                                                    {wgOpen && (
                                                                        <div className="mt-1 space-y-1">
                                                                            {(entry.workerGroups || []).map((wg, wgIdx) => (
                                                                                <WorkerGroupRow key={wg.id || wgIdx} wg={wg} wgIdx={wgIdx}
                                                                                    options={savedSpecialties}
                                                                                    onUpdate={(patch) => updateWorkerGroup(group.id, entry.id, wg.id, patch)}
                                                                                    onRemove={() => removeWorkerGroup(group.id, entry.id, wg.id)}
                                                                                />
                                                                            ))}
                                                                            <button onClick={() => addWorkerGroup(group.id, entry.id)}
                                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-dashed text-[9px] font-semibold transition-colors"
                                                                                style={{ borderColor: 'rgba(94,234,212,0.2)', color: 'rgba(94,234,212,0.5)' }}
                                                                                onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(94,234,212,0.4)'; e.currentTarget.style.color='#5eead4'; }}
                                                                                onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(94,234,212,0.2)'; e.currentTarget.style.color='rgba(94,234,212,0.5)'; }}>
                                                                                <Plus size={7} /> {t('msAddSpecialty')}
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 px-3 py-2 transition-colors"
                                                                style={{ background: 'transparent' }}
                                                                onMouseEnter={e => e.currentTarget.style.background='rgba(94,234,212,0.04)'}
                                                                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                                                                <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                                                                    <span className="text-[12px] font-semibold whitespace-nowrap" style={{ color: '#e2f7f8' }}>
                                                                        {entry.checkIn && entry.checkOut
                                                                            ? `${sd(entry.checkIn)} → ${sd(entry.checkOut)}`
                                                                            : entry.nights > 0 ? `${entry.nights} ${t('nightsMany')}` : '—'}
                                                                    </span>
                                                                    {roomLabels && <span className="text-[10px]" style={{ color: 'rgba(94,234,212,0.45)' }}>{roomLabels}</span>}
                                                                    {entry.nights > 0 && <span className="text-[11px]" style={{ color: 'rgba(94,234,212,0.5)' }}>{entry.nights}{t('msNightShort')}</span>}
                                                                    {entry.people > 0 && <span className="text-[10px]" style={{ color: 'rgba(94,234,212,0.45)' }}>{entry.people}{t('msPeopleWord')}</span>}
                                                                    {entry.personNights > 0 && <span className="text-[11px] font-bold" style={{ color: '#5eead4' }}>-{entry.personNights}</span>}
                                                                    {wgCount > 0 && <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: 'rgba(94,234,212,0.1)', color: '#5eead4' }}>{t('msBrigShort')}{wgCount}</span>}
                                                                </div>
                                                                <div className="flex items-center gap-0.5 shrink-0">
                                                                    <button onClick={() => setEditingEntryId(entry.id)}
                                                                        className="text-[9px] px-1.5 py-0.5 rounded font-semibold transition-colors"
                                                                        style={{ color: '#5eead4', background: 'rgba(94,234,212,0.07)', border: '1px solid rgba(94,234,212,0.2)' }}>
                                                                        {t('msEditShort')}
                                                                    </button>
                                                                    <button onClick={() => removeEntry(group.id, entry.id)} className="p-0.5 rounded transition-colors ml-0.5"
                                                                        style={{ color: 'rgba(94,234,212,0.3)' }}
                                                                        onMouseEnter={e => e.currentTarget.style.color='#f87171'} onMouseLeave={e => e.currentTarget.style.color='rgba(94,234,212,0.3)'}>
                                                                        <X size={9} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {group.manualEntries.length > 1 && (
                                                <div className="flex justify-end gap-2 px-3 pt-1.5">
                                                    <span className="text-[9px]" style={{ color: 'rgba(94,234,212,0.4)' }}>{t('total')}:</span>
                                                    <span className="text-[9px] font-bold" style={{ color: '#5eead4' }}>{group.manualPersonNights} {t('msPersonNightsWord')}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="px-3 pb-1">
                                        <button onClick={() => addEntry(group.id)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed text-[10px] font-medium transition-colors"
                                            style={{ borderColor: 'rgba(94,234,212,0.3)', color: '#0f9688' }}
                                            onMouseEnter={e => { e.currentTarget.style.background='rgba(94,234,212,0.06)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background=''; }}>
                                            <Plus size={8} /> {t('msAddPeriod')}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* ─ Доп. расходы (произвольные позиции: стирка, транспорт, питание…) ─ */}
                            <div style={{ borderTop: '1px solid rgba(94,234,212,0.1)' }}>
                                <div className="flex items-center justify-between px-3 py-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-medium" style={{ color: 'rgba(94,234,212,0.5)' }}>{t('msExtraCharges')}</span>
                                        {(group.extraCharges || []).length > 0 && (
                                            <span className="text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(94,234,212,0.12)', color: '#5eead4' }}>{group.extraCharges.length}</span>
                                        )}
                                        {group.extraTotal > 0 && <span className="text-[9px] font-bold" style={{ color: '#fbbf24' }}>+{fmt(group.extraTotal)}</span>}
                                    </div>
                                </div>
                                {(group.extraCharges || []).length > 0 && (
                                    <div className="pb-1">
                                        {group.extraCharges.map(charge => (
                                            <div key={charge.id} className="flex items-center gap-2 px-3 py-1.5 border-b last:border-0 transition-colors"
                                                style={{ borderColor: 'rgba(94,234,212,0.08)' }}
                                                onMouseEnter={e => e.currentTarget.style.background='rgba(94,234,212,0.04)'}
                                                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                                                <span className="flex-1 min-w-0 text-[12px] truncate" style={{ color: '#e2f7f8' }}>{(charge.transferTo || charge.transferFrom) && <span style={{ color: '#fbbf24' }}>⇄ </span>}{charge.name}</span>
                                                {charge.date && <span className="text-[9px] shrink-0" style={{ color: 'rgba(94,234,212,0.4)' }}>{charge.date.slice(5).split('-').reverse().join('.')}</span>}
                                                <span className="text-[11px] font-bold shrink-0" style={{ color: '#fbbf24' }}>{fmt(parseInt(charge.amount, 10) || 0)}</span>
                                                {!group.closed && !group.completed && (
                                                    <button onClick={() => removeExtraCharge(group.id, charge.id)} className="p-0.5 rounded transition-colors shrink-0"
                                                        style={{ color: 'rgba(94,234,212,0.3)' }}
                                                        onMouseEnter={e => e.currentTarget.style.color='#f87171'} onMouseLeave={e => e.currentTarget.style.color='rgba(94,234,212,0.3)'}>
                                                        <X size={9} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {!group.closed && !group.completed && (
                                    <div className="px-3 pb-2">
                                        {extraForm?.groupId === group.id ? (
                                            <div className="flex items-center gap-1.5">
                                                <input autoFocus value={extraForm.name}
                                                    onChange={e => setExtraForm(f => ({ ...f, name: e.target.value }))}
                                                    onKeyDown={e => { if (e.key === 'Enter') { addExtraCharge(group.id, extraForm.name, extraForm.amount); setExtraForm(null); } if (e.key === 'Escape') setExtraForm(null); }}
                                                    placeholder={t('msExtraNamePlaceholder')}
                                                    className="flex-1 min-w-0 px-2 py-1.5 text-[11px] rounded-lg focus:outline-none"
                                                    style={{ border: '1px solid rgba(94,234,212,0.25)', background: 'rgba(94,234,212,0.07)', color: '#e2f7f8' }} />
                                                <input value={extraForm.amount}
                                                    onChange={e => setExtraForm(f => ({ ...f, amount: e.target.value.replace(/[^\d-]/g, '') }))}
                                                    onKeyDown={e => { if (e.key === 'Enter') { addExtraCharge(group.id, extraForm.name, extraForm.amount); setExtraForm(null); } if (e.key === 'Escape') setExtraForm(null); }}
                                                    placeholder={t('amount')} inputMode="numeric"
                                                    className="w-24 px-2 py-1.5 text-[11px] rounded-lg focus:outline-none text-right font-mono"
                                                    style={{ border: '1px solid rgba(94,234,212,0.25)', background: 'rgba(94,234,212,0.07)', color: '#fbbf24' }} />
                                                <button onClick={() => { addExtraCharge(group.id, extraForm.name, extraForm.amount); setExtraForm(null); }}
                                                    disabled={!extraForm.name.trim() || !(parseInt(extraForm.amount, 10))}
                                                    className="shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40"
                                                    style={{ background: '#0f9688' }}>OK</button>
                                                <button onClick={() => setExtraForm(null)} className="shrink-0 p-1 rounded" style={{ color: 'rgba(94,234,212,0.4)' }}><X size={10} /></button>
                                            </div>
                                        ) : (
                                            <button onClick={() => setExtraForm({ groupId: group.id, name: '', amount: '' })}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed text-[10px] font-medium transition-colors"
                                                style={{ borderColor: 'rgba(251,191,36,0.35)', color: '#d97706' }}
                                                onMouseEnter={e => { e.currentTarget.style.background='rgba(251,191,36,0.07)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background=''; }}>
                                                <Plus size={8} /> {t('addExpense2')}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ─ Списание долга: только админ, в отчёты не попадает ─ */}
                            {isAdmin && ((group.writeOffs || []).length > 0 || (!group.closed && group.debt > 0)) && (
                                <div style={{ borderTop: '1px solid rgba(167,139,250,0.15)' }}>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5">
                                        <EyeOff size={9} style={{ color: 'rgba(167,139,250,0.6)' }} />
                                        <span className="text-[10px] font-medium" style={{ color: 'rgba(167,139,250,0.7)' }}>{t('msWriteOffNoun')}</span>
                                        {(group.writeOffTotal || 0) > 0 && (
                                            <span className="text-[9px] font-bold" style={{ color: '#a78bfa' }}>−{fmt(group.writeOffTotal)}</span>
                                        )}
                                        <span className="text-[9px]" style={{ color: 'rgba(167,139,250,0.4)' }}>{t('msNotInReports')}</span>
                                    </div>
                                    {(group.writeOffs || []).length > 0 && (
                                        <div className="pb-1">
                                            {group.writeOffs.map(charge => (
                                                <div key={charge.id} className="flex items-center gap-2 px-3 py-1.5 border-b last:border-0"
                                                    style={{ borderColor: 'rgba(167,139,250,0.1)' }}>
                                                    <span className="flex-1 min-w-0 text-[12px] truncate" style={{ color: 'rgba(226,247,248,0.75)' }}>{charge.name}</span>
                                                    {charge.date && <span className="text-[9px] shrink-0" style={{ color: 'rgba(167,139,250,0.4)' }}>{charge.date.slice(5).split('-').reverse().join('.')}</span>}
                                                    <span className="text-[11px] font-bold shrink-0" style={{ color: '#a78bfa' }}>−{fmt(Math.abs(parseInt(charge.amount, 10) || 0))}</span>
                                                    <button onClick={() => removeWriteOff(group.id, charge.id)} className="p-0.5 rounded shrink-0"
                                                        style={{ color: 'rgba(167,139,250,0.35)' }}
                                                        onMouseEnter={e => e.currentTarget.style.color='#f87171'} onMouseLeave={e => e.currentTarget.style.color='rgba(167,139,250,0.35)'}>
                                                        <X size={9} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {!group.closed && (
                                        <div className="px-3 pb-2">
                                            {writeOffForm?.groupId === group.id ? (
                                                <div className="flex items-center gap-1.5">
                                                    <input autoFocus value={writeOffForm.reason}
                                                        onChange={e => setWriteOffForm(f => ({ ...f, reason: e.target.value }))}
                                                        onKeyDown={e => { if (e.key === 'Enter') { addWriteOff(group.id, writeOffForm.reason, writeOffForm.amount); setWriteOffForm(null); } if (e.key === 'Escape') setWriteOffForm(null); }}
                                                        placeholder={t('msWriteOffReasonPlaceholder')}
                                                        className="flex-1 min-w-0 px-2 py-1.5 text-[11px] rounded-lg focus:outline-none"
                                                        style={{ border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.08)', color: '#e2f7f8' }} />
                                                    <input value={writeOffForm.amount}
                                                        onChange={e => setWriteOffForm(f => ({ ...f, amount: e.target.value.replace(/\D/g, '') }))}
                                                        onKeyDown={e => { if (e.key === 'Enter') { addWriteOff(group.id, writeOffForm.reason, writeOffForm.amount); setWriteOffForm(null); } if (e.key === 'Escape') setWriteOffForm(null); }}
                                                        placeholder={t('amount')} inputMode="numeric"
                                                        className="w-24 px-2 py-1.5 text-[11px] rounded-lg focus:outline-none text-right font-mono"
                                                        style={{ border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.08)', color: '#a78bfa' }} />
                                                    <button onClick={() => { addWriteOff(group.id, writeOffForm.reason, writeOffForm.amount); setWriteOffForm(null); }}
                                                        disabled={!(parseInt(writeOffForm.amount, 10) > 0)}
                                                        className="shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40"
                                                        style={{ background: '#7c3aed' }}>{t('writeOff')}</button>
                                                    <button onClick={() => setWriteOffForm(null)} className="shrink-0 p-1 rounded" style={{ color: 'rgba(167,139,250,0.4)' }}><X size={10} /></button>
                                                </div>
                                            ) : group.debt > 0 && (
                                                <button onClick={() => setWriteOffForm({ groupId: group.id, reason: '', amount: String(Math.max(0, group.debt)) })}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed text-[10px] font-medium transition-colors"
                                                    style={{ borderColor: 'rgba(167,139,250,0.35)', color: '#a78bfa' }}
                                                    onMouseEnter={e => { e.currentTarget.style.background='rgba(167,139,250,0.08)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background=''; }}>
                                                    <EyeOff size={8} /> {t('msWriteOffDebt')}
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

            {/* ─ Merge payment sticky bar ─ */}
            {mergeMode && selectedGroupIds.size >= 2 && (() => {
                const selGroups = detailedGroups.filter(g => selectedGroupIds.has(g.id));
                const totalDebt = selGroups.reduce((s, g) => s + (g.debt || 0), 0);
                const totalCharged = selGroups.reduce((s, g) => s + (g.contractTotal || 0), 0);
                return (
                    <div className="sticky bottom-4 mt-4 mx-0 z-20">
                        <div className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3 shadow-2xl"
                            style={{ background: 'linear-gradient(135deg, #0f2e33 0%, #1a4a50 100%)', border: '1.5px solid rgba(94,234,212,0.4)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(94,234,212,0.15)' }}>
                                    <span className="text-base font-black" style={{ color: '#5eead4' }}>{selectedGroupIds.size}</span>
                                </div>
                                <div>
                                    <div className="text-xs font-bold" style={{ color: '#e2f7f8' }}>{t('msSelectedGroups').replace('{n}', selectedGroupIds.size)}</div>
                                    <div className="text-[10px]" style={{ color: 'rgba(94,234,212,0.6)' }}>
                                        {totalCharged > 0 && <span>{t('expCharged')}: <b style={{ color: '#5eead4' }}>{fmt(totalCharged)}</b></span>}
                                        {totalDebt > 0 && <span className="ml-2">{t('msDebtLower')}: <b style={{ color: '#f87171' }}>{fmt(totalDebt)}</b></span>}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setPayingMergedGroups(selGroups)}
                                className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all active:scale-[.97]"
                                style={{ background: '#0f9688' }}>
                                {t('msPayGroups').replace('{n}', selectedGroupIds.size)}
                            </button>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default ManualStayView;
