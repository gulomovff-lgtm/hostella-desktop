const fs = require('fs');

const newCode = `
    const paidPct = globalStats.charged > 0 ? Math.min(100, (globalStats.paid / globalStats.charged) * 100) : 0;

    return (
        <div className="space-y-4">
            {payingGroup && (
                <PaymentModal group={payingGroup} currentUser={currentUser} onClose={() => setPayingGroup(null)} />
            )}
            {reportGroup && (
                <BrigadeReportModal group={reportGroup} onClose={() => setReportGroup(null)} />
            )}

            {/* ── Верхняя панель ── */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Ручной учёт</h2>
                    <p className="text-sm text-slate-400 mt-0.5">
                        {detailedGroups.length} {pluralGroups(detailedGroups.length)}
                        {groupedGuests.length > 0 && <> · {groupedGuests.length} гостей</>}
                    </p>
                </div>
                {!creating ? (
                    <button
                        onClick={() => setCreating(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-[.97] transition-all shadow-sm shadow-indigo-200"
                    >
                        <Plus size={14} strokeWidth={2.5} /> Новая группа
                    </button>
                ) : (
                    <div className="flex items-center gap-2 bg-white border-2 border-indigo-300 rounded-xl px-3 py-2 shadow-lg shadow-indigo-100">
                        <input
                            autoFocus
                            value={newGroupName}
                            onChange={e => setNewGroupName(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') createGroup();
                                if (e.key === 'Escape') { setCreating(false); setNewGroupName(''); }
                            }}
                            placeholder="Название договора…"
                            className="flex-1 min-w-[200px] text-sm outline-none text-slate-800 placeholder:text-slate-400"
                        />
                        <button onClick={createGroup}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors">
                            Создать
                        </button>
                        <button onClick={() => { setCreating(false); setNewGroupName(''); }}
                            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                            <X size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* ── Статистика ── */}
            {detailedGroups.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Чел-суток</div>
                        <div className="text-2xl font-black text-slate-800">{globalStats.nights.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{detailedGroups.length} групп</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Начислено</div>
                        <div className="text-2xl font-black text-slate-800">{fmt(globalStats.charged)}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">сум</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm px-4 py-3.5">
                        <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1">Оплачено</div>
                        <div className="text-2xl font-black text-emerald-600">{fmt(globalStats.paid)}</div>
                        {globalStats.charged > 0 && (
                            <div className="text-[10px] text-emerald-400 mt-0.5">{paidPct.toFixed(0)}%</div>
                        )}
                    </div>
                    {globalStats.debt > 0 ? (
                        <div className="bg-rose-50 rounded-2xl border border-rose-100 shadow-sm px-4 py-3.5">
                            <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mb-1">Долг</div>
                            <div className="text-2xl font-black text-rose-600">{fmt(globalStats.debt)}</div>
                            <div className="text-[10px] text-rose-400 mt-0.5">сум</div>
                        </div>
                    ) : (
                        <div className="bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm px-4 py-3.5 flex flex-col justify-center">
                            <div className="flex items-center gap-1.5 text-emerald-600">
                                <Check size={16} strokeWidth={3} />
                                <span className="text-sm font-black">Долгов нет</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Прогресс оплаты */}
            {globalStats.charged > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-3.5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-500">Прогресс оплаты</span>
                        <span className="text-xs font-black" style={{ color: paidPct >= 100 ? '#16a34a' : '#6366f1' }}>
                            {paidPct.toFixed(0)}%
                        </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                                width: \`\${paidPct}%\`,
                                background: paidPct >= 100 ? '#16a34a' : 'linear-gradient(90deg,#6366f1,#8b5cf6)',
                            }}
                        />
                    </div>
                </div>
            )}

            {/* ── Пустой стейт ── */}
            {detailedGroups.length === 0 && (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center bg-white">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
                        <FileText size={24} className="text-indigo-400" />
                    </div>
                    <p className="text-base font-bold text-slate-700">Договоров пока нет</p>
                    <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">
                        Создайте группу и начните отслеживать проживание
                    </p>
                    <button
                        onClick={() => setCreating(true)}
                        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
                        <Plus size={14} /> Создать группу
                    </button>
                </div>
            )}

            {/* ── Список договоров ── */}
            <div className="space-y-3">
                {detailedGroups.map((group, idx) => {
                    const isMemberPickerOpen = memberPickerGroupId === group.id;
                    const isEditing = editingGroup?.id === group.id;
                    const accent = ACCENT_COLORS[idx % ACCENT_COLORS.length];
                    const membersOpen = isSectionOpen(group.id, 'members');
                    const periodsOpen = isSectionOpen(group.id, 'periods');
                    const groupPaidPct = group.contractTotal > 0 ? Math.min(100, (group.amountPaid / group.contractTotal) * 100) : 0;
                    const isPaid = group.contractTotal > 0 && group.debt <= 0;

                    return (
                        <div key={group.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

                            {/* Цветная полоска сверху */}
                            <div className="h-1.5" style={{ background: accent }} />

                            {/* ─ Заголовок карточки ─ */}
                            <div className="px-5 py-4">
                                <div className="flex items-start gap-4">
                                    {/* Левая часть: имя + метрики */}
                                    <div className="flex-1 min-w-0">
                                        {isEditing ? (
                                            <div className="flex items-center gap-2 mb-2">
                                                <input
                                                    autoFocus
                                                    value={editingGroup.name}
                                                    onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })}
                                                    onKeyDown={e => { if (e.key === 'Enter') renameGroup(); if (e.key === 'Escape') setEditingGroup(null); }}
                                                    className="flex-1 text-base font-bold outline-none border-b-2 border-indigo-400 bg-transparent text-slate-900 pb-0.5"
                                                />
                                                <button onClick={renameGroup} className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors">
                                                    <Check size={13} />
                                                </button>
                                                <button onClick={() => setEditingGroup(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                                                    <X size={13} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 flex-wrap mb-2">
                                                <span className="text-base font-black text-slate-900 leading-snug">{group.name}</span>
                                                {isPaid && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                                                        <Check size={8} strokeWidth={3} /> Оплачено
                                                    </span>
                                                )}
                                                {!isPaid && group.debt > 0 && group.contractTotal > 0 && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                                                        Долг {fmt(group.debt)} сум
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Метрики */}
                                        <div className="flex items-center gap-4 flex-wrap text-[11px]">
                                            <span className="text-slate-500">
                                                <span className="text-slate-400">Участников: </span>
                                                <span className="font-bold text-slate-700">{group.members.length}</span>
                                            </span>
                                            <span className="text-slate-200">·</span>
                                            <span>
                                                <span className="text-slate-400">Чел-суток: </span>
                                                <span className="font-black" style={{ color: accent }}>{group.totalPersonNights.toLocaleString()}</span>
                                            </span>
                                            {group.contractRate > 0 && (
                                                <>
                                                    <span className="text-slate-200">·</span>
                                                    <span>
                                                        <span className="text-slate-400">Начислено: </span>
                                                        <span className="font-bold text-slate-700">{fmt(group.contractTotal)} сум</span>
                                                    </span>
                                                    {group.amountPaid > 0 && (
                                                        <>
                                                            <span className="text-slate-200">·</span>
                                                            <span>
                                                                <span className="text-slate-400">Оплачено: </span>
                                                                <span className="font-bold text-emerald-600">{fmt(group.amountPaid)} сум</span>
                                                            </span>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        {/* Progress bar */}
                                        {group.contractTotal > 0 && (
                                            <div className="mt-3 h-1.5 rounded-full overflow-hidden bg-slate-100">
                                                <div
                                                    className="h-full rounded-full transition-all duration-500"
                                                    style={{ width: \`\${groupPaidPct}%\`, background: isPaid ? '#16a34a' : accent }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Правые действия */}
                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setEditingGroup({ id: group.id, name: group.name })}
                                                className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                                                <Edit2 size={13} />
                                            </button>
                                            <button
                                                onClick={() => setReportGroup(group)}
                                                title="Отчёт по составу бригады"
                                                className="p-1.5 rounded-lg text-slate-300 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                                                <FileText size={13} />
                                            </button>
                                            <button
                                                onClick={() => deleteGroup(group.id)}
                                                className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => setPayingGroup(group)}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-[.97] shadow-sm"
                                            style={{ background: accent }}
                                            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                        >
                                            <DollarSign size={12} strokeWidth={2.5} /> Оплатить
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Ставка */}
                            <div className="px-5 py-2.5 bg-slate-50 border-y border-slate-100 flex items-center gap-3">
                                <span className="text-xs font-semibold text-slate-400">Ставка</span>
                                <input
                                    value={group.contractRate || ''}
                                    onChange={e => updateGroup(group.id, { contractRate: e.target.value.replace(/[^0-9]/g, '') })}
                                    placeholder="0"
                                    title="сум/чел-сут"
                                    className="w-24 px-2.5 py-1 text-xs text-right font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 text-slate-700"
                                />
                                <span className="text-xs text-slate-400">сум/ч-с</span>
                                {group.contractRate > 0 && group.totalPersonNights > 0 && (
                                    <span className="text-xs text-slate-500 ml-1">
                                        = <span className="font-bold text-slate-700">{fmt(group.contractTotal)}</span> сум
                                    </span>
                                )}
                            </div>

                            {/* ─ Аккордеон: участники ─ */}
                            <div className="border-b border-slate-100 last:border-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                        toggleSection(group.id, 'members');
                                        if (isSectionOpen(group.id, 'members')) { setMemberPickerGroupId(null); setMemberSearch(''); }
                                    }}
                                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50/80 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-2">
                                        <Users size={13} className="text-slate-400" />
                                        <span className="text-xs font-semibold text-slate-600">Участники</span>
                                        {group.members.length > 0 && (
                                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md"
                                                style={{ background: accent + '18', color: accent }}>
                                                {group.members.length}
                                            </span>
                                        )}
                                    </div>
                                    {membersOpen
                                        ? <ChevronDown size={13} className="text-slate-400" />
                                        : <ChevronRight size={13} className="text-slate-400" />}
                                </button>

                                {membersOpen && (
                                    <div className="px-5 pb-4 space-y-3">
                                        {group.members.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {group.members.map(member => (
                                                    <span key={member.key}
                                                        className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium"
                                                        style={{ background: accent + '12', border: \`1px solid \${accent}28\`, color: accent }}>
                                                        {member.name}
                                                        <span className="text-[10px]" style={{ opacity: 0.5 }}>{member.totalNights}н</span>
                                                        <button onClick={() => toggleMember(group.id, member.key)}
                                                            className="w-4 h-4 rounded-full flex items-center justify-center transition-opacity hover:opacity-100"
                                                            style={{ opacity: 0.4, background: accent + '20' }}>
                                                            <X size={8} />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {group.members.length === 0 && !isMemberPickerOpen && (
                                            <p className="text-xs text-slate-400">Нет участников</p>
                                        )}
                                        <button
                                            onClick={() => {
                                                if (isMemberPickerOpen) { setMemberPickerGroupId(null); setMemberSearch(''); }
                                                else { setMemberPickerGroupId(group.id); setMemberSearch(''); }
                                            }}
                                            className={\`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all \${
                                                isMemberPickerOpen
                                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                                    : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                            }\`}
                                        >
                                            <Plus size={10} style={{ transform: isMemberPickerOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s' }} />
                                            {isMemberPickerOpen ? 'Свернуть' : 'Добавить гостя'}
                                        </button>

                                        {isMemberPickerOpen && (
                                            <div className="rounded-xl overflow-hidden border border-slate-200">
                                                <div className="relative">
                                                    <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                    <input
                                                        autoFocus
                                                        value={memberSearch}
                                                        onChange={e => setMemberSearch(e.target.value)}
                                                        placeholder="Поиск гостя…"
                                                        className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 focus:outline-none text-slate-700 border-b border-slate-100"
                                                    />
                                                </div>
                                                {filteredGuests.length === 0 ? (
                                                    <div className="text-xs text-slate-400 text-center py-3">Не найдено</div>
                                                ) : (
                                                    <div className="max-h-48 overflow-y-auto">
                                                        {filteredGuests.map(guest => {
                                                            const isInGroup = (group.memberKeys || []).includes(guest.key);
                                                            return (
                                                                <button key={guest.key}
                                                                    onClick={() => toggleMember(group.id, guest.key)}
                                                                    className={\`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors border-b border-slate-50 last:border-0 \${isInGroup ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}\`}>
                                                                    <div className="min-w-0">
                                                                        <div className="text-xs font-semibold text-slate-800 truncate">{guest.name}</div>
                                                                        <div className="text-[10px] text-slate-400">{guest.stayCount} засел. · {guest.totalNights} сут.</div>
                                                                    </div>
                                                                    <div className={\`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all \${isInGroup ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}\`}>
                                                                        {isInGroup && <Check size={7} className="text-white" strokeWidth={3} />}
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ─ Аккордеон: периоды ─ */}
                            <div>
                                <button
                                    type="button"
                                    onClick={() => toggleSection(group.id, 'periods')}
                                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50/80 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-2">
                                        <CalendarDays size={13} className="text-slate-400" />
                                        <span className="text-xs font-semibold text-slate-600">Периоды</span>
                                        {group.manualEntries.length > 0 && (
                                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-600">
                                                {group.manualEntries.length}
                                            </span>
                                        )}
                                        {group.manualPersonNights > 0 && (
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                +{group.manualPersonNights} ч-с
                                            </span>
                                        )}
                                    </div>
                                    {periodsOpen
                                        ? <ChevronDown size={13} className="text-slate-400" />
                                        : <ChevronRight size={13} className="text-slate-400" />}
                                </button>

                                {periodsOpen && (
                                    <div className="px-5 pb-4">
                                        {group.manualEntries.length === 0 ? (
                                            <p className="text-xs text-slate-400 mb-3">Нет периодов</p>
                                        ) : (
                                            <div className="space-y-2 mb-3">
                                                {/* Заголовки колонок */}
                                                <div className="grid grid-cols-[1fr_1fr_auto_44px_32px_28px] gap-1.5 px-1">
                                                    {['Заезд', 'Выезд', 'Комнаты', 'Чел', 'Ноч', ''].map((h, i) => (
                                                        <div key={i} className="text-[9px] font-bold uppercase text-slate-400 tracking-wider text-center">{h}</div>
                                                    ))}
                                                </div>

                                                {group.manualEntries.map(entry => (
                                                    <div key={entry.id} className="rounded-xl border border-slate-100 overflow-hidden">
                                                        {/* Строка периода */}
                                                        <div className="grid grid-cols-[1fr_1fr_auto_44px_32px_28px] gap-1.5 items-center px-2 py-2 bg-white">
                                                            <input
                                                                type="date"
                                                                value={entry.checkIn || ''}
                                                                onChange={e => updateEntry(group.id, entry.id, { checkIn: e.target.value })}
                                                                className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:border-indigo-400 w-full text-slate-700"
                                                            />
                                                            <input
                                                                type="date"
                                                                value={entry.checkOut || ''}
                                                                onChange={e => updateEntry(group.id, entry.id, { checkOut: e.target.value })}
                                                                className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:border-indigo-400 w-full text-slate-700"
                                                            />
                                                            <RoomPicker
                                                                rooms={rooms}
                                                                selected={Array.isArray(entry.roomIds) ? entry.roomIds : []}
                                                                onChange={roomIds => updateEntry(group.id, entry.id, { roomIds })}
                                                            />
                                                            <input
                                                                type="number" min="0" placeholder="0"
                                                                value={entry.people || ''}
                                                                onChange={e => updateEntry(group.id, entry.id, { people: e.target.value.replace(/[^0-9]/g, '') })}
                                                                className="px-1 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:border-indigo-400 text-center w-full text-slate-700"
                                                            />
                                                            <div className="text-center">
                                                                {entry.nights > 0
                                                                    ? <span className="text-xs font-bold text-slate-600">{entry.nights}</span>
                                                                    : <span className="text-slate-300 text-xs">—</span>}
                                                                {entry.personNights > 0 && (
                                                                    <div className="text-[9px] font-black text-violet-500">{entry.personNights}</div>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={() => removeEntry(group.id, entry.id)}
                                                                className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors mx-auto">
                                                                <X size={11} />
                                                            </button>
                                                        </div>

                                                        {/* Состав бригады */}
                                                        <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/60 space-y-1.5">
                                                            {(entry.workerGroups || []).map((wg, wgIdx) => (
                                                                <WorkerGroupRow
                                                                    key={wg.id || wgIdx}
                                                                    wg={wg}
                                                                    wgIdx={wgIdx}
                                                                    onUpdate={(patch) => updateWorkerGroup(group.id, entry.id, wg.id, patch)}
                                                                    onRemove={() => removeWorkerGroup(group.id, entry.id, wg.id)}
                                                                />
                                                            ))}
                                                            <button
                                                                onClick={() => addWorkerGroup(group.id, entry.id)}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-slate-200 text-[10px] font-semibold text-slate-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-white transition-colors">
                                                                <Plus size={9} /> Добавить специальность
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}

                                                {group.manualEntries.length > 1 && (
                                                    <div className="flex justify-end gap-3 pt-1 border-t border-slate-100">
                                                        <span className="text-[10px] text-slate-400">Итого ручные:</span>
                                                        <span className="text-[10px] font-black text-violet-600">{group.manualPersonNights} чел-сут</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <button
                                            onClick={() => addEntry(group.id)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                                            <Plus size={10} /> Добавить период
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ManualStayView;
`;

const filePath = 'src/components/Views/ManualStayView.jsx';
fs.appendFileSync(filePath, newCode, 'utf8');
console.log('Done. Lines:', fs.readFileSync(filePath, 'utf8').split('\n').length);
