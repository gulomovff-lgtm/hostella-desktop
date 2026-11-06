/**
 * Большая коллекция целиком в памяти, но без живой подписки на всю коллекцию.
 *
 * Подписка на всю историю разбирает десятки тысяч документов в главном потоке: окно
 * замирает на первом заходе, а каждая запись потом идёт в разы дольше. Поэтому:
 *   • база читается фоновым потоком (workers/collectionReader) и лежит на диске кассы:
 *     сервер спрашиваем раз в сутки, остальное время список открывается мгновенно;
 *   • изменения — живая подписка на записи с updatedAt за последние дни. Поэтому записи
 *     в такие коллекции ставят changeStamp() (сторож в tests/clients-list.test.mjs);
 *   • чужие удаления — сигнал в settings: все кассы перечитывают базу;
 *   • ни копии, ни связи — обычная подписка от кэша Firestore, как раньше.
 */
import { collection, doc, onSnapshot, query, setDoc, Timestamp, where } from 'firebase/firestore';
import Reader from '../workers/collectionReader.worker.js?worker&inline';
import { auth, db, PUBLIC_DATA_PATH, REST_DOCUMENTS } from '../firebase';
import { createClientsList, isClientsBaseStale, CLIENTS_DELTA_WINDOW_MS } from './clientsList';

const CHECK_STALE_MS = 60 * 60 * 1000;

/**
 * Отметка изменения. Время кассы, а не serverTimestamp: запись с ещё не подтверждённым
 * временем сервера не подходит под запрос по updatedAt, и новая запись без связи не
 * появлялась бы в списке (проверено на эмуляторе). Часы кассы отстали больше окна
 * подписки — другие кассы увидят запись при суточном перечитывании.
 */
export const changeStamp = () => ({ updatedAt: Timestamp.now() });

const revRef = (revDoc) => doc(db, ...PUBLIC_DATA_PATH, 'settings', revDoc);

/** Сигнал всем кассам перечитать базу: об удалении подписка на изменения не узнает. */
export const bumpRev = (revDoc, field) =>
  setDoc(revRef(revDoc), { [field]: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }, { merge: true })
    .catch((e) => console.warn('[collections] rev', e.message));

// Один фоновый поток на всю программу
let worker = null;
let seq = 0;
const pending = new Map();
const getWorker = () => {
  if (worker) return worker;
  worker = new Reader();
  worker.onmessage = ({ data: m }) => {
    const p = pending.get(m.id);
    if (!p) return;
    if (m.type === 'chunk') { p.docs.push(...m.docs); return; }
    pending.delete(m.id);
    if (m.type === 'error') p.reject(new Error(m.message));
    else p.resolve({ docs: p.docs, found: m.found, meta: m.meta });
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'worker'));
    pending.clear();
    worker = null;
  };
  return worker;
};
const ask = (msg) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, { docs: [], resolve, reject });
  getWorker().postMessage({ ...msg, id });
});

/**
 * name — коллекция; order — порядок списка ({ key, compare }) или null;
 * onList(массив) — на каждое изменение; onReady() — один раз, когда список полный;
 * revDoc, revField — где лежит сигнал «перечитать»; keep — отбор записей (firestoreRest.matchesKeep),
 * его считает фоновый поток. Вернёт отписку.
 */
export function startCollectionSync({ name, order = null, onList, onReady, revDoc, revField, keep = null }) {
  const store = createClientsList(order);
  const col = collection(db, ...PUBLIC_DATA_PATH, name);
  let stopped = false;
  let readAt = 0;
  let knownRev = null;
  let latestRev = null;
  let revSeen = false;
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
      const token = await auth.currentUser.getIdToken();
      const now = Date.now();
      const { docs } = await ask({ op: 'fetch', name, restBase: REST_DOCUMENTS, parent: PUBLIC_DATA_PATH.join('/'), token, keep, meta: { readAt: now, rev: revAtStart } });
      if (stopped) return;
      readAt = now;
      knownRev = revAtStart;
      emit(store.setBase(docs));
      markReady();
      // Копия клиентов прежнего формата (0.15.53–0.15.54) больше не нужна
      if (name === 'clients') { try { indexedDB.deleteDatabase('hostella-clients'); } catch (_) { /* нет доступа */ } }
    } catch (e) {
      console.warn(`[collections] ${name}: чтение базы`, e?.message);
      if (!stopped && !ready) {
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
  }, (e) => console.warn(`[collections] ${name}: изменения`, e.message));

  const stopRev = onSnapshot(revRef(revDoc), (snap) => {
    latestRev = snap.exists() ? (snap.data()[revField] ?? null) : null;
    if ((revSeen || readAt) && latestRev !== knownRev) refresh();
    revSeen = true;
  }, () => {});

  const timer = setInterval(() => { if (isClientsBaseStale(readAt)) refresh(); }, CHECK_STALE_MS);

  (async () => {
    const copy = await ask({ op: 'cache', name, keep }).catch(() => null);
    if (stopped) return;
    if (copy?.found) {
      readAt = copy.meta?.readAt || 0;
      knownRev = copy.meta?.rev ?? null;
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
