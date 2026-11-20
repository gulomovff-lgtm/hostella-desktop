// Рабочие по договору: продление в 00:00 по Ташкенту (решение владельца
// 20.11.2026). Сутки — календарные дни от заезда до сегодня включительно;
// сумма идёт в договор (ставка договора × сутки, на экране).
// Те же правила — в src/utils/contractWorkers.js: менять вместе.
'use strict';

const TZ_MS = 5 * 3600 * 1000;
const tashkentYmd = (d) => {
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  if (!Number.isFinite(t)) return '';
  return new Date(t + TZ_MS).toISOString().slice(0, 10);
};
const ymdToUtc = (ymd) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));

function workerDays(checkInDate, now) {
  const from = tashkentYmd(checkInDate);
  const to = tashkentYmd(now);
  if (!from || !to) return 0;
  return Math.max(1, Math.round((ymdToUtc(to) - ymdToUtc(from)) / 86400000) + 1);
}

function nextTashkentMidnightIso(now) {
  const today = tashkentYmd(now);
  return new Date(ymdToUtc(today) + 86400000 - TZ_MS).toISOString();
}

// Поля, которые нужно записать живущему рабочему; null — менять нечего.
// Считается от заезда, а не «+1»: пропущенный запуск исправится следующим.
function extendPatch(g, now) {
  if (!g || !g.contractWorker || g.status !== 'active' || !g.checkInDate) return null;
  const days = workerDays(g.checkInDate, now);
  const checkOutDate = nextTashkentMidnightIso(now);
  if (Number(g.days) === days && g.checkOutDate === checkOutDate) return null;
  return { days, checkOutDate };
}

async function extendActiveWorkers(db, base, now = new Date()) {
  const snap = await db.collection(`${base}/guests`)
    .where('contractWorker', '==', true).where('status', '==', 'active').get();
  let changed = 0;
  let batch = db.batch(); let n = 0;
  for (const d of snap.docs) {
    const patch = extendPatch(d.data(), now);
    if (!patch) continue;
    batch.update(d.ref, { ...patch, autoExtendedAt: now.toISOString() });
    changed++; n++;
    if (n >= 400) { await batch.commit(); batch = db.batch(); n = 0; }
  }
  if (n) await batch.commit();
  return { total: snap.size, changed };
}

module.exports = { tashkentYmd, workerDays, nextTashkentMidnightIso, extendPatch, extendActiveWorkers };
