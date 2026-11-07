/**
 * «Мест нет» на сервере: те же расчёты, что в src/utils/noVacancy.js
 * (сверяет tests/no-vacancy.test.mjs). Документ settings/noVacancy ставит кассир,
 * отметка действует до until — ближайших 9:00 по Ташкенту, потом её как будто нет.
 */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const isNoVacancy = (entry, now = Date.now()) => Number(entry && entry.until) > now;

const noVacancyNight = (entry) => {
    const until = Number(entry && entry.until);
    if (!until) return null;
    return new Date(until - DAY_MS + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
};

/** { hostel1: { until, night } } — только действующие отметки. */
async function readNoVacancy(hostellaDb, basePath, now = Date.now()) {
    try {
        const snap = await hostellaDb.doc(`${basePath}/settings/noVacancy`).get();
        const data = snap.exists ? snap.data() || {} : {};
        const out = {};
        for (const [hostelId, entry] of Object.entries(data)) {
            if (isNoVacancy(entry, now)) out[hostelId] = { until: new Date(Number(entry.until)).toISOString(), night: noVacancyNight(entry) };
        }
        return out;
    } catch (e) {
        console.warn('noVacancy read', e.message);
        return {};
    }
}

module.exports = { isNoVacancy, noVacancyNight, readNoVacancy };
