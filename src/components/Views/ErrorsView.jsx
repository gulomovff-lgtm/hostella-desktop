/**
 * ErrorsView — журнал ошибок для супера (решение владельца 29.10.2026).
 *
 * Все сбои в одном месте: падения программы, обрывы связи с сервером,
 * записи, не дошедшие до сервера, отказы записи, e-mehmon, Telegram, ошибки
 * серверных функций. Строка — одна ошибка за день, повторы — счётчиком
 * (utils/errorLog.js). Подписка живёт, только пока экран открыт.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { AlertOctagon, CheckCircle2, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { db, PUBLIC_DATA_PATH } from '../../firebase';
import { ERROR_KINDS, dayKey } from '../../utils/errorLog';

const PERIODS = [
  { id: 1, label: 'Сегодня' },
  { id: 7, label: '7 дней' },
  { id: 30, label: '30 дней' },
];
const HOSTELS = [
  { id: '', label: 'Все филиалы' },
  { id: 'hostel1', label: 'Хостел №1' },
  { id: 'hostel2', label: 'Хостел №2' },
];
const SEVERITY = {
  critical: { label: 'важная', cls: 'bg-rose-50 text-rose-600', bar: 'bg-rose-400' },
  error:    { label: 'ошибка', cls: 'bg-amber-50 text-amber-700', bar: 'bg-amber-400' },
  warning:  { label: 'заметка', cls: 'bg-slate-100 text-slate-500', bar: 'bg-slate-300' },
};

const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - (n - 1)); return dayKey(d); };

const Chip = ({ active, onClick, children }) => (
  <button type="button" onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${active ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
    {children}
  </button>
);

export default function ErrorsView({ currentUser, showNotification }) {
  const [period, setPeriod] = useState(7);
  const [kind, setKind] = useState('');
  const [hostel, setHostel] = useState('');
  const [openOnly, setOpenOnly] = useState(true);
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState('');
  const [expanded, setExpanded] = useState(null);

  // Подписка — на выбранный период; день строки — YYYY-MM-DD, сравнивается строкой
  useEffect(() => {
    setRows(null); setFailed('');
    const q = query(collection(db, ...PUBLIC_DATA_PATH, 'errorLog'), where('day', '>=', daysAgo(period)));
    return onSnapshot(q,
      (snap) => setRows(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (e) => setFailed(e?.code || e?.message || 'ошибка'));
  }, [period]);

  const isOpen = (r) => !r.resolved || (r.lastAt && r.resolvedAt && r.lastAt > r.resolvedAt);

  const base = useMemo(() => (rows || []).filter(r => (!hostel || r.hostelId === hostel) && (!openOnly || isOpen(r))),
    [rows, hostel, openOnly]);
  const kindCounts = useMemo(() => {
    const m = {};
    for (const r of base) m[r.kind] = (m[r.kind] || 0) + (Number(r.count) || 1);
    return m;
  }, [base]);
  const list = useMemo(() => base
    .filter(r => !kind || r.kind === kind)
    .sort((a, b) => String(b.lastAt || '').localeCompare(String(a.lastAt || ''))), [base, kind]);
  const total = useMemo(() => Object.values(kindCounts).reduce((s, n) => s + n, 0), [kindCounts]);

  const setResolved = async (r, value) => {
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'errorLog', r.id), value
        ? { resolved: true, resolvedAt: new Date().toISOString(), resolvedBy: currentUser?.name || currentUser?.login || '' }
        : { resolved: false, resolvedAt: null, resolvedBy: null });
    } catch (e) {
      showNotification?.('Не удалось отметить: ' + (e?.code || e?.message || e), 'error');
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex items-baseline gap-x-4 flex-wrap">
        <h1 className="text-xl md:text-2xl font-black text-slate-800">Ошибки</h1>
        <span className="text-sm text-slate-400">
          все сбои касс и сервера · {rows ? <span className="tabular-nums">{total} раз, {list.length} строк</span> : 'загрузка…'}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          {PERIODS.map(p => <Chip key={p.id} active={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}</Chip>)}
          <span className="w-px bg-slate-200 mx-1" />
          {HOSTELS.map(h => <Chip key={h.id || 'all'} active={hostel === h.id} onClick={() => setHostel(h.id)}>{h.label}</Chip>)}
          <span className="w-px bg-slate-200 mx-1" />
          <Chip active={openOnly} onClick={() => setOpenOnly(v => !v)}>Только неразобранные</Chip>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip active={!kind} onClick={() => setKind('')}>Все · {total}</Chip>
          {Object.entries(ERROR_KINDS).filter(([k]) => kindCounts[k]).map(([k, label]) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{label} · {kindCounts[k]}</Chip>
          ))}
        </div>
      </div>

      {failed && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl px-4 py-3 text-sm font-semibold">
          Журнал не загрузился: {failed}.{failed === 'permission-denied' ? ' Нет доступа: журнал видит только супер (или правила базы ещё не обновлены).' : ''}
        </div>
      )}

      {rows && !list.length && !failed && (
        <div className="bg-white rounded-2xl border border-slate-200 px-4 py-10 text-center">
          <CheckCircle2 className="mx-auto text-emerald-500" size={28} />
          <div className="mt-2 font-bold text-slate-700">{openOnly ? 'Неразобранных ошибок нет' : 'Ошибок нет'}</div>
          <div className="text-xs text-slate-400 mt-1">за выбранный период и филиал</div>
        </div>
      )}

      <div className="space-y-2">
        {list.map(r => {
          const sev = SEVERITY[r.severity] || SEVERITY.error;
          const open = expanded === r.id;
          const recurred = r.resolved && isOpen(r);
          return (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex gap-3 p-3">
                <div className={`w-1 self-stretch rounded-full ${r.resolved && !recurred ? 'bg-emerald-300' : sev.bar}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{ERROR_KINDS[r.kind] || r.kind}</span>
                    <span className={`text-[10.5px] font-black px-2 py-0.5 rounded-full ${sev.cls}`}>{sev.label}</span>
                    {r.resolved && !recurred && <span className="text-[10.5px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">разобрано</span>}
                    {recurred && <span className="text-[10.5px] font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">повторилась после разбора</span>}
                    <span className="ml-auto text-xs font-black text-slate-700 tabular-nums">×{Number(r.count) || 1}</span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-800 break-words">{r.message}</div>
                  <div className="mt-1 text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className="font-mono">{r.context}</span>
                    <span className="tabular-nums">последняя {fmtTime(r.lastAt)}{r.firstAt && r.firstAt !== r.lastAt ? ` · первая ${fmtTime(r.firstAt)}` : ''}</span>
                    {r.hostelId && <span>{r.hostelId === 'hostel1' ? 'Хостел №1' : r.hostelId === 'hostel2' ? 'Хостел №2' : r.hostelId}</span>}
                    {r.user && <span>{r.user}</span>}
                    {(r.version || r.platform) && <span>{r.version ? 'v' + r.version : ''} {r.platform || ''}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {r.resolved && !recurred ? (
                    <button type="button" onClick={() => setResolved(r, false)}
                      className="flex items-center gap-1 text-xs font-bold rounded-lg px-3 py-1.5 border border-slate-200 text-slate-500 hover:bg-slate-50">
                      <RotateCcw size={13} />Вернуть
                    </button>
                  ) : (
                    <button type="button" onClick={() => setResolved(r, true)}
                      className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg px-3 py-1.5">
                      <CheckCircle2 size={13} />Разобрано
                    </button>
                  )}
                  <button type="button" onClick={() => setExpanded(open ? null : r.id)}
                    className="flex items-center gap-1 text-xs font-bold rounded-lg px-3 py-1.5 border border-slate-200 text-slate-500 hover:bg-slate-50">
                    {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}Подробно
                  </button>
                </div>
              </div>
              {open && (
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600 space-y-1">
                  {r.resolvedBy && <div>Разобрал: <b>{r.resolvedBy}</b> · {fmtTime(r.resolvedAt)}</div>}
                  {r.device && <div>Устройство: <span className="font-mono">{r.device}</span></div>}
                  <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-slate-500 max-h-64 overflow-auto">
                    {JSON.stringify(r.details || {}, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!rows && !failed && (
        <div className="flex items-center gap-2 text-sm text-slate-400"><AlertOctagon size={15} />Загружаю журнал…</div>
      )}
    </div>
  );
}
