import React, { useState } from 'react';
import { Check, ChevronDown, ExternalLink, Link, MapPin, RefreshCw, CreditCard, AlertTriangle, Loader2, Home } from 'lucide-react';
import { portalUnpaid, portalPayLeftMs, fmtPayLeft } from '../../../utils/kadastrPortal';
import { localYmd } from '../../../utils/registrationStatus';
import { Flag } from '../../../utils/helpers';
import { COUNTRY_FLAGS } from '../../../constants/countries';
import { STATUS_CFG, fmt, getDaysLeft, getStatus } from './shared';
import CopyButton from './CopyButton';
import TRANSLATIONS from '../../../constants/translations';

// Карточка регистрации кадастра (13.11.2026). Спокойная белая карточка, цвет —
// мягкими акцентами статуса: кольцо вокруг флага, число дней, полоса срока.
// Всё, что ждёт кассира, — отдельной полосой внизу со своей кнопкой:
// не оплачен турсбор → «Оплатить», срок кончился → «Продлить», листок
// оформляется или сайт отказал — пояснение. Ручных правок нет.
const TONE = {
  active:   { ring: 'ring-emerald-200', num: 'text-emerald-600', bar: 'from-emerald-200 to-emerald-400', chip: 'bg-emerald-50 text-emerald-700' },
  expiring: { ring: 'ring-amber-200',   num: 'text-amber-600',   bar: 'from-amber-200 to-amber-400',     chip: 'bg-amber-50 text-amber-700' },
  expired:  { ring: 'ring-rose-200',    num: 'text-rose-500',    bar: 'from-rose-200 to-rose-400',       chip: 'bg-rose-50 text-rose-600' },
  removed:  { ring: 'ring-slate-200',   num: 'text-slate-400',   bar: 'from-slate-200 to-slate-300',     chip: 'bg-slate-100 text-slate-500' },
};
const ddmm = (ymd) => (ymd ? `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}` : '');
const dayMs = 86400000;
const toMs = (ymd) => new Date(ymd + 'T12:00:00').getTime();

// Этапы листка: оформлен → турсбор оплачен → сумма в расходах
function PortalSteps({ reg, unexpensed, t, delay }) {
  const p = reg.portal || {};
  const steps = [
    { key: 'l', label: t('kadStepListok'), st: p.status === 'saved' ? 'done' : p.status === 'pending' ? 'now' : p.status === 'error' ? 'bad' : 'wait' },
    { key: 'p', label: t('kadStepPay'), st: p.paidAt ? 'done' : p.status === 'saved' ? 'bad' : 'wait' },
    { key: 'e', label: t('kadStepExpense'), st: reg.amount > 0 && unexpensed <= 0 ? 'done' : reg.amount > 0 ? 'now' : 'wait' },
  ];
  const pill = {
    done: 'bg-emerald-50 text-emerald-700',
    now:  'bg-teal-50 text-teal-700',
    bad:  'bg-rose-50 text-rose-600',
    wait: 'bg-slate-50 text-slate-400',
  };
  return (
    <div className="flex flex-wrap items-center gap-1 min-w-0">
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          {i > 0 && <span className={`w-2.5 h-px ${steps[i - 1].st === 'done' ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
          <span className={`flex items-center gap-1 pl-1.5 pr-2 py-0.5 rounded-full text-[10.5px] font-semibold whitespace-nowrap ${pill[s.st]}`}>
            {s.st === 'done' && <Check size={10} strokeWidth={3} className="kad-tick" style={{ animationDelay: `${delay + 350 + i * 90}ms` }} />}
            {s.st === 'now' && <span className="w-1.5 h-1.5 rounded-full bg-teal-400 kad-breathe" />}
            {s.st === 'bad' && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
            {s.st === 'wait' && <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
            {s.label}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

const RegCard = ({ reg, maxEnd = '', onExtend, onPay, lang = 'ru', index = 0, leaving = false, baseDelay = 0 }) => {
  const t = k => TRANSLATIONS[lang]?.[k] || k;
  const [expanded, setExpanded] = useState(false);
  const alreadyExpensed = reg.totalExpensed ?? (reg.expenseAdded ? (Number(reg.amount) || 0) : 0);
  const unexpensed = Math.max(0, (Number(reg.amount) || 0) - alreadyExpensed);
  const unpaid = portalUnpaid(reg.portal);
  const status = getStatus(reg);
  const tone = TONE[unpaid && status !== 'removed' ? 'expired' : status];
  const daysLeft = getDaysLeft(reg.endDate);
  const payLeft = portalPayLeftMs(reg.portal);
  const canPay = !!onPay && payLeft > 0;
  const ended = status !== 'removed' && reg.endDate && reg.endDate < localYmd();
  const limitHit = ended && !!maxEnd && reg.endDate >= maxEnd;
  const canExtend = ended && !!onExtend && !limitHit;
  const pending = reg.portal?.status === 'pending';
  const portalErr = reg.portal?.status === 'error';
  const delay = baseDelay + Math.min(index, 12) * 55;

  const total = Math.max(1, (toMs(reg.endDate) - toMs(reg.startDate)) / dayMs + 1);
  const passed = Math.min(total, Math.max(0, (toMs(localYmd()) - toMs(reg.startDate)) / dayMs + 1));
  const pct = status === 'removed' ? 100 : Math.round((passed / total) * 100);
  const code = COUNTRY_FLAGS[reg.country] || '';
  const passTail = String(reg.passport || '').replace(/\s/g, '').slice(-4);

  const big = status === 'removed' ? null
    : daysLeft > 0 ? { n: daysLeft, sub: t('kadDaysLeft') }
    : daysLeft === 0 ? { n: '0', sub: t('kadLastDay') }
    : { n: Math.abs(daysLeft), sub: t('kadDaysAgo') };

  // Полоса внизу — что ждёт кассира (одна, самая важная)
  let strip = null;
  if (pending) strip = { cls: 'bg-teal-50/80 text-teal-700', icon: <Loader2 size={13} className="animate-spin" />, text: t('kadPending'), stripes: true };
  else if (canPay) strip = { cls: 'bg-rose-50/80 text-rose-700', icon: <CreditCard size={13} />, text: `${t('cadPortalUnpaidBadge')} · ${t('cadPayLeft').replace('{t}', fmtPayLeft(payLeft, t))}`,
    action: <button onClick={() => onPay(reg)} className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50 transition-colors">{t('cadPortalPayBtn')}</button> };
  else if (portalErr) strip = { cls: 'bg-rose-50/80 text-rose-700', icon: <AlertTriangle size={13} />, text: `${t('cadPortalErrShort')}: ${t('cadPortal_' + (reg.portal.error || 'error'))}` };
  else if (canExtend) strip = { cls: 'bg-teal-50/70 text-teal-800', icon: <RefreshCw size={13} />, text: t('kadEndedCanExtend'),
    action: <button onClick={() => onExtend(reg)} className="px-3 py-1.5 rounded-lg bg-white border border-teal-200 text-teal-700 text-xs font-bold hover:bg-teal-50 transition-colors">{t('cdmExtend')}</button> };
  else if (limitHit) strip = { cls: 'bg-slate-50 text-slate-600', icon: <AlertTriangle size={13} />, text: t('cadLimitReached').replace('{date}', maxEnd) };

  return (
    <div className={`${leaving ? 'kad-leave' : 'kad-rise'} bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,.04)] hover:shadow-[0_4px_14px_rgba(15,23,42,.06)] transition-shadow overflow-hidden`}
      style={leaving ? undefined : { animationDelay: `${delay}ms` }}>
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-full bg-white ring-2 ${tone.ring} ring-offset-1 flex items-center justify-center flex-shrink-0 overflow-hidden`}>
            {code ? <Flag code={code} size={22} /> : <span className="text-xs font-bold text-slate-400">{(reg.guestName || '?').slice(0, 1)}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 text-[14.5px] leading-tight truncate">{reg.guestName}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              {reg.country}{passTail && <span className="tabular-nums"> · ···{passTail}</span>}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${TONE[status].chip}`}>{STATUS_CFG[status].label}</span>
              {reg.portal?.paidAt && <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">✓ {t('cadPortalPaidShort')}</span>}
              {reg.guestLeft && <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{t('cadGuestLeft')}</span>}
              {unexpensed > 0 && <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 tabular-nums">{t('cdmNotInExpenses')}: {fmt(unexpensed)}</span>}
            </div>
          </div>
          {big && (
            <div className="text-right flex-shrink-0 pl-2">
              <div className={`text-2xl font-black leading-none tabular-nums ${tone.num}`}>{big.n}</div>
              <div className="text-[10px] text-slate-400 mt-1">{big.sub}</div>
            </div>
          )}
        </div>

        <p className="mt-2.5 text-[11.5px] text-slate-500 flex items-center gap-1.5 truncate">
          <Home size={11} className="text-slate-300 flex-shrink-0" />
          <span className="truncate">{reg.cadastreAddress}</span>
        </p>

        {/* Срок: полоса с отметкой «сегодня» */}
        <div className="mt-2">
          <div className="relative h-1.5 rounded-full bg-slate-100">
            <div className={`kad-fill absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${tone.bar}`}
              style={{ width: `${pct}%`, animationDelay: `${delay + 180}ms` }} />
            {status !== 'removed' && pct > 0 && pct < 100 && (
              <span className="kad-tick absolute top-1/2 w-2.5 h-2.5 -mt-[5px] -ml-[5px] rounded-full bg-white border-2 border-slate-300"
                style={{ left: `${pct}%`, animationDelay: `${delay + 900}ms` }} />
            )}
          </div>
          <div className="flex justify-between mt-1.5 text-[10.5px] text-slate-400 tabular-nums">
            <span>{ddmm(reg.startDate)}</span>
            <span className="text-slate-500">{reg.days} {t('daysShort')}{reg.amount > 0 && ` · ${fmt(reg.amount)} ${t('cadSum')}`}</span>
            <span>{ddmm(reg.endDate)}</span>
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-2 justify-between">
          {reg.portal ? <PortalSteps reg={reg} unexpensed={unexpensed} t={t} delay={delay} /> : <span />}
          <button onClick={() => setExpanded(x => !x)} title={t('kadDetails')}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
            <span className="hidden sm:inline">{t('kadDetails')}</span>
            <ChevronDown size={13} className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Подробно — раскрывается плавно по высоте */}
      <div className={`kad-collapse ${expanded ? 'open' : ''}`}>
        <div>
          <div className="border-t border-slate-100 px-4 py-3 space-y-2.5 bg-slate-50/50">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px] text-slate-500">
              {reg.passport && <p>{t('kadPassport')}: <span className="text-slate-700 font-semibold tabular-nums">{reg.passport}</span></p>}
              {reg.phone && <p className="tabular-nums">{reg.phone}</p>}
              {reg.cadastreOwner && <p>{t('cadmOwner')}: {reg.cadastreOwner}</p>}
              {reg.cadastreName && reg.cadastreName !== reg.cadastreAddress && <p className="flex items-center gap-1"><MapPin size={10} /> {reg.cadastreName}</p>}
              <p className="tabular-nums">{reg.startDate} → {reg.endDate}</p>
            </div>
            {reg.regLink && (
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                <Link size={12} className="text-slate-400 flex-shrink-0" />
                <a href={reg.regLink} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:underline truncate flex-1">{reg.regLink}</a>
                <CopyButton text={reg.regLink} lang={lang} />
                <a href={reg.regLink} target="_blank" rel="noopener noreferrer" className="p-1 rounded-md hover:bg-slate-100 text-slate-400"><ExternalLink size={12} /></a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Что ждёт кассира — полоса с действием */}
      {strip && (
        <div className={`kad-strip relative flex items-center gap-2 px-4 py-2.5 border-t border-white ${strip.cls}`} style={{ animationDelay: `${delay + 420}ms` }}>
          {strip.stripes && <span className="absolute inset-0 kad-stripes opacity-60" />}
          <span className="relative flex-shrink-0">{strip.icon}</span>
          <span className="relative flex-1 text-xs font-semibold tabular-nums">{strip.text}</span>
          {strip.action && <span className="relative">{strip.action}</span>}
        </div>
      )}
    </div>
  );
};

export default RegCard;
