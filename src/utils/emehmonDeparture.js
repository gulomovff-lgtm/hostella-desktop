/**
 * emehmonDeparture — что автомат кладёт в выселение сверх данных гостя и как
 * читает его результат. Без JSX и Firebase — под тестами
 * (tests/emehmon-departure.test.mjs). Зеркало src/emehmon/departure.js
 * в Hosti Cloud: правило одно на боевую и Cloud.
 *
 * Окна с вопросами при выводе больше нет (решение владельца 2026-09-11):
 *   • сумма — итог за проживание: ставка × прожитые сутки по формуле портала,
 *     то же число, что держит пересчёт (utils/emehmonAmount.js); в окне
 *     Check-Out портала это поле оплаты;
 *   • тип оплаты — из настроек (`emehmonPayType`), по умолчанию «Другое» (1) —
 *     умолчание прежнего окна;
 *   • лист убытия снимается всегда: main-процесс держит окно листа скрытым и
 *     отдаёт PDF (electron/emehmonSheet.js).
 */
import { emehmonAmountForStay } from './emehmonAmount.js';

/** Типы оплаты окна Check-Out портала: код → ключ перевода или буквальная подпись. */
export const PAY_TYPES = Object.freeze([
  { value: '1', labelKey: 'emmPayOther' },
  { value: '2', labelKey: 'cash' },
  { value: '3', literal: 'Humo' },
  { value: '4', literal: 'Uzcard' },
  { value: '5', labelKey: 'emmPayTransfer' },
  { value: '6', labelKey: 'emmPayContract' },
]);

/** День выезда как в таблицах портала: «12.09.2026»; без даты — пустая строка. */
export const checkOutDayOf = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

export const normalizePayType = (v) => (PAY_TYPES.some((t) => t.value === String(v)) ? String(v) : '1');

/**
 * Поля выселения.
 * @param {object} guest — { checkInDate, checkOutDate }
 * @param {object} o — { rate: ставка за сутки, payType, now }
 */
export const departureExtras = (guest, { rate, payType, now = Date.now() } = {}) => {
  const total = emehmonAmountForStay(guest, rate, now);
  const r = Number(rate);
  const amount = total > 0 ? total : (Number.isFinite(r) && r > 0 ? r : 0);
  return { amount: String(amount), payType: normalizePayType(payType) };
};

/**
 * Отметки в карточку по результату выселения. Лист — отдельно от факта
 * вывода: убытие в госсистеме прошло и без него.
 * @param {object} res — ответ main-процесса: sheet {file,name,bytes,at,source} / sheetError
 * @param {object} o — { now, uploaded: {path,url} — копия в облаке, если загрузилась }
 */
export const departureMarks = (res, { now = new Date(), uploaded = null } = {}) => {
  const at = now instanceof Date ? now.toISOString() : String(now);
  const marks = { emehmonOut: true, emehmonOutAt: at };
  const r = res && typeof res === 'object' ? res : {};
  const sh = r.sheet && typeof r.sheet === 'object' ? r.sheet : null;
  const up = uploaded && uploaded.url ? uploaded : null;
  if (sh && (sh.file || up)) {
    marks.emehmonSheet = {
      file: String(sh.file || ''),
      name: String(sh.name || ''),
      bytes: Number(sh.bytes) || 0,
      at: String(sh.at || at),
      source: String(sh.source || ''),
      path: up ? String(up.path) : '',
      url: up ? String(up.url) : '',
    };
  } else if (r.sheetError && (r.sheetError.code || r.sheetError.message)) {
    marks.emehmonSheetError = {
      code: String(r.sheetError.code || 'sheet_error'),
      message: String(r.sheetError.message || '').slice(0, 200),
      at,
    };
  }
  return marks;
};
