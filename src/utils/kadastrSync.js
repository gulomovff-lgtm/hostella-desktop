// Сверка листков сайта кадастра (reg.emehmon.uz) с записями кадастра в
// Hostella (решение владельца 13.11.2026): после входа и раз в час программа
// сама поправляет дни и создаёт запись тем, кто на сайте есть, а в Hostella
// не указан. Сайт — источник правды о сроке; деньги не трогаем (сумма с сайта
// в списке не приходит, расход пишется при оформлении через программу).
import { normPass, cadastreEndFor, cadastreDaysFor, localYmd, cadastreHouseFor } from './registrationStatus.js';
import { cadastreLimitFor } from './kadastrPortal.js';

/** 'dd.mm.yyyy HH:MM' → { ymd, iso } (местное время) или null. */
export function parseSiteDt(dt) {
  const m = String(dt || '').match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
  if (Number.isNaN(d.getTime())) return null;
  return { ymd: `${m[3]}-${m[2]}-${m[1]}`, iso: d.toISOString() };
}

const addDays = (ymd, n) => {
  const d = new Date(ymd + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return localYmd(d);
};

/**
 * План сверки.
 *  rows — строки сайта (новые сверху), regs — записи кадастра Hostella,
 *  guests — гости, cadastres — дома, createHostelId — филиал, которому эта
 *  касса заводит недостающие записи (null — только правим, не создаём:
 *  две кассы не должны создать одну запись дважды).
 * Ответ: { fixes: [{ regId, patch }], creates: [data], unmatched: [row],
 *   toRegister: [{ reg, guest, days }] } — записи, у которых сегодня нет
 *   листка на сайте (продлили в Hostella, или листок не прошёл): программа
 *   оформит его сама, без ручной кнопки.
 */
// Отказы сайта, которые повтором не исправить, — пробуем раз в сутки
const HARD_ERRORS = new Set(['not_found', 'no_citizen', 'no_cadastre', 'no_psp_date', 'days_limit', 'housing_blocked', 'compliance_danger', 'missing']);
export function planKadastrSync({ rows = [], regs = [], guests = [], cadastres = [], createHostelId = null, now = new Date(), limit = 20 } = {}) {
  const today = localYmd(now);
  const since = addDays(today, -3);
  const seen = new Set();
  const fixes = [], creates = [], unmatched = [];
  // Докуда у человека есть листок на сайте (последний листок, любой давности)
  const siteEnd = new Map();
  for (const row of rows) {
    const pass = normPass(row?.passport);
    const at = parseSiteDt(row?.dt);
    const days = Math.round(Number(row?.wdays) || 0);
    if (!pass || !at || days < 1) continue;
    const end = cadastreEndFor(at.ymd, days);
    if (end && (!siteEnd.has(pass) || siteEnd.get(pass) < end)) siteEnd.set(pass, end);
  }

  for (const row of rows) {
    const pass = normPass(row?.passport);
    const at = parseSiteDt(row?.dt);
    const days = Math.round(Number(row?.wdays) || 0);
    if (!pass || !at || days < 1 || seen.has(pass)) continue;
    seen.add(pass);                                   // у человека важен последний листок
    const start = at.ymd;
    const end = cadastreEndFor(start, days);
    if (!end || end < since) continue;                // давно кончился — историю не трогаем

    const mine = (regs || []).filter(r => r && r.status !== 'removed' && normPass(r.passport) === pass);
    // Запись, к которой относится листок: её срок пересекается с листком или
    // кончился накануне (продление новым листком)
    const reg = mine
      .filter(r => r.startDate && r.endDate && r.startDate <= end && addDays(r.endDate, 1) >= start)
      .sort((a, b) => String(b.endDate).localeCompare(String(a.endDate)))[0];

    const portalOf = (prev = {}) => ({
      ...prev,
      status: 'saved',
      listokId: String(row.id || prev.listokId || ''),
      savedAt: prev.listokId === String(row.id) && prev.savedAt ? prev.savedAt : at.iso,
      payUrl: row.payUrl || prev.payUrl || '',
      ...(row.paid ? { paidAt: prev.paidAt || now.toISOString() } : {}),
    });

    if (reg) {
      // Продление новым листком: начало оставляем раннее, конец — по сайту
      const startDate = reg.startDate <= start ? reg.startDate : start;
      const patch = {};
      // Продлили в Hostella после этого листка — конец не откатываем:
      // новый листок на добавленные дни оформит toRegister
      const pendingExt = reg.endDate > end && reg.extendedAt && reg.extendedAt > at.iso;
      if (!pendingExt) {
        if (reg.endDate !== end) patch.endDate = end;
        if (startDate !== reg.startDate) patch.startDate = startDate;
        const d = cadastreDaysFor(startDate, end);
        if (Number(reg.days) !== d) patch.days = d;
      }
      const p = portalOf(reg.portal || {});
      const pr = reg.portal || {};
      if (pr.listokId !== p.listokId || pr.payUrl !== p.payUrl || (!!pr.paidAt) !== (!!p.paidAt) || pr.status !== 'saved') patch.portal = p;
      if (Object.keys(patch).length) fixes.push({ regId: reg.id, patch });
      continue;
    }

    if (end < today) continue;                        // кончился — не создаём
    const guest = (guests || []).find(g => g && g.status === 'active' && g.roomId !== 'DEBT_ONLY' && normPass(g.passport) === pass);
    if (!guest) { unmatched.push(row); continue; }
    const hostelId = guest.hostelId || 'hostel1';
    if (!createHostelId || createHostelId !== hostelId) continue;
    const house = cadastreHouseFor(hostelId, cadastres);
    creates.push({
      guestId: guest.id, guestName: guest.fullName || row.name || '', passport: guest.passport || row.passport,
      birthDate: guest.birthDate || '', country: guest.country || '', phone: guest.phone || '',
      cadastreId: house?.id || null, cadastreAddress: house?.address || house?.name || '',
      cadastreName: house?.name || '', cadastreOwner: house?.owner || '',
      hostelId, startDate: start, endDate: end, days,
      amount: 0, addToExpenses: false, quiet: true, silent: true,
      portal: portalOf({}),
    });
  }
  // Сегодня кадастр в Hostella действует, а листка на сайте нет — оформить
  const toRegister = [];
  const dayAgo = now.getTime() - 24 * 3600 * 1000;
  const twoHoursAgo = now.getTime() - 2 * 3600 * 1000;
  for (const reg of regs || []) {
    if (!reg || reg.status === 'removed' || !reg.startDate || !reg.endDate) continue;
    if (reg.startDate > today || reg.endDate < today) continue;
    if (!createHostelId || (reg.hostelId || 'hostel1') !== createHostelId) continue;
    const pass = normPass(reg.passport);
    if (!pass) continue;
    if ((siteEnd.get(pass) || '') >= today) continue;
    const p = reg.portal || {};
    const pAt = new Date(p.at || p.savedAt || 0).getTime();
    if (p.status === 'error' && HARD_ERRORS.has(p.error) && pAt > dayAgo) continue;
    if ((p.status === 'saved' || p.status === 'pending') && pAt > twoHoursAgo) continue;   // оформляется сейчас / список сайта мог не успеть
    const guest = (guests || []).find(g => g && g.status === 'active' && g.roomId !== 'DEBT_ONLY' &&
      ((reg.guestId && g.id === reg.guestId) || normPass(g.passport) === pass));
    if (!guest) continue;
    // Предел сайта известен (30 дней от въезда) и уже пройден — не стучимся
    const lim = cadastreLimitFor(guest, [reg]);
    if (lim && lim < today) {
      // 30 дней от въезда (КПП) прошли: продление в Hostella откатываем к
      // последнему листку — дальше гость пойдёт в e-mehmon
      const back = siteEnd.get(pass) || '';
      if (back && reg.endDate > back) fixes.push({ regId: reg.id, patch: { endDate: back, days: cadastreDaysFor(reg.startDate, back) } });
      continue;
    }
    toRegister.push({ reg, guest, siteEnd: siteEnd.get(pass) || '', days: Math.max(1, cadastreDaysFor(today, lim && lim < reg.endDate ? lim : reg.endDate)) });
  }
  // Не больше limit записей за раз: остальное — в следующую сверку
  return { fixes: fixes.slice(0, limit), creates: creates.slice(0, limit), unmatched, toRegister: toRegister.slice(0, 2) };
}
