/**
 * Список клиентов из двух частей: база (разовое чтение коллекции) и изменения
 * (живая подписка только на недавно изменённые записи). См. utils/clientsStore.js.
 *
 * Без Firestore и React — покрыто тестами (tests/clients-list.test.mjs).
 */
import { alphabetical } from './liveList.js';

// Базу перечитываем раз в сутки: так подтягиваются записи, изменённые без отметки
// времени (касса на старой версии), и чужие удаления, о которых не дали сигнал.
export const CLIENTS_REFRESH_MS = 24 * 60 * 60 * 1000;
// Окно подписки на изменения с запасом: часы касс могут врать на часы, а база
// может быть прочитана сутки назад. Записей за такое окно — единицы.
export const CLIENTS_DELTA_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export const isClientsBaseStale = (readAt, now = Date.now()) => !readAt || now - readAt >= CLIENTS_REFRESH_MS;

/**
 * Накопитель списка. Изменение сильнее базы: база могла быть прочитана раньше него.
 * Неизменённые записи сохраняют объект — кэши экранов не сбрасываются (как в liveList).
 */
export function createClientsList(order = alphabetical('fullName')) {
  let base = new Map();
  const overlay = new Map();
  const gone = new Set();
  const toItem = (d) => ({ ...d });

  const list = () => {
    const merged = new Map(base);
    for (const [id, o] of overlay) merged.set(id, o);
    for (const id of gone) merged.delete(id);
    const items = Array.from(merged.values());
    const keys = new Map(items.map((o) => [o.id, order.key(o)]));
    return items.sort((a, b) => order.compare(keys.get(a.id), keys.get(b.id)));
  };

  return {
    list,
    /** Новая база: массив записей с id. Запись, которой нет в новой базе, исчезает. */
    setBase(docs = []) {
      base = new Map(docs.map((d) => [d.id, base.has(d.id) && same(base.get(d.id), d) ? base.get(d.id) : toItem(d)]));
      // Изменения старше новой базы держать незачем, но отличить их нельзя (часы),
      // поэтому оставляем: подписка всё равно присылает только то, что менялось.
      return list();
    },
    /** changes: [{ type: 'added'|'modified'|'removed', id, data }]. */
    applyDelta(changes = []) {
      if (!changes.length) return null;
      for (const c of changes) {
        if (c.type === 'removed') { overlay.delete(c.id); gone.add(c.id); continue; }
        gone.delete(c.id);
        overlay.set(c.id, { id: c.id, ...c.data });
      }
      return list();
    },
  };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
