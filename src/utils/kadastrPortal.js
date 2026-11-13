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
