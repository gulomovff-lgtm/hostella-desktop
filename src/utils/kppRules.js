/**
 * kppRules.js — КПП иностранного гостя: разбор данных портала и правило сроков.
 *
 * ── ЗАЧЕМ ───────────────────────────────────────────────────────────────
 *
 * Иностранец обязан быть зарегистрирован в течение «окна» после пересечения
 * границы (КПП); окно зависит от гражданства. После окна он должен быть
 * зарегистрирован где-то непрерывно: выехал из одного отеля — в течение
 * суток заехал в другой. Разрыв длиннее — нарушение, и по закону такого
 * гостя направляют в миграционную службу, а не регистрируют молча.
 *
 * Данные для этого решения лежат в e-mehmon: дата прохода КПП — на второй
 * вкладке мастера, список прошлых проживаний — на последнем шаге перед
 * «Сохранить». Их DOM-разметка нам не задокументирована, поэтому здесь
 * разбор ЭВРИСТИЧЕСКИЙ: по ключам полей, подписям и заголовкам таблиц.
 * Правило разбора — лучше «не нашли», чем «нашли не то»: без даты КПП
 * система ничего не решает и ничего не блокирует.
 *
 * Без JSX и Firebase — покрыто тестами.
 */

/** Срок (дней) без регистрации, день прохода КПП = 1-й день. */
export const getRegistrationWindow = (country) => {
  switch (country) {
    case 'Казахстан':
      return 30;
    case 'Россия':
    case 'Азербайджан':
    case 'Белоруссия':
    case 'Беларусь':
      return 15;
    case 'Таджикистан':
      return 10;
    default:
      return 3;
  }
};

/** Сколько суток допустимо между выездом из другого отеля и заездом к нам. */
export const HOTEL_GAP_DAYS = 1;

const DATE_RX = /(\d{2})[.\-/](\d{2})[.\-/](\d{4})|(\d{4})-(\d{2})-(\d{2})/;
const DATE_RX_G = /(\d{2})[.\-/](\d{2})[.\-/](\d{4})|(\d{4})-(\d{2})-(\d{2})/g;

/** «dd.mm.yyyy» / «dd/mm/yyyy» / «yyyy-mm-dd» → 'yyyy-mm-dd', иначе null. */
export const toIsoDate = (str) => {
  const m = DATE_RX.exec(String(str || ''));
  if (!m) return null;
  const [y, mo, d] = m[4] ? [m[4], m[5], m[6]] : [m[3], m[2], m[1]];
  const yy = +y, mm = +mo, dd = +d;
  if (!yy || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${y}-${mo}-${d}`;
};

const allDates = (str) => {
  const out = [];
  const s = String(str || '');
  DATE_RX_G.lastIndex = 0;
  let m;
  while ((m = DATE_RX_G.exec(s))) {
    const iso = toIsoDate(m[0]);
    if (iso) out.push(iso);
  }
  return out;
};

const localMidnight = (iso) => {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getTime();
};

/** Календарных суток от a до b (b − a), по местной полуночи; NaN если дата битая. */
export const daysBetween = (a, b) => {
  const ta = localMidnight(a), tb = localMidnight(b);
  if (ta == null || tb == null) return NaN;
  return Math.round((tb - ta) / 86400000);
};

export const todayIso = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

// Ключи/подписи, за которыми в портале стоит дата и номер прохода границы.
export const KPP_KEY_RX = /kpp|кпп|chegara|kirish\s*sana|kirgan|въезд|entry|cross|arrival\s*date|kelgan/i;
export const KPP_NUM_RX = /(kpp|кпп|chegara).*(no|№|nomer|raqam|number)|(no|№|nomer|raqam|number).*(kpp|кпп|chegara)/i;
// Заголовки таблицы прошлых проживаний.
export const STAY_HDR_RX = /mehmonxona|hotel|отель|гостин|joylash|yashash|turar|sana|date|дата|kirish|chiqish|kelish|ketish|заезд|выезд|checkin|checkout/i;

/**
 * Разбор дампа мастера e-mehmon.
 * @param {{fields?:object, labels?:object, tables?:Array<{headers?:string[], rows?:string[][]}>, blocks?:string[]}} probe
 * @param {{birthDate?:string, passportIssueDate?:string, today?:string}} opts — даты, которые НЕ могут быть датой КПП
 * @returns {{kppDate:string|null, kppNumber:string|null, stays:Array<{hotel:string,from:string|null,to:string|null}>, lastCheckout:string|null, officialName:string}}
 */
export function parseEmehmonProbe(probe = {}, opts = {}) {
  const fields = probe?.fields || {};
  const labels = probe?.labels || {};
  const tables = Array.isArray(probe?.tables) ? probe.tables : [];
  const blocks = Array.isArray(probe?.blocks) ? probe.blocks : [];
  const today = opts.today || todayIso();
  const banned = new Set([toIsoDate(opts.birthDate), toIsoDate(opts.passportIssueDate)].filter(Boolean));
  const plausible = (iso) => !!iso && !banned.has(iso) && iso <= today && iso >= '2000-01-01';

  let kppDate = null, kppNumber = null;
  const scan = (map) => {
    for (const [key, raw] of Object.entries(map)) {
      const val = String(raw ?? '').trim();
      if (!val) continue;
      if (KPP_NUM_RX.test(key) && !kppNumber && !toIsoDate(val)) { kppNumber = val.slice(0, 40); continue; }
      if (KPP_KEY_RX.test(key)) {
        const iso = toIsoDate(val);
        if (iso && plausible(iso) && !kppDate) kppDate = iso;
        else if (!iso && !kppNumber && /\d/.test(val)) kppNumber = val.slice(0, 40);
      }
    }
  };
  scan(fields);
  scan(labels);
  if (!kppDate) {
    // Таблица «ключ — значение»: первая ячейка — подпись, в строке — дата.
    for (const tb of tables) {
      for (const row of (tb?.rows || [])) {
        if (!Array.isArray(row) || !row.length) continue;
        if (!KPP_KEY_RX.test(String(row[0]))) continue;
        const iso = allDates(row.join(' ')).find(plausible);
        if (iso) { kppDate = iso; break; }
      }
      if (kppDate) break;
    }
  }

  // Прошлые проживания: таблица с «отельными» заголовками и ≥2 датами в строках.
  let stays = [];
  const rowStays = (rows) => {
    const out = [];
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const cells = row.map(c => String(c ?? '').trim());
      const dates = allDates(cells.join(' | ')).sort();
      if (dates.length < 2) continue;
      const hotel = cells.find(c => c && !toIsoDate(c) && !/^\d+$/.test(c)) || '';
      out.push({ hotel: hotel.slice(0, 80), from: dates[0], to: dates[dates.length - 1] });
    }
    return out;
  };
  for (const tb of tables) {
    const headers = (tb?.headers || []).map(h => String(h ?? ''));
    const rows = tb?.rows || [];
    const hdrHits = headers.filter(h => STAY_HDR_RX.test(h)).length;
    const looksLikeStays = hdrHits >= 2 || (headers.length === 0 && rows.length > 0 && rowStays(rows).length === rows.length);
    if (!looksLikeStays) continue;
    const parsed = rowStays(rows);
    if (parsed.length) { stays = parsed; break; }
  }
  if (!stays.length && blocks.length) {
    // Запасной вариант: строки текста «Отель … 01.09.2026 … 05.09.2026».
    for (const b of blocks) {
      for (const line of String(b || '').split(/\n+/)) {
        const dates = allDates(line).sort();
        if (dates.length < 2) continue;
        const hotel = line.replace(DATE_RX_G, '').replace(/[|:;–—-]+/g, ' ').replace(/\s+/g, ' ').trim();
        stays.push({ hotel: hotel.slice(0, 80), from: dates[0], to: dates[dates.length - 1] });
      }
      if (stays.length) break;
    }
  }
  stays = stays.slice(0, 10).sort((a, b) => String(a.to).localeCompare(String(b.to)));
  const lastCheckout = stays.map(s => s.to).filter(d => d && d <= today).sort().pop() || null;

  return { kppDate, kppNumber, stays, lastCheckout, officialName: String(probe?.officialName || '') };
}

/**
 * Правило сроков.
 * @returns {{ok:boolean, reason:'no_kpp'|'within_window'|'after_hotel'|'gap_after_kpp'|'gap_after_hotel', dayNumber:number, window:number, gapDays:number}}
 */
export function assessKpp({ country, kppDate, lastCheckout, today, windowDays } = {}) {
  const window = Number.isFinite(windowDays) ? windowDays : getRegistrationWindow(country);
  const day = today || todayIso();
  if (!kppDate || !Number.isFinite(daysBetween(kppDate, day))) {
    return { ok: true, reason: 'no_kpp', dayNumber: 0, window, gapDays: 0 };
  }
  const dayNumber = daysBetween(kppDate, day) + 1;
  if (dayNumber <= window) return { ok: true, reason: 'within_window', dayNumber, window, gapDays: 0 };
  if (lastCheckout) {
    const gap = daysBetween(lastCheckout, day);
    if (Number.isFinite(gap) && gap <= HOTEL_GAP_DAYS) return { ok: true, reason: 'after_hotel', dayNumber, window, gapDays: gap };
    return { ok: false, reason: 'gap_after_hotel', dayNumber, window, gapDays: Number.isFinite(gap) ? gap : 0 };
  }
  return { ok: false, reason: 'gap_after_kpp', dayNumber, window, gapDays: dayNumber - window };
}

/**
 * Пора ли регистрировать иностранца: на ПРЕДПОСЛЕДНИЙ день окна (или сразу,
 * если он уже позже). В первые дни окна регистрация не нужна по закону —
 * и лишняя запись в портале только создаёт работу при выезде.
 */
export function registrationDue({ country, kppDate, today, windowDays } = {}) {
  const window = Number.isFinite(windowDays) ? windowDays : getRegistrationWindow(country);
  if (!kppDate) return false;
  const d = daysBetween(kppDate, today || todayIso());
  if (!Number.isFinite(d)) return false;
  return d + 1 >= Math.max(1, window - 1);
}

/** Обрезать дамп до предела размера документа (Firestore — 1 МБ, нам хватит ~8 КБ). */
export function trimProbe(probe, maxBytes = 8000) {
  const size = (o) => { try { return JSON.stringify(o).length; } catch { return Infinity; } };
  const p = {
    at: probe?.at || new Date().toISOString(),
    fields: { ...(probe?.fields || {}) },
    labels: { ...(probe?.labels || {}) },
    tables: (probe?.tables || []).map(t => ({ id: t?.id || '', headers: [...(t?.headers || [])], rows: (t?.rows || []).map(r => [...(r || [])]) })),
    blocks: [...(probe?.blocks || [])],
  };
  if (size(p) <= maxBytes) return p;
  p.blocks = [];
  if (size(p) <= maxBytes) return p;
  for (const t of p.tables) { while (t.rows.length > 5 && size(p) > maxBytes) t.rows.pop(); }
  if (size(p) <= maxBytes) return p;
  while (p.tables.length > 1 && size(p) > maxBytes) p.tables.pop();
  if (size(p) <= maxBytes) return p;
  const keys = Object.keys(p.labels);
  while (keys.length && size(p) > maxBytes) delete p.labels[keys.pop()];
  const fk = Object.keys(p.fields);
  while (fk.length && size(p) > maxBytes) delete p.fields[fk.pop()];
  return p;
}

/** Повторять «нет комнаты» не чаще раза в N часов (метка на госте, не в памяти). */
export function shouldRetryNoRoom(guest, now = Date.now(), hours = 6) {
  const at = guest?.emehmonNoRoomAt ? new Date(guest.emehmonNoRoomAt).getTime() : 0;
  if (!at || !Number.isFinite(at)) return true;
  return now - at >= hours * 3600 * 1000;
}
