import { collection, doc, runTransaction, increment, addDoc, updateDoc } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { logAction } from '../utils/auditLog';
import TRANSLATIONS from '../constants/translations';
import { buildLines, linesTotal, linesComment, validateSale, validateItem, canCancelSale } from '../utils/shop';

/**
 * useShopActions — услуги и товары (стирка, глажка, завтрак, напитки…).
 *
 * Продажа — одна транзакция: запись продажи, оплата в кассу (если «сейчас»),
 * сумма «в счёт» на госте (servicesTotal) и списание товара со склада
 * филиала. Отмена возвращает всё обратно тем же способом. Правила и формулы —
 * utils/shop.js (там же решения владельца).
 */
export function useShopActions({ currentUser, lang, showNotification }) {
  const t = k => TRANSLATIONS[lang]?.[k] || k;
  const col = (name) => collection(db, ...PUBLIC_DATA_PATH, name);
  const ref = (name, id) => doc(db, ...PUBLIC_DATA_PATH, name, id);
  const staffId = () => currentUser?.id || currentUser?.login || 'unknown';
  const isAdmin = () => currentUser?.role === 'admin' || currentUser?.role === 'super';

  /**
   * Продажа. guest — проживающий или null («с улицы»).
   * mode: 'account' — в счёт гостя; 'paid' — оплачено сейчас (method).
   */
  const handleSale = async ({ guest = null, hostelId, cart = [], mode = 'paid', method = 'cash', catalog = [] }) => {
    const lines = buildLines(cart, catalog);
    const err = validateSale({ lines, hostelId, guestId: guest?.id || '', mode, method, catalog });
    if (err) { showNotification(t('shErr_' + err), 'error'); return false; }
    const total = linesTotal(lines);
    const now = new Date().toISOString();
    const saleRef = doc(col('sales'));
    const payRef = mode === 'paid' ? doc(col('payments')) : null;
    const need = new Map();
    for (const l of lines) if (l.kind === 'product' && l.itemId) need.set(l.itemId, (need.get(l.itemId) || 0) + l.qty);
    try {
      await runTransaction(db, async (tx) => {
        // чтения — до записей: остатки товара и гость
        for (const [itemId, n] of need) {
          const s = await tx.get(ref('catalog', itemId));
          const have = Number(s.exists() ? s.data()?.stock?.[hostelId] : 0) || 0;
          if (n > have) throw new Error(t('shErr_stock_item').replace('{name}', s.data()?.name || '').replace('{have}', have));
        }
        if (mode === 'account') {
          const gs = await tx.get(ref('guests', guest.id));
          if (!gs.exists()) throw new Error(t('shErr_guest_gone'));
        }
        tx.set(saleRef, {
          hostelId, staffId: staffId(), staffName: currentUser?.name || currentUser?.login || '',
          date: now, guestId: guest?.id || null, guestName: guest?.fullName || '', roomNumber: guest?.roomNumber || '',
          items: lines, total, mode, method: mode === 'paid' ? method : null,
          paymentId: payRef ? payRef.id : null, status: 'active',
        });
        if (payRef) {
          // Касса: обычный приход, категория «услуги». Деньги гостя за проживание
          // не трогает — удаление и отчёт знают категорию service.
          tx.set(payRef, {
            guestId: guest?.id || '', guestName: guest?.fullName || '', staffId: staffId(),
            amount: total, method, date: now, hostelId,
            type: 'income', category: 'service', comment: linesComment(lines), saleId: saleRef.id,
          });
        }
        if (mode === 'account') tx.update(ref('guests', guest.id), { servicesTotal: increment(total) });
        for (const [itemId, n] of need) {
          tx.update(ref('catalog', itemId), { [`stock.${hostelId}`]: increment(-n) });
          tx.set(doc(col('stockMoves')), {
            itemId, itemName: lines.find(l => l.itemId === itemId)?.name || '', hostelId, qty: -n,
            reason: 'sale', saleId: saleRef.id, date: now, staffId: staffId(),
          });
        }
      });
      logAction(currentUser, 'shop_sale', { saleId: saleRef.id, guestId: guest?.id || null, total, mode, method: mode === 'paid' ? method : null, items: linesComment(lines) });
      showNotification(t(mode === 'account' ? 'shSoldAccount' : 'shSoldPaid').replace('{sum}', total.toLocaleString('ru-RU')), 'success');
      return true;
    } catch (e) {
      showNotification(t('shSaleFailed') + (e?.message || e), 'error');
      return false;
    }
  };

  /** Отмена продажи: касса, счёт гостя и склад — обратно. */
  const handleCancelSale = async (sale) => {
    if (!canCancelSale(sale, currentUser)) { showNotification(t('shCannotCancel'), 'error'); return false; }
    const now = new Date().toISOString();
    const saleRef = ref('sales', sale.id);
    try {
      const res = await runTransaction(db, async (tx) => {
        const s = await tx.get(saleRef);
        if (!s.exists() || s.data().status === 'cancelled') return { already: true };
        const d = s.data();
        const payRef = d.paymentId ? ref('payments', d.paymentId) : null;
        const pay = payRef ? await tx.get(payRef) : null;
        const gRef = (d.mode === 'account' && d.guestId) ? ref('guests', d.guestId) : null;
        const g = gRef ? await tx.get(gRef) : null;
        const back = new Map();
        for (const l of d.items || []) if (l.kind === 'product' && l.itemId) back.set(l.itemId, (back.get(l.itemId) || 0) + (Number(l.qty) || 0));
        const itemSnaps = {};
        for (const itemId of back.keys()) itemSnaps[itemId] = await tx.get(ref('catalog', itemId));

        if (pay && pay.exists()) tx.delete(payRef);
        if (g && g.exists()) tx.update(gRef, { servicesTotal: increment(-(Number(d.total) || 0)) });
        for (const [itemId, n] of back) {
          if (!itemSnaps[itemId]?.exists()) continue;
          tx.update(ref('catalog', itemId), { [`stock.${d.hostelId}`]: increment(n) });
          tx.set(doc(col('stockMoves')), {
            itemId, itemName: itemSnaps[itemId].data()?.name || '', hostelId: d.hostelId, qty: n,
            reason: 'cancel', saleId: sale.id, date: now, staffId: staffId(),
          });
        }
        tx.update(saleRef, { status: 'cancelled', cancelledAt: now, cancelledBy: staffId() });
        return {};
      });
      if (res.already) { showNotification(t('shAlreadyCancelled'), 'info'); return true; }
      logAction(currentUser, 'shop_cancel', { saleId: sale.id, total: sale.total, guestId: sale.guestId || null });
      showNotification(t('shCancelled'), 'success');
      return true;
    } catch (e) {
      showNotification(t('shSaleFailed') + (e?.message || e), 'error');
      return false;
    }
  };

  /** Справочник: создать или изменить позицию (только админ). Удаления нет — «скрыть». */
  const handleSaveItem = async (item) => {
    if (!isAdmin()) { showNotification(t('shOnlyAdmin'), 'error'); return false; }
    const err = validateItem(item);
    if (err) { showNotification(t('shItemErr_' + err), 'error'); return false; }
    const fields = {
      name: String(item.name).trim().slice(0, 60), kind: item.kind, price: Math.round(Number(item.price)),
      emoji: String(item.emoji || '').slice(0, 4), active: item.active !== false,
    };
    try {
      if (item.id) await updateDoc(ref('catalog', item.id), fields);
      else await addDoc(col('catalog'), { ...fields, stock: {}, createdAt: new Date().toISOString(), createdBy: staffId() });
      logAction(currentUser, item.id ? 'shop_item_edit' : 'shop_item_add', { itemId: item.id || null, ...fields });
      showNotification(t('shItemSaved'), 'success');
      return true;
    } catch (e) {
      showNotification(t('shSaleFailed') + (e?.message || e), 'error');
      return false;
    }
  };

  /**
   * Приход товара (только админ): остаток растёт; при payFromCash закупка
   * пишется расходом кассы филиала — одной транзакцией.
   */
  const handleStockIn = async ({ item, hostelId, qty, unitCost = 0, payFromCash = false }) => {
    if (!isAdmin()) { showNotification(t('shOnlyAdmin'), 'error'); return false; }
    const n = Math.round(Number(qty) || 0);
    const cost = Math.max(0, Math.round(Number(unitCost) || 0));
    if (!item?.id || n <= 0) { showNotification(t('shErr_qty'), 'error'); return false; }
    if (!hostelId || hostelId === 'all') { showNotification(t('shErr_hostel'), 'error'); return false; }
    const now = new Date().toISOString();
    const total = n * cost;
    try {
      await runTransaction(db, async (tx) => {
        const s = await tx.get(ref('catalog', item.id));
        if (!s.exists()) throw new Error(t('shErr_item_gone'));
        const expRef = (payFromCash && total > 0) ? doc(col('expenses')) : null;
        tx.update(ref('catalog', item.id), { [`stock.${hostelId}`]: increment(n), ...(cost > 0 ? { costPrice: cost } : {}) });
        tx.set(doc(col('stockMoves')), {
          itemId: item.id, itemName: s.data().name || '', hostelId, qty: n, reason: 'purchase',
          unitCost: cost, total, expenseId: expRef ? expRef.id : null, date: now, staffId: staffId(),
        });
        if (expRef) {
          tx.set(expRef, {
            category: t('shExpenseCategory'), amount: total,
            comment: `${s.data().name || ''} ×${n}`, hostelId, staffId: staffId(), date: now,
            skipCashbox: false, source: 'shop',
          });
        }
      });
      logAction(currentUser, 'shop_stock_in', { itemId: item.id, hostelId, qty: n, unitCost: cost, payFromCash: !!payFromCash });
      showNotification(t('shStockAdded').replace('{n}', n), 'success');
      return true;
    } catch (e) {
      showNotification(t('shSaleFailed') + (e?.message || e), 'error');
      return false;
    }
  };

  /** Инвентаризация (только админ): остаток = пересчитанное, разница — в журнал движений. */
  const handleStockAdjust = async ({ item, hostelId, actual }) => {
    if (!isAdmin()) { showNotification(t('shOnlyAdmin'), 'error'); return false; }
    const a = Math.round(Number(actual));
    if (!item?.id || !Number.isFinite(a) || a < 0) { showNotification(t('shErr_qty'), 'error'); return false; }
    if (!hostelId || hostelId === 'all') { showNotification(t('shErr_hostel'), 'error'); return false; }
    const now = new Date().toISOString();
    try {
      const delta = await runTransaction(db, async (tx) => {
        const s = await tx.get(ref('catalog', item.id));
        if (!s.exists()) throw new Error(t('shErr_item_gone'));
        const cur = Number(s.data()?.stock?.[hostelId]) || 0;
        const d = a - cur;
        if (!d) return 0;
        tx.update(ref('catalog', item.id), { [`stock.${hostelId}`]: a });
        tx.set(doc(col('stockMoves')), {
          itemId: item.id, itemName: s.data().name || '', hostelId, qty: d, reason: 'adjust', date: now, staffId: staffId(),
        });
        return d;
      });
      if (delta) logAction(currentUser, 'shop_stock_adjust', { itemId: item.id, hostelId, actual: a, delta });
      showNotification(t('shStockAdjusted'), 'success');
      return true;
    } catch (e) {
      showNotification(t('shSaleFailed') + (e?.message || e), 'error');
      return false;
    }
  };

  return { handleSale, handleCancelSale, handleSaveItem, handleStockIn, handleStockAdjust };
}
