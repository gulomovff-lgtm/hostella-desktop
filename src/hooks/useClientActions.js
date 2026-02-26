/**
 * useClientActions — операции с базой клиентов.
 */
import { collection, doc, addDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { logAction } from '../utils/auditLog';
import { getNormalizedCountry } from '../utils/helpers';

export function useClientActions({ currentUser, clients, showNotification }) {

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
      const activeGuests = guests.filter(g => g.status === 'active' && (g.passport || g.fullName));

      for (const g of activeGuests) {
        // Ищем по паспорту, если нет — по ФИО
        const ec = g.passport
          ? clients.find(c => c.passport && c.passport === g.passport)
          : clients.find(c => !c.passport && c.fullName === g.fullName);

        if (ec) {
          // Обновляем только если данных не хватает
          const updates = {};
          if (!ec.fullName && g.fullName) updates.fullName = g.fullName;
          if (!ec.birthDate && g.birthDate) updates.birthDate = g.birthDate;
          if (!ec.country && g.country) updates.country = g.country;
          if (!ec.phone && g.phone) updates.phone = g.phone;
          if (!ec.passport && g.passport) updates.passport = g.passport;
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
            lastVisit: new Date().toISOString(),
            visits: 1,
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

  return {
    handleUpdateClient,
    handleImportClients,
    handleDeduplicate,
    handleBulkDeleteClients,
    handleNormalizeCountries,
    handleSyncClientsFromGuests,
  };
}
