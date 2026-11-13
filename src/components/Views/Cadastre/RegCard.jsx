import React, { useState } from 'react';
import { Calendar, ChevronDown, ChevronUp, ExternalLink, Link, MapPin, Receipt, RefreshCw } from 'lucide-react';
import { portalPayOpen, portalUnpaid } from '../../../utils/kadastrPortal';
import { STATUS_CFG, fmt, getDaysLeft, getStatus } from './shared';
import CopyButton from './CopyButton';
import TRANSLATIONS from '../../../constants/translations';

// Ручные «Изменить / Завершить / Удалить / В расходы» убраны (13.11.2026):
// кадастр ведёт программа — листок на сайте, сумма в расходы, завершение через
// 18 часов, сверка сроков. Кассиру остаются «Продлить» и «Оплатить».
const RegCard = ({ reg, maxEnd = '', onExtend, onPay, lang = 'ru' }) => {
  const t = k => TRANSLATIONS[lang]?.[k] || k;
  const [expanded, setExpanded] = useState(false);
  const alreadyExpensed = reg.totalExpensed ?? (reg.expenseAdded ? (Number(reg.amount) || 0) : 0);
  const unexpensed = Math.max(0, (Number(reg.amount) || 0) - alreadyExpensed);
  const unpaid = portalUnpaid(reg.portal);
  const status = getStatus(reg);
  const cfg = unpaid && status !== 'removed' ? STATUS_CFG.expired : STATUS_CFG[status];
  const daysLeft = getDaysLeft(reg.endDate);
  const Icon = cfg.icon;

  return (
    <div className={`bg-white rounded-2xl border ${cfg.border} shadow-sm overflow-hidden transition-all hover:shadow-md`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center flex-shrink-0`}>
            <Icon size={18} className={cfg.text} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-slate-800 text-sm">{reg.guestName}</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                {cfg.label}
                {status === 'active'   && daysLeft > 0 && ` · ${daysLeft} ${t('daysShort')}`}
                {status === 'expiring' && (
                  daysLeft === 0 ? ` · ${t('cdmTodayExcl')}` :
                  daysLeft === 1 ? ` · ${t('cdmTomorrow')}` :
                  ` · ${daysLeft} ${t('daysShort')}`
                )}
                {status === 'expired'  && (daysLeft === 0 ? ` · ${t('today')}` : ` · ${Math.abs(daysLeft)} ${t('daysShort')} ${t('cdmAgo')}`)}
              </span>
              {reg.expenseAdded && unexpensed <= 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                  📊 {t('cdmInExpenses')}
                </span>
              )}
              {unexpensed > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  ⚠️ {t('cdmNotInExpenses')}: {fmt(unexpensed)} {t('cadSum')}
                </span>
              )}
              {reg.guestLeft && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  🚪 {t('cadGuestLeft')}
                </span>
              )}
              {unpaid && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  💳 {t('cadPortalUnpaidBadge')}
                </span>
              )}
              {reg.portal?.status === 'saved' && reg.portal.paidAt && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ✓ {t('cadPortalPaidShort')}
                </span>
              )}
              {reg.portal?.status === 'error' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  ⚠ {t('cadPortalErrShort')}: {t('cadPortal_' + (reg.portal.error || 'error'))}
                </span>
              )}
            </div>
            <div className="mt-1.5 space-y-0.5">
              <p className="text-xs text-slate-600 flex items-center gap-1">
                <MapPin size={10} className="text-slate-400 flex-shrink-0" />
                {reg.cadastreAddress}
                {reg.cadastreName && reg.cadastreName !== reg.cadastreAddress && <span className="text-slate-400">· {reg.cadastreName}</span>}
              </p>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Calendar size={10} className="text-slate-400" />
                {reg.startDate} → {reg.endDate}
                <span className="text-slate-400">({reg.days} {t('daysShort')})</span>
              </p>
              {reg.amount > 0 && (
                <p className="text-xs font-semibold text-teal-700 flex items-center gap-1">
                  <Receipt size={10} /> {t('cdmRegCostShort')}: {fmt(reg.amount)} {t('cadSum')}
                </p>
              )}
            </div>
          </div>
          <button onClick={() => setExpanded(x => !x)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 flex-shrink-0">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
          {/* Доп. инфо */}
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            {reg.passport && <p>🪪 <b>{reg.passport}</b></p>}
            {reg.country  && <p>🌍 {reg.country}</p>}
            {reg.phone    && <p>📞 {reg.phone}</p>}
            {reg.cadastreOwner && <p>👤 {t('cadmOwner')}: {reg.cadastreOwner}</p>}
          </div>
          {/* Ссылка на регистрацию */}
          {reg.regLink && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <Link size={12} className="text-teal-500 flex-shrink-0" />
              <a href={reg.regLink} target="_blank" rel="noopener noreferrer"
                className="text-xs text-teal-600 hover:underline truncate flex-1 font-medium">
                {reg.regLink}
              </a>
              <CopyButton text={reg.regLink} lang={lang} />
              <a href={reg.regLink} target="_blank" rel="noopener noreferrer"
                className="p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-700">
                <ExternalLink size={12} />
              </a>
            </div>
          )}
          {/* Кнопки */}
          <div className="flex flex-wrap gap-2">
            {maxEnd && reg.endDate >= maxEnd && status !== 'removed' && (
              <span className="text-xs font-semibold text-rose-600 self-center">{t('cadLimitReached').replace('{date}', maxEnd)}</span>
            )}
            {status !== 'removed' && onExtend && !(maxEnd && reg.endDate >= maxEnd) && (
              <button onClick={() => onExtend(reg)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700">
                <RefreshCw size={11} /> {t('cdmExtend')}
              </button>
            )}
            {onPay && portalPayOpen(reg.portal) && (
              <button onClick={() => onPay(reg)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700">
                💳 {t('cadPortalPayBtn')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default RegCard;
