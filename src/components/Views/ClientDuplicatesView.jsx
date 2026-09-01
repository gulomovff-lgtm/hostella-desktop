/**
 * ClientDuplicatesView — ручной разбор дубликатов клиентов.
 *
 * Кассиры заводят одного гостя по нескольку раз, причём паспорт каждый раз
 * пишут по-разному. Слепая дедупликация тут опасна — это деньги на балансе,
 * поэтому экран показывает группы кандидатов, а какая запись настоящая, решает
 * проверка паспорта в госбазе e-mehmon (кнопка «Проверить») и человек.
 *
 * Проверки идут ПО ОДНОЙ: портал не любит частых запросов, и владелец просил
 * ручной режим. Пока проверка бежит, остальные кнопки «Проверить» выключены.
 *
 * Логика поиска и расчёта слияния живёт в utils/clientDuplicates.js,
 * сама запись в Firestore — в hooks/useClientActions (handleMergeClients).
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Merge, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Loader2,
  Users, Wallet, Phone, CalendarDays, LogIn, Monitor,
} from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import { findDuplicateGroups, computeMergedClient, normalizeName, pickFallbackMain } from '../../utils/clientDuplicates';

// Портал ждёт дату рождения в виде дд.мм.гггг, а в базе она лежит как ГГГГ-ММ-ДД.
const toDmy = (iso) => {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-');
  return (d && m && y) ? `${d}.${m}.${y}` : String(iso || '');
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso).slice(0, 10) : d.toLocaleDateString();
};

const num = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
};

// Вид карточки и подпись под ней — по вердикту госбазы.
const VERDICT = {
  valid:         { tone: 'ok',      icon: CheckCircle2,  key: 'cdValid'       },
  not_found:     { tone: 'bad',     icon: XCircle,       key: 'cdNotFound'    },
  need_login:    { tone: 'warn',    icon: LogIn,         key: 'cdNeedLogin'   },
  no_form:       { tone: 'warn',    icon: AlertTriangle, key: 'cdNoForm'      },
  check_timeout: { tone: 'warn',    icon: AlertTriangle, key: 'cdTimeout'     },
  error:         { tone: 'warn',    icon: AlertTriangle, key: 'cdError'       },
  no_desktop:    { tone: 'warn',    icon: Monitor,       key: 'cdDesktopOnly' },
};

const TONE_CARD = {
  ok:   'border-emerald-400 ring-2 ring-emerald-100 bg-emerald-50/40',
  bad:  'border-rose-300 bg-rose-50/40',
  warn: 'border-amber-300 bg-amber-50/40',
};

const TONE_BADGE = {
  ok:   'bg-emerald-100 text-emerald-700 border-emerald-200',
  bad:  'bg-rose-100 text-rose-700 border-rose-200',
  warn: 'bg-amber-100 text-amber-700 border-amber-200',
};

const ClientDuplicatesView = ({ clients = [], onMerge, currentUser = {}, lang = 'ru' }) => {
  const t = (k) => TRANSLATIONS[lang]?.[k] || k;

  // Результаты проверок по id записи: { status, officialName?, message? }
  const [checks, setChecks] = useState({});
  const [runningId, setRunningId] = useState(null);
  const [useOfficial, setUseOfficial] = useState({});   // id → ставить ли ФИО из госбазы
  const [confirmFor, setConfirmFor] = useState(null);   // id главной записи
  const [mergingId, setMergingId] = useState(null);
  const [failedKey, setFailedKey] = useState(null);     // key группы, где слияние сорвалось
  // Групп бывают сотни, а карточка тяжёлая — рисуем порциями, иначе экран
  // открывается с заметной задержкой (сам поиск дубликатов быстрый).
  const [shown, setShown] = useState(20);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoProgress, setAutoProgress] = useState(null); // { done, total, merged, skipped }
  const stopRef = useRef(false);

  const groups = useMemo(() => findDuplicateGroups(clients), [clients]);

  // После слияния часть записей исчезает из Firestore — чистим их состояние,
  // иначе вердикт «зелёный» переехал бы на будущего клиента с тем же id.
  useEffect(() => {
    const alive = new Set(clients.map(c => c.id));
    const prune = (obj) => {
      const next = {};
      let changed = false;
      for (const id of Object.keys(obj)) {
        if (alive.has(id)) next[id] = obj[id]; else changed = true;
      }
      return changed ? next : obj;
    };
    setChecks(prev => prune(prev));
    setUseOfficial(prev => prune(prev));
    setConfirmFor(prev => (prev && !alive.has(prev) ? null : prev));
  }, [clients]);

  // Один запрос в госбазу. Общий для ручной кнопки и автоматического прогона.
  const checkOne = async (client) => {
    try {
      const res = await window.electronAPI.emehmonPassportCheck({
        passport: (client.passport || '').replace(/\s/g, '').toUpperCase(),
        birthDate: toDmy(client.birthDate),
        docType: '1',
        hostelId: currentUser?.hostelId || '',
      });
      return res || { status: 'error' };
    } catch (e) {
      return { status: 'error', message: e?.message };
    }
  };

  const runCheck = async (client) => {
    if (runningId || autoRunning) return;
    if (!window.electronAPI?.emehmonPassportCheck) {
      setChecks(prev => ({ ...prev, [client.id]: { status: 'no_desktop' } }));
      return;
    }
    setRunningId(client.id);
    setChecks(prev => ({ ...prev, [client.id]: null }));
    const res = await checkOne(client);
    setChecks(prev => ({ ...prev, [client.id]: res }));
    setRunningId(null);
  };

  /**
   * Автоматический прогон: идёт по группам, проверяет записи и сливает.
   *
   * Правила:
   *  1. Нашли подтверждённую госбазой — она главная, остальные сливаются в неё
   *     сразу; оставшиеся записи группы уже не проверяем (экономим запросы).
   *  2. Госбаза ответила «нет такого» по ВСЕМ записям — это заведомо один и тот же
   *     человек, введённый по-разному: сливаем в одну, главной берём самую живую
   *     (больше визитов, свежее визит, есть паспорт).
   *  3. Проверка не дала ответа (таймаут, ошибка, нужен вход) — НЕ сливаем:
   *     «не ответил» и «не нашёл» — разные вещи, вслепую тут терять деньги нельзя.
   *
   * Расхождение в ФИО решается в пользу госбазы.
   */
  const runAuto = async () => {
    if (autoRunning || runningId) return;
    if (!window.electronAPI?.emehmonPassportCheck) {
      setAutoProgress({ done: 0, total: 0, merged: 0, skipped: 0, noDesktop: true });
      return;
    }
    stopRef.current = false;
    setAutoRunning(true);
    setFailedKey(null);
    const total = groups.length;
    let done = 0, merged = 0, skipped = 0, needLogin = false;
    setAutoProgress({ done, total, merged, skipped });
    try {
      for (const group of groups) {
        if (stopRef.current) break;
        const results = {};
        let confirmed = null;      // запись, подтверждённая госбазой
        for (const c of group.clients) {
          if (stopRef.current) break;
          if (!c.passport || !c.birthDate) continue;   // проверять нечего
          setRunningId(c.id);
          setChecks(prev => ({ ...prev, [c.id]: null }));
          const res = await checkOne(c);
          results[c.id] = res;
          setChecks(prev => ({ ...prev, [c.id]: res }));
          setRunningId(null);
          // Портал требует вход — дальше без кассира не пройти, останавливаемся.
          if (res?.status === 'need_login') { needLogin = true; stopRef.current = true; break; }
          // Нашли подтверждённую — остальные проверять незачем, сливаем в неё.
          if (res?.status === 'valid') { confirmed = c; break; }
        }
        if (stopRef.current) break;

        done++;
        let main = confirmed;
        if (!main) {
          // Подтверждённой нет. Сливаем, только если по всем проверенным записям
          // портал дал внятное «нет такого»; невнятный ответ — на ручной разбор.
          const checked = group.clients.filter(c => results[c.id]);
          const allNotFound = checked.length > 0
            && checked.every(c => results[c.id].status === 'not_found');
          if (allNotFound) main = pickFallbackMain(group.clients);
        }

        if (main) {
          const official = results[main.id]?.officialName || '';
          const patch = (official && normalizeName(official) !== normalizeName(main.fullName))
            ? { fullName: official }
            : {};
          const otherIds = group.clients.filter(c => c.id !== main.id).map(c => c.id);
          const ok = otherIds.length ? await onMerge?.(main.id, otherIds, patch) : true;
          if (ok) merged++; else skipped++;
        } else {
          skipped++;   // проверка не дала ответа — не трогаем
        }
        setAutoProgress({ done, total, merged, skipped, needLogin });
      }
    } finally {
      setAutoProgress(prev => ({ ...(prev || {}), done, total, merged, skipped, needLogin, finished: true }));
      setRunningId(null);
      setAutoRunning(false);
    }
  };

  const doMerge = async (group, main) => {
    const otherIds = group.clients.filter(c => c.id !== main.id).map(c => c.id);
    if (!otherIds.length) return;
    const official = checks[main.id]?.officialName || '';
    // Галочка не тронута — берём ФИО из госбазы: она источник правды.
    // Владелец может снять галочку и оставить написание как в базе Hostella.
    const takeOfficial = useOfficial[main.id] ?? true;
    const patch = (takeOfficial && official) ? { fullName: official } : {};
    setMergingId(main.id);
    setFailedKey(null);
    try {
      const ok = await onMerge?.(main.id, otherIds, patch);
      if (ok) setConfirmFor(null);
      else setFailedKey(group.key);
    } catch {
      setFailedKey(group.key);
    } finally {
      setMergingId(null);
    }
  };

  return (
    <div className="space-y-4 pb-20 animate-in fade-in">
      {/* Шапка */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <Merge size={20} className="text-teal-600" /> {t('cdTitle')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('cdGroupsCount').replace('{n}', groups.length)}
        </p>
        <p className="text-xs text-slate-400 mt-1">{t('cdHint')}</p>

        {groups.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2 flex-wrap">
              {!autoRunning ? (
                <button
                  onClick={runAuto}
                  disabled={!!runningId}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-sm font-bold transition-colors"
                >
                  <ShieldCheck size={15} /> {t('cdAutoBtn')}
                </button>
              ) : (
                <button
                  onClick={() => { stopRef.current = true; }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-colors"
                >
                  <Loader2 size={15} className="animate-spin" /> {t('cdAutoStop')}
                </button>
              )}
              {autoProgress && (
                <span className="text-xs font-medium text-slate-600">
                  {t('cdAutoProgress')
                    .replace('{done}', autoProgress.done ?? 0)
                    .replace('{total}', autoProgress.total ?? 0)
                    .replace('{merged}', autoProgress.merged ?? 0)
                    .replace('{skipped}', autoProgress.skipped ?? 0)}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">{t('cdAutoRule')}</p>
            {autoProgress?.needLogin && (
              <p className="text-[11px] text-amber-600 font-semibold mt-1">{t('cdNeedLogin')}</p>
            )}
            {autoProgress?.noDesktop && (
              <p className="text-[11px] text-amber-600 font-semibold mt-1">{t('cdDesktopOnly')}</p>
            )}
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <Users size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-bold">{t('cdEmpty')}</p>
          <p className="text-xs text-slate-400 mt-1">{t('cdEmptyHint')}</p>
        </div>
      ) : groups.slice(0, shown).map(group => {
        const confirmMain = group.clients.find(c => c.id === confirmFor);
        return (
          <div key={group.key} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Заголовок группы */}
            <div className="flex items-center gap-2 flex-wrap px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <CalendarDays size={14} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-600">{t('birthDate')}:</span>
              <span className="text-xs font-mono font-bold text-slate-800">
                {String(group.clients[0]?.birthDate || '').slice(0, 10) || '—'}
              </span>
              <span className="ml-auto text-[11px] font-bold text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">
                {t('cdRecordsCount').replace('{n}', group.clients.length)}
              </span>
            </div>

            {/* Записи группы */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 p-3">
              {group.clients.map(c => {
                const res = checks[c.id];
                const verdict = res ? (VERDICT[res.status] || VERDICT.error) : null;
                const isRunning = runningId === c.id;
                const canCheck = !!(c.passport && c.birthDate);
                const official = res?.status === 'valid' ? (res.officialName || '') : '';
                const nameDiffers = !!official && normalizeName(official) !== normalizeName(c.fullName);
                const VIcon = verdict?.icon;

                return (
                  <div
                    key={c.id}
                    className={`rounded-xl border p-3 transition-colors ${
                      verdict ? TONE_CARD[verdict.tone] : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="font-bold text-slate-900 text-sm leading-tight break-words">
                      {c.fullName || '—'}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="bg-white/70 border border-slate-100 rounded-lg px-2 py-1.5">
                        <div className="text-[9px] text-slate-400 uppercase font-bold">{t('passport')}</div>
                        <div className="text-xs font-mono font-bold text-indigo-700 truncate">{c.passport || '—'}</div>
                      </div>
                      <div className="bg-white/70 border border-slate-100 rounded-lg px-2 py-1.5">
                        <div className="text-[9px] text-slate-400 uppercase font-bold">{t('birthDate')}</div>
                        <div className="text-xs font-medium text-slate-700">{String(c.birthDate || '—').slice(0, 10)}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Phone size={11} className="text-slate-400" />{c.phone || '—'}</span>
                      <span className={`flex items-center gap-1 font-bold ${
                        num(c.balance) > 0 ? 'text-violet-700' : num(c.balance) < 0 ? 'text-rose-600' : 'text-slate-400'
                      }`}>
                        <Wallet size={11} className="text-violet-400" />{num(c.balance).toLocaleString()} {t('sum')}
                      </span>
                      <span>{t('cdVisits')}: <strong className="text-slate-700">{num(c.visits)}</strong></span>
                      <span>{t('cdLastVisit')}: {fmtDate(c.lastVisit)}</span>
                    </div>

                    {/* Вердикт госбазы */}
                    {verdict && (
                      <div className={`mt-2 text-[11px] font-bold rounded-lg border px-2 py-1.5 flex items-start gap-1.5 ${TONE_BADGE[verdict.tone]}`}>
                        <VIcon size={12} className="mt-0.5 shrink-0" />
                        <span className="break-words">
                          {t(verdict.key)}
                          {res.message && verdict.tone === 'warn' ? ` (${res.message})` : ''}
                        </span>
                      </div>
                    )}

                    {/* Официальное ФИО из госбазы отличается — решает человек */}
                    {nameDiffers && (
                      <div className="mt-2 rounded-lg border border-emerald-200 bg-white/70 px-2 py-2 space-y-1">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">{t('cdStoredName')}</div>
                        <div className="text-xs text-slate-700 break-words">{c.fullName || '—'}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-bold pt-1">{t('cdOfficialName')}</div>
                        <div className="text-xs font-bold text-emerald-700 break-words">{official}</div>
                        <label className="flex items-start gap-2 pt-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useOfficial[c.id] ?? true}
                            onChange={e => setUseOfficial(prev => ({ ...prev, [c.id]: e.target.checked }))}
                            className="mt-0.5 rounded border-slate-300 text-emerald-600"
                          />
                          <span className="text-[11px] font-medium text-slate-600">{t('cdUseOfficialName')}</span>
                        </label>
                      </div>
                    )}

                    {/* Действия */}
                    <div className="flex gap-2 mt-2.5">
                      <button
                        onClick={() => runCheck(c)}
                        disabled={!!runningId || !canCheck}
                        title={canCheck ? '' : t('cdNoPassport')}
                        className="flex-1 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        {isRunning
                          ? <><Loader2 size={13} className="animate-spin" /> {t('cdChecking')}</>
                          : <><ShieldCheck size={13} /> {t('cdCheck')}</>}
                      </button>
                      {res?.status === 'valid' && (
                        <button
                          onClick={() => { setFailedKey(null); setConfirmFor(c.id); }}
                          disabled={!!mergingId}
                          className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-40 flex items-center justify-center gap-1.5"
                        >
                          <Merge size={13} /> {t('cdMergeHere')}
                        </button>
                      )}
                    </div>

                    {!canCheck && (
                      <p className="mt-1.5 text-[10px] text-slate-400">{t('cdNoPassport')}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Подтверждение слияния — прямо в группе, чтобы видеть, что с чем сливаем */}
            {confirmMain && (() => {
              const others = group.clients.filter(c => c.id !== confirmMain.id);
              const preview = computeMergedClient(confirmMain, others);
              const official = checks[confirmMain.id]?.officialName || '';
              const applyName = (useOfficial[confirmMain.id] ?? true) && !!official;
              return (
                <div className="border-t border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 text-sm">{t('cdConfirmTitle')}</div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {t('cdConfirmText').replace('{n}', others.length)}
                      </p>
                      <div className="mt-1.5 text-xs text-slate-700 space-y-0.5">
                        <div>
                          <span className="text-slate-500">{t('cdMainRecord')}: </span>
                          <strong className="break-words">{applyName ? official : (confirmMain.fullName || '—')}</strong>
                          <span className="text-slate-500 font-mono"> · {confirmMain.passport || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">{t('cdConfirmTotal')}: </span>
                          <strong className="text-violet-700">{preview.balance.toLocaleString()} {t('sum')}</strong>
                          <span className="text-slate-500"> · {t('cdConfirmVisits')}: </span>
                          <strong>{preview.visits}</strong>
                        </div>
                      </div>
                      {failedKey === group.key && (
                        <p className="mt-1.5 text-xs font-bold text-rose-600">{t('cdMergeFailed')}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setConfirmFor(null)}
                      disabled={!!mergingId}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold text-sm hover:bg-slate-50 disabled:opacity-40"
                    >{t('cancel')}</button>
                    <button
                      onClick={() => doMerge(group, confirmMain)}
                      disabled={!!mergingId}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      {mergingId === confirmMain.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Merge size={14} />}
                      {t('cdMergeBtn')}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })}

      {groups.length > shown && (
        <button
          onClick={() => setShown(n => n + 20)}
          className="w-full py-3 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-sm font-bold text-slate-600 transition-colors"
        >
          {t('cdShowMore').replace('{n}', groups.length - shown)}
        </button>
      )}
    </div>
  );
};

export default ClientDuplicatesView;
