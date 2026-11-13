// Хранилище сайта кадастра по филиалам (решение владельца 13.11.2026):
// админ один раз вводит пароль ключа ЭЦП, сертификат, текст кадастра и карты
// для турсбора — дальше ими пользуются кассы ЭТОГО филиала, на любом
// компьютере. Раньше всё жило только на компьютере, где ввели (DPAPI).
//
// Где лежит: artifacts/hostella-multi-v4/public/data/kadastrVault/{hostelId},
// одним зашифрованным полем (AES-256-GCM, ключ KADASTR_VAULT_KEY в Secret
// Manager). Правил на эту коллекцию нет — общий «всё остальное запрещено»
// закрывает её для приложения целиком; читает и пишет только эта функция.
//
// Кто что может:
//  • public  — маски (есть ли пароль, •••• 1234): сотрудник; кассир — свой филиал;
//  • set     — изменить: только admin/super, любой филиал;
//  • secrets — открытые значения для главного процесса Electron: сотрудник;
//              кассир — только свой филиал. Каждая выдача — в журнал действий.
const functions = require('firebase-functions/v1');
const crypto = require('crypto');

const APP_ID = 'hostella-multi-v4';
const BASE = `artifacts/${APP_ID}/public/data`;
const vaultDb = () => require('firebase-admin/firestore').getFirestore('hostella');
const STAFF = ['cashier', 'admin', 'super'];
const ADMINS = ['admin', 'super'];

const fail = (code, msg) => new functions.https.HttpsError(code, msg);

function key() {
    const k = Buffer.from(String(process.env.KADASTR_VAULT_KEY || ''), 'base64');
    if (k.length !== 32) throw fail('failed-precondition', 'Хранилище кадастра не настроено');
    return k;
}
function seal(obj) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
    const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
    return { v: 1, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') };
}
function open(blob) {
    if (!blob || !blob.data) return {};
    const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(blob.iv, 'base64'));
    d.setAuthTag(Buffer.from(blob.tag, 'base64'));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(blob.data, 'base64')), d.final()]).toString('utf8'));
}

const digits = (v) => String(v || '').replace(/\D/g, '');
function cleanCard(c) {
    if (!c) return null;
    const number = digits(c.number), mm = digits(c.mm).padStart(2, '0').slice(-2), yy = digits(c.yy).slice(-2);
    let phone = digits(c.phone);
    if (phone.length === 9) phone = '998' + phone;
    if (number.length !== 16 || !/^(0[1-9]|1[0-2])$/.test(mm) || yy.length !== 2 || phone.length !== 12) return null;
    return { number, mm, yy, phone };
}
function normalize(st) {
    if (!Array.isArray(st.cards)) st.cards = [];
    if (st.cards.length && !st.cards.some(c => c.id === st.defaultCardId)) st.defaultCardId = st.cards[0].id;
    if (!st.cards.length) delete st.defaultCardId;
    return st;
}
const mask = (c) => '•••• ' + String(c.number).slice(-4);
const phoneMask = (c) => '+' + String(c.phone).slice(0, 5) + ' ••• •• ' + String(c.phone).slice(-2);
function publicView(st, meta = {}) {
    const def = st.cards.find(c => c.id === st.defaultCardId) || null;
    return {
        ok: true,
        hasPassword: !!st.eimzoPassword,
        cert: st.cert || '',
        cadMatch: st.cadMatch || '',
        cards: st.cards.map(c => ({ id: c.id, mask: mask(c), phoneMask: phoneMask(c), isDefault: c.id === st.defaultCardId })),
        hasCard: !!def,
        cardMask: def ? mask(def) : '',
        cardPhoneMask: def ? phoneMask(def) : '',
        updatedAt: meta.updatedAt || null,
        empty: !st.eimzoPassword && !st.cards.length && !st.cert,
    };
}
/** Изменение настроек (та же форма, что была в main.js). Ошибка — строка. */
function applyPatch(st, p) {
    if (typeof p.eimzoPassword === 'string' && p.eimzoPassword) st.eimzoPassword = p.eimzoPassword.slice(0, 200);
    if (p.clearPassword) delete st.eimzoPassword;
    if (typeof p.cert === 'string' && /^[0-9A-Za-z]{4,40}$/.test(p.cert.trim())) st.cert = p.cert.trim();
    if (typeof p.cadMatch === 'string' && p.cadMatch.trim() && p.cadMatch.length <= 60) st.cadMatch = p.cadMatch.trim();
    const addOne = (raw, makeDefault) => {
        const c = cleanCard(raw); if (!c) return false;
        const same = st.cards.find(x => x.number === c.number);
        if (same) Object.assign(same, c); else st.cards.push({ id: 'c' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex'), ...c });
        if (makeDefault || st.cards.length === 1) st.defaultCardId = (same || st.cards[st.cards.length - 1]).id;
        return true;
    };
    if (p.addCard && !addOne(p.addCard, !!p.addCard.makeDefault)) return 'bad_card';
    // Перенос с компьютера: карты целиком (старый формат — одна card)
    if (Array.isArray(p.importCards)) for (const c of p.importCards.slice(0, 10)) addOne(c, c && c.id === p.importDefaultId);
    if (typeof p.removeCard === 'string') st.cards = st.cards.filter(c => c.id !== p.removeCard);
    if (typeof p.defaultCard === 'string' && st.cards.some(c => c.id === p.defaultCard)) st.defaultCardId = p.defaultCard;
    if (p.clearCard) st.cards = [];
    normalize(st);
    return '';
}

exports.kadastrVault = functions.runWith({ secrets: ['KADASTR_VAULT_KEY'] }).https.onCall(async (data, context) => {
    const tok = context.auth && context.auth.token;
    const role = tok && tok.hostellaRole;
    if (!tok || !STAFF.includes(role)) throw fail('permission-denied', 'Нужен вход сотрудника');
    const hostelId = String((data && data.hostelId) || '');
    if (!/^hostel\d{1,3}$/.test(hostelId)) throw fail('invalid-argument', 'Не выбран филиал');
    // Кассир — только свой филиал
    if (role === 'cashier' && String(tok.hostellaHostel || '') !== hostelId) throw fail('permission-denied', 'Чужой филиал');
    const action = String((data && data.action) || 'public');
    const db = vaultDb();
    const ref = db.doc(`${BASE}/kadastrVault/${hostelId}`);
    const snap = await ref.get();
    const doc = snap.exists ? snap.data() : {};
    const st = normalize(open(doc.blob));

    if (action === 'public') return publicView(st, doc);

    if (action === 'set') {
        if (!ADMINS.includes(role)) throw fail('permission-denied', 'Настройки кадастра меняет админ');
        const err = applyPatch(st, (data && data.patch) || {});
        if (err) return { ok: false, error: err };
        const updatedAt = new Date().toISOString();
        await ref.set({ blob: seal(st), updatedAt, updatedBy: context.auth.uid });
        await audit(db, context, 'kadastr_vault_set', { hostelId, fields: Object.keys((data && data.patch) || {}) });
        return publicView(st, { updatedAt });
    }

    if (action === 'secrets') {
        await audit(db, context, 'kadastr_vault_read', { hostelId, why: String((data && data.why) || '').slice(0, 40) });
        return {
            ok: true,
            eimzoPassword: st.eimzoPassword || '',
            cert: st.cert || '',
            cadMatch: st.cadMatch || '',
            cards: st.cards,
            defaultCardId: st.defaultCardId || null,
        };
    }
    throw fail('invalid-argument', 'Неизвестное действие');
});

async function audit(db, context, action, details) {
    try {
        const uid = context.auth.uid;
        let name = uid;
        try { const u = await db.doc(`${BASE}/users/${uid}`).get(); if (u.exists) name = u.data().name || u.data().login || uid; } catch (_) {}
        await db.collection(`${BASE}/auditLog`).add({
            action, details,
            userId: uid, userName: name, userRole: context.auth.token.hostellaRole || 'unknown',
            hostelId: details.hostelId || null,
            timestamp: new Date().toISOString(),
            source: 'server',
        });
    } catch (e) { console.error('[kadastrVault] audit', e.message); }
}

// Для тестов — неперечисляемо: Object.assign(exports, …) в index.js его не возьмёт
Object.defineProperty(exports, '_internal', { value: { seal, open, applyPatch, publicView, normalize, cleanCard }, enumerable: false });
