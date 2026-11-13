// Сайт кадастра (reg.emehmon.uz) из программы: данные гостя → листок, оплата.
// Сам сайт и секреты (пароль ЭЦП, карта) — в главном процессе Electron
// (electron/kadastrPortal.js); здесь только сбор данных гостя и разбор ответа.
import { COUNTRY_ISO3 } from '../constants/countries.js';

/** 'YYYY-MM-DD…' → 'dd/mm/yyyy' (формат полей сайта кадастра). */
export const toDmySlash = (iso) => {
  const m = String(iso || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

/** Есть ли сайт кадастра в этой сборке (только касса на Electron). */
export const kadastrPortalAvailable = () => typeof window !== 'undefined' && !!window.electronAPI?.kadastrRegister;

/**
 * Что сайт кадастра спросит о госте. Чего не хватает — до сайта не идём:
 * cadPortalMissing покажет кассиру, что дописать в карточке.
 */
export function kadastrPayload(guest, days, card) {
  return {
    iso3: COUNTRY_ISO3[guest?.country] || '',
    birth: toDmySlash(guest?.birthDate),
    passport: String(guest?.passport || '').replace(/\s/g, '').toUpperCase(),
    pspDate: toDmySlash(guest?.passportIssueDate),
    issuedBy: '',
    days: Math.max(1, Math.round(Number(days) || 0)),
    card: card || null,
  };
}

/** Каких данных гостя не хватает для листка: массив ключей перевода. */
export function kadastrMissing(p) {
  const miss = [];
  if (!p.iso3) miss.push('country');
  if (!p.birth) miss.push('birthDate');
  if (!p.passport) miss.push('passport');
  if (!p.pspDate) miss.push('passportIssueDate');
  return miss;
}

/** Ответ сайта → поле portal записи кадастра. */
export function portalFromResult(r, now = new Date()) {
  const at = now.toISOString();
  if (r?.status === 'saved') {
    return {
      status: 'saved', savedAt: at,
      amount: Number(r.amount) || 0,
      payUrl: r.payUrl || '',
      pay: r.pay || '',
    };
  }
  return { status: 'error', error: String(r?.status || 'error'), message: String(r?.message || r?.reason || '').slice(0, 300), at };
}

/** Оплату ещё можно провести (сайт держит неоплаченный листок 24 часа). */
export const portalPayOpen = (portal, now = Date.now()) =>
  !!portal && portal.status === 'saved' && !portal.paidAt && !!portal.payUrl &&
  now - new Date(portal.savedAt).getTime() < 24 * 3600 * 1000;

/** Сколько ещё можно оплатить (мс): сайт держит неоплаченный листок сутки. */
export const portalPayLeftMs = (portal, now = Date.now()) =>
  portalPayOpen(portal, now) ? new Date(portal.savedAt).getTime() + 24 * 3600 * 1000 - now : 0;
/** «5 ч 20 мин» / «40 мин» — остаток окна оплаты. */
export function fmtPayLeft(ms, t = (k) => k) {
  const min = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} ${t('hoursShort')} ${m} ${t('minShort')}` : `${m} ${t('minShort')}`;
}

/** Листок на сайте есть, а турсбор не оплачен — красный статус в кадастре. */
export const portalUnpaid = (portal) => !!portal && portal.status === 'saved' && !portal.paidAt;

/** Сколько дней кадастра разрешено от въезда в страну (правило сайта). */
export const CADASTRE_MAX_DAYS = 30;
/** 'dd/mm/yyyy' (поле сайта) → 'YYYY-MM-DD'. */
export const dmySlashToYmd = (s) => {
  const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};
/** Последний день, до которого сайт даст кадастр: въезд — 1-й день из 30. */
export function cadastreLimitEnd(borderYmd) {
  const m = String(borderYmd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const d = new Date(+m[1], +m[2] - 1, +m[3] + CADASTRE_MAX_DAYS - 1, 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Известный предел кадастра для человека: из листков сайта (самый поздний). */
export function cadastreMaxEndFor(regs = []) {
  let best = '';
  for (const r of regs || []) { const m = r?.portal?.maxEnd; if (m && m > best) best = m; }
  return best;
}

/**
 * Предел кадастра гостя: 30 дней от последнего въезда. Въезд — дата КПП
 * (решение владельца 13.11.2026: гости раз в 30 дней выезжают и въезжают,
 * дата КПП обновляется); если сайт сообщил въезд позже — берём его.
 */
export function cadastreLimitFor(guest, regs = []) {
  const byKpp = cadastreLimitEnd(String(guest?.kppDate || '').slice(0, 10));
  const bySite = cadastreMaxEndFor(regs);
  return byKpp > bySite ? byKpp : bySite;
}
