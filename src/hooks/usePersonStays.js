/**
 * Все визиты ОДНОГО человека — точечно, а не весь архив.
 *
 * Программа держит в памяти только живущих и последние недели
 * (utils/historyWindow). Где нужен весь путь конкретного гостя — история
 * клиента, прошлые визиты при заселении — грузим только его записи: по
 * паспорту (как записан и без пробелов, плюс поле passportClean), а без
 * паспорта — по ФИО. Подписка живая: оплата долга видна сразу. Ключ ждёт,
 * пока кассир допечатает паспорт (debounceMs), чтобы не дёргать базу на
 * каждую букву.
 */
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { mergeLists, newestFirst } from '../utils/liveList';
import { personQueryKeys } from '../utils/historyWindow';

const EMPTY = Object.freeze([]);

export function usePersonStays(person, { enabled = true, debounceMs = 0 } = {}) {
  const keys = personQueryKeys(person);
  const sig = enabled ? `${keys.passports.join('|')}#${keys.name}` : '';
  const [state, setState] = useState({ sig: '', list: EMPTY });

  useEffect(() => {
    if (!sig || sig === '#') return undefined;
    let cancelled = false;
    let unsubs = [];
    const start = () => {
      if (cancelled) return;
      const col = collection(db, ...PUBLIC_DATA_PATH, 'guests');
      const qs = [];
      if (keys.passports.length) {
        qs.push(query(col, where('passport', 'in', keys.passports)));
        qs.push(query(col, where('passportClean', '==', keys.passports[0])));
      } else if (keys.name) {
        qs.push(query(col, where('fullName', '==', keys.name)));
      }
      const parts = qs.map(() => []);
      unsubs = qs.map((q, i) => onSnapshot(q, (snap) => {
        parts[i] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!cancelled) setState({ sig, list: mergeLists(parts, newestFirst('checkInDate')) });
      }, () => { /* нет доступа или сети — покажем то, что есть в памяти */ }));
    };
    const tm = setTimeout(start, debounceMs);
    return () => { cancelled = true; clearTimeout(tm); unsubs.forEach(u => u()); };
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  return state.sig === sig ? state.list : EMPTY;
}
