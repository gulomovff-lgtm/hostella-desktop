/**
 * Ручная резервная копия: что выгружается и как отличить полную копию от старой.
 *
 * Списки из useAppData для копии не годятся: это окно за HISTORY_WINDOW_DAYS
 * (utils/historyWindow), а расходы на экране ещё и урезаны фильтром хостела.
 * Поэтому коллекции читаются целиком разовым запросом по нажатию на кнопку;
 * ошибка чтения любой из них отменяет копию целиком — неполный файл не создаётся.
 *
 * Без Firestore и React — покрыто тестами (tests/backup-export.test.mjs).
 */

export const BACKUP_COLLS = ['rooms', 'guests', 'expenses', 'payments', 'users', 'tasks', 'shifts'];

// 1.0 собиралась из списков экрана и после окна истории могла быть неполной.
export const BACKUP_VERSION = '2.0';

/**
 * Прочитать все коллекции по очереди и собрать объект копии.
 * readColl(name) → массив записей с id; onProgress({ done, total, counts }).
 */
export async function collectBackup(readColl, { exportedBy, now = new Date(), onProgress } = {}) {
  const data = {};
  const counts = {};
  let done = 0;
  for (const coll of BACKUP_COLLS) {
    const items = await readColl(coll);
    data[coll] = coll === 'users' ? items.map(u => ({ ...u, pass: '***' })) : items;
    counts[coll] = items.length;
    done += 1;
    onProgress?.({ done, total: BACKUP_COLLS.length, counts: { ...counts } });
  }
  return {
    exportedAt: now.toISOString(),
    exportedBy,
    version: BACKUP_VERSION,
    complete: true,
    data,
    stats: counts,
  };
}

/** Файл собран целиком из базы (старые копии этой отметки не имеют). */
export function isCompleteBackup(parsed) {
  return parsed?.complete === true;
}
