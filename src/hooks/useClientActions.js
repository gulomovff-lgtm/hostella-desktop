/**
 * useClientActions — операции с базой клиентов.
 */
import { collection, doc, addDoc, updateDoc, deleteDoc, writeBatch, increment } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { logAction } from '../utils/auditLog';
import { getNormalizedCountry } from '../utils/helpers';

export function useClientActions({ currentUser, clients, showNotification, setUndoStack }) {

  const pushUndo = (item) => {
    if (!setUndoStack) return;
    setUndoStack(prev => [
      { ...item, id: Date.now(), timestamp: new Date().toISOString() },
      ...prev,
    ].slice(0, 5));
  };

  const handleUpdateClient = async (id, d) => {
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'clients', id), d);
    showNotification('Updated');
  };

  const handleImportClients = async (newClients) => {
    if (newClients.length === 0) return;
    try {
      const batch = writeBatch(db);
      let updated = 0, created = 0;
      newClients.forEach(nc => {
        const existing = clients.find(c =>
          (c.passport && nc.passport && c.passport === nc.passport) ||
          (c.fullName === nc.fullName && c.passport === nc.passport)
        );
        if (existing) {
          batch.update(doc(db, ...PUBLIC_DATA_PATH, 'clients', existing.id), {
            fullName: existing.fullName || nc.fullName,
            passport: existing.passport || nc.passport,
            birthDate: existing.birthDate || nc.birthDate,
            country: existing.country || nc.country,
          });
          updated++;
        } else {
          batch.set(doc(collection(db, ...PUBLIC_DATA_PATH, 'clients')), { ...nc, visits: 0, lastVisit: new Date().toISOString() });
          created++;
        }
      });
      await batch.commit();
      showNotification(`Success! New: ${created}, Merged: ${updated}`, 'success');
    } catch (e) {
      console.error(e);
      showNotification('Import failed', 'error');
    }
  };

  const handleDeduplicate = async () => {
    if (!confirm('Start auto deduplication?')) return;
    try {
      const map = {}, duplicates = [];
      clients.forEach(c => {
        const key = c.passport ? `P:${c.passport}` : `N:${c.fullName}`;
        if (!map[key]) map[key] = c;
        else duplicates.push({ original: map[key], duplicate: c });
      });
      if (duplicates.length === 0) return showNotification('No duplicates found!');
      const batch = writeBatch(db);
      duplicates.forEach(({ original, duplicate }) => {
        batch.update(doc(db, ...PUBLIC_DATA_PATH, 'clients', original.id), {
          visits: (original.visits || 0) + (duplicate.visits || 0),
          lastVisit: new Date(original.lastVisit) > new Date(duplicate.lastVisit) ? original.lastVisit : duplicate.lastVisit,
        });
        batch.delete(doc(db, ...PUBLIC_DATA_PATH, 'clients', duplicate.id));
      });
      await batch.commit();
      showNotification(`Merged ${duplicates.length} duplicates!`, 'success');
    } catch (e) {
      console.error(e);
      showNotification('Deduplication failed', 'error');
    }
  };

  const handleBulkDeleteClients = async (ids) => {
    try {
      const batch = writeBatch(db);
      ids.forEach(id => batch.delete(doc(db, ...PUBLIC_DATA_PATH, 'clients', id)));
      await batch.commit();
      showNotification(`Deleted ${ids.length} clients`, 'success');
    } catch (e) {
      showNotification('Bulk delete failed', 'error');
    }
  };

  const handleNormalizeCountries = async () => {
    try {
      const batch = writeBatch(db);
      let count = 0;
      clients.forEach(c => {
        const normalized = getNormalizedCountry(c.country);
        if (normalized !== c.country) {
          batch.update(doc(db, ...PUBLIC_DATA_PATH, 'clients', c.id), { country: normalized });
          count++;
        }
      });
      if (count > 0) { await batch.commit(); showNotification(`Normalized ${count} countries`, 'success'); }
      else showNotification('All normalized');
    } catch (e) {
      showNotification('Normalization failed', 'error');
    }
  };

  const handleSyncClientsFromGuests = async (guests) => {
    try {
      const batch = writeBatch(db);
      let created = 0, updated = 0, skipped = 0;
      // Sync ALL guests (active + checked_out) that have at least a name
      const allGuests = guests.filter(g => (g.passport || g.fullName));

      const norm = s => (s || '').replace(/\s/g, '').toUpperCase();
      for (const g of allGuests) {
        const normPassport = norm(g.passport);
        const normName = norm(g.fullName);
        // Search by normalized passport first, then fallback to name (regardless of whether client has passport)
        const ec = normPassport
          ? (clients.find(c => c.passport && norm(c.passport) === normPassport)
              || (normName && clients.find(c => norm(c.fullName) === normName)))
          : (normName ? clients.find(c => norm(c.fullName) === normName) : null);

        if (ec) {
          const updates = {};
          if (!ec.fullName && g.fullName) updates.fullName = g.fullName;
          if (!ec.birthDate && g.birthDate) updates.birthDate = g.birthDate;
          if (!ec.country && g.country) updates.country = g.country;
          if (!ec.phone && g.phone) updates.phone = g.phone;
          if (!ec.passport && g.passport) updates.passport = g.passport;
          // Update lastVisit if this guest's checkInDate is newer
          const gDate = g.checkInDate || g.checkOutDate;
          if (gDate && (!ec.lastVisit || new Date(gDate) > new Date(ec.lastVisit))) {
            updates.lastVisit = gDate;
          }
          if (Object.keys(updates).length > 0) {
            batch.update(doc(db, ...PUBLIC_DATA_PATH, 'clients', ec.id), updates);
            updated++;
          } else {
            skipped++;
          }
        } else {
          batch.set(doc(collection(db, ...PUBLIC_DATA_PATH, 'clients')), {
            fullName: g.fullName || '',
            passport: g.passport || '',
            birthDate: g.birthDate || '',
            country: g.country || '',
            phone: g.phone || '',
            passportIssueDate: g.passportIssueDate || '',
            lastVisit: g.checkOutDate || g.checkInDate || new Date().toISOString(),
            visits: 1,
            balance: 0,
          });
          created++;
        }
      }

      if (created + updated > 0) await batch.commit();
      showNotification(
        `✅ Готово: ${created} добавлено, ${updated} обновлено${skipped ? `, ${skipped} без изменений` : ''}`,
        'success'
      );
      logAction(currentUser, 'sync_clients', { created, updated, skipped });
    } catch (e) {
      showNotification('Ошибка синхронизации: ' + e.message, 'error');
    }
  };

  const handleTopUpBalance = async (clientId, amount, method = 'cash', skipCashbox = false) => {
    if (!clientId || !amount || isNaN(amount) || amount <= 0) return;
    const amt = Number(amount);
    const client = clients.find(c => c.id === clientId);
    // Пополнение баланса супером НЕ должно попадать в кассу
    const skip = skipCashbox || currentUser?.role === 'super';

    // 1. Обновляем баланс клиента
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'clients', clientId), { balance: increment(amt) });

    let paymentId = null;
    // 2. Создаём запись в кассе (payments) — только если не обход кассы
    if (!skip) {
      const payRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'payments'), {
        type: 'balance_topup',
        clientId,
        clientName: client?.fullName || '',
        guestId: null,
        staffId: currentUser?.id || currentUser?.login || '',
        staffName: currentUser?.name || currentUser?.login || '',
        amount: amt,
        method,
        date: new Date().toISOString(),
        hostelId: currentUser?.hostelId || '',
        comment: `Пополнение баланса: ${client?.fullName || clientId}`,
        note: `Пополнение баланса: ${client?.fullName || clientId}`,
      });
      paymentId = payRef.id;
    }

    // 3. Добавляем в стек отмены
    pushUndo({
      type: 'balance_topup',
      clientId,
      amount: amt,
      paymentId,
      description: `Пополнение баланса ${client?.fullName || ''}: +${amt.toLocaleString()} сум`,
    });

    logAction(currentUser, 'balance_topup', { clientId, amount: amt, method, skipCashbox });
    showNotification(`✅ Баланс пополнен: +${amt.toLocaleString()} сум`, 'success');
  };

  const handleAdjustBalance = async (clientId, delta) => {
    if (!clientId || !delta || isNaN(delta) || delta === 0) return;
    const amt = Number(delta);
    const client = clients.find(c => c.id === clientId);
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'clients', clientId), { balance: increment(amt) });
    logAction(currentUser, 'balance_adjust', { clientId, delta: amt, clientName: client?.fullName || '' });
    showNotification(amt > 0
      ? `✅ Баланс пополнен: +${amt.toLocaleString()} сум`
      : `✅ Баланс уменьшен: ${amt.toLocaleString()} сум`, 'success');
  };

  const handleAddClient = async (data) => {
    await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'clients'), {
      fullName: data.fullName || '',
      passport: data.passport || '',
      birthDate: data.birthDate || '',
      country: data.country || 'Узбекистан',
      phone: data.phone || '',
      clientStatus: data.clientStatus || 'normal',
      visits: 0,
      balance: 0,
      lastVisit: new Date().toISOString(),
    });
    showNotification('✅ Клиент добавлен', 'success');
  };

  return {
    handleUpdateClient,
    handleImportClients,
    handleDeduplicate,
    handleBulkDeleteClients,
    handleNormalizeCountries,
    handleSyncClientsFromGuests,
    handleTopUpBalance,
    handleAdjustBalance,
    handleAddClient,
  };
}
