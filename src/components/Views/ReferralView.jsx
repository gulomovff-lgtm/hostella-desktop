import React, { useState, useRef, useEffect } from 'react';
import { useReferralSystem } from '../../hooks/useReferralSystem';
import { Search } from 'lucide-react';

/* ─── palette by depth ───────────────────────────────────────────── */
const LEVEL_COLORS = [
  { bg: 'from-violet-600 to-purple-600', ring: 'ring-violet-400/60', dot: 'bg-violet-400', line: '#a78bfa' },
  { bg: 'from-blue-500 to-cyan-500',     ring: 'ring-blue-400/60',   dot: 'bg-blue-400',   line: '#60a5fa' },
  { bg: 'from-emerald-500 to-teal-500',  ring: 'ring-emerald-400/60',dot: 'bg-emerald-400',line: '#34d399' },
  { bg: 'from-orange-500 to-amber-400',  ring: 'ring-orange-400/60', dot: 'bg-orange-400', line: '#fb923c' },
  { bg: 'from-pink-500 to-rose-500',     ring: 'ring-pink-400/60',   dot: 'bg-pink-400',   line: '#f472b6' },
];
const lc = (lvl) => LEVEL_COLORS[Math.min(lvl, LEVEL_COLORS.length - 1)];

const getDisplayName = (node) => node.fullName || node.name || '—';

const initials = (node) => {
  if (node.isVirtual) return '🏠';
  const name = getDisplayName(node);
  return name.trim().split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';
};

const fmtDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
};

/* ─── Stat chip ──────────────────────────────────────────────────── */
const StatChip = ({ label, value, sub }) => (
  <div className="flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-2xl px-4 py-3 min-w-[80px]">
    <span className="text-xl font-bold text-white leading-none">{value}</span>
    {sub && <span className="text-[10px] text-emerald-400 font-semibold mt-0.5">{sub}</span>}
    <span className="text-[10px] text-slate-400 mt-1 text-center leading-tight">{label}</span>
  </div>
);

/* ─── Progress bar ───────────────────────────────────────────────── */
const ProgressBar = ({ value, max, lineColor }) => {
  const pct = max ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${lineColor}, rgba(255,255,255,0.8))` }}
      />
    </div>
  );
};

/* ─── Redeem stepper ─────────────────────────────────────────────── */
const RedeemRow = ({ node, onRedeem }) => {
  const [amount, setAmount] = useState(1);
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center border border-white/10 rounded-xl overflow-hidden flex-1">
        <button type="button" onClick={() => setAmount(a => Math.max(1, a - 1))}
          className="px-2.5 py-1.5 text-slate-300 hover:bg-white/10 text-xs font-bold transition-colors">–</button>
        <span className="flex-1 text-center text-white text-xs font-semibold">{amount}д</span>
        <button type="button" onClick={() => setAmount(a => Math.min(node.bonusDays, a + 1))}
          className="px-2.5 py-1.5 text-slate-300 hover:bg-white/10 text-xs font-bold transition-colors">+</button>
      </div>
      <button type="button" onClick={() => onRedeem(node.id, amount)}
        className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-colors whitespace-nowrap">
        Вычесть
      </button>
    </div>
  );
};

/* ─── Node card ──────────────────────────────────────────────────── */
const NodeCard = ({ node, level, selectedId, onSelect, onConfirm, onRedeem, onRemove }) => {
  const isVirtual  = !!node.isVirtual;
  const isSelected = selectedId === node.id;
  const col        = lc(level);
  const hasBonus   = (node.bonusDays || 0) > 0;
  const displayName = getDisplayName(node);

  return (
    <div
      className={`relative cursor-pointer rounded-2xl transition-all duration-200 ring-2 select-none
        ${isSelected ? `${col.ring} shadow-2xl scale-[1.02]` : 'ring-white/0 hover:ring-white/20'}
        ${isVirtual ? 'w-56' : 'w-52'}`}
      onClick={() => onSelect(node.id === selectedId ? null : node.id)}
    >
      <div className="overflow-hidden rounded-2xl bg-slate-800/80 backdrop-blur-sm border border-white/8">
        {/* Gradient header */}
        <div className={`px-4 pt-3 pb-4 bg-gradient-to-br ${col.bg} relative`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-sm shadow-inner flex-shrink-0">
              {initials(node)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm leading-tight truncate">{displayName}</p>
              <p className="text-white/60 text-[10px] mt-0.5">
                {isVirtual
                  ? 'Корень системы'
                  : node.referralConfirmed
                    ? `✓ ${fmtDate(node.confirmedAt || node.createdAt)}`
                    : '⏳ Ожидает подтверждения'}
              </p>
            </div>
          </div>
          {hasBonus && (
            <div className="absolute top-2 right-2 bg-amber-400 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
              +{node.bonusDays}д
            </div>
          )}
        </div>

        {/* Stats body */}
        <div className="px-4 py-3 space-y-2.5">
          {!isVirtual && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-400">Рефералы до сброса</span>
                <span className="text-[11px] font-semibold text-slate-200">{node.referralsMade || 0}/2</span>
              </div>
              <ProgressBar value={node.referralsMade || 0} max={2} lineColor={col.line} />
            </div>
          )}
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>👥 {(node.children || []).length} приглашено</span>
            {(node.totalBonusEarned || 0) > 0 && (
              <span className="text-emerald-400 font-medium">★ {node.totalBonusEarned} зараб.</span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded action panel */}
      {isSelected && (
        <div className="mt-1.5 rounded-2xl bg-slate-900/95 border border-white/10 p-3 space-y-2 shadow-2xl"
          onClick={e => e.stopPropagation()}>
          {!isVirtual && !node.referralConfirmed && (
            <button type="button" onClick={() => onConfirm(node.id)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors">
              ✓ Подтвердить 10 дней
            </button>
          )}
          {!isVirtual && node.referralConfirmed && !hasBonus && (
            <p className="text-center text-[10px] text-emerald-500 font-medium">✓ Уже подтверждён</p>
          )}
          {hasBonus && <RedeemRow node={node} onRedeem={onRedeem} />}
          {!isVirtual && (
            <button type="button"
              onClick={() => { if (window.confirm(`Убрать "${displayName}" из программы?`)) onRemove(node.id); }}
              className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl bg-red-500/20 hover:bg-red-500/40 text-red-400 text-xs font-medium transition-colors">
              ✕ Убрать из программы
            </button>
          )}
          {isVirtual && (
            <p className="text-center text-slate-500 text-[10px]">Корневой узел</p>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Tree branch ────────────────────────────────────────────────── */
const TreeBranch = ({ node, level = 0, selectedId, onSelect, onConfirm, onRedeem, onRemove }) => {
  const hasChildren = (node.children?.length || 0) > 0;
  const col = lc(level);
  const childCol = lc(level + 1);

  return (
    <div className="flex flex-col items-center">
      <NodeCard node={node} level={level} selectedId={selectedId}
        onSelect={onSelect} onConfirm={onConfirm} onRedeem={onRedeem} onRemove={onRemove} />
      {hasChildren && (
        <>
          <div className="w-0.5 h-6 flex-shrink-0"
            style={{ background: `linear-gradient(${col.line}, ${childCol.line})` }} />
          <div className="flex items-start gap-5 relative">
            {node.children.length > 1 && (
              <div className="absolute top-0 left-0 right-0 h-0.5"
                style={{ background: childCol.line, opacity: 0.35 }} />
            )}
            {node.children.map(child => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-0.5 h-6 flex-shrink-0" style={{ background: childCol.line, opacity: 0.5 }} />
                <TreeBranch node={child} level={level + 1} selectedId={selectedId}
                  onSelect={onSelect} onConfirm={onConfirm} onRedeem={onRedeem} onRemove={onRemove} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* ─── Add panel (новый или существующий клиент) ──────────────────── */
const AddPanel = ({ participantList, nonParticipants, onAddNew, onLinkExisting }) => {
  const [mode, setMode]         = useState('new'); // 'new' | 'existing'
  const [name, setName]         = useState('');
  const [referrerId, setRefId]  = useState('root');
  const [search, setSearch]     = useState('');
  const [pickedId, setPickedId] = useState('');
  const [linkRef, setLinkRef]   = useState('root');
  const inputRef                = useRef(null);

  const filteredNP = nonParticipants.filter(c =>
    (c.fullName || '').toLowerCase().includes(search.toLowerCase())
  ).slice(0, 20);

  const handleNew = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddNew(name.trim(), referrerId);
    setName('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleLink = (e) => {
    e.preventDefault();
    if (!pickedId) return;
    onLinkExisting(pickedId, linkRef);
    setPickedId('');
    setSearch('');
  };

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex rounded-xl overflow-hidden border border-white/10">
        {[['new', 'Новый гость'], ['existing', 'Из базы клиентов']].map(([m, label]) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className="flex-1 py-2 text-[11px] font-bold transition-colors"
            style={{
              background: mode === m ? 'rgba(139,92,246,0.35)' : 'transparent',
              color: mode === m ? '#c4b5fd' : '#64748b',
            }}>
            {label}
          </button>
        ))}
      </div>

      {mode === 'new' ? (
        <form onSubmit={handleNew} className="space-y-3">
          <div>
            <label className="text-[11px] text-slate-400 font-medium uppercase tracking-wide block mb-1">Имя</label>
            <input ref={inputRef} value={name} onChange={e => setName(e.target.value)} placeholder="Введите имя…" required
              className="w-full bg-slate-700/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition" />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 font-medium uppercase tracking-wide block mb-1">Кем приглашён</label>
            <select value={referrerId} onChange={e => setRefId(e.target.value)}
              className="w-full bg-slate-700/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition">
              {participantList.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <button type="submit"
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm font-semibold shadow-lg shadow-violet-900/30 transition-all active:scale-95">
            + Добавить гостя
          </button>
        </form>
      ) : (
        <form onSubmit={handleLink} className="space-y-3">
          <div>
            <label className="text-[11px] text-slate-400 font-medium uppercase tracking-wide block mb-1">Поиск клиента</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPickedId(''); }}
                placeholder="ФИО…"
                className="w-full pl-8 bg-slate-700/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition" />
            </div>
            {search && filteredNP.length > 0 && (
              <div className="mt-1 bg-slate-800 border border-white/10 rounded-xl overflow-hidden max-h-36 overflow-y-auto">
                {filteredNP.map(c => (
                  <button key={c.id} type="button"
                    onClick={() => { setPickedId(c.id); setSearch(c.fullName || ''); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors
                      ${pickedId === c.id ? 'bg-violet-600/30 text-violet-300' : 'text-slate-300'}`}>
                    {c.fullName}{c.passport ? ` · ${c.passport}` : ''}
                  </button>
                ))}
              </div>
            )}
            {search && filteredNP.length === 0 && (
              <p className="text-[10px] text-slate-500 mt-1 px-1">Не найдено среди незарегистрированных</p>
            )}
          </div>
          <div>
            <label className="text-[11px] text-slate-400 font-medium uppercase tracking-wide block mb-1">Кем приглашён</label>
            <select value={linkRef} onChange={e => setLinkRef(e.target.value)}
              className="w-full bg-slate-700/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition">
              {participantList.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <button type="submit" disabled={!pickedId}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-semibold shadow-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
            Добавить в программу
          </button>
        </form>
      )}
    </div>
  );
};

/* ─── Legend ─────────────────────────────────────────────────────── */
const Legend = () => (
  <div className="space-y-1.5">
    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Уровни вложенности</p>
    {LEVEL_COLORS.map((c, i) => (
      <div key={i} className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-sm ${c.dot}`} />
        <span className="text-[11px] text-slate-400">{i === 0 ? 'Корень (хостел)' : `Уровень ${i}`}</span>
      </div>
    ))}
  </div>
);

/* ─── Rules ──────────────────────────────────────────────────────── */
const RulesCard = () => (
  <div className="bg-slate-800/60 border border-white/8 rounded-2xl p-4 space-y-2">
    <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Правила бонусов</p>
    <div className="space-y-2 text-[11px] text-slate-300 leading-relaxed">
      <p className="flex items-start gap-1.5">
        <span className="text-amber-400 font-bold flex-shrink-0">1.</span>
        Гость приглашает знакомого, тот живёт 10+ дней →
        <span className="text-amber-300 font-semibold ml-1">+1 день</span>
      </p>
      <p className="flex items-start gap-1.5">
        <span className="text-amber-400 font-bold flex-shrink-0">2.</span>
        Второй приглашённый живёт 10+ дней →
        <span className="text-amber-300 font-semibold ml-1">+2 дня</span>
        (итого 3), счётчик сбрасывается
      </p>
      <p className="flex items-start gap-1.5">
        <span className="text-amber-400 font-bold flex-shrink-0">∞</span>
        Приглашённые тоже могут звать других — бонусы начисляются им же
      </p>
    </div>
  </div>
);

/* ─── Empty state ────────────────────────────────────────────────── */
const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-24 opacity-40">
    <span className="text-5xl mb-3">🌱</span>
    <p className="text-slate-400 text-sm">Добавьте первого участника через панель слева</p>
  </div>
);

/* ─── Main ───────────────────────────────────────────────────────── */
const ReferralView = ({ clients = [], hostelId, showNotification, currentUser }) => {
  const {
    nodes,
    addReferralClient,
    linkExistingClient,
    confirmTenDayStay,
    redeemBonusDays,
    removeFromProgram,
    getParticipantList,
    getNonParticipants,
    getStats,
  } = useReferralSystem({ clients, hostelId, showNotification });

  const [selectedId, setSelectedId] = useState(null);
  const stats           = getStats();
  const participantList = getParticipantList();
  const nonParticipants = getNonParticipants();
  const wrapRef         = useRef(null);

  const hasParticipants = nodes[0]?.children?.length > 0;

  /* Deselect on outside click */
  useEffect(() => {
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setSelectedId(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="min-h-full bg-slate-900 text-white flex flex-col" ref={wrapRef}>

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-white/5 bg-slate-900/80 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
              <span className="text-2xl">🎁</span> Бонусная программа
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">Реферральная иерархия · привязана к базе клиентов</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatChip label="Участников" value={stats.totalGuests} />
            <StatChip label="Подтверждено" value={stats.confirmedGuests}
              sub={stats.pendingGuests > 0 ? `${stats.pendingGuests} ожидает` : null} />
            <StatChip label="Бонусов" value={stats.totalBonusPending}
              sub={stats.totalBonusUsed > 0 ? `${stats.totalBonusUsed} исп.` : null} />
            <StatChip label="Заработано" value={stats.totalBonusEarned} />
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 border-r border-white/5 p-4 flex flex-col gap-5 overflow-y-auto bg-slate-900/50">
          <div className="bg-slate-800/60 border border-white/8 rounded-2xl p-4">
            <p className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
              <span>👤</span> Добавить участника
            </p>
            <AddPanel
              participantList={participantList}
              nonParticipants={nonParticipants}
              onAddNew={addReferralClient}
              onLinkExisting={linkExistingClient}
            />
          </div>
          <Legend />
          <RulesCard />
        </div>

        {/* Tree canvas */}
        <div className="flex-1 overflow-auto p-8 bg-[radial-gradient(ellipse_at_top_left,_rgba(109,40,217,0.08)_0%,_transparent_60%)]">
          <p className="text-[11px] text-slate-600 mb-6 flex items-center gap-1.5">
            <span>💡</span> Нажмите на карточку чтобы открыть действия
          </p>

          {hasParticipants ? (
            <div className="flex items-start gap-10 flex-wrap pb-16">
              {nodes.map(root => (
                <TreeBranch key={root.id} node={root} level={0}
                  selectedId={selectedId} onSelect={setSelectedId}
                  onConfirm={confirmTenDayStay}
                  onRedeem={redeemBonusDays}
                  onRemove={removeFromProgram}
                />
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-start gap-10 flex-wrap pb-4">
                {nodes.map(root => (
                  <TreeBranch key={root.id} node={root} level={0}
                    selectedId={selectedId} onSelect={setSelectedId}
                    onConfirm={confirmTenDayStay}
                    onRedeem={redeemBonusDays}
                    onRemove={removeFromProgram}
                  />
                ))}
              </div>
              <EmptyState />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReferralView;
