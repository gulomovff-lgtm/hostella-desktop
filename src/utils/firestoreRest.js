/**
 * Чтение коллекции через REST Firestore: разбор ответа и постраничный запрос.
 * Работает в фоновом потоке (workers/collectionReader.worker.js), без SDK.
 *
 * Без браузера и Firestore — покрыто тестами (tests/firestore-rest.test.mjs).
 */

/**
 * Значение REST в обычное значение JS. Время — строкой ISO: большинство дат в базе и так
 * ISO-строки, а экраны разбирают их через new Date(...).
 */
export function decodeValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('referenceValue' in v) return v.referenceValue;
  if ('bytesValue' in v) return v.bytesValue;
  if ('geoPointValue' in v) return { latitude: v.geoPointValue.latitude ?? 0, longitude: v.geoPointValue.longitude ?? 0 };
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields);
  return null;
}

export function decodeFields(fields = {}) {
  const out = {};
  for (const k of Object.keys(fields)) out[k] = decodeValue(fields[k]);
  return out;
}

/** Документ REST в запись с id: последний кусок полного имени. */
export function decodeDocument(document) {
  const id = document.name.slice(document.name.lastIndexOf('/') + 1);
  return { id, ...decodeFields(document.fields) };
}

/** Тело запроса одной страницы: порядок по имени документа, продолжение после lastName. */
export function pageQuery(collectionId, pageSize, lastName = null) {
  return {
    structuredQuery: {
      from: [{ collectionId }],
      orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }],
      limit: pageSize,
      ...(lastName ? { startAt: { values: [{ referenceValue: lastName }], before: false } } : {}),
    },
  };
}

/** Строки ответа runQuery в документы REST; строки без документа (служебные) пропускаем. */
export function pageDocuments(rows) {
  if (!Array.isArray(rows)) throw new Error(`Ответ сервера: ${JSON.stringify(rows).slice(0, 160)}`);
  return rows.filter((r) => r.document).map((r) => r.document);
}

/**
 * Отбор записей в фоновом потоке: запись подходит, если выполнено хотя бы одно условие.
 * Условие: { field, gte } — не раньше границы, { field, in } — из списка, { field, isNull } — null.
 * Пустой отбор — все записи.
 */
export function matchesKeep(doc, keep) {
  if (!keep || !keep.length) return true;
  return keep.some((c) => {
    const v = doc[c.field];
    if (c.isNull) return v === null;
    if (c.in) return c.in.includes(v);
    return String(v ?? '') >= c.gte;
  });
}
