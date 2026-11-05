/**
 * Клиенты: полный список в памяти без живой подписки на всю коллекцию.
 *
 * Весь список нужен: заселение, деньги и автосинхронизация ищут клиента по нему,
 * и на неполном списке программа наплодила бы дубликатов. А вот подписка на него не
 * нужна и дорога: с ней каждая запись в базу занимает в 2–5 раз дольше (замер
 * 05.11.2026, окно истории + 2282 клиента: 224–595 мс против 80–128 мс).
 *
 * Поэтому:
 *   • база — разовое чтение через firestore/lite при входе и раз в сутки;
 *   • изменения — живая подписка на записи с updatedAt за последние дни. Поэтому
 *     КАЖДАЯ запись в клиента обязана ставить clientStamp() (сторож в
 *     tests/clients-list.test.mjs), иначе другие кассы увидят её только через сутки;
 *   • чужие удаления — сигнал settings/clientsRev, все кассы перечитывают базу;
 *   • без связи — копия последней базы в IndexedDB; нет ни копии, ни связи —
 *     обычная подписка, как раньше (она работает от кэша Firestore).
 */
import { collection, doc, onSnapshot, query, setDoc, Timestamp, where } from 'firebase/firestore';
import { collection as liteCollection, getDocs as liteGetDocs, getFirestore as getLiteFirestore } from 'firebase/firestore/lite';
import { app, db, PUBLIC_DATA_PATH } from '../firebase';
import { createClientsList, isClientsBaseStale, CLIENTS_DELTA_WINDOW_MS, CLIENTS_REFRESH_MS } from './clientsList';

const FULL_READ_TIMEOUT_MS = 30000;
const IDB_NAME = 'hostella-clients';
const IDB_STORE = 'kv';
const IDB_KEY = 'base';

/**
 * Отметка в каждую запись клиента: по ней другие кассы узнают об изменении.
 * Время кассы, а не serverTimestamp: запись с ещё не подтверждённым временем сервера
 * не подходит под запрос по updatedAt, и новый клиент, созданный без связи, не появлялся
 * в списке (проверено на эмуляторе). Часы кассы отстали больше окна подписки —
 * другие кассы увидят запись при суточном перечитывании.
 */
export const clientStamp = () => ({ updatedAt: Timestamp.now() });

const revRef = () => doc(db, ...PUBLIC_DATA_PATH, 'settings', 'clientsRev');

/** После удаления клиентов: подписка на изменения об удалении не узнает. */
export const bumpClientsRev = () =>
  setDoc(revRef(), { rev: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }).catch((e) => console.warn('[clients] rev', e.message));

const openCache = () => new Promise((resolve, reject) => {
  const r = indexedDB.open(IDB_NAME, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

async function readCache() {
  try {
    const d = await openCache();
    return await new Promise((resolve) => {
      const q = d.transaction(IDB_STORE).objectStore(IDB_STORE).get(IDB_KEY);
      q.onsuccess = () => { d.close(); resolve(q.result || null); };
      q.onerror = () => { d.close(); resolve(null); };
    });
  } catch { return null; }
}

async function writeCache(value) {
  try {
    const d = await openCache();
    const tx = d.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, IDB_KEY);
    tx.oncomplete = () => d.close();
    tx.onerror = () => d.close();
  } catch (e) { console.warn('[clients] copy', e.message); }
}

async function readFull() {
  const read = liteGetDocs(liteCollection(getLiteFirestore(app, 'hostella'), ...PUBLIC_DATA_PATH, 'clients'));
  const snap = await Promise.race([
    read,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), FULL_READ_TIMEOUT_MS)),
  ]);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * onList(массив) — на каждое изменение; onReady() — один раз, когда список можно
 * считать полным (автоматика ждёт его, чтобы не создавать дубликаты). Вернёт отписку.
 */
export function startClientsSync({ onList, onReady }) {
  const store = createClientsList();
  const col = collection(db, ...PUBLIC_DATA_PATH, 'clients');
  let stopped = false;
  let readAt = 0;
  let knownRev = null;
  let latestRev = null;
  let reading = false;
  let fallbackStop = null;
  let ready = false;
  const markReady = () => { if (!ready && !stopped) { ready = true; onReady?.(); } };
  const emit = (next) => { if (next && !stopped) onList(next); };

  const refresh = async () => {
    if (reading || stopped || fallbackStop) return;
    reading = true;
    const revAtStart = latestRev;
    try {
      const docs = await readFull();
      if (stopped) return;
      readAt = Date.now();
      knownRev = revAtStart;
      emit(store.setBase(docs));
      writeCache({ readAt, rev: revAtStart, docs });
      markReady();
    } catch (e) {
      console.warn('[clients] чтение базы', e?.message);
      if (!stopped && !ready) {
        // Ни копии, ни чтения: работаем подпиской от кэша Firestore
        fallbackStop = onSnapshot(col, (snap) => {
          emit(store.setBase(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
          markReady();
        }, () => markReady());
      }
    } finally {
      reading = false;
    }
  };

  const since = Timestamp.fromMillis(Date.now() - CLIENTS_DELTA_WINDOW_MS);
  const stopDelta = onSnapshot(query(col, where('updatedAt', '>=', since)), (snap) => {
    emit(store.applyDelta(snap.docChanges().map((c) => ({ type: c.type, id: c.doc.id, data: c.doc.data() }))));
  }, (e) => console.warn('[clients] изменения', e.message));

  let revSeen = false;
  const stopRev = onSnapshot(revRef(), (snap) => {
    latestRev = snap.exists() ? snap.data().rev : null;
    if (revSeen || readAt) { if (latestRev !== knownRev) refresh(); }
    revSeen = true;
  }, () => {});

  const timer = setInterval(() => { if (isClientsBaseStale(readAt)) refresh(); }, Math.min(CLIENTS_REFRESH_MS, 60 * 60 * 1000));

  (async () => {
    const copy = await readCache();
    if (stopped) return;
    if (copy?.docs?.length) {
      readAt = copy.readAt;
      knownRev = copy.rev ?? null;
      emit(store.setBase(copy.docs));
      markReady();
    }
    if (isClientsBaseStale(readAt) || (revSeen && latestRev !== knownRev)) await refresh();
  })();

  return () => {
    stopped = true;
    clearInterval(timer);
    stopDelta();
    stopRev();
    fallbackStop?.();
  };
}
