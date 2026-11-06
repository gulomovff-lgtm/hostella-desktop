/**
 * SessionsView — отображение активных сессий для супер-администратора.
 * Показывает каждую сессию с устройством, временем входа, активностью.
 * Администратор может принудительно завершить сессию ("Выгнать").
 */
import React, { useState, useMemo } from 'react';
import { Monitor, Smartphone, Globe, Clock, UserX, RefreshCw, Wifi, WifiOff, Trash2, MapPin } from 'lucide-react';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../../firebase';
import TRANSLATIONS from '../../constants/translations';

const getDeviceIcon = (deviceInfo) => {
  if (!deviceInfo) return Globe;
  if (deviceInfo.browser === 'Electron App') return Monitor;
  if (deviceInfo.os === 'Android' || deviceInfo.os === 'iOS') return Smartphone;
  return Monitor;
};

const formatTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/** Считает сессию "неактивной" если lastSeen > 2 минут назад */
const isStale = (lastSeen) => {
  if (!lastSeen) return true;
  return Date.now() - new Date(lastSeen).getTime() > 2 * 60 * 1000;
};

/** Сессия считается "зависшей" (устаревшей) если lastSeen > 10 минут или нет активности */
const isAbandoned = (lastSeen) => {
  if (!lastSeen) return true;
  return Date.now() - new Date(lastSeen).getTime() > 10 * 60 * 1000;
};

const SessionsView = ({ sessions = [], users = [], lang = 'ru' }) => {
  const t = (k) => TRANSLATIONS[lang]?.[k] || k;
  const HOSTELS = { hostel1: t('svHostel1'), hostel2: t('svHostel2'), all: t('svBoth') };
  const [forcingOut, setForcingOut] = useState(null);
  const [filterActive, setFilterActive] = useState(true);
  const [filterHostel, setFilterHostel] = useState('');
  const [closingStale, setClosingStale] = useState(false);

  const displayed = useMemo(() => {
    let list = [...sessions];
    if (filterActive) list = list.filter(s => s.active);
    if (filterHostel) list = list.filter(s => s.hostelId === filterHostel);
    return list.sort((a, b) => new Date(b.loginAt) - new Date(a.loginAt));
  }, [sessions, filterActive, filterHostel]);

  const onlineCount = useMemo(
    () => sessions.filter(s => s.active && !isStale(s.lastSeen)).length,
    [sessions]
  );
  const activeCount = useMemo(() => sessions.filter(s => s.active).length, [sessions]);

  /** Количество зависших сессий (активных, но без хартбита > 10 мин) */
  const staleCount = useMemo(
    () => sessions.filter(s => s.active && isAbandoned(s.lastSeen)).length,
    [sessions]
  );

  const handleForceLogout = async (session) => {
    const user = users.find(u => u.id === session.userId || u.login === session.userId);
    if (!user?.id) return;
    setForcingOut(session.id);
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'users', user.id), {
        forceLogoutAfter: new Date().toISOString(),
      });
    } catch (e) {
      console.error('[sessions] force logout failed:', e);
    }
    setForcingOut(null);
  };

  /** Закрыть все зависшие сессии (active=true, lastSeen > 10 мин) */
  const handleCloseStale = async () => {
    const toClose = sessions.filter(s => s.active && isAbandoned(s.lastSeen));
    if (!toClose.length) return;
    setClosingStale(true);
    try {
      // Firestore batch: макс 500 операций за batch
      const chunks = [];
      for (let i = 0; i < toClose.length; i += 490) chunks.push(toClose.slice(i, i + 490));
      const now = new Date().toISOString();
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        for (const s of chunk) {
          batch.update(doc(db, ...PUBLIC_DATA_PATH, 'sessions', s.id), {
            active: false,
            logoutAt: now,
          });
        }
        await batch.commit();
      }
    } catch (e) {
      console.error('[sessions] close stale failed:', e);
    }
    setClosingStale(false);
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Monitor size={20} className="text-indigo-500" /> {t('svTitle')}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="font-bold text-emerald-600">{onlineCount}</span> {t('svOnline')}
            &nbsp;·&nbsp;
            <span className="font-bold text-slate-700">{activeCount}</span> {t('svActiveLower')}
            &nbsp;·&nbsp;
            {t('svTotalRecords').replace('{n}', sessions.length)}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {staleCount > 0 && (
            <button
              onClick={handleCloseStale}
              disabled={closingStale}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 transition-colors"
              title={t('svCloseStaleTitle')}
            >
              {closingStale
                ? <RefreshCw size={12} className="animate-spin" />
                : <Trash2 size={12} />}
              {t('svCloseStale').replace('{n}', staleCount)}
            </button>
          )}
          <select
            value={filterHostel}
            onChange={e => setFilterHostel(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">{t('expAllHostels')}</option>
            <option value="hostel1">{t('svHostel1')}</option>
            <option value="hostel2">{t('svHostel2')}</option>
          </select>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterActive}
              onChange={e => setFilterActive(e.target.checked)}
              className="rounded accent-indigo-600"
            />
            {t('cadOnlyActive')}
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {displayed.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-2">📱</div>
            <div className="text-slate-400 font-semibold">{t('svNoSessions')}</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {displayed.map(s => {
              const DevIcon = getDeviceIcon(s.deviceInfo);
              const stale   = isStale(s.lastSeen);
              const online  = s.active && !stale;
              const role    = s.role === 'admin' ? t('admin')
                            : s.role === 'cashier' ? t('cashier')
                            : s.role === 'super' ? t('svSuper') : s.role;

              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/40 transition-colors">
                  {/* Device icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 
                    ${online       ? 'bg-emerald-100 text-emerald-600'
                    : s.active     ? 'bg-amber-100 text-amber-500'
                                   : 'bg-slate-100 text-slate-400'}`}>
                    <DevIcon size={18} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">{s.userName}</span>
                      <span className="text-[11px] text-slate-400 font-medium">{role}</span>
                      {online ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                          <Wifi size={10} /> {t('svOnline')}
                        </span>
                      ) : s.active ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-100 flex items-center gap-1">
                          <WifiOff size={10} /> {t('svNoActivity')}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200">
                          ⚫ {t('svLoggedOut')}
                        </span>
                      )}
                      {s.hostelId && HOSTELS[s.hostelId] && (
                        <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                          {HOSTELS[s.hostelId]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
                      {s.deviceInfo?.browser && (
                        <span>🌐 {s.deviceInfo.browser}</span>
                      )}
                      {s.deviceInfo?.os && (
                        <span>💻 {s.deviceInfo.os}</span>
                      )}
                      {s.networkInfo?.ip && (
                        <span className="font-mono">{s.networkInfo.ip}</span>
                      )}
                      {(s.networkInfo?.city || s.networkInfo?.country) && (
                        <span className="flex items-center gap-1">
                          <MapPin size={10} />
                          {[s.networkInfo.city, s.networkInfo.region, s.networkInfo.country]
                            .filter(Boolean).join(', ')}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {t('svLoginLabel')}: {formatTime(s.loginAt)}
                      </span>
                      {s.lastSeen && (
                        <span>{t('svActivityLabel')}: {formatTime(s.lastSeen)}</span>
                      )}
                      {s.logoutAt && (
                        <span>{t('svLogoutLabel')}: {formatTime(s.logoutAt)}</span>
                      )}
                    </div>
                  </div>

                  {/* Force logout */}
                  {s.active && (
                    <button
                      onClick={() => handleForceLogout(s)}
                      disabled={forcingOut === s.id}
                      title={t('svForceEndTitle')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 transition-colors shrink-0"
                    >
                      {forcingOut === s.id
                        ? <RefreshCw size={12} className="animate-spin" />
                        : <UserX size={12} />}
                      {t('svKick')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 text-center">
        {t('svFooterNote')}
      </p>
    </div>
  );
};

export default SessionsView;
