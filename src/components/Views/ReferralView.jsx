import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useReferralSystem } from '../../hooks/useReferralSystem';
import { useReferralSettings } from '../../hooks/useReferralSettings';
import {
  Search, Settings, X, Plus, Trash2, ChevronUp, ChevronDown, Save,
  Gift, RotateCcw, Users, CheckCircle2, Clock, Award, Sparkles,
  Network, List as ListIcon, UserPlus, Minus, Info, ZoomIn, ZoomOut,
} from 'lucide-react';

/* ─── palette by depth (light theme, brand teal) ──────────────────── */
const LEVEL_COLORS = [
  { label: 'Корень (хостел)', text: 'text-teal-700',    dot: 'bg-teal-500',    soft: 'bg-teal-50',    border: 'border-teal-200',    ring: 'ring-teal-300',    line: '#0f9688', grad: 'from-teal-500 to-emerald-500' },
  { label: 'Уровень 1',       text: 'text-blue-700',    dot: 'bg-blue-500',    soft: 'bg-blue-50',    border: 'border-blue-200',    ring: 'ring-blue-300',    line: '#3b82f6', grad: 'from-blue-500 to-cyan-500' },
  { label: 'Уровень 2',       text: 'text-emerald-700', dot: 'bg-emerald-500', soft: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-300', line: '#10b981', grad: 'from-emerald-500 to-teal-500' },
  { label: 'Уровень 3',       text: 'text-amber-700',   dot: 'bg-amber-500',   soft: 'bg-amber-50',   border: 'border-amber-200',   ring: 'ring-amber-300',   line: '#f59e0b', grad: 'from-amber-500 to-orange-500' },
  { label: 'Уровень 4+',      text: 'text-rose-700',    dot: 'bg-rose-500',    soft: 'bg-rose-50',    border: 'border-rose-200',    ring: 'ring-rose-300',    line: '#f43f5e', grad: 'from-rose-500 to-pink-500' },
];
const lc = (lvl) => LEVEL_COLORS[Math.min(Math.max(lvl, 0), LEVEL_COLORS.length - 1)];

const inputCls = 'w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition';

const getDisplayName = (node) => node.fullName || node.name || '—';
const initials = (node) => {
  if (node.isVirtual) return '🏠';
  const name = getDisplayName(node);
  return name.trim().split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';
};
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) : '';

/* ─── Mini stepper ────────────────────────────────────────────────── */
const Stepper = ({ value, setValue, min = 1, max = 999 }) => (
  <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-white shrink-0">
    <button type="button" onClick={() => setValue(v => Math.max(min, v - 1))}
      className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 transition-colors"><Minus size={13} /></button>
    <span className="w-8 text-center text-sm font-bold text-slate-700">{value}</span>
    <button type="button" onClick={() => setValue(v => Math.min(max, v + 1))}
      className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 transition-colors"><Plus size={13} /></button>
  </div>
);

/* ─── Shared actions panel (used by tree node & list row) ─────────── */
const NodeActions = ({ node, settings, guests = [], onConfirm, onRedeem, onAddBonus, onResetBonus, onExtendStay, onRemove }) => {
  const hasBonus = (node.bonusDays || 0) > 0;
  const displayName = getDisplayName(node);

  const [addAmt, setAddAmt] = useState(1);
  const [redeemAmt, setRedeemAmt] = useState(1);
  const [showExtend, setShowExtend] = useState(false);
  const [extSearch, setExtSearch] = useState('');
  const [extGuestId, setExtGuestId] = useState('');
  const [extDays, setExtDays] = useState(1);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const candidateGuests = guests.filter(g =>
    g.status === 'active' &&
    (g.clientId === node.id ||
     (g.fullName || '').toUpperCase() === (node.fullName || node.name || '').toUpperCase())
  );
  const searchGuests = extSearch.trim()
    ? guests.filter(g => g.status === 'active' &&
        (g.fullName || '').toLowerCase().includes(extSearch.toLowerCase())).slice(0, 6)
    : candidateGuests.slice(0, 6);
  const selectedGuest = extGuestId ? guests.find(g => g.id === extGuestId) : null;

  const handleExtendSubmit = (e) => {
    e.preventDefault();
    if (!extGuestId) return;
    onExtendStay?.(node.id, extGuestId, extDays);
    setShowExtend(false); setExtGuestId(''); setExtSearch(''); setExtDays(1);
  };

  return (
    <div className="space-y-2.5">
      {/* Confirm stay */}
      {!node.referralConfirmed && (
        <button type="button" onClick={() => onConfirm(node.id)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors">
          <CheckCircle2 size={14} /> Подтвердить {settings?.minStayDays || 10} дней проживания
        </button>
      )}
      {node.referralConfirmed && !hasBonus && (
        <p className="text-center text-[11px] text-emerald-600 font-semibold py-1">✓ Проживание подтверждено</p>
      )}

      {/* Redeem bonus */}
      {hasBonus && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-2">
          <span className="text-[11px] text-amber-700 font-bold ml-1 shrink-0">Списать:</span>
          <Stepper value={redeemAmt} setValue={setRedeemAmt} min={1} max={node.bonusDays} />
          <button type="button" onClick={() => onRedeem(node.id, redeemAmt)}
            className="flex-1 py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold transition-colors">
            Списать {redeemAmt} д.
          </button>
        </div>
      )}

      {/* Add bonus + reset */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-500 font-semibold shrink-0">Начислить:</span>
        <Stepper value={addAmt} setValue={setAddAmt} min={1} />
        <button type="button" onClick={() => onAddBonus?.(node.id, addAmt)}
          className="flex-1 py-1.5 px-2 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 text-xs font-bold flex items-center justify-center gap-1 transition-colors">
          <Gift size={12} /> +{addAmt} д.
        </button>
        <button type="button" onClick={() => onResetBonus?.(node.id)} title="Обнулить бонусы"
          className="p-2 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-500 transition-colors">
          <RotateCcw size={13} />
        </button>
      </div>

      {/* Extend stay with bonus */}
      {hasBonus && (
        <div>
          <button type="button" onClick={() => setShowExtend(v => !v)}
            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 text-xs font-bold transition-colors">
            <Sparkles size={12} /> Продлить проживание бонусом {showExtend ? '▲' : '▼'}
          </button>
          {showExtend && (
            <form onSubmit={handleExtendSubmit} className="mt-2 space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
              {!selectedGuest ? (
                <div className="space-y-1">
                  <input value={extSearch}
                    onChange={e => { setExtSearch(e.target.value); setExtGuestId(''); }}
                    placeholder="Поиск активного гостя…"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white text-slate-700 text-[11px] placeholder-slate-400 border border-slate-300 focus:outline-none focus:border-orange-400" />
                  {searchGuests.length === 0 && (
                    <p className="text-[10px] text-slate-400 text-center py-1">Нет активных гостей</p>
                  )}
                  <div className="space-y-0.5 max-h-24 overflow-y-auto">
                    {searchGuests.map(g => (
                      <button key={g.id} type="button"
                        onClick={() => { setExtGuestId(g.id); setExtSearch(g.fullName); }}
                        className="w-full text-left px-2 py-1 rounded-lg bg-white hover:bg-orange-50 border border-slate-100 text-[11px] text-slate-600 transition-colors">
                        <span className="font-semibold">{g.fullName}</span>
                        <span className="ml-1.5 text-slate-400">выезд: {fmtDate(g.bonusCheckOutDate || g.checkOutDate)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-orange-700 font-semibold truncate flex-1">{selectedGuest.fullName}</span>
                  <span className="text-[10px] text-slate-400">выезд: {fmtDate(selectedGuest.bonusCheckOutDate || selectedGuest.checkOutDate)}</span>
                  <button type="button" onClick={() => { setExtGuestId(''); setExtSearch(''); }}
                    className="text-slate-400 hover:text-slate-600 ml-1"><X size={11} /></button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 shrink-0">Дней:</span>
                <input type="number" min={1} max={node.bonusDays} value={extDays}
                  onChange={e => setExtDays(Math.min(node.bonusDays, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-14 px-2 py-1 rounded-lg bg-white text-slate-700 text-[11px] text-center border border-slate-300 focus:outline-none focus:border-orange-400" />
                <span className="text-[10px] text-slate-400">макс {node.bonusDays}</span>
              </div>
              <button type="submit" disabled={!extGuestId}
                className="w-full py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors">
                Продлить проживание
              </button>
            </form>
          )}
        </div>
      )}

      {/* Remove */}
      {!confirmRemove ? (
        <button type="button" onClick={() => setConfirmRemove(true)}
          className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl text-rose-500 hover:bg-rose-50 text-xs font-medium transition-colors">
          <Trash2 size={12} /> Убрать из программы
        </button>
      ) : (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 space-y-2">
          <p className="text-xs text-rose-600 text-center font-semibold">Убрать «{displayName}»?</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => { onRemove(node.id); setConfirmRemove(false); }}
              className="flex-1 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold transition-colors">Да, убрать</button>
            <button type="button" onClick={() => setConfirmRemove(false)}
              className="flex-1 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs font-medium transition-colors">Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Tree node card (light) ──────────────────────────────────────── */
const TreeNodeCard = ({ node, level, selectedId, onSelect, settings, guests, handlers }) => {
  const isVirtual = !!node.isVirtual;
  const isSelected = selectedId === node.id;
  const col = lc(level);
  const hasBonus = (node.bonusDays || 0) > 0;
  const displayName = getDisplayName(node);
  const tiersCount = settings?.tiers?.length || 2;
  const made = node.referralsMade || 0;
  const pct = tiersCount ? Math.min((made / tiersCount) * 100, 100) : 0;

  return (
    <div className={`relative rounded-2xl transition-all duration-200 select-none ${isVirtual ? 'w-56' : 'w-52'}`}>
      <div
        onClick={() => onSelect(node.id === selectedId ? null : node.id)}
        className={`overflow-hidden rounded-2xl bg-white border shadow-sm cursor-pointer transition-all
          ${isSelected ? `ring-2 ${col.ring} shadow-lg ${col.border}` : 'border-slate-200 hover:shadow-md hover:border-slate-300'}`}>
        {/* header */}
        <div className={`px-3.5 pt-3 pb-3 bg-gradient-to-br ${col.grad} relative`}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/25 flex items-center justify-center text-white font-bold text-sm shadow-inner shrink-0">
              {initials(node)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-tight truncate">{displayName}</p>
              <p className="text-white/75 text-[10px] mt-0.5">
                {isVirtual ? 'Корень системы'
                  : node.referralConfirmed ? `✓ ${fmtDate(node.confirmedAt || node.createdAt)}`
                  : '⏳ Ожидает подтверждения'}
              </p>
            </div>
          </div>
          {hasBonus && (
            <div className="absolute top-2 right-2 bg-white text-amber-600 text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-sm flex items-center gap-0.5">
              <Gift size={9} /> {node.bonusDays}д
            </div>
          )}
        </div>
        {/* body */}
        {!isVirtual && (
          <div className="px-3.5 py-2.5 space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-400">До бонуса</span>
                <span className="text-[11px] font-bold text-slate-600">{made}/{tiersCount}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: col.line }} />
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>👥 {(node.children || []).length} приглашено</span>
              {(node.totalBonusEarned || 0) > 0 && <span className="text-emerald-600 font-semibold">★ {node.totalBonusEarned}</span>}
            </div>
          </div>
        )}
      </div>

      {isSelected && !isVirtual && (
        <div className="mt-1.5 rounded-2xl bg-white border border-slate-200 p-3 shadow-lg" onClick={e => e.stopPropagation()}>
          <NodeActions node={node} settings={settings} guests={guests} {...handlers} />
        </div>
      )}
      {isSelected && isVirtual && (
        <div className="mt-1.5 rounded-2xl bg-white border border-slate-200 p-3 shadow-lg text-center text-[11px] text-slate-400">
          Корневой узел программы
        </div>
      )}
    </div>
  );
};

/* ─── Tree branch ─────────────────────────────────────────────────── */
const TreeBranch = ({ node, level = 0, selectedId, onSelect, settings, guests, handlers }) => {
  const hasChildren = (node.children?.length || 0) > 0;
  const col = lc(level);
  const childCol = lc(level + 1);
  const shared = { selectedId, onSelect, settings, guests, handlers };

  return (
    <div className="flex flex-col items-center">
      <TreeNodeCard node={node} level={level} {...shared} />
      {hasChildren && (
        <>
          <div className="w-0.5 h-6 shrink-0" style={{ background: `linear-gradient(${col.line}, ${childCol.line})` }} />
          <div className="flex items-start gap-5 relative">
            {node.children.length > 1 && (
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: childCol.line, opacity: 0.35 }} />
            )}
            {node.children.map(child => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-0.5 h-6 shrink-0" style={{ background: childCol.line, opacity: 0.5 }} />
                <TreeBranch node={child} level={level + 1} {...shared} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* ─── List row v2: карточка с действиями прямо в строке ───────────── */
const ListRow = ({ node, level, expanded, onToggle, settings, guests, handlers }) => {
  const col = lc(level);
  const hasBonus = (node.bonusDays || 0) > 0;
  const tiersCount = settings?.tiers?.length || 2;
  const made = node.referralsMade || 0;
  const pct = tiersCount ? Math.min((made / tiersCount) * 100, 100) : 0;
  const invited = (node.children || []).length;

  return (
    <div className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all duration-200
        ${expanded ? `${col.border} ring-2 ${col.ring} shadow-md` : 'border-slate-200 hover:border-slate-300 hover:shadow-md'}`}>
      <div className="flex items-center gap-3 p-3">
        {/* Аватар + уровень */}
        <div className="relative shrink-0">
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${col.grad} flex items-center justify-center text-white font-bold text-sm`}>
            {initials(node)}
          </div>
          <span className={`absolute -bottom-1 -right-1 text-[8px] font-black px-1 py-px rounded-md ${col.soft} ${col.text} border border-white`}>
            ур.{level}
          </span>
        </div>

        {/* Имя + статус + прогресс */}
        <button type="button" onClick={onToggle} className="flex-1 min-w-0 text-left group">
          <div className="font-bold text-slate-800 text-sm truncate group-hover:text-teal-700 transition-colors">
            {getDisplayName(node)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
            {node.referralConfirmed
              ? <span className="text-emerald-600 font-medium inline-flex items-center gap-0.5"><CheckCircle2 size={10} /> подтверждён</span>
              : <span className="text-amber-600 font-medium inline-flex items-center gap-0.5"><Clock size={10} /> ожидает</span>}
            <span>👥 {invited}</span>
          </div>
          {/* Прогресс до бонуса */}
          <div className="flex items-center gap-1.5 mt-1.5 max-w-[220px]">
            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: col.line }} />
            </div>
            <span className="text-[9px] font-bold text-slate-400 shrink-0">{made}/{tiersCount}</span>
          </div>
        </button>

        {/* Бонус */}
        {hasBonus && (
          <div className="shrink-0 flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5">
            <Gift size={13} className="text-amber-500" />
            <span className="text-base font-black text-amber-600 leading-none">{node.bonusDays}</span>
            <span className="text-[9px] font-bold text-amber-400">дн.</span>
          </div>
        )}

        {/* Инлайн-действия */}
        <div className="shrink-0 flex items-center gap-1.5">
          {!node.referralConfirmed && (
            <button type="button" onClick={() => handlers.onConfirm(node.id)}
              title={`Подтвердить ${settings?.minStayDays || 10} дней проживания`}
              className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all active:scale-95">
              <CheckCircle2 size={13} /> <span className="hidden sm:inline">Подтвердить</span>
            </button>
          )}
          <button type="button" onClick={() => handlers.onAddBonus?.(node.id, 1)}
            title="Начислить 1 бонусный день"
            className="flex items-center gap-0.5 px-2 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 text-[11px] font-bold transition-all active:scale-95">
            <Gift size={12} /> +1
          </button>
          <button type="button" onClick={onToggle}
            className={`p-2 rounded-xl transition-all ${expanded ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}>
            <ChevronDown size={15} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-2 border-t border-slate-100 bg-slate-50/60">
          <NodeActions node={node} settings={settings} guests={guests} {...handlers} />
        </div>
      )}
    </div>
  );
};

/* ─── Add panel (new or existing client) ──────────────────────────── */
const AddPanel = ({ participantList, nonParticipants, onAddNew, onLinkExisting }) => {
  const [mode, setMode] = useState('new');
  const [name, setName] = useState('');
  const [referrerId, setRefId] = useState('root');
  const [search, setSearch] = useState('');
  const [pickedId, setPickedId] = useState('');
  const [linkRef, setLinkRef] = useState('root');
  const inputRef = useRef(null);

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
    setPickedId(''); setSearch('');
  };

  return (
    <div className="space-y-3">
      <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-slate-100 p-1 gap-1">
        {[['new', 'Новый гость'], ['existing', 'Из базы']].map(([m, label]) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${mode === m ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-400'}`}>
            {label}
          </button>
        ))}
      </div>

      {mode === 'new' ? (
        <form onSubmit={handleNew} className="space-y-2.5">
          <div>
            <label className="text-[11px] text-slate-500 font-semibold block mb-1">Имя гостя</label>
            <input ref={inputRef} value={name} onChange={e => setName(e.target.value)} placeholder="Введите имя…" required className={inputCls} />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 font-semibold block mb-1">Кем приглашён</label>
            <select value={referrerId} onChange={e => setRefId(e.target.value)} className={inputCls}>
              {participantList.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <button type="submit" className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold shadow-sm shadow-teal-200 transition-all active:scale-95 flex items-center justify-center gap-2">
            <UserPlus size={15} /> Добавить гостя
          </button>
        </form>
      ) : (
        <form onSubmit={handleLink} className="space-y-2.5">
          <div>
            <label className="text-[11px] text-slate-500 font-semibold block mb-1">Поиск клиента</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPickedId(''); }} placeholder="ФИО…" className={`${inputCls} pl-8`} />
            </div>
            {search && filteredNP.length > 0 && (
              <div className="mt-1 bg-white border border-slate-200 rounded-xl overflow-hidden max-h-36 overflow-y-auto shadow-sm">
                {filteredNP.map(c => (
                  <button key={c.id} type="button" onClick={() => { setPickedId(c.id); setSearch(c.fullName || ''); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-teal-50 transition-colors ${pickedId === c.id ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-slate-600'}`}>
                    {c.fullName}{c.passport ? ` · ${c.passport}` : ''}
                  </button>
                ))}
              </div>
            )}
            {search && filteredNP.length === 0 && <p className="text-[10px] text-slate-400 mt-1 px-1">Не найдено</p>}
          </div>
          <div>
            <label className="text-[11px] text-slate-500 font-semibold block mb-1">Кем приглашён</label>
            <select value={linkRef} onChange={e => setLinkRef(e.target.value)} className={inputCls}>
              {participantList.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <button type="submit" disabled={!pickedId}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
            Добавить в программу
          </button>
        </form>
      )}
    </div>
  );
};

/* ─── Rules / how-it-works card (light) ───────────────────────────── */
const RulesCard = ({ settings }) => {
  const rules = settings?.customRules?.filter(r => r.text?.trim()) || [];
  const tiers = settings?.tiers || [];
  const minDays = settings?.minStayDays || 10;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
      <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Info size={13} className="text-teal-500" /> Как работает</p>
      {tiers.length > 0 && (
        <div className="space-y-1.5">
          {tiers.map((t, i) => (
            <div key={t.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-2.5 py-1.5">
              <span className="text-[11px] text-slate-500"><span className="font-bold text-slate-700">{i + 1}.</span> {t.label}</span>
              <span className="text-[11px] font-black text-amber-600">+{t.bonusDays} д.</span>
            </div>
          ))}
          {settings?.resetAfterCycle && <p className="text-[10px] text-slate-400 px-1">↺ После цикла счётчик сбрасывается</p>}
        </div>
      )}
      {rules.length > 0 && (
        <div className="pt-2 border-t border-slate-100 space-y-1.5">
          {rules.map((r, i) => (
            <p key={r.id} className="flex items-start gap-1.5 text-[11px] text-slate-500 leading-relaxed">
              <span className="text-teal-500 font-bold shrink-0">{i + 1}.</span>{r.text}
            </p>
          ))}
        </div>
      )}
      <p className="text-[10px] text-slate-400 border-t border-slate-100 pt-2">
        Мин. проживание: <span className="text-slate-700 font-semibold">{minDays} дн.</span>
        {settings?.maxBonusDays > 0 && <> · Лимит: <span className="text-slate-700 font-semibold">{settings.maxBonusDays} д.</span></>}
        {settings?.bonusExpiryDays > 0 && <> · Истекают через <span className="text-slate-700 font-semibold">{settings.bonusExpiryDays} дн.</span></>}
      </p>
    </div>
  );
};

/* ─── Settings Modal (light) ──────────────────────────────────────── */
const SettingsModal = ({ settings, onClose, onSave, saving, patchSettings, addTier, updateTier, removeTier, moveTier, addRule, updateRule, removeRule }) => {
  const [tab, setTab] = useState('general');
  const TABS = [
    { id: 'general', label: '⚙️ Основные' },
    { id: 'tiers', label: '🏆 Тиры' },
    { id: 'rules', label: '📋 Правила' },
  ];
  const lbl = 'block text-[11px] text-slate-500 font-semibold mb-1.5';

  return (
    <div className="modal-centered fixed inset-0 z-[200] flex items-center justify-center p-4 pb-[84px] sm:pb-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col" style={{ maxHeight: '88vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">⚙️ Настройки бонусной программы</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>

        <div className="flex px-6 pt-4 gap-1 shrink-0">
          {TABS.map(tt => (
            <button key={tt.id} onClick={() => setTab(tt.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${tab === tt.id ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'text-slate-400 border border-transparent hover:bg-slate-50'}`}>
              {tt.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {tab === 'general' && (
            <div className="space-y-4">
              <label className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Программа активна</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Если выключить — новые участники не добавляются</p>
                </div>
                <button type="button" onClick={() => patchSettings({ programActive: !settings.programActive })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${settings.programActive ? 'bg-teal-500' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.programActive ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </label>
              <div>
                <label className={lbl}>Название программы</label>
                <input value={settings.programName} onChange={e => patchSettings({ programName: e.target.value })} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Мин. дней для подтверждения</label>
                  <input type="number" min={1} max={365} value={settings.minStayDays}
                    onChange={e => patchSettings({ minStayDays: parseInt(e.target.value) || 10 })} className={inputCls} />
                </div>
                <div>
                  <label className={lbl}>Макс. бонусов на гостя (0=∞)</label>
                  <input type="number" min={0} max={9999} value={settings.maxBonusDays}
                    onChange={e => patchSettings({ maxBonusDays: parseInt(e.target.value) || 0 })} className={inputCls} />
                </div>
                <div>
                  <label className={lbl}>Срок действия бонусов (0=∞)</label>
                  <input type="number" min={0} max={9999} value={settings.bonusExpiryDays}
                    onChange={e => patchSettings({ bonusExpiryDays: parseInt(e.target.value) || 0 })} className={inputCls} />
                </div>
                <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                  <input type="checkbox" checked={settings.resetAfterCycle}
                    onChange={e => patchSettings({ resetAfterCycle: e.target.checked })} className="w-4 h-4 accent-teal-500" />
                  <span className="text-[11px] text-slate-600 leading-tight">Сбрасывать счётчик после цикла тиров</span>
                </label>
              </div>
            </div>
          )}

          {tab === 'tiers' && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Каждый тир — порядковый реферал в цикле. После последнего тира счётчик сбрасывается (если включено) и цикл повторяется.
              </p>
              {settings.tiers.map((tier, idx) => (
                <div key={tier.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-3">
                  <div className="flex flex-col gap-0.5">
                    <button type="button" onClick={() => moveTier(tier.id, -1)} disabled={idx === 0}
                      className="p-0.5 hover:bg-slate-200 rounded-lg text-slate-400 disabled:opacity-20 transition-colors"><ChevronUp size={13} /></button>
                    <button type="button" onClick={() => moveTier(tier.id, 1)} disabled={idx === settings.tiers.length - 1}
                      className="p-0.5 hover:bg-slate-200 rounded-lg text-slate-400 disabled:opacity-20 transition-colors"><ChevronDown size={13} /></button>
                  </div>
                  <div className="w-6 h-6 shrink-0 rounded-full bg-teal-100 text-teal-700 text-[10px] font-bold flex items-center justify-center">{idx + 1}</div>
                  <input value={tier.label} onChange={e => updateTier(tier.id, { label: e.target.value })} placeholder="Название тира"
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-400 transition" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">+дней:</span>
                    <input type="number" min={1} max={365} value={tier.bonusDays}
                      onChange={e => updateTier(tier.id, { bonusDays: parseInt(e.target.value) || 1 })}
                      className="w-14 bg-white border border-slate-300 rounded-xl px-2 py-1.5 text-xs text-amber-600 font-bold text-center focus:outline-none focus:ring-1 focus:ring-amber-400 transition" />
                  </div>
                  <button type="button" onClick={() => removeTier(tier.id)} disabled={settings.tiers.length <= 1}
                    className="p-1.5 rounded-xl hover:bg-rose-50 text-rose-400 hover:text-rose-500 disabled:opacity-20 transition-colors"><Trash2 size={13} /></button>
                </div>
              ))}
              <button type="button" onClick={addTier}
                className="w-full py-2 rounded-2xl border border-dashed border-slate-300 hover:border-teal-400 text-slate-400 hover:text-teal-600 text-xs font-medium flex items-center justify-center gap-2 transition-all">
                <Plus size={13} /> Добавить тир
              </button>
            </div>
          )}

          {tab === 'rules' && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-400">Эти правила отображаются в карточке «Как работает».</p>
              {settings.customRules.map((rule, idx) => (
                <div key={rule.id} className="flex gap-2 items-start">
                  <span className="mt-2 text-[11px] font-bold text-teal-500 shrink-0 w-5 text-center">{idx + 1}.</span>
                  <textarea value={rule.text} rows={2} onChange={e => updateRule(rule.id, e.target.value)} placeholder="Текст правила…"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-400 transition resize-none" />
                  <button type="button" onClick={() => removeRule(rule.id)}
                    className="mt-1.5 p-1.5 rounded-xl hover:bg-rose-50 text-rose-400 hover:text-rose-500 transition-colors"><Trash2 size={13} /></button>
                </div>
              ))}
              <button type="button" onClick={addRule}
                className="w-full py-2 rounded-2xl border border-dashed border-slate-300 hover:border-teal-400 text-slate-400 hover:text-teal-600 text-xs font-medium flex items-center justify-center gap-2 transition-all">
                <Plus size={13} /> Добавить правило
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm transition-colors">Отмена</button>
          <button onClick={() => onSave(settings)} disabled={saving}
            className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-50 active:scale-95 shadow-sm shadow-teal-200">
            <Save size={14} />{saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Flatten tree for list view ──────────────────────────────────── */
const flattenTree = (nodes) => {
  const out = [];
  const walk = (list, level) => {
    (list || []).forEach(n => {
      if (!n.isVirtual) out.push({ node: n, level });
      walk(n.children, n.isVirtual ? 1 : level + 1);
    });
  };
  walk(nodes, 0);
  return out;
};

/* ─── Main ────────────────────────────────────────────────────────── */
const ReferralView = ({ clients = [], guests = [], hostelId, showNotification, currentUser }) => {
  const settingsMgr = useReferralSettings(showNotification, hostelId);
  const { settings, saving } = settingsMgr;

  const {
    nodes,
    addReferralClient, linkExistingClient,
    confirmTenDayStay, redeemBonusDays, addBonusDays, resetBonuses,
    extendStayWithBonus, removeFromProgram,
    getParticipantList, getNonParticipants, getStats,
  } = useReferralSystem({ clients, guests, hostelId, showNotification, settings });

  const [selectedId, setSelectedId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [view, setView] = useState('list');           // 'list' | 'tree'
  const [addOpen, setAddOpen] = useState(false);      // модалка «Добавить участника»
  const [infoOpen, setInfoOpen] = useState(false);    // модалка «Как работает»
  const [statusFilter, setStatusFilter] = useState('all'); // all | bonus | pending | confirmed
  const [listSearch, setListSearch] = useState('');
  const [treeScale, setTreeScale] = useState(1);

  const stats = getStats();
  const participantList = getParticipantList();
  const nonParticipants = getNonParticipants();
  const canvasRef = useRef(null);
  const lastPinchDist = useRef(null);

  const handlers = {
    onConfirm: confirmTenDayStay,
    onRedeem: redeemBonusDays,
    onAddBonus: addBonusDays,
    onResetBonus: resetBonuses,
    onExtendStay: extendStayWithBonus,
    onRemove: removeFromProgram,
  };

  const hasParticipants = nodes[0]?.children?.length > 0;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super';

  const allFlat = useMemo(() => flattenTree(nodes), [nodes]);
  const filterCounts = useMemo(() => ({
    all: allFlat.length,
    bonus: allFlat.filter(({ node }) => (node.bonusDays || 0) > 0).length,
    pending: allFlat.filter(({ node }) => !node.referralConfirmed).length,
    confirmed: allFlat.filter(({ node }) => node.referralConfirmed).length,
  }), [allFlat]);

  const flatList = useMemo(() => {
    let list = allFlat;
    if (statusFilter === 'bonus')     list = list.filter(({ node }) => (node.bonusDays || 0) > 0);
    if (statusFilter === 'pending')   list = list.filter(({ node }) => !node.referralConfirmed);
    if (statusFilter === 'confirmed') list = list.filter(({ node }) => node.referralConfirmed);
    const q = listSearch.trim().toLowerCase();
    if (q) list = list.filter(({ node }) => getDisplayName(node).toLowerCase().includes(q));
    return [...list].sort((a, b) => (b.node.bonusDays || 0) - (a.node.bonusDays || 0) || getDisplayName(a.node).localeCompare(getDisplayName(b.node)));
  }, [allFlat, statusFilter, listSearch]);

  const clampScale = (s) => Math.min(2.5, Math.max(0.3, s));
  const handleCanvasWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); setTreeScale(s => clampScale(s - e.deltaY * 0.0012)); }
  }, []);
  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (lastPinchDist.current !== null) setTreeScale(s => clampScale(s + (d - lastPinchDist.current) * 0.006));
      lastPinchDist.current = d;
    }
  }, []);
  const handleTouchEnd = useCallback(() => { lastPinchDist.current = null; }, []);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || view !== 'tree') return;
    el.addEventListener('wheel', handleCanvasWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleCanvasWheel);
  }, [handleCanvasWheel, view]);

  const hostelBadge = hostelId && hostelId !== 'all'
    ? (hostelId === 'hostel1' ? 'Хостел №1' : hostelId === 'hostel2' ? 'Хостел №2' : hostelId)
    : null;

  const FILTERS = [
    { id: 'all',       label: 'Все',           count: filterCounts.all },
    { id: 'bonus',     label: '🎁 С бонусами', count: filterCounts.bonus },
    { id: 'pending',   label: '⏳ Ожидают',    count: filterCounts.pending },
    { id: 'confirmed', label: '✓ Подтверждены', count: filterCounts.confirmed },
  ];

  return (
    <div className="min-h-full bg-slate-50 flex flex-col">
      {/* ── Шапка: название + статы + действия ── */}
      <div className="shrink-0 px-4 md:px-6 pt-4 pb-3 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center text-lg shadow-sm shadow-teal-200 shrink-0">🎁</span>
            <div className="min-w-0">
              <h1 className="text-lg font-black text-slate-800 leading-tight truncate flex items-center gap-2">
                {settings.programName}
                {!settings.programActive && <span className="text-[10px] bg-rose-50 text-rose-500 border border-rose-200 px-2 py-0.5 rounded-full font-semibold shrink-0">Выключена</span>}
              </h1>
              <p className="text-slate-400 text-[11px] flex items-center gap-1.5">
                Реферальная программа
                {hostelBadge && <span className="bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-px rounded-full font-semibold text-[9px]">{hostelBadge}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setInfoOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-teal-300 hover:text-teal-600 text-slate-500 text-xs font-semibold transition-all shadow-sm active:scale-95">
              <Info size={14} /> <span className="hidden sm:inline">Как работает</span>
            </button>
            {isAdmin && (
              <button onClick={() => setShowSettings(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-teal-300 hover:text-teal-600 text-slate-500 text-xs font-semibold transition-all shadow-sm active:scale-95">
                <Settings size={14} /> <span className="hidden sm:inline">Настройки</span>
              </button>
            )}
            <button onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm shadow-teal-200 transition-all active:scale-95 hover:-translate-y-px">
              <UserPlus size={14} /> Участник
            </button>
          </div>
        </div>

        {/* Статы — компактные чипы */}
        <div className="flex items-center gap-2 flex-wrap mt-3">
          {[
            { icon: Users,        value: stats.totalGuests,      label: 'участников',       tint: 'bg-teal-50 text-teal-700 border-teal-200' },
            { icon: CheckCircle2, value: stats.confirmedGuests,  label: 'подтверждено',      tint: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { icon: Clock,        value: stats.pendingGuests,    label: 'ожидают',           tint: 'bg-amber-50 text-amber-700 border-amber-200' },
            { icon: Gift,         value: stats.totalBonusPending, label: 'бонусов доступно', tint: 'bg-orange-50 text-orange-700 border-orange-200' },
            { icon: Award,        value: stats.totalBonusEarned, label: 'заработано',        tint: 'bg-violet-50 text-violet-700 border-violet-200' },
          ].map(({ icon: Icon, value, label, tint }) => (
            <div key={label} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold ${tint}`}>
              <Icon size={13} />
              <span className="font-black">{value}</span>
              <span className="opacity-70 font-medium hidden sm:inline">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Тулбар: фильтры + поиск + вид ── */}
      <div className="shrink-0 px-4 md:px-6 py-2.5 flex items-center gap-2 flex-wrap border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        {view === 'list' && (
          <div className="flex items-center bg-slate-100/80 rounded-xl p-1 gap-0.5 overflow-x-auto scrollbar-hide">
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setStatusFilter(f.id)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all active:scale-95
                  ${statusFilter === f.id ? 'bg-white text-teal-700 shadow-sm ring-1 ring-slate-200/80' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/60'}`}>
                {f.label}
                <span className={`text-[9px] px-1 py-px rounded-full font-black ${statusFilter === f.id ? 'bg-teal-50 text-teal-600' : 'bg-slate-200 text-slate-500'}`}>{f.count}</span>
              </button>
            ))}
          </div>
        )}

        {view === 'list' && (
          <div className="relative flex-1 min-w-[140px] max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={listSearch} onChange={e => setListSearch(e.target.value)} placeholder="Поиск…"
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition" />
          </div>
        )}

        {view === 'tree' && (
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
            <button onClick={() => setTreeScale(s => clampScale(s - 0.1))} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"><ZoomOut size={13} /></button>
            <span className="text-[11px] font-bold text-slate-500 w-10 text-center">{Math.round(treeScale * 100)}%</span>
            <button onClick={() => setTreeScale(s => clampScale(s + 0.1))} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"><ZoomIn size={13} /></button>
            {treeScale !== 1 && <button onClick={() => setTreeScale(1)} className="ml-1 px-2 h-6 flex items-center rounded-lg hover:bg-slate-100 text-slate-400 text-[10px]">Сброс</button>}
          </div>
        )}
        {view === 'tree' && (
          <div className="hidden md:flex items-center gap-2.5 px-2">
            {LEVEL_COLORS.map((c, i) => (
              <span key={i} className="flex items-center gap-1 text-[10px] text-slate-400">
                <span className={`w-2 h-2 rounded-sm ${c.dot}`} /> {i === 0 ? 'корень' : `ур.${i}`}
              </span>
            ))}
          </div>
        )}

        <div className="ml-auto flex rounded-xl overflow-hidden border border-slate-200 bg-slate-100 p-1 gap-1">
          {[['list', 'Список', ListIcon], ['tree', 'Дерево', Network]].map(([v, label, Icon]) => (
            <button key={v} onClick={() => setView(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${view === v ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-400'}`}>
              <Icon size={13} /> <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Контент ── */}
      <div ref={canvasRef} onTouchMove={view === 'tree' ? handleTouchMove : undefined} onTouchEnd={view === 'tree' ? handleTouchEnd : undefined}
        style={view === 'tree' ? { touchAction: 'pan-x pan-y' } : undefined}
        className="flex-1 overflow-auto p-4 md:p-6">
        {!hasParticipants ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl mb-3">🌱</span>
            <p className="text-slate-500 font-semibold text-sm">Пока нет участников</p>
            <button onClick={() => setAddOpen(true)}
              className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold shadow-sm shadow-teal-200 transition-all active:scale-95">
              <UserPlus size={15} /> Добавить первого участника
            </button>
          </div>
        ) : view === 'list' ? (
          <div className="max-w-3xl mx-auto space-y-2">
            {flatList.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-10">Ничего не найдено</p>
            ) : flatList.map(({ node, level }) => (
              <ListRow key={node.id} node={node} level={level}
                expanded={expandedId === node.id}
                onToggle={() => setExpandedId(id => id === node.id ? null : node.id)}
                settings={settings} guests={guests} handlers={handlers} />
            ))}
          </div>
        ) : (
          <div style={{ transform: `scale(${treeScale})`, transformOrigin: 'top left', transition: 'transform 0.1s ease-out' }}>
            <div className="flex items-start gap-10 flex-wrap pb-16">
              {nodes.map(root => (
                <TreeBranch key={root.id} node={root} level={0}
                  selectedId={selectedId} onSelect={setSelectedId}
                  settings={settings} guests={guests} handlers={handlers} />
              ))}
            </div>
            <span className="text-[10px] text-slate-400 block mt-2">Ctrl+колесо / щипок — масштаб</span>
          </div>
        )}
      </div>

      {/* ── Модалка «Добавить участника» ── */}
      {addOpen && (
        <div className="modal-centered fixed inset-0 z-[150] flex items-center justify-center p-3 pb-[84px] sm:pb-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={e => e.target === e.currentTarget && setAddOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5"><UserPlus size={15} className="text-teal-500" /> Добавить участника</p>
              <button onClick={() => setAddOpen(false)} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>
            <AddPanel participantList={participantList} nonParticipants={nonParticipants}
              onAddNew={(n, r) => { addReferralClient(n, r); }}
              onLinkExisting={(c, r) => { linkExistingClient(c, r); setAddOpen(false); }} />
          </div>
        </div>
      )}

      {/* ── Модалка «Как работает» ── */}
      {infoOpen && (
        <div className="modal-centered fixed inset-0 z-[150] flex items-center justify-center p-3 pb-[84px] sm:pb-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={e => e.target === e.currentTarget && setInfoOpen(false)}>
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="relative">
              <button onClick={() => setInfoOpen(false)}
                className="absolute top-3 right-3 z-10 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400"><X size={18} /></button>
              <RulesCard settings={settings} />
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal settings={settings} saving={saving}
          onClose={() => setShowSettings(false)}
          onSave={async (s) => { await settingsMgr.saveSettings(s); setShowSettings(false); }}
          patchSettings={settingsMgr.patchSettings}
          addTier={settingsMgr.addTier} updateTier={settingsMgr.updateTier} removeTier={settingsMgr.removeTier} moveTier={settingsMgr.moveTier}
          addRule={settingsMgr.addRule} updateRule={settingsMgr.updateRule} removeRule={settingsMgr.removeRule} />
      )}
    </div>
  );
};

export default ReferralView;
