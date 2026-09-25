import test from 'node:test';
import assert from 'node:assert/strict';
import { isSuperOnlyAction, auditCollectionFor, visibleAuditFor } from '../src/utils/auditScope.js';

test('зачёты и ручные оплаты супера пишутся в отдельный журнал', () => {
    for (const a of ['super_payment', 'super_payment_add', 'super_payment_edit']) {
        assert.equal(isSuperOnlyAction(a), true, a);
        assert.equal(auditCollectionFor(a), 'auditLogSuper', a);
    }
    for (const a of ['checkin', 'payment', 'price_change', 'kpp_reset']) assert.equal(auditCollectionFor(a), 'auditLog', a);
});

test('админ видит общий журнал без зачётов; супер — оба по времени; кассир — ничего', () => {
    const common = [
        { id: '1', action: 'checkin', timestamp: '2026-09-25T10:00:00Z' },
        { id: '2', action: 'super_payment', timestamp: '2026-09-25T09:00:00Z' },   // старая запись в общем журнале
    ];
    const sup = [{ id: '3', action: 'super_payment_add', timestamp: '2026-09-25T11:00:00Z' }];
    assert.deepEqual(visibleAuditFor('admin', common, sup).map(e => e.id), ['1']);
    assert.deepEqual(visibleAuditFor('super', common, sup).map(e => e.id), ['3', '1', '2']);
    assert.deepEqual(visibleAuditFor('cashier', common, sup), []);
});

test('правила: общий журнал читает админ, суперский — только супер, оба неизменяемы', async () => {
    const fs = await import('node:fs');
    const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
    const common = rules.slice(rules.indexOf('match /auditLog/{doc}'), rules.indexOf('match /auditLogSuper/{doc}'));
    const sup = rules.slice(rules.indexOf('match /auditLogSuper/{doc}'), rules.indexOf('}', rules.indexOf('allow update, delete: if false;', rules.indexOf('match /auditLogSuper/{doc}'))));
    assert.ok(common.includes('allow read:   if isAdmin();'));
    assert.ok(sup.includes('allow read:   if isSuper();'));
    assert.ok(common.includes('allow update, delete: if false;') && sup.includes('allow update, delete: if false;'));
});
