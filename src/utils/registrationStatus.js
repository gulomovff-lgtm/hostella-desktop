/**
 * Один ответ на два вопроса, которые раньше каждый экран решал по-своему:
 *  • есть ли у гостя регистрация — e-mehmon ИЛИ кадастр (адресная регистрация);
 *  • живёт ли человек сейчас — по записи гостя, а не по журналам.
 *
 * Регистрация по кадастру — отдельный источник: отметку e-mehmon (emehmonReg)
 * ей не ставим, потому что emehmonReg сверяется со списком портала (/listok) и
 * снимается, если гостя там нет, а выселение по ней выводит гостя из портала.
 * Поэтому «галочка» в карточке и все проверки смотрят на hasRegistration().
 *
 * Связь кадастра с гостем: guestId (это может быть id гостя ИЛИ id клиента —
 * регистрацию заводят и из базы клиентов), иначе паспорт; по ФИО — только
 * когда у регистрации паспорта нет (тот же порядок, что при выселении).
 */

export const normPass = (v) => String(v || '').replace(/\s/g, '').toUpperCase();
const normName = (v) => String(v || '').replace(/\s+/g, ' ').trim().toUpperCase();

/** Регистрация кадастра относится к гостю/человеку? */
export function cadastreMatches(reg, g) {
  if (!reg || !g) return false;
  if (g.id && reg.guestId && reg.guestId === g.id) return true;
  const rp = normPass(reg.passport), gp = normPass(g.passport);
  if (rp && gp) return rp === gp;
  if (!rp && reg.guestName && g.fullName) return normName(reg.guestName) === normName(g.fullName);
  return false;
}

/** Действующая (не снятая) регистрация кадастра гостя — самая поздняя по сроку, или null. */
export function cadastreRegFor(g, cadastreRegs = []) {
  let best = null;
  for (const r of cadastreRegs || []) {
    if (!r || r.status === 'removed' || !cadastreMatches(r, g)) continue;
    if (!best || String(r.endDate || '') > String(best.endDate || '')) best = r;
  }
  return best;
}

/** Местная дата YYYY-MM-DD. */
export const localYmd = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

/** Регистрация кадастра действует сегодня (последний день — включительно). */
export const cadastreValid = (reg, now = new Date()) =>
  !!reg && !!reg.endDate && String(reg.endDate).slice(0, 10) >= localYmd(now);

/** Действующая сегодня регистрация кадастра гостя или null (истёкшая — не регистрация). */
export function validCadastreFor(g, cadastreRegs = [], now = new Date()) {
  const r = cadastreRegFor(g, cadastreRegs);
  return cadastreValid(r, now) ? r : null;
}

/** Есть ли у гостя регистрация сегодня: e-mehmon или действующий кадастр. */
export const hasRegistration = (g, cadastreRegs = [], now = new Date()) =>
  !!g && (!!g.emehmonReg || !!validCadastreFor(g, cadastreRegs, now));

/** Откуда регистрация: 'emehmon' | 'cadastre' | null. */
export const registrationSource = (g, cadastreRegs = [], now = new Date()) =>
  (!g ? null : g.emehmonReg ? 'emehmon' : validCadastreFor(g, cadastreRegs, now) ? 'cadastre' : null);

/**
 * Мешает ли кадастр автомату регистрировать гостя в e-mehmon.
 * Обычный кадастр — мешает, даже истёкший: продлить кадастр или перевести в
 * e-mehmon решает человек («Оформить» его покажет).
 * Перевод кнопкой «В кадастр» (backToEmehmon, 2026-11-11) — мешает только
 * пока действует: на следующий день после конца гость снова идёт в e-mehmon.
 */
export function cadastreBlocksAuto(g, cadastreRegs = [], now = new Date()) {
  const r = cadastreRegFor(g, cadastreRegs);
  if (!r) return false;
  if (r.backToEmehmon && !cadastreValid(r, now)) return false;
  return true;
}

/**
 * Можно ли автомату (заселение, оплата, добор) регистрировать гостя в e-mehmon.
 * Кнопка «Оформить авто» в карточке — решение человека, её это не касается.
 */
export const autoRegisterAllowed = (g, cadastreRegs = [], now = new Date()) =>
  !!g && !g.emehmonReg && !g.emehmonSkip && !cadastreBlocksAuto(g, cadastreRegs, now);

/**
 * Перевод в кадастр начался, а гость ещё числится в e-mehmon — пора вывести.
 * Только переводы кнопкой (backToEmehmon) и только с дня начала кадастра.
 */
export function cadastreTransferDue(g, cadastreRegs = [], now = new Date()) {
  const r = cadastreRegFor(g, cadastreRegs);
  if (!r || !r.backToEmehmon || !cadastreValid(r, now)) return null;
  return String(r.startDate || '').slice(0, 10) <= localYmd(now) ? r : null;
}

/** Конец кадастра по началу и числу дней (день начала — 1-й). YYYY-MM-DD. */
export function cadastreEndFor(startYmd, days) {
  const n = Math.round(Number(days));
  if (!startYmd || !Number.isFinite(n) || n < 1) return '';
  const d = new Date(String(startYmd).slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + n - 1);
  return localYmd(d);
}

/** Сколько дней от начала до конца включительно (0 — конец раньше начала). */
export function cadastreDaysFor(startYmd, endYmd) {
  const a = new Date(String(startYmd || '').slice(0, 10) + 'T12:00:00');
  const b = new Date(String(endYmd || '').slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.round((b - a) / 86400000) + 1);
}

/**
 * Какой дом-кадастр брать гостю: у обоих филиалов он один (Ниёзбек Йули 43),
 * но записей две — по филиалу. Берём свою, иначе любую действующую.
 */
export function cadastreHouseFor(hostelId, cadastres = []) {
  const live = (cadastres || []).filter(c => c && c.active !== false);
  return live.find(c => (c.hostelId || 'hostel1') === (hostelId || 'hostel1')) || live[0] || null;
}

/**
 * Что НЕ переносится в новое проживание того же человека после паузы (деление
 * с разрывом): регистрация, её попытки, решения и листы — по прошлому заезду.
 * Дата КПП остаётся: человек тот же и из страны не выезжал.
 */
export const NEW_STAY_RESET_KEYS = [
  'emehmonReg', 'emehmonRegAt', 'emehmonRegAuto', 'emehmonRegError', 'emehmonRegErrorAt',
  'emehmonOut', 'emehmonOutAt', 'emehmonOutAuto', 'emehmonMovedOut', 'emehmonRoomSkip',
  'emehmonSkip', 'emehmonSkipAt', 'emehmonClaimAt', 'emehmonClaimBy', 'emehmonNoRoomAt',
  'emehmonRegNote', 'emehmonLastTry', 'emehmonSheet', 'emehmonSheetError', 'emehmonAmount', 'emehmonStayStart',
  'kppRegistered', 'kppRegisteredAt', 'kppSituation', 'kppSituationDecision', 'kppSituationAckAt',
  'continuedBy', 'continuedFrom', 'closedByContinuation',
];

/** Конец проживания с учётом бонусных суток. */
export function stayEnd(g) {
  if (!g) return null;
  const co = g.checkOutDate ? new Date(g.checkOutDate) : null;
  const bonus = g.bonusCheckOutDate ? new Date(g.bonusCheckOutDate) : null;
  const end = (bonus && co && bonus > co) ? bonus : (co || bonus);
  return end && !Number.isNaN(end.getTime()) ? end : null;
}

/**
 * Живёт ли гость сейчас: запись активна, это не долговая запись и срок не
 * вышел. Запись, которую забыли выселить (срок прошёл), — уже не «живёт»:
 * по ней не напоминаем о регистрации.
 */
export function isLivingNow(g, now = new Date()) {
  if (!g || g.status !== 'active' || g.roomId === 'DEBT_ONLY') return false;
  const end = stayEnd(g);
  return !end || end.getTime() >= new Date(now).getTime();
}

/**
 * Регистрация кадастра принадлежит человеку, который у нас уже не живёт:
 * нашлись его записи гостя, и ни одна не живёт сейчас. Если записей нет
 * вовсе (регистрация человеку «с улицы», не гостю) — false: напоминать надо.
 */
export function cadastrePersonGone(reg, guests = [], now = new Date(), clients = []) {
  let matched = false;
  for (const g of guests || []) {
    if (!cadastreMatches(reg, g)) continue;
    if (isLivingNow(g, now)) return false;
    matched = true;
  }
  if (matched) return true;
  // Старые записи гостей грузятся только по запросу (utils/historyWindow), а
  // живущие — всегда. Поэтому «наш ли это человек» досматриваем по клиентам
  // (они целиком): бывал у нас (визиты/последний визит) и сейчас не живёт — уехал.
  return (clients || []).some(c => (Number(c?.visits) > 0 || c?.lastVisit) &&
    cadastreMatches(reg, { id: c.id, passport: c.passport, fullName: c.fullName }));
}
