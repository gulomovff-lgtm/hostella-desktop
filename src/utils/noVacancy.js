/**
 * «Мест нет» — кассир отмечает филиал заполненным, сайт и бот перестают предлагать
 * заезд на эту ночь. Владелец (2026-11-07): отметка сама снимается утром в 9:00.
 *
 * Документ settings/noVacancy: { [hostelId]: { until, by, byName, at } }.
 * until — мс времени ближайших 9:00 по Ташкенту: после него отметка недействительна
 * без всякого расписания, сервер (functions/lib/noVacancy.js) считает так же.
 * Ночь — дата заезда, которую закрывает отметка: сутки до until.
 *
 * Здесь только расчёты: файл подключают и тесты, и программа.
 */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC+5, перехода на летнее время нет
const DAY_MS = 24 * 60 * 60 * 1000;
export const NO_VACANCY_RESET_HOUR = 9;

/** Ближайшие 9:00 по Ташкенту после now (мс). Ровно в 9:00 — уже следующие сутки. */
export const nextResetAt = (now = Date.now()) => {
  const local = now + TASHKENT_OFFSET_MS;
  const dayStart = Math.floor(local / DAY_MS) * DAY_MS;
  let reset = dayStart + NO_VACANCY_RESET_HOUR * 60 * 60 * 1000;
  if (reset <= local) reset += DAY_MS;
  return reset - TASHKENT_OFFSET_MS;
};

/** Отметка действует? entry — значение филиала из документа. */
export const isNoVacancy = (entry, now = Date.now()) => Number(entry?.until) > now;

/** Дата заезда (YYYY-MM-DD, по Ташкенту), которую закрывает отметка. */
export const noVacancyNight = (entry) => {
  const until = Number(entry?.until);
  if (!until) return null;
  return new Date(until - DAY_MS + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
};

/** Запись для включения: до ближайших 9:00. */
export const noVacancyEntry = (user, now = Date.now()) => ({
  until: nextResetAt(now),
  by: user?.id || user?.login || '',
  byName: user?.name || user?.login || '',
  at: new Date(now).toISOString(),
});
