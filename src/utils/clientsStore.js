/**
 * Клиенты: полный список в памяти без живой подписки на всю коллекцию (utils/collectionStore).
 *
 * Весь список нужен: заселение, деньги и автосинхронизация ищут клиента по нему,
 * и на неполном списке программа наплодила бы дубликатов. А подписка на него дорога:
 * с ней каждая запись в базу занимает в 2–5 раз дольше (замер 05.11.2026, окно истории
 * и 2282 клиента: 224–595 мс против 80–128 мс).
 */
import { alphabetical } from './liveList';
import { bumpRev, changeStamp, startCollectionSync } from './collectionStore';

/** Каждая запись в клиента обязана ставить отметку: иначе другие кассы увидят её через сутки. */
export const clientStamp = changeStamp;

/** После удаления клиентов: подписка на изменения об удалении не узнает. */
export const bumpClientsRev = () => bumpRev('clientsRev', 'rev');

export const startClientsSync = ({ onList, onReady }) => startCollectionSync({
  name: 'clients', order: alphabetical('fullName'), onList, onReady, revDoc: 'clientsRev', revField: 'rev',
});
