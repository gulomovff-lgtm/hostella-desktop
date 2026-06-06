// v2 вЂ“ redesigned UX
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'src', 'components', 'Views', 'ManualStayView.jsx');

const content = `import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, History, Search, Loader2, Edit2, Check } from 'lucide-react';
import {
    collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch,
} from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../../firebase';

const CONTRACT_GROUPS_KEY = 'hostella_contract_groups';
const COLLECTION = [...PUBLIC_DATA_PATH, 'manualStayGroups'];
const INP = 'px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-700 transition-all';

const fmt = n => (parseInt(n) || 0).toLocaleString('ru');

const getStayNights = (stay) => {
    const d = parseInt(stay?.days, 10);
    if (d > 0) return d;
    if (!stay?.checkInDate || !stay?.checkOutDate) return 0;
    const ms = new Date(stay.checkOutDate) - new Date(stay.checkInDate);
    return ms > 0 ? Math.round(ms / 86400000) : 0;
};

const getTotalPaid = g =>
    typeof g.amountPaid === 'number'
        ? g.amountPaid
        : (g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0);

const pluralGroups = (n) => {
    if (n % 10 === 1 && n % 100 !== 11) return '\u0433\u0440\u0443\u043f\u043f\u0430';
    if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return '\u0433\u0440\u0443\u043f\u043f\u044b';
    return '\u0433\u0440\u0443\u043f\u043f';
};

const Stat = ({ label, value, sub, valueClass = 'text-slate-800' }) => (
    <div className="bg-white px-3 py-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
        <div className={\`text-lg font-black \${valueClass}\`}>{value}</div>
        {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
);

const computeEntry = (entry) => {
    const rooms  = parseInt(entry.rooms,  10) || 0;
    const people = parseInt(entry.people, 10) || 0;
    let nights = 0;
    if (entry.checkIn && entry.checkOut) {
        const ms = new Date(entry.checkOut) - new Date(entry.checkIn);
        nights = ms > 0 ? Math.round(ms / 86400000) : 0;
    }
    if (!nights) nights = parseInt(entry.nights, 10) || 0;
    return { rooms, people, nights, roomNights: rooms * nights, personNights: people * nights };
};

const ManualStayView = ({ guests = [], payments = [], shifts = [], users = [], currentUser, lang = 'ru' }) => {
    const [contractGroups, setContractGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [memberPickerGroupId, setMemberPickerGroupId] = useState(null);
    const [memberSearch, setMemberSearch] = useState('');
    const [editingGroup, setEditingGroup] = useState(null);

    useEffect(() => {
        const colRef = collection(db, ...COLLECTION);
        const unsub = onSnapshot(colRef, (snap) => {
            const groups = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
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
                                    contractRate: g.contractRate || '', manualEntries: g.manualEntries || [],
                                    createdAt: Date.now(),
                                });
                            });
                            batch.commit().then(() => localStorage.removeItem(CONTRACT_GROUPS_KEY)).catch(console.error);
                        }
                    }
                } catch {}
            }
        }, (err) => { console.error('[ManualStay]', err); setLoading(false); });
        return () => unsub();
    }, []);

    const createGroup = async () => {
        const name = newGroupName.trim();
        if (!name) return;
        const id = \`contract-\${Date.now()}\`;
        await setDoc(doc(db, ...COLLECTION, id), { name, memberKeys: [], contractRate: '', manualEntries: [], createdAt: Date.now() });
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
        if (!window.confirm('\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0433\u0440\u0443\u043f\u043f\u0443?')) return;
        await deleteDoc(doc(db, ...COLLECTION, groupId));
        if (memberPickerGroupId === groupId) setMemberPickerGroupId(null);
    };

    const updateGroup = async (groupId, patch) => {
        await updateDoc(doc(db, ...COLLECTION, groupId), patch);
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
        const entry = { id: \`e-\${Date.now()}\`, checkIn: today, checkOut: tomorrow, rooms: '', people: '', note: '' };
        await updateDoc(doc(db, ...COLLECTION, groupId), { manualEntries: [...(group.manualEntries || []), entry] });
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
        const manualEntries = (group.manualEntries || []).filter(e => e.id !== entryId);
        await updateDoc(doc(db, ...COLLECTION, groupId), { manualEntries });
    };

    const groupedGuests = useMemo(() => {
        const map = new Map();
        guests.filter(g => g.status !== 'booking').forEach(g => {
            const key = (g.fullName || '\u2014').trim();
            if (!map.has(key)) map.set(key, { key, name: key, stays: [] });
            map.get(key).stays.push(g);
        });
        return Array.from(map.values())
            .map(g => ({
                ...g,
                stayCount: g.stays.length,
                totalNights: g.stays.reduce((s, stay) => s + getStayNights(stay), 0),
                totalPaid: g.stays.reduce((s, stay) => s + getTotalPaid(stay), 0),
                totalAmount: g.stays.reduce((s, stay) => s + (stay.totalPrice || 0), 0),
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }, [guests]);

    const guestMap = useMemo(() => new Map(groupedGuests.map(g => [g.key, g])), [groupedGuests]);

    const detailedGroups = useMemo(() => {
        return contractGroups.map(group => {
            const members = (group.memberKeys || []).map(k => guestMap.get(k)).filter(Boolean);
            const rawEntries = Array.isArray(group.manualEntries) ? group.manualEntries : [];
            const entries = rawEntries.map(e => ({ ...e, ...computeEntry(e) }));
            const autoPersonNights  = members.reduce((s, m) => s + m.totalNights, 0);
            const manualPersonNights = entries.reduce((s, e) => s + e.personNights, 0);
            const manualRoomNights   = entries.reduce((s, e) => s + e.roomNights, 0);
            const totalPersonNights  = autoPersonNights + manualPersonNights;
            const totalAmount = members.reduce((s, m) => s + m.totalAmount, 0);
            const totalPaid   = members.reduce((s, m) => s + m.totalPaid, 0);
            const contractRate = parseInt(group.contractRate, 10) || 0;
            return {
                ...group, members, manualEntries: entries,
                autoPersonNights, manualPersonNights, manualRoomNights, totalPersonNights,
                totalAmount, totalPaid, contractRate,
                contractTotal: contractRate > 0 ? contractRate * totalPersonNights : 0,
            };
        });
    }, [contractGroups, guestMap]);

    const filteredGuests = useMemo(() => {
        const q = memberSearch.trim().toLowerCase();
        return q ? groupedGuests.filter(g => g.name.toLowerCase().includes(q)) : groupedGuests;
    }, [groupedGuests, memberSearch]);

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
        </div>
    );

    return (
        <div className="space-y-4 animate-in fade-in">
            {/* \u0428\u0430\u043f\u043a\u0430 */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <History size={20} className="text-indigo-500" /> \u0420\u0443\u0447\u043d\u043e\u0439 \u0443\u0447\u0451\u0442 \u043f\u0440\u043e\u0436\u0438\u0432\u0430\u043d\u0438\u044f
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {detailedGroups.length} {pluralGroups(detailedGroups.length)} &middot; {groupedGuests.length.toLocaleString()} \u0433\u043e\u0441\u0442\u0435\u0439 \u0432 \u0431\u0430\u0437\u0435
                    </p>
                </div>
                {!creating ? (
                    <button
                        onClick={() => setCreating(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
                    >
                        <Plus size={15} /> \u041d\u043e\u0432\u0430\u044f \u0433\u0440\u0443\u043f\u043f\u0430
                    </button>
                ) : (
                    <div className="flex items-center gap-2">
                        <input
                            autoFocus
                            value={newGroupName}
                            onChange={e => setNewGroupName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') createGroup(); if (e.key === 'Escape') { setCreating(false); setNewGroupName(''); }}}
                            placeholder="\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0433\u0440\u0443\u043f\u043f\u044b / \u0434\u043e\u0433\u043e\u0432\u043e\u0440\u0430"
                            className={INP + ' min-w-[220px]'}
                        />
                        <button onClick={createGroup} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors">
                            \u0421\u043e\u0437\u0434\u0430\u0442\u044c
                        </button>
                        <button onClick={() => { setCreating(false); setNewGroupName(''); }} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                )}
            </div>

            {/* \u041f\u0443\u0441\u0442\u043e\u0439 \u0441\u0442\u0435\u0439\u0442 */}
            {detailedGroups.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                    <History size={32} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500 font-semibold">\u041d\u0435\u0442 \u0433\u0440\u0443\u043f\u043f</p>
                    <p className="text-slate-400 text-sm mt-1">\u0421\u043e\u0437\u0434\u0430\u0439\u0442\u0435 \u0433\u0440\u0443\u043f\u043f\u0443, \u0447\u0442\u043e\u0431\u044b \u043e\u0431\u044a\u0435\u0434\u0438\u043d\u0438\u0442\u044c \u0433\u043e\u0441\u0442\u0435\u0439 \u043f\u043e \u0434\u043e\u0433\u043e\u0432\u043e\u0440\u0443</p>
                </div>
            )}

            {/* \u041a\u0430\u0440\u0442\u043e\u0447\u043a\u0438 \u0433\u0440\u0443\u043f\u043f */}
            <div className="space-y-4">
                {detailedGroups.map(group => {
                    const isMemberPickerOpen = memberPickerGroupId === group.id;
                    const isEditing = editingGroup?.id === group.id;
                    return (
                        <div key={group.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                            {/* \u0417\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a */}
                            <div className="px-4 pt-4 pb-3 border-b border-slate-100">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        {isEditing ? (
                                            <div className="flex items-center gap-2 flex-1">
                                                <input
                                                    autoFocus
                                                    value={editingGroup.name}
                                                    onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })}
                                                    onKeyDown={e => { if (e.key === 'Enter') renameGroup(); if (e.key === 'Escape') setEditingGroup(null); }}
                                                    className={INP + ' font-bold flex-1'}
                                                />
                                                <button onClick={renameGroup} className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors">
                                                    <Check size={14} />
                                                </button>
                                                <button onClick={() => setEditingGroup(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 min-w-0">
                                                <h2 className="font-black text-slate-800 text-base truncate">{group.name}</h2>
                                                <button
                                                    onClick={() => setEditingGroup({ id: group.id, name: group.name })}
                                                    className="shrink-0 p-1 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                                    title="\u041f\u0435\u0440\u0435\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u0442\u044c"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => deleteGroup(group.id)}
                                        className="shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-500 border border-rose-200 hover:bg-rose-50 transition-colors"
                                    >
                                        \u0423\u0434\u0430\u043b\u0438\u0442\u044c
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    {group.members.length} \u0447\u0435\u043b.
                                    &middot; {group.totalPersonNights.toLocaleString()} \u0447\u0435\u043b-\u0441\u0443\u0442\u043e\u043a
                                    {group.manualPersonNights > 0 && (
                                        <span className="text-slate-400"> (\u0430\u0432\u0442\u043e {group.autoPersonNights.toLocaleString()} + \u0440\u0443\u0447\u043d\u044b\u0435 {group.manualPersonNights.toLocaleString()})</span>
                                    )}
                                    &middot; {group.members.reduce((s, m) => s + m.stayCount, 0)} \u0437\u0430\u0441\u0435\u043b\u0435\u043d\u0438\u0439
                                </p>
                            </div>

                            {/* \u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-100">
                                <Stat
                                    label="\u0427\u0435\u043b-\u0441\u0443\u0442\u043e\u043a"
                                    value={group.totalPersonNights.toLocaleString()}
                                    sub={group.manualRoomNights > 0 ? \`\${group.manualRoomNights.toLocaleString()} \u043a\u043e\u043c\u043d-\u0441\u0443\u0442\` : undefined}
                                />
                                <Stat label="\u041d\u0430\u0447\u0438\u0441\u043b\u0435\u043d\u043e" value={fmt(group.totalAmount)} />
                                <Stat label="\u041e\u043f\u043b\u0430\u0447\u0435\u043d\u043e" value={fmt(group.totalPaid)} valueClass="text-emerald-600" />
                                <Stat
                                    label="\u041f\u043e \u0434\u043e\u0433\u043e\u0432\u043e\u0440\u0443"
                                    value={group.contractRate > 0 ? fmt(group.contractTotal) : '\u2014'}
                                    valueClass="text-indigo-700"
                                />
                            </div>

                            {/* \u0421\u0442\u0430\u0432\u043a\u0430 \u0434\u043e\u0433\u043e\u0432\u043e\u0440\u0430 */}
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap bg-slate-50/50">
                                <span className="text-xs font-bold text-slate-500">\u0421\u0442\u0430\u0432\u043a\u0430 \u0434\u043e\u0433\u043e\u0432\u043e\u0440\u0430:</span>
                                <input
                                    value={group.contractRate || ''}
                                    onChange={e => updateGroup(group.id, { contractRate: e.target.value.replace(/[^0-9]/g, '') })}
                                    placeholder="0"
                                    className={INP + ' w-32'}
                                />
                                <span className="text-xs text-slate-400">\u0441\u0443\u043c / \u0447\u0435\u043b-\u0441\u0443\u0442\u043a\u0438</span>
                                {group.contractRate > 0 && (
                                    <span className="text-xs font-bold text-indigo-600">
                                        {group.totalPersonNights.toLocaleString()} &times; {fmt(group.contractRate)} = {fmt(group.contractTotal)} \u0441\u0443\u043c
                                    </span>
                                )}
                            </div>

                            {/* \u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0438 */}
                            <div className="px-4 py-3 border-b border-slate-100">
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <span className="text-xs font-black text-slate-600 uppercase tracking-wide">\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0438</span>
                                    <button
                                        onClick={() => {
                                            if (isMemberPickerOpen) { setMemberPickerGroupId(null); setMemberSearch(''); }
                                            else { setMemberPickerGroupId(group.id); setMemberSearch(''); }
                                        }}
                                        className={\`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors \${isMemberPickerOpen ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}\`}
                                    >
                                        <Plus size={11} className={isMemberPickerOpen ? 'rotate-45 transition-transform duration-200' : 'transition-transform duration-200'} />
                                        {isMemberPickerOpen ? '\u0421\u043a\u0440\u044b\u0442\u044c' : '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c'}
                                    </button>
                                </div>

                                {group.members.length === 0 && !isMemberPickerOpen && (
                                    <p className="text-xs text-slate-400">\u041d\u0435\u0442 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432 \u2014 \u043d\u0430\u0436\u043c\u0438\u0442\u0435 \xab\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c\xbb</p>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    {group.members.map(member => (
                                        <span key={member.key} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-xs font-semibold text-indigo-800">
                                            {member.name}
                                            <span className="text-indigo-400">{member.totalNights} \u0441\u0443\u0442.</span>
                                            <button onClick={() => toggleMember(group.id, member.key)} className="text-indigo-300 hover:text-rose-500 transition-colors">
                                                <X size={11} />
                                            </button>
                                        </span>
                                    ))}
                                </div>

                                {/* \u0412\u0441\u0442\u0440\u043e\u0435\u043d\u043d\u044b\u0439 \u043f\u0438\u043a\u0435\u0440 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432 */}
                                {isMemberPickerOpen && (
                                    <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/30 p-3">
                                        <div className="relative mb-2">
                                            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            <input
                                                autoFocus
                                                value={memberSearch}
                                                onChange={e => setMemberSearch(e.target.value)}
                                                placeholder="\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u0438\u043c\u0435\u043d\u0438\u2026"
                                                className={INP + ' pl-8 w-full'}
                                            />
                                        </div>
                                        {filteredGuests.length === 0 ? (
                                            <p className="text-xs text-slate-400 text-center py-3">\u0413\u043e\u0441\u0442\u0435\u0439 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e</p>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-52 overflow-y-auto">
                                                {filteredGuests.map(guest => {
                                                    const isInGroup = (group.memberKeys || []).includes(guest.key);
                                                    return (
                                                        <button
                                                            key={guest.key}
                                                            onClick={() => toggleMember(group.id, guest.key)}
                                                            className={\`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-colors \${isInGroup ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}\`}
                                                        >
                                                            <div className="min-w-0">
                                                                <div className="text-xs font-bold truncate">{guest.name}</div>
                                                                <div className="text-[10px] text-slate-400">{guest.stayCount} \u0437\u0430\u0441\u0435\u043b. &middot; {guest.totalNights} \u0441\u0443\u0442.</div>
                                                            </div>
                                                            <div className={\`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors \${isInGroup ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}\`}>
                                                                {isInGroup && <Check size={8} className="text-white" strokeWidth={3} />}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* \u0420\u0443\u0447\u043d\u044b\u0435 \u0437\u0430\u043f\u0438\u0441\u0438 */}
                            <div className="px-4 py-3">
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-slate-600 uppercase tracking-wide">\u0420\u0443\u0447\u043d\u044b\u0435 \u0437\u0430\u043f\u0438\u0441\u0438</span>
                                        {group.manualPersonNights > 0 && (
                                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                                                +{group.manualPersonNights.toLocaleString()} \u0447\u0435\u043b-\u0441\u0443\u0442
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => addEntry(group.id)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
                                    >
                                        <Plus size={11} /> \u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0437\u0430\u043f\u0438\u0441\u044c
                                    </button>
                                </div>

                                {group.manualEntries.length === 0 ? (
                                    <p className="text-xs text-slate-400">\u041d\u0435\u0442 \u0440\u0443\u0447\u043d\u044b\u0445 \u0437\u0430\u043f\u0438\u0441\u0435\u0439 \u2014 \u0434\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u043f\u0435\u0440\u0438\u043e\u0434 \u043f\u0440\u043e\u0436\u0438\u0432\u0430\u043d\u0438\u044f</p>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-1">
                                            <div className="col-span-3 text-[10px] font-bold uppercase text-slate-400">\u0417\u0430\u0435\u0437\u0434</div>
                                            <div className="col-span-3 text-[10px] font-bold uppercase text-slate-400">\u0412\u044b\u0435\u0437\u0434</div>
                                            <div className="col-span-2 text-[10px] font-bold uppercase text-slate-400">\u041a\u043e\u043c\u043d\u0430\u0442</div>
                                            <div className="col-span-2 text-[10px] font-bold uppercase text-slate-400">\u041b\u044e\u0434\u0435\u0439</div>
                                            <div className="col-span-2 text-[10px] font-bold uppercase text-slate-400">\u0418\u0442\u043e\u0433\u043e</div>
                                        </div>
                                        {group.manualEntries.map(entry => (
                                            <div key={entry.id} className="grid grid-cols-12 gap-2 items-center">
                                                <input
                                                    type="date"
                                                    value={entry.checkIn || ''}
                                                    onChange={e => updateEntry(group.id, entry.id, { checkIn: e.target.value })}
                                                    className={INP + ' col-span-6 sm:col-span-3'}
                                                />
                                                <input
                                                    type="date"
                                                    value={entry.checkOut || ''}
                                                    onChange={e => updateEntry(group.id, entry.id, { checkOut: e.target.value })}
                                                    className={INP + ' col-span-6 sm:col-span-3'}
                                                />
                                                <input
                                                    type="number" min="0"
                                                    placeholder="\u041a\u043e\u043c\u043d\u0430\u0442"
                                                    value={entry.rooms || ''}
                                                    onChange={e => updateEntry(group.id, entry.id, { rooms: e.target.value.replace(/[^0-9]/g, '') })}
                                                    className={INP + ' col-span-4 sm:col-span-2'}
                                                />
                                                <input
                                                    type="number" min="0"
                                                    placeholder="\u041b\u044e\u0434\u0435\u0439"
                                                    value={entry.people || ''}
                                                    onChange={e => updateEntry(group.id, entry.id, { people: e.target.value.replace(/[^0-9]/g, '') })}
                                                    className={INP + ' col-span-4 sm:col-span-2'}
                                                />
                                                <div className="col-span-3 sm:col-span-2 text-[11px] text-slate-600 font-semibold leading-tight">
                                                    {entry.nights > 0 ? (
                                                        <>
                                                            <div className="text-slate-500">{entry.nights} \u043d\u043e\u0447.</div>
                                                            <div className="text-indigo-600">{entry.personNights} \u0447\u0435\u043b-\u0441.</div>
                                                        </>
                                                    ) : (
                                                        <span className="text-slate-300">\u2014</span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => removeEntry(group.id, entry.id)}
                                                    className="col-span-1 w-8 h-8 rounded-lg border border-rose-200 text-rose-400 hover:bg-rose-50 inline-flex items-center justify-center transition-colors"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* \u0421\u0432\u043e\u0434\u043d\u0430\u044f \u0441\u0442\u0440\u043e\u043a\u0430 \u043f\u043e \u0432\u0441\u0435\u043c \u0433\u0440\u0443\u043f\u043f\u0430\u043c */}
            {detailedGroups.length > 1 && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                    <h3 className="text-sm font-black text-indigo-800 mb-3">\u0418\u0442\u043e\u0433\u043e \u043f\u043e \u0432\u0441\u0435\u043c \u0433\u0440\u0443\u043f\u043f\u0430\u043c</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                            <div className="text-[10px] font-bold uppercase text-indigo-400">\u0427\u0435\u043b-\u0441\u0443\u0442\u043e\u043a</div>
                            <div className="text-xl font-black text-indigo-700">{detailedGroups.reduce((s, g) => s + g.totalPersonNights, 0).toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold uppercase text-indigo-400">\u041d\u0430\u0447\u0438\u0441\u043b\u0435\u043d\u043e</div>
                            <div className="text-xl font-black text-slate-800">{fmt(detailedGroups.reduce((s, g) => s + g.totalAmount, 0))}</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold uppercase text-indigo-400">\u041e\u043f\u043b\u0430\u0447\u0435\u043d\u043e</div>
                            <div className="text-xl font-black text-emerald-600">{fmt(detailedGroups.reduce((s, g) => s + g.totalPaid, 0))}</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold uppercase text-indigo-400">\u041f\u043e \u0434\u043e\u0433\u043e\u0432\u043e\u0440\u0430\u043c</div>
                            <div className="text-xl font-black text-indigo-700">{fmt(detailedGroups.reduce((s, g) => s + g.contractTotal, 0))}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManualStayView;
`;

fs.writeFileSync(target, content, 'utf8');
console.log('Written OK, lines:', content.split('\n').length);
