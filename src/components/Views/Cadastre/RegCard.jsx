import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, ExternalLink, Link, MapPin, RefreshCw, CreditCard, AlertTriangle } from 'lucide-react';
import { portalUnpaid, portalPayLeftMs, fmtPayLeft } from '../../../utils/kadastrPortal';
import { localYmd } from '../../../utils/registrationStatus';
import { Flag } from '../../../utils/helpers';
import { COUNTRY_FLAGS } from '../../../constants/countries';
import { STATUS_CFG, fmt, getDaysLeft, getStatus } from './shared';
import CopyButton from './CopyButton';
import TRANSLATIONS from '../../../constants/translations';

// Карточка регистрации кадастра (13.11.2026; по просьбе владельца —
// минимализм, приглушённые цвета). Цвет только в точке статуса и тонкой
// полосе срока: зелёный — действует, янтарный — истекает, красный — истёк
// или не оплачен, серый — завершён. Ручных правок нет: кассиру «Оплатить
// турсбор» (пока сайт держит листок) и «Продлить» (после конца срока).
const DOT  = { active: 'bg-emerald-400', expiring: 'bg-amber-400', expired: 'bg-rose-400', removed: 'bg-slate-300' };
const FILL = { active: 'bg-emerald-300', expiring: 'bg-amber-300', expired: 'bg-rose-300', removed: 'bg-slate-200' };
const ddmm = (ymd) => (ymd ? `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}` : '');
const dayMs = 86400000;
const toMs = (ymd) => new Date(ymd + 'T12:00:00').getTime();

// Этапы листка на сайте: оформлен → турсбор оплачен → сумма в расходах.
// Тихо: серые подписи, сделанное — зелёная галочка, проблема — красная точка.
function PortalSteps({ reg, unexpensed, t }) {
  const p = reg.portal || {};
  const steps = [
    { key: 'l', label: t('kadStepListok'), st: p.status === 'saved' ? 'done' : p.status === 'pending' ? 'now' : p.status === 'error' ? 'bad' : 'wait' },
    { key: 'p', label: t('kadStepPay'), st: p.paidAt ? 'done' : p.status === 'saved' ? 'bad' : 'wait' },
    { key: 'e', label: t('kadStepExpense'), st: reg.amount > 0 && unexpensed <= 0 ? 'done' : reg.amount > 0 ? 'now' : 'wait' },
  ];
  return (
    <div className="flex items-center gap-2 text-[11px] text-slate-400">
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          {i > 0 && <span className="w-3 h-px bg-slate-200" />}
          <span className={`flex items-center gap-1 ${s.st === 'done' ? 'text-slate-500' : s.st === 'bad' ? 'text-rose-500' : ''}`}>
            {s.st === 'done' && <Check size={11} strokeWidth={3} className="text-emerald-500 kad-pop" />}
            {s.st === 'bad' && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
            {s.st === 'now' && <span className="w-1.5 h-1.5 rounded-full bg-teal-400 kad-breathe" />}
            {s.st === 'wait' && <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />}
            {s.label}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

const RegCard = ({ reg, maxEnd = '', onExtend, onPay, lang = 'ru', index = 0 }) => {
  const t = k => TRANSLATIONS[lang]?.[k] || k;
  const [expanded, setExpanded] = useState(false);
  const alreadyExpensed = reg.totalExpensed ?? (reg.expenseAdded ? (Number(reg.amount) || 0) : 0);
  const unexpensed = Math.max(0, (Number(reg.amount) || 0) - alreadyExpensed);
  const unpaid = portalUnpaid(reg.portal);
  const status = getStatus(reg);
  const tone = unpaid && status !== 'removed' ? 'expired' : status;   // не оплачен — красная точка, подпись по сроку
  const daysLeft = getDaysLeft(reg.endDate);
  const payLeft = portalPayLeftMs(reg.portal);
  const canPay = !!onPay && payLeft > 0;
  const ended = status !== 'removed' && reg.endDate && reg.endDate < localYmd();
  const limitHit = ended && !!maxEnd && reg.endDate >= maxEnd;
  const canExtend = ended && !!onExtend && !limitHit;
  const pending = reg.portal?.status === 'pending';
  const delay = Math.min(index, 12) * 40;

  // Полоса срока: сколько прошло от начала к концу
  const total = Math.max(1, (toMs(reg.endDate) - toMs(reg.startDate)) / dayMs + 1);
  const passed = Math.min(total, Math.max(0, (toMs(localYmd()) - toMs(reg.startDate)) / dayMs + 1));
  const pct = status === 'removed' ? 100 : Math.round((passed / total) * 100);
  const code = COUNTRY_FLAGS[reg.country] || '';

  const big = status === 'removed' ? null
    : daysLeft > 0 ? { n: daysLeft, sub: t('kadDaysLeft') }
    : daysLeft === 0 ? { n: '0', sub: t('kadLastDay') }
    : { n: Math.abs(daysLeft), sub: t('kadDaysAgo') };

  return (
    <div className="kad-rise bg-white rounded-2xl border border-slate-200 hover:border-slate-300 transition-colors overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}>
      <div className="px-4 pt-3.5 pb-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {code ? <Flag code={code} size={20} /> : <span className="text-xs font-bold text-slate-400">{(reg.guestName || '?').slice(0, 1)}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 text-sm leading-tight truncate">{reg.guestName}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1 truncate">
              <MapPin size={10} className="flex-shrink-0" />
              <span className="truncate">{reg.cadastreAddress}</span>
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className={`w-1.5 h-1.5 rounded-full ${DOT[tone]}`} /> {STATUS_CFG[status].label}
              </span>
              {unpaid && (
                <span className="text-rose-500 tabular-nums">
                  {t('cadPortalUnpaidBadge')}{payLeft > 0 && ` · ${t('cadPayLeft').replace('{t}', fmtPayLeft(payLeft, t))}`}
                </span>
              )}
              {pending && <span className="text-teal-600 kad-breathe">{t('kadPending')}</span>}
              {reg.portal?.status === 'error' && (
                <span className="text-rose-500 flex items-center gap-1"><AlertTriangle size={10} /> {t('cadPortal_' + (reg.portal.error || 'error'))}</span>
              )}
              {reg.guestLeft && <span className="text-slate-400">{t('cadGuestLeft')}</span>}
              {unexpensed > 0 && <span className="text-amber-600 tabular-nums">{t('cdmNotInExpenses')}: {fmt(unexpensed)} {t('cadSum')}</span>}
            </div>
          </div>
          {big && (
            <div className="text-right flex-shrink-0 pl-2">
              <div className={`text-xl font-black leading-none tabular-nums ${tone === 'expired' ? 'text-rose-500' : 'text-slate-700'}`}>{big.n}</div>
              <div className="text-[10px] text-slate-400 mt-1">{big.sub}</div>
            </div>
          )}
        </div>

        {/* Срок — тонкая полоса */}
        <div className="mt-3">
          <div className="relative h-1 rounded-full bg-slate-100 overflow-hidden">
            <div className={`kad-fill absolute inset-y-0 left-0 rounded-full ${FILL[tone]}`} style={{ width: `${pct}%`, animationDelay: `${delay + 120}ms` }} />
            {pending && <span className="absolute inset-0 kad-stripes" />}
          </div>
          <div className="flex justify-between mt-1 text-[10.5px] text-slate-400 tabular-nums">
            <span>{ddmm(reg.startDate)}</span>
            <span>{reg.days} {t('daysShort')}{reg.amount > 0 && ` · ${fmt(reg.amount)} ${t('cadSum')}`}</span>
            <span>{ddmm(reg.endDate)}</span>
          </div>
        </div>

        {/* Этапы на сайте + действия */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2 justify-between">
          {reg.portal ? <PortalSteps reg={reg} unexpensed={unexpensed} t={t} /> : <span />}
          <div className="flex flex-wrap items-center gap-1.5 ml-auto">
            {limitHit && <span className="text-[11px] text-rose-500">{t('cadLimitReached').replace('{date}', maxEnd)}</span>}
            {canPay && (
              <button onClick={() => onPay(reg)}
                className="kad-slide flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50/70 text-rose-600 text-xs font-bold hover:bg-rose-50 transition-colors">
                <CreditCard size={12} /> {t('cadPortalPayBtn')}
                <span className="font-normal opacity-70 tabular-nums">· {fmtPayLeft(payLeft, t)}</span>
              </button>
            )}
            {canExtend && (
              <button onClick={() => onExtend(reg)}
                className="kad-slide flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50/70 text-teal-700 text-xs font-bold hover:bg-teal-50 transition-colors">
                <RefreshCw size={12} /> {t('cdmExtend')}
              </button>
            )}
            <button onClick={() => setExpanded(x => !x)} title={t('kadDetails')}
              className="w-7 h-7 rounded-lg hover:bg-slate-50 text-slate-300 hover:text-slate-500 flex items-center justify-center transition-colors">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="kad-rise border-t border-slate-100 px-4 pb-3.5 pt-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px] text-slate-500">
            {reg.passport && <p>{t('kadPassport')}: <span className="text-slate-700 font-semibold tabular-nums">{reg.passport}</span></p>}
            {reg.country  && <p>{reg.country}</p>}
            {reg.phone    && <p className="tabular-nums">{reg.phone}</p>}
            {reg.cadastreOwner && <p>{t('cadmOwner')}: {reg.cadastreOwner}</p>}
            {reg.cadastreName && reg.cadastreName !== reg.cadastreAddress && <p>{reg.cadastreName}</p>}
            <p className="tabular-nums">{reg.startDate} → {reg.endDate}</p>
          </div>
          {reg.regLink && (
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5">
              <Link size={12} className="text-slate-400 flex-shrink-0" />
              <a href={reg.regLink} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:underline truncate flex-1">{reg.regLink}</a>
              <CopyButton text={reg.regLink} lang={lang} />
              <a href={reg.regLink} target="_blank" rel="noopener noreferrer" className="p-1 rounded-md hover:bg-slate-100 text-slate-400"><ExternalLink size={12} /></a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RegCard;
