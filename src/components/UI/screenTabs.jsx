import React, { lazy, useRef } from 'react';

/**
 * Держит экран построенным, пока кассир на другой вкладке. Постройка «Номеров» и панели
 * занимает сотни мс на тысячи элементов, а возвращаются на них постоянно. Скрытый экран
 * получает прежний элемент (то же значение children) и не перерисовывается от данных:
 * свежие данные он получит одним обновлением, когда на него вернутся.
 * Только для экранов без глобальных клавиш: обработчики скрытого экрана продолжают работать.
 */
export const KeepAliveTab = ({ active, children }) => {
    const element = useRef(null);
    if (active) element.current = children;
    if (element.current === null) return null;
    return <div style={active ? undefined : { display: 'none' }}>{element.current}</div>;
};

/**
 * Экран отдельным файлом: код редких экранов не разбирается при каждом запуске.
 * На сайте после выкатки старая страница может запросить уже удалённый файл: один раз
 * перезагружаем её, чтобы получить новую версию, вместо ошибки на экране.
 */
const RELOAD_KEY = 'hostella_chunk_reload';
export const lazyScreen = (load) => lazy(() => load().then((m) => {
    try { sessionStorage.removeItem(RELOAD_KEY); } catch (_) { /* приватный режим */ }
    return m;
}).catch((err) => {
    let already = true;
    try { already = !!sessionStorage.getItem(RELOAD_KEY); if (!already) sessionStorage.setItem(RELOAD_KEY, '1'); } catch (_) { /* приватный режим */ }
    if (already) throw err;
    window.location.reload();
    return new Promise(() => {});
}));
