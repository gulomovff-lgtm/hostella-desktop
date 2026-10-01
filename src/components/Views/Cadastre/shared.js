// Общие расчёты и стили экрана кадастровых регистраций.
// Вынесены отдельно: их используют и карточки, и все модалки экрана.
import { CheckCircle2, AlertTriangle, AlertCircle, UserX } from 'lucide-react';

export const getLocalDateStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Разность в днях: endDate (YYYY-MM-DD) минус сегодня (локальное время)
// Регистрация 6–16: последний день 16-е → daysLeft=0 когда сегодня 16-е
export const getDaysLeft = (endDate) => {
  const todayStr = getLocalDateStr();
  const endMs   = new Date(endDate   + 'T12:00:00').getTime();
  const todayMs = new Date(todayStr  + 'T12:00:00').getTime();
  return Math.round((endMs - todayMs) / 86400000);
};

export const getStatus = (reg) => {
  if (reg.status === 'removed') return 'removed';
  const daysLeft = getDaysLeft(reg.endDate);
  if (daysLeft <= 0) return 'expired';
  if (daysLeft <= 3) return 'expiring';
  return 'active';
};

export const STATUS_CFG = {
  active:   { label: 'Активна',       icon: CheckCircle2,   bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  expiring: { label: 'Истекает',      icon: AlertTriangle,  bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500'   },
  expired:  { label: 'Истекла',       icon: AlertCircle,    bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    dot: 'bg-rose-500'    },
  removed:  { label: 'Завершён',       icon: UserX,          bg: 'bg-slate-50',   text: 'text-slate-500',   border: 'border-slate-200',   dot: 'bg-slate-400'   },
};

export const calcEndDate = (startDate, days) => {
  try {
    const d = new Date(startDate + 'T12:00:00');
    d.setDate(d.getDate() + parseInt(days || 0));
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  } catch { return ''; }
};

export const fmt = (n) => Number(n || 0).toLocaleString();
export const inp = 'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none font-medium';

// ─── EditRegModal ─────────────────────────────────────────────────────────────
