import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useReferralSystem } from '../../hooks/useReferralSystem';
import { useReferralSettings } from '../../hooks/useReferralSettings';
import { Search, Settings, X, Plus, Trash2, ChevronUp, ChevronDown, Save, ToggleLeft, ToggleRight, Gift, RotateCcw } from 'lucide-react';

/* --- palette by depth --------------------------------------------- */
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
  if (node.isVirtual) return '??';
  const name = getDisplayName(node);
  return name.trim().split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';
};

const fmtDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
};

/* --- Stat chip ---------------------------------------------------- */
const StatChip = ({ label, value, sub }) => (
  <div className="flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-2xl px-4 py-3 min-w-[80px]">
    <span className="text-xl font-bold text-white leading-none">{value}</span>
    {sub && <span className="text-[10px] text-emerald-400 font-semibold mt-0.5">{sub}</span>}
    <span className="text-[10px] text-slate-400 mt-1 text-center leading-tight">{label}</span>
  </div>
);

/* --- Progress bar ------------------------------------------------- */
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

/* --- Settings Modal ---------------------------------------------- */
const SettingsModal = ({ settings, onClose, onSave, saving,
  patchSettings, addTier, updateTier, removeTier, moveTier,
  addRule, updateRule, removeRule }) => {
  const [tab, setTab] = useState('general');

  const TABS = [
    { id: 'general', label: '?? Основные' },
    { id: 'tiers',   label: '?? Бонусные тиры' },
    { id: 'rules',   label: '?? Правила' },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">?? Настройки бонусной программы</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-4 gap-1 flex-shrink-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: tab === t.id ? 'rgba(139,92,246,0.25)' : 'transparent',
                color: tab === t.id ? '#c4b5fd' : '#64748b',
                border: tab === t.id ? '1px solid rgba(139,92,246,0.4)' : '1px solid transparent',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* -- General -- */}
          {tab === 'general' && (
            <div className="space-y-4">
              <label className="flex items-center justify-between p-3 bg-slate-800/60 border border-white/8 rounded-2xl cursor-pointer hover:border-white/20 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-white">Программа активна</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Если выключить — новые участники не добавляются</p>
                </div>
                <button type="button" onClick={() => patchSettings({ programActive: !settings.programActive })}
                  className="transition-transform active:scale-95">
                  {settings.programActive
                    ? <ToggleRight size={32} className="text-violet-400" />
                    : <ToggleLeft size={32} className="text-slate-500" />}
                </button>
              </label>

              <div>
                <label className="block text-[11px] text-slate-400 font-medium uppercase tracking-wide mb-1.5">Название программы</label>
                <input value={settings.programName}
                  onChange={e => patchSettings({ programName: e.target.value })}
                  className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 font-medium uppercase tracking-wide mb-1.5">Мин. дней для подтверждения</label>
                  <input type="number" min={1} max={365} value={settings.minStayDays}
                    onChange={e => patchSettings({ minStayDays: parseInt(e.target.value) || 10 })}
                    className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 font-medium uppercase tracking-wide mb-1.5">Макс. бонусов на гостя (0=?)</label>
                  <input type="number" min={0} max={9999} value={settings.maxBonusDays}
                    onChange={e => patchSettings({ maxBonusDays: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 font-medium uppercase tracking-wide mb-1.5">Срок действия бонусов (дней, 0=?)</label>
                  <input type="number" min={0} max={9999} value={settings.bonusExpiryDays}
                    onChange={e => patchSettings({ bonusExpiryDays: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition" />
                </div>
                <label className="flex items-center gap-2 p-3 bg-slate-800/60 border border-white/8 rounded-xl cursor-pointer hover:border-white/20 transition-colors">
                  <input type="checkbox" checked={settings.resetAfterCycle}
                    onChange={e => patchSettings({ resetAfterCycle: e.target.checked })}
                    className="w-4 h-4 accent-violet-500" />
                  <span className="text-xs text-slate-300 leading-tight">Сбрасывать счётчик после полного цикла тиров</span>
                </label>
              </div>
            </div>
          )}

          {/* -- Tiers -- */}
          {tab === 'tiers' && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Каждый тир соответствует порядковому рефералу в цикле. После прохождения последнего тира счётчик сбрасывается (если включено) и цикл повторяется.
              </p>
              {settings.tiers.map((tier, idx) => (
                <div key={tier.id} className="flex items-center gap-2 bg-slate-800/60 border border-white/8 rounded-2xl p-3">
                  <div className="flex flex-col gap-0.5">
                    <button type="button" onClick={() => moveTier(tier.id, -1)} disabled={idx === 0}
                      className="p-0.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white disabled:opacity-20 transition-colors">
                      <ChevronUp size={13} />
                    </button>
                    <button type="button" onClick={() => moveTier(tier.id, 1)} disabled={idx === settings.tiers.length - 1}
                      className="p-0.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white disabled:opacity-20 transition-colors">
                      <ChevronDown size={13} />
                    </button>
                  </div>
                  <div className="w-6 h-6 flex-shrink-0 rounded-full bg-violet-600/30 text-violet-400 text-[10px] font-bold flex items-center justify-center">{idx + 1}</div>
                  <input value={tier.label} onChange={e => updateTier(tier.id, { label: e.target.value })}
                    placeholder="Название тира"
                    className="flex-1 bg-slate-700/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">+дней:</span>
                    <input type="number" min={1} max={365} value={tier.bonusDays}
                      onChange={e => updateTier(tier.id, { bonusDays: parseInt(e.target.value) || 1 })}
                      className="w-14 bg-slate-700/60 border border-white/10 rounded-xl px-2 py-1.5 text-xs text-amber-300 font-bold text-center focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition" />
                  </div>
                  <button type="button" onClick={() => removeTier(tier.id)} disabled={settings.tiers.length <= 1}
                    className="p-1.5 rounded-xl hover:bg-red-500/20 text-red-400/60 hover:text-red-400 disabled:opacity-20 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addTier}
                className="w-full py-2 rounded-2xl border border-dashed border-white/20 hover:border-violet-500/50 text-slate-400 hover:text-violet-400 text-xs font-medium flex items-center justify-center gap-2 transition-all">
                <Plus size={13} /> Добавить тир
              </button>
              <div className="bg-slate-800/40 border border-amber-500/20 rounded-2xl p-3">
                <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide mb-1.5">Предпросмотр цикла</p>
                <div className="flex flex-wrap gap-2">
                  {settings.tiers.map((t, i) => (
                    <div key={t.id} className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-2.5 py-1.5">
                      <span className="text-[10px] text-amber-300 font-semibold">{i + 1}.</span>
                      <span className="text-[10px] text-slate-300">{t.label}</span>
                      <span className="text-[10px] text-amber-400 font-bold">+{t.bonusDays}д</span>
                    </div>
                  ))}
                  {settings.resetAfterCycle && (
                    <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5">
                      <span className="text-[10px] text-slate-500">? сброс</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* -- Rules -- */}
          {tab === 'rules' && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-400">Эти правила отображаются гостям и сотрудникам в боковой панели программы.</p>
              {settings.customRules.map((rule, idx) => (
                <div key={rule.id} className="flex gap-2 items-start">
                  <span className="mt-2 text-[11px] font-bold text-violet-400 flex-shrink-0 w-5 text-center">{idx + 1}.</span>
                  <textarea value={rule.text} rows={2}
                    onChange={e => updateRule(rule.id, e.target.value)}
                    placeholder="Текст правила…"
                    className="flex-1 bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition resize-none" />
                  <button type="button" onClick={() => removeRule(rule.id)}
                    className="mt-1.5 p-1.5 rounded-xl hover:bg-red-500/20 text-red-400/60 hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addRule}
                className="w-full py-2 rounded-2xl border border-dashed border-white/20 hover:border-violet-500/50 text-slate-400 hover:text-violet-400 text-xs font-medium flex items-center justify-center gap-2 transition-all">
                <Plus size={13} /> Добавить правило
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/8 flex-shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 text-sm transition-colors">
            Отмена
          </button>
          <button onClick={() => onSave(settings)} disabled={saving}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-50 active:scale-95 shadow-lg shadow-violet-900/40">
            <Save size={14} />{saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* --- Redeem stepper ----------------------------------------------- */
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

/* --- Node card -------------------------------------------------- */
const NodeCard = ({ node, level, selectedId, onSelect, onConfirm, onRedeem, onRemove, settings,
                    onAddBonus, onResetBonus, onExtendStay, guests = [] }) => {
  const isVirtual  = !!node.isVirtual;
  const isSelected = selectedId === node.id;
  const col        = lc(level);
  const hasBonus   = (node.bonusDays || 0) > 0;
  const displayName = getDisplayName(node);
  const tiersCount  = settings?.tiers?.length || 2;

  const [addAmt, setAddAmt]             = useState(1);
  const [showExtend, setShowExtend]     = useState(false);
  const [extSearch, setExtSearch]       = useState('');
  const [extGuestId, setExtGuestId]     = useState('');
  const [extDays, setExtDays]           = useState(1);
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
    <div
      className={`relative cursor-pointer rounded-2xl transition-all duration-200 ring-2 select-none
        ${isSelected ? `${col.ring} shadow-2xl scale-[1.02]` : 'ring-white/0 hover:ring-white/20'}
        ${isVirtual ? 'w-56' : 'w-52'}`}
      onClick={() => onSelect(node.id === selectedId ? null : node.id)}
    >
      <div className="overflow-hidden rounded-2xl bg-slate-800/80 backdrop-blur-sm border border-white/8">
        <div className={`px-4 pt-3 pb-4 bg-gradient-to-br ${col.bg} relative`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-sm shadow-inner flex-shrink-0">
              {initials(node)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm leading-tight truncate">{displayName}</p>
              <p className="text-white/60 text-[10px] mt-0.5">
                {isVirtual ? 'Корень системы'
                  : node.referralConfirmed ? `? ${fmtDate(node.confirmedAt || node.createdAt)}`
                  : '? Ожидает подтверждения'}
              </p>
            </div>
          </div>
          {hasBonus && (
            <div className="absolute top-2 right-2 bg-amber-400 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
              +{node.bonusDays}д
            </div>
          )}
        </div>
        <div className="px-4 py-3 space-y-2.5">
          {!isVirtual && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-400">Рефералы до сброса</span>
                <span className="text-[11px] font-semibold text-slate-200">{node.referralsMade || 0}/{tiersCount}</span>
              </div>
              <ProgressBar value={node.referralsMade || 0} max={tiersCount} lineColor={col.line} />
            </div>
          )}
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>?? {(node.children || []).length} приглашено</span>
            {(node.totalBonusEarned || 0) > 0 && (
              <span className="text-emerald-400 font-medium">? {node.totalBonusEarned} зараб.</span>
            )}
          </div>
        </div>
      </div>

      {isSelected && (
        <div className="mt-1.5 rounded-2xl bg-slate-900/95 border border-white/10 p-3 space-y-2 shadow-2xl"
          onClick={e => e.stopPropagation()}>

          {!isVirtual && !node.referralConfirmed && (
            <button type="button" onClick={() => onConfirm(node.id)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors">
              ? Подтвердить {settings?.minStayDays || 10} дней
            </button>
          )}
          {!isVirtual && node.referralConfirmed && !hasBonus && (
            <p className="text-center text-[10px] text-emerald-500 font-medium">? Уже подтверждён</p>
          )}
          {hasBonus && <RedeemRow node={node} onRedeem={onRedeem} />}

          {!isVirtual && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 mr-1">Дней:</span>
              <button type="button" onClick={() => setAddAmt(a => Math.max(1, a-1))}
                className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-bold flex items-center justify-center">-</button>
              <span className="text-white text-xs font-bold w-6 text-center">{addAmt}</span>
              <button type="button" onClick={() => setAddAmt(a => a+1)}
                className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-bold flex items-center justify-center">+</button>
              <button type="button" onClick={() => onAddBonus?.(node.id, addAmt)}
                className="flex-1 py-1.5 px-2 rounded-xl bg-amber-500/30 hover:bg-amber-500/50 text-amber-300 text-xs font-semibold transition-colors">
                <Gift size={10} className="inline mr-1"/>Начислить
              </button>
              <button type="button" onClick={() => onResetBonus?.(node.id)}
                className="p-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors" title="Обнулить бонусы">
                <RotateCcw size={11}/>
              </button>
            </div>
          )}

          {!isVirtual && hasBonus && (
            <div>
              <button type="button" onClick={() => setShowExtend(v => !v)}
                className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl bg-orange-500/20 hover:bg-orange-500/35 text-orange-300 text-xs font-semibold transition-colors">
                <Gift size={11}/>Бонус: {node.bonusDays}д — {showExtend ? 'Скрыть' : 'Продлить проживание'}
              </button>
              {showExtend && (
                <form onSubmit={handleExtendSubmit} className="mt-2 space-y-2 bg-slate-800/60 rounded-xl p-2.5">
                  {!selectedGuest ? (
                    <div className="space-y-1">
                      <input value={extSearch}
                        onChange={e => { setExtSearch(e.target.value); setExtGuestId(''); }}
                        placeholder="Поиск гостя…"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-700 text-white text-[11px] placeholder-slate-400 border border-white/10 focus:outline-none focus:border-orange-400"
                      />
                      {searchGuests.length === 0 && (
                        <p className="text-[10px] text-slate-500 text-center">Нет активных гостей</p>
                      )}
                      <div className="space-y-0.5 max-h-24 overflow-y-auto">
                        {searchGuests.map(g => (
                          <button key={g.id} type="button"
                            onClick={() => { setExtGuestId(g.id); setExtSearch(g.fullName); }}
                            className="w-full text-left px-2 py-1 rounded-lg bg-white/5 hover:bg-orange-500/20 text-[11px] text-slate-200 transition-colors">
                            <span className="font-semibold">{g.fullName}</span>
                            <span className="ml-1.5 text-slate-400">выезд: {fmtDate(g.bonusCheckOutDate || g.checkOutDate)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-orange-300 font-semibold truncate flex-1">{selectedGuest.fullName}</span>
                      <span className="text-[10px] text-slate-400">выезд: {fmtDate(selectedGuest.bonusCheckOutDate || selectedGuest.checkOutDate)}</span>
                      <button type="button" onClick={() => { setExtGuestId(''); setExtSearch(''); }}
                        className="text-slate-400 hover:text-white ml-1"><X size={11}/></button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 shrink-0">Дней:</span>
                    <input type="number" min={1} max={node.bonusDays} value={extDays}
                      onChange={e => setExtDays(Math.min(node.bonusDays, Math.max(1, parseInt(e.target.value)||1)))}
                      className="w-14 px-2 py-1 rounded-lg bg-slate-700 text-white text-[11px] text-center border border-white/10 focus:outline-none focus:border-orange-400"
                    />
                    <span className="text-[10px] text-slate-500">макс {node.bonusDays}</span>
                  </div>
                  <button type="submit" disabled={!extGuestId}
                    className="w-full py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors">
                    Продлить проживание
                  </button>
                </form>
              )}
            </div>
          )}

          {!isVirtual && !confirmRemove && (
            <button type="button"
              onClick={() => setConfirmRemove(true)}
              className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl bg-red-500/20 hover:bg-red-500/40 text-red-400 text-xs font-medium transition-colors">
              ? Убрать из программы
            </button>
          )}
          {!isVirtual && confirmRemove && (
            <div className="rounded-xl bg-red-900/40 border border-red-500/40 px-3 py-2.5 space-y-2">
              <p className="text-xs text-red-300 text-center font-semibold">
                Убрать «{displayName}» из программы?
              </p>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => { onRemove(node.id); setConfirmRemove(false); }}
                  className="flex-1 py-1.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition-colors">
                  Да, убрать
                </button>
                <button type="button"
                  onClick={() => setConfirmRemove(false)}
                  className="flex-1 py-1.5 rounded-xl bg-slate-600 hover:bg-slate-500 text-white text-xs font-medium transition-colors">
                  Отмена
                </button>
              </div>
            </div>
          )}
          {isVirtual && (
            <p className="text-center text-slate-500 text-[10px]">Корневой узел</p>
          )}
        </div>
      )}
    </div>
  );
};

/* --- Tree branch -------------------------------------------------- */
const TreeBranch = ({ node, level = 0, selectedId, onSelect, onConfirm, onRedeem, onRemove, settings,
                      onAddBonus, onResetBonus, onExtendStay, guests }) => {
  const hasChildren = (node.children?.length || 0) > 0;
  const col = lc(level);
  const childCol = lc(level + 1);
  const shared = { selectedId, onSelect, onConfirm, onRedeem, onRemove, settings, onAddBonus, onResetBonus, onExtendStay, guests };

  return (
    <div className="flex flex-col items-center">
      <NodeCard node={node} level={level} {...shared} />
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
                <TreeBranch node={child} level={level + 1} {...shared} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* --- Add panel (новый или существующий клиент) -------------------- */
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

/* --- Legend ------------------------------------------------------- */
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

/* --- Rules -------------------------------------------------------- */
const RulesCard = ({ settings }) => {
  const rules = settings?.customRules?.filter(r => r.text?.trim()) || [];
  const tiers = settings?.tiers || [];
  const minDays = settings?.minStayDays || 10;
  return (
    <div className="bg-slate-800/60 border border-white/8 rounded-2xl p-4 space-y-3">
      <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
        {settings?.programName || 'Бонусная программа'} · Правила
      </p>
      {/* Tiers preview */}
      {tiers.length > 0 && (
        <div className="space-y-1">
          {tiers.map((t, i) => (
            <div key={t.id} className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400">{i + 1}. {t.label}</span>
              <span className="text-[10px] font-bold text-amber-400">+{t.bonusDays} д.</span>
            </div>
          ))}
          {settings?.resetAfterCycle && (
            <p className="text-[10px] text-slate-600">? цикл повторяется</p>
          )}
        </div>
      )}
      {/* Custom rules */}
      {rules.length > 0 && (
        <div className="pt-1 border-t border-white/5 space-y-1.5">
          {rules.map((r, i) => (
            <p key={r.id} className="flex items-start gap-1.5 text-[10px] text-slate-300 leading-relaxed">
              <span className="text-amber-400 font-bold flex-shrink-0">{i + 1}.</span>{r.text}
            </p>
          ))}
        </div>
      )}
      <p className="text-[10px] text-slate-500 border-t border-white/5 pt-2">
        Мин. проживание для подтверждения: <span className="text-white font-semibold">{minDays} дн.</span>
        {settings?.maxBonusDays > 0 && <> · Лимит: <span className="text-white font-semibold">{settings.maxBonusDays} д.</span></>}
        {settings?.bonusExpiryDays > 0 && <> · Истекают через: <span className="text-white font-semibold">{settings.bonusExpiryDays} дн.</span></>}
      </p>
    </div>
  );
};

/* --- Empty state -------------------------------------------------- */
const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-24 opacity-40">
    <span className="text-5xl mb-3">??</span>
    <p className="text-slate-400 text-sm">Добавьте первого участника через панель слева</p>
  </div>
);

/* --- Main --------------------------------------------------------- */
const ReferralView = ({ clients = [], guests = [], hostelId, showNotification, currentUser }) => {
  const settingsMgr = useReferralSettings(showNotification, hostelId);
  const { settings, saving } = settingsMgr;

  const {
    nodes,
    addReferralClient,
    linkExistingClient,
    confirmTenDayStay,
    redeemBonusDays,
    addBonusDays,
    resetBonuses,
    extendStayWithBonus,
    removeFromProgram,
    getParticipantList,
    getNonParticipants,
    getStats,
  } = useReferralSystem({ clients, guests, hostelId, showNotification, settings });

  const [selectedId,    setSelectedId]    = useState(null);
  const [showSettings,  setShowSettings]  = useState(false);
  const [mobileTab,     setMobileTab]     = useState('tree'); // 'tree' | 'add'
  const [treeScale,     setTreeScale]     = useState(1);
  const stats           = getStats();
  const participantList = getParticipantList();
  const nonParticipants = getNonParticipants();
  const wrapRef         = useRef(null);
  const canvasRef       = useRef(null);
  const lastPinchDist   = useRef(null);

  const hasParticipants = nodes[0]?.children?.length > 0;

  const clampScale = (s) => Math.min(2.5, Math.max(0.3, s));

  /* Ctrl+wheel zoom */
  const handleCanvasWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setTreeScale(s => clampScale(s - e.deltaY * 0.0012));
    }
  }, []);

  /* Pinch-to-zoom */
  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      if (lastPinchDist.current !== null) {
        const delta = d - lastPinchDist.current;
        setTreeScale(s => clampScale(s + delta * 0.006));
      }
      lastPinchDist.current = d;
    }
  }, []);

  const handleTouchEnd = useCallback(() => { lastPinchDist.current = null; }, []);

  /* Attach wheel listener with passive:false so we can preventDefault */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleCanvasWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleCanvasWheel);
  }, [handleCanvasWheel]);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super';

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

      {/* -- Top bar -- */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-white/5 bg-slate-900/80 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
              <span className="text-2xl">??</span>
              {settings.programName}
              {!settings.programActive && (
                <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-normal">Выключена</span>
              )}
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">Реферральная иерархия · привязана к базе клиентов
              {hostelId && hostelId !== 'all' && (
                <span className="ml-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-semibold text-[10px]">
                  {hostelId === 'hostel1' ? 'Хостел №1' : hostelId === 'hostel2' ? 'Хостел №2' : hostelId}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatChip label="Участников" value={stats.totalGuests} />
            <StatChip label="Подтверждено" value={stats.confirmedGuests}
              sub={stats.pendingGuests > 0 ? `${stats.pendingGuests} ожидает` : null} />
            <StatChip label="Бонусов" value={stats.totalBonusPending}
              sub={stats.totalBonusUsed > 0 ? `${stats.totalBonusUsed} исп.` : null} />
            <StatChip label="Заработано" value={stats.totalBonusEarned} />
            {isAdmin && (
              <button onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-800/80 border border-white/10 hover:border-violet-500/50 text-slate-400 hover:text-violet-400 text-xs font-medium transition-all self-center">
                <Settings size={14} /> Настройки
              </button>
            )}
          </div>
        </div>
      </div>

      {/* -- Mobile tab bar -- */}
      <div className="flex md:hidden flex-shrink-0 border-b border-white/5 bg-slate-900/80">
        <button
          onClick={() => setMobileTab('tree')}
          className="flex-1 py-3 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
          style={{ color: mobileTab === 'tree' ? '#c4b5fd' : '#475569', borderBottom: mobileTab === 'tree' ? '2px solid #8b5cf6' : '2px solid transparent' }}>
          ?? Дерево
        </button>
        <button
          onClick={() => setMobileTab('add')}
          className="flex-1 py-3 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
          style={{ color: mobileTab === 'add' ? '#c4b5fd' : '#475569', borderBottom: mobileTab === 'add' ? '2px solid #8b5cf6' : '2px solid transparent' }}>
          ?? Участники
        </button>
      </div>

      {/* -- Body -- */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <div className={`w-full md:w-72 flex-shrink-0 border-r border-white/5 p-4 flex-col gap-5 overflow-y-auto bg-slate-900/50 ${mobileTab === 'add' ? 'flex' : 'hidden md:flex'}`}>
          <div className="bg-slate-800/60 border border-white/8 rounded-2xl p-4">
            <p className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
              <span>??</span> Добавить участника
            </p>
            <AddPanel
              participantList={participantList}
              nonParticipants={nonParticipants}
              onAddNew={addReferralClient}
              onLinkExisting={linkExistingClient}
            />
          </div>
          <Legend />
          <RulesCard settings={settings} />
        </div>

        {/* Tree canvas */}
        <div
          ref={canvasRef}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: 'pan-x pan-y' }}
          className={`flex-1 overflow-auto p-4 md:p-8 bg-[radial-gradient(ellipse_at_top_left,_rgba(109,40,217,0.08)_0%,_transparent_60%)] ${mobileTab === 'tree' ? 'block' : 'hidden md:block'}`}
        >
          {/* Zoom controls */}
          <div className="flex items-center gap-2 mb-4 sticky top-0 z-10">
            <div className="flex items-center gap-1 bg-slate-800/90 border border-white/10 rounded-xl px-2 py-1 backdrop-blur-sm">
              <button
                onClick={() => setTreeScale(s => clampScale(s - 0.1))}
                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-300 text-sm font-bold transition-colors"
              >?</button>
              <span className="text-[11px] font-bold text-slate-400 w-10 text-center">{Math.round(treeScale * 100)}%</span>
              <button
                onClick={() => setTreeScale(s => clampScale(s + 0.1))}
                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-300 text-sm font-bold transition-colors"
              >+</button>
              {treeScale !== 1 && (
                <button
                  onClick={() => setTreeScale(1)}
                  className="ml-1 px-2 h-6 flex items-center rounded-lg hover:bg-white/10 text-slate-500 hover:text-slate-300 text-[10px] transition-colors"
                >Сброс</button>
              )}
            </div>
            <span className="text-[10px] text-slate-600 hidden md:block">Ctrl+колесо для зума</span>
            <span className="text-[10px] text-slate-600 md:hidden">Щипок для зума</span>
          </div>

          <div style={{ transform: `scale(${treeScale})`, transformOrigin: 'top left', transition: 'transform 0.1s ease-out' }}>
            {hasParticipants ? (
              <div className="flex items-start gap-10 flex-wrap pb-16">
                {nodes.map(root => (
                  <TreeBranch key={root.id} node={root} level={0}
                    selectedId={selectedId} onSelect={setSelectedId}
                    onConfirm={confirmTenDayStay}
                    onRedeem={redeemBonusDays}
                    onRemove={removeFromProgram}
                    onAddBonus={addBonusDays}
                    onResetBonus={resetBonuses}
                    onExtendStay={extendStayWithBonus}
                    guests={guests}
                    settings={settings}
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
                      onAddBonus={addBonusDays}
                      onResetBonus={resetBonuses}
                      onExtendStay={extendStayWithBonus}
                      guests={guests}
                      settings={settings}
                    />
                  ))}
                </div>
                <EmptyState />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          saving={saving}
          onClose={() => setShowSettings(false)}
          onSave={async (s) => { await settingsMgr.saveSettings(s); setShowSettings(false); }}
          patchSettings={settingsMgr.patchSettings}
          addTier={settingsMgr.addTier}
          updateTier={settingsMgr.updateTier}
          removeTier={settingsMgr.removeTier}
          moveTier={settingsMgr.moveTier}
          addRule={settingsMgr.addRule}
          updateRule={settingsMgr.updateRule}
          removeRule={settingsMgr.removeRule}
        />
      )}
    </div>
  );
};

export default ReferralView;
