/**
 * ClientVersionsView — телеметрия версий клиентов для admin/super.
 * Показывает, на какой версии каждое устройство и когда оно последний раз заходило.
 * Помогает удалённо понять, кто «застрял» на старой версии, без связи с пользователями.
 */
import React, { useState, useMemo } from 'react';
import { Monitor, Globe, Clock, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

const HOSTELS = { hostel1: 'Хостел №1', hostel2: 'Хостел №2', all: 'Оба' };

const formatTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// Сравнение версий "a.b.c": -1 если a<b, 0 если равны, 1 если a>b
const versionCmp = (a, b) => {
  const pa = String(a || '0').split('.').map(n => parseInt(n) || 0);
  const pb = String(b || '0').split('.').map(n => parseInt(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
};

const isStale = (lastSeen) => {
  if (!lastSeen) return true;
  return Date.now() - new Date(lastSeen).getTime() > 7 * 24 * 60 * 60 * 1000; // > 7 дней
};

const ClientVersionsView = ({ clientVersions = [] }) => {
  const [filterPlatform, setFilterPlatform] = useState('');

  // Максимальная (самая свежая) известная версия среди всех клиентов — эталон
  const latestVersion = useMemo(
    () => clientVersions.reduce((max, v) => versionCmp(v.appVersion, max) > 0 ? v.appVersion : max, '0.0.0'),
    [clientVersions]
  );

  const displayed = useMemo(() => {
    let list = [...clientVersions];
    if (filterPlatform) list = list.filter(v => v.platform === filterPlatform);
    return list.sort((a, b) => new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0));
  }, [clientVersions, filterPlatform]);

  const outdatedCount = useMemo(
    () => clientVersions.filter(v => versionCmp(v.appVersion, latestVersion) < 0).length,
    [clientVersions, latestVersion]
  );

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Monitor size={20} className="text-indigo-500" /> Версии клиентов
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Свежая версия: <span className="font-bold text-emerald-600">{latestVersion}</span>
            &nbsp;·&nbsp;
            <span className="font-bold text-amber-600">{outdatedCount}</span> на старой
            &nbsp;·&nbsp;
            {clientVersions.length} устройств
          </p>
        </div>
        <select
          value={filterPlatform}
          onChange={e => setFilterPlatform(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="">Все платформы</option>
          <option value="desktop">Десктоп</option>
          <option value="web">Веб</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {displayed.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-2">📊</div>
            <div className="text-slate-400 font-semibold">Нет данных о версиях</div>
            <div className="text-xs text-slate-400 mt-1">Записи появятся после входа клиентов в обновлённую версию</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {displayed.map(v => {
              const outdated = versionCmp(v.appVersion, latestVersion) < 0;
              const stale = isStale(v.lastSeenAt);
              const DevIcon = v.platform === 'desktop' ? Monitor : Globe;
              return (
                <div key={v.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/40 transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                    ${outdated ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    <DevIcon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">{v.name || v.login}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1
                        ${outdated ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                        {outdated ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
                        v{v.appVersion || '?'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {v.platform === 'desktop' ? 'Десктоп' : 'Веб'}
                      </span>
                      {v.hostelId && HOSTELS[v.hostelId] && (
                        <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                          {HOSTELS[v.hostelId]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
                      <span>👤 {v.login}</span>
                      {v.os && <span>💻 {v.os}</span>}
                      {v.buildTs && <span className="font-mono">build {v.buildTs}</span>}
                      <span className={`flex items-center gap-1 ${stale ? 'text-rose-400' : ''}`}>
                        <Clock size={11} /> {formatTime(v.lastSeenAt)}
                        {stale && ' (давно не заходил)'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 text-center">
        Версия пишется при входе и раз в 30 минут. «Свежая версия» — максимальная среди всех клиентов.
      </p>
    </div>
  );
};

export default ClientVersionsView;
