/**
 * shop.js — услуги и товары: продажа гостю и «с улицы», склад напитков.
 *
 * ── РЕШЕНИЯ ВЛАДЕЛЬЦА (2026-09-25) ──────────────────────────────────────
 *
 *  • Оплата — на выбор при добавлении: «в счёт гостя» (сумма копится на
 *    госте и гасится обычной оплатой) или «оплачено сейчас» (деньги сразу в
 *    кассу, отчёт и смену кассира). Продажа «с улицы» — только сразу.
 *  • Приход товара: количество и цена закупки; при желании закупка пишется
 *    расходом кассы.
 *  • Справочник и цены ведёт админ; кассир выбирает из списка или вводит
 *    разовую услугу с названием и ценой вручную.
 *
 * ── ПОЧЕМУ УСЛУГИ НЕ В totalPrice ───────────────────────────────────────
 *
 * totalPrice гостя — стоимость проживания, и её пересчитывают продление,
 * переезд, урезание суток, правка цены и выселение (ставка × сутки). Услуги
 * внутри неё стирались бы при первом же пересчёте. Поэтому услуги «в счёт»
 * копятся в отдельном поле servicesTotal, а долг везде считается от
 * chargeOf(g) = totalPrice + servicesTotal.
 *
 * Без React и Firestore — покрыто тестами.
 */

export const KINDS = ['service', 'product'];
export const PAY_METHODS = ['cash', 'card', 'qr', 'transfer'];
/** Кассир может отменить свою продажу в течение этого времени (ошибся — исправил). */
export const CASHIER_CANCEL_MS = 2 * 60 * 60 * 1000;

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** Всё, что гость должен: проживание + услуги «в счёт». */
export const chargeOf = (g) => num(g?.totalPrice) + num(g?.servicesTotal);

/** Остаток товара на складе филиала. */
export const stockOf = (item, hostelId) => num(item?.stock?.[hostelId]);

/**
 * Строки корзины → проверенные строки продажи.
 * Строка из справочника: { itemId, qty }; ручная услуга: { name, price, qty }.
 * Цена позиции справочника берётся из справочника, а не из корзины.
 */
export function buildLines(cart = [], catalog = []) {
  const byId = new Map((catalog || []).map(i => [i.id, i]));
  const out = [];
  for (const c of cart || []) {
    const qty = Math.max(0, Math.round(num(c?.qty)));
    if (!qty) continue;
    if (c.itemId) {
      const it = byId.get(c.itemId);
      if (!it || it.active === false) continue;
      const price = Math.round(num(it.price));
      out.push({ itemId: it.id, name: String(it.name || '').trim(), kind: it.kind === 'product' ? 'product' : 'service', qty, price, sum: price * qty });
    } else {
      const name = String(c?.name || '').trim();
      const price = Math.round(num(c?.price));
      if (!name || price <= 0) continue;
      out.push({ itemId: null, name: name.slice(0, 80), kind: 'service', qty, price, sum: price * qty, manual: true });
    }
  }
  return out;
}

export const linesTotal = (lines = []) => lines.reduce((s, l) => s + num(l.sum), 0);

/** Нехватка товара: [{ itemId, name, need, have }] — продажу с нехваткой не проводим. */
export function stockShortages(lines = [], catalog = [], hostelId) {
  const byId = new Map((catalog || []).map(i => [i.id, i]));
  const need = new Map();
  for (const l of lines) {
    if (l.kind !== 'product' || !l.itemId) continue;
    need.set(l.itemId, (need.get(l.itemId) || 0) + num(l.qty));
  }
  const out = [];
  for (const [itemId, n] of need) {
    const have = stockOf(byId.get(itemId), hostelId);
    if (n > have) out.push({ itemId, name: byId.get(itemId)?.name || '', need: n, have });
  }
  return out;
}

/** Подпись для отчёта и кассы: «Стирка ×1, Кола 0,5 ×2». */
export const linesComment = (lines = []) =>
  lines.map(l => `${l.name}${num(l.qty) > 1 ? ` ×${l.qty}` : ''}`).join(', ').slice(0, 200);

/**
 * Проверка продажи перед записью. Вернёт ключ ошибки или ''.
 *   empty — пустая корзина; hostel — не выбран филиал; walkin_account — «в счёт»
 *   без гостя; method — нет способа оплаты; stock — не хватает товара.
 */
export function validateSale({ lines = [], hostelId, guestId, mode, method, catalog = [] } = {}) {
  if (!lines.length || linesTotal(lines) <= 0) return 'empty';
  if (!hostelId || hostelId === 'all') return 'hostel';
  if (mode === 'account' && !guestId) return 'walkin_account';
  if (mode !== 'account' && !PAY_METHODS.includes(method)) return 'method';
  if (stockShortages(lines, catalog, hostelId).length) return 'stock';
  return '';
}

/** Может ли пользователь отменить продажу. */
export function canCancelSale(sale, user, now = Date.now()) {
  if (!sale || sale.status === 'cancelled' || !user) return false;
  if (user.role === 'admin' || user.role === 'super') return true;
  const mine = sale.staffId && (sale.staffId === user.id || sale.staffId === user.login);
  const at = new Date(sale.date || 0).getTime();
  return !!mine && Number.isFinite(at) && now - at <= CASHIER_CANCEL_MS;
}

/** Активные продажи гостя, свежие сверху. */
export const guestSales = (sales = [], guestId) =>
  (sales || []).filter(s => s && s.guestId === guestId && s.status !== 'cancelled')
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

/** Сумма «в счёт» по продажам гостя — для сверки с полем servicesTotal. */
export const accountTotal = (sales = []) =>
  (sales || []).filter(s => s && s.status !== 'cancelled' && s.mode === 'account').reduce((a, s) => a + num(s.total), 0);

/** Проверка позиции справочника. Вернёт ключ ошибки или ''. */
export function validateItem({ name, kind, price } = {}) {
  if (!String(name || '').trim()) return 'name';
  if (!KINDS.includes(kind)) return 'kind';
  if (!(Math.round(num(price)) > 0)) return 'price';
  return '';
}

/** Итоги продаж за период: выручка сразу, в счёт, по позициям. */
export function salesSummary(sales = []) {
  let paid = 0, account = 0, count = 0;
  const byItem = new Map();
  for (const s of sales || []) {
    if (!s || s.status === 'cancelled') continue;
    count++;
    if (s.mode === 'account') account += num(s.total); else paid += num(s.total);
    for (const l of s.items || []) {
      const key = l.itemId || `manual:${l.name}`;
      const cur = byItem.get(key) || { name: l.name, qty: 0, sum: 0 };
      cur.qty += num(l.qty); cur.sum += num(l.sum);
      byItem.set(key, cur);
    }
  }
  return { paid, account, total: paid + account, count, items: [...byItem.values()].sort((a, b) => b.sum - a.sum) };
}
