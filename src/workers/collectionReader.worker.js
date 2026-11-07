/**
 * Фоновый поток чтения больших коллекций. Скачивание, разбор и запись в кэш идут здесь,
 * а главный поток получает готовые записи порциями и не замирает.
 *
 * Запрос: { id, op: 'cache' | 'fetch', name, restBase, parent, token, meta, keep }
 * keep — какие записи отдать главному потоку (firestoreRest.matchesKeep): на диске лежат все.
 * Ответы: { id, type: 'chunk', docs }, затем { id, type: 'done', found, meta }
 *         или { id, type: 'error', message }.
 */
import { decodeDocument, matchesKeep, pageDocuments, pageQuery } from '../utils/firestoreRest';

const DB_NAME = 'hostella-collections';
const STORE = 'kv';
const PAGE_SIZE = 1000;
const CHUNK_SIZE = 400;

const openDb = () => new Promise((resolve, reject) => {
  const r = indexedDB.open(DB_NAME, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE);
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});
const cacheGet = async (key) => {
  const d = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const q = d.transaction(STORE).objectStore(STORE).get(key);
      q.onsuccess = () => resolve(q.result || null);
      q.onerror = () => reject(q.error);
    });
  } finally { d.close(); }
};
const cachePut = async (key, value) => {
  const d = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } finally { d.close(); }
};

// Порции с паузой: главный поток успевает обработать ввод между сообщениями
const sendChunks = async (id, docs) => {
  for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
    self.postMessage({ id, type: 'chunk', docs: docs.slice(i, i + CHUNK_SIZE) });
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function download({ name, restBase, parent, token }) {
  const url = `${restBase}/${parent}:runQuery`;
  const docs = [];
  let lastName = null;
  for (;;) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(pageQuery(name, PAGE_SIZE, lastName)),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const page = pageDocuments(await res.json());
    for (const d of page) docs.push(decodeDocument(d));
    if (page.length < PAGE_SIZE) return docs;
    lastName = page[page.length - 1].name;
  }
}

self.onmessage = async ({ data: m }) => {
  try {
    if (m.op === 'cache') {
      const hit = await cacheGet(m.name).catch(() => null);
      if (hit?.docs?.length) await sendChunks(m.id, hit.docs.filter((d) => matchesKeep(d, m.keep)));
      self.postMessage({ id: m.id, type: 'done', found: !!hit?.docs?.length, meta: hit?.meta || null });
      return;
    }
    const docs = await download(m);
    // Сбой записи на диск не мешает работе: данные всё равно получены
    await cachePut(m.name, { docs, meta: m.meta }).catch(() => {});
    await sendChunks(m.id, docs.filter((d) => matchesKeep(d, m.keep)));
    self.postMessage({ id: m.id, type: 'done', found: true, meta: m.meta });
  } catch (e) {
    self.postMessage({ id: m.id, type: 'error', message: String(e?.message || e) });
  }
};
