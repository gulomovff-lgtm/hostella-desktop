/**
 * Живой список коллекции Firestore по изменениям снимка (docChanges), а не
 * пересборкой всего массива.
 *
 * Раньше каждый снимок (одна оплата, одна отметка e-mehmon на любой кассе)
 * заново создавал объекты ВСЕХ документов и сортировал их, разбирая даты в
 * компараторе. Все гости получали новые объекты — кэши экранов (useMemo,
 * stableView, memo комнат и мест) сбрасывались, и программа пересчитывала
 * всё. Здесь неизменённые документы сохраняют свой объект, ключ сортировки
 * считается один раз на документ, а снимок без изменений (только метаданные)
 * не даёт нового массива вовсе.
 *
 * Без Firestore и React — покрыто тестами (tests/live-list.test.mjs).
 */

const collator = typeof Intl !== 'undefined' ? new Intl.Collator('ru') : null;

/** Время в мс для сортировки; плохая дата — 0 (в конец при «новые сверху»). */
export const timeKey = (v) => {
  if (!v) return 0;
  const ms = typeof v === 'number' ? v : (typeof v?.toMillis === 'function' ? v.toMillis() : Date.parse(v));
  return Number.isFinite(ms) ? ms : 0;
};

/** Новые сверху по полю даты. */
export const newestFirst = (field) => ({
  key: (o) => timeKey(o[field]),
  compare: (a, b) => b - a,
});

/** По алфавиту (русская сортировка) по полю. */
export const alphabetical = (field) => ({
  key: (o) => String(o[field] || ''),
  compare: (a, b) => (collator ? collator.compare(a, b) : (a < b ? -1 : a > b ? 1 : 0)),
});

/**
 * Объединить несколько живых списков одной коллекции (окно, договоры…) без
 * дублей по id; объекты не копируются — кэши экранов сохраняются.
 */
export function mergeLists(lists, order = null) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const o of list || []) {
      if (!o || seen.has(o.id)) continue;
      seen.add(o.id);
      out.push(o);
    }
  }
  if (order) {
    const keys = new Map(out.map((o) => [o.id, order.key(o)]));
    out.sort((a, b) => order.compare(keys.get(a.id), keys.get(b.id)));
  }
  return out;
}

/**
 * Создаёт накопитель списка. apply(changes) → новый массив или null, если
 * менять нечего. changes: [{ type: 'added'|'modified'|'removed', id, data }].
 * order: { key, compare } — порядок списка; extra — поля, добавляемые к объекту.
 */
export function createLiveList({ order = null, extra = null } = {}) {
  const byId = new Map();
  const keys = new Map();
  let started = false;
  return function apply(changes) {
    if (started && (!changes || changes.length === 0)) return null;
    started = true;
    for (const c of changes || []) {
      if (c.type === 'removed') { byId.delete(c.id); keys.delete(c.id); continue; }
      const obj = extra ? { id: c.id, ...c.data, ...extra } : { id: c.id, ...c.data };
      byId.set(c.id, obj);
      if (order) keys.set(c.id, order.key(obj));
    }
    const list = Array.from(byId.values());
    if (order) list.sort((a, b) => order.compare(keys.get(a.id), keys.get(b.id)));
    return list;
  };
}
