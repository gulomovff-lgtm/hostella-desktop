/**
 * Реферальная программа — облачные функции (логика — ./referral.js).
 *
 *  referralCredit — приглашённый выехал без долга → бонус в журнал
 *    referralLedger/acc_<guestId> и на баланс пригласившего, одной транзакцией.
 *    Документ журнала с id по гостю — защита от двойного начисления.
 *    Приход в кассу НЕ пишется: это не деньги от гостя.
 *  referralBot — API для бота @Hostellauzbot (сайт, PHP): кабинет, привязка
 *    Telegram по телефону или по коду, проверка реферального кода. Ключ —
 *    заголовок X-Hostella-Key = секрет REFERRAL_API_KEY (тот же ключ в
 *    includes/secrets.php сайта).
 */
const functions = require('firebase-functions/v1');
const crypto = require('crypto');
const REF = require('./referral');

const REF_BASE = 'artifacts/hostella-multi-v4/public/data';
const REF_SITE_NOTIFY_URL = 'https://hostella.uz/referral-notify.php';

const safeEqual = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

const refDb = () => require('firebase-admin/firestore').getFirestore('hostella');
const refSettings = async (fdb) => {
  const s = await fdb.doc(`${REF_BASE}/settings/referralProgram`).get();
  return s.exists ? s.data() : {};
};

// Сообщение клиенту в @Hostellauzbot — через сайт (токен бота живёт там). Не критично.
const refNotify = async (chatId, text) => {
  if (!chatId || !process.env.REFERRAL_API_KEY) return;
  try {
    await fetch(REF_SITE_NOTIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Hostella-Key': process.env.REFERRAL_API_KEY },
      body: JSON.stringify({ chatId: String(chatId), text }),
    });
  } catch (e) { console.warn('[referral notify]', e.message); }
};

const money = (n) => (Number(n) || 0).toLocaleString('ru-RU');

exports.referralCredit = functions
  .runWith({ secrets: ['REFERRAL_API_KEY'] })
  .firestore.database('hostella')
  .document(`${REF_BASE}/guests/{guestId}`)
  .onWrite(async (change, ctx) => {
    const after = change.after.exists ? change.after.data() : null;
    // Дёшево отсекаем почти все записи гостей до чтения базы
    if (!after || !after.referrerClientId || after.status !== 'checked_out' || after.refBonusCredited != null) return null;
    const { FieldValue } = require('firebase-admin/firestore');
    const fdb = refDb();
    const settings = await refSettings(fdb);
    if (!settings.active) return null;
    const guestId = ctx.params.guestId;
    const guestRef = change.after.ref;
    const ledgerRef = fdb.doc(`${REF_BASE}/referralLedger/acc_${guestId}`);
    const clientRef = fdb.doc(`${REF_BASE}/clients/${after.referrerClientId}`);
    let done = null;
    await fdb.runTransaction(async (tx) => {
      const [g, l, c] = await Promise.all([tx.get(guestRef), tx.get(ledgerRef), tx.get(clientRef)]);
      if (!g.exists || l.exists || !c.exists) return;
      const gd = g.data();
      const d = REF.creditDecision(gd, settings);
      if (!d) return;
      const now = new Date().toISOString();
      const cd = c.data();
      tx.set(ledgerRef, {
        type: 'accrual', referrerClientId: after.referrerClientId, refereeClientId: gd.refereeClientId || null,
        guestId, guestName: REF.maskName(gd.fullName), nights: d.nights, rate: d.rate, amount: d.amount,
        checkIn: gd.checkInDate || '', checkOut: gd.checkOutDate || '', hostelId: gd.hostelId || null,
        balanceBefore: Number(cd.balance) || 0, date: now,
      });
      tx.update(clientRef, { balance: FieldValue.increment(d.amount), refBonusTotal: FieldValue.increment(d.amount) });
      tx.update(guestRef, { refBonusCredited: d.amount, refBonusAt: now });
      done = { amount: d.amount, nights: d.nights, chatId: cd.tgChatId, balance: (Number(cd.balance) || 0) + d.amount, who: REF.maskName(gd.fullName) };
    });
    if (done) {
      console.log(`referral credit ${done.amount} -> ${after.referrerClientId} for ${guestId}`);
      await refNotify(done.chatId,
        `🎁 Начислен бонус: <b>${money(done.amount)} сум</b>\n` +
        `За ${done.who} — ${done.nights} сут. проживания.\n` +
        `Ваш баланс: <b>${money(done.balance)} сум</b>. Им можно оплатить проживание.`);
    }
    return null;
  });

exports.referralBot = functions
  .runWith({ secrets: ['REFERRAL_API_KEY'] })
  .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
    const key = String(req.headers['x-hostella-key'] || '');
    const expected = process.env.REFERRAL_API_KEY;
    if (!expected || !key || !safeEqual(key, expected)) { res.status(401).json({ ok: false, error: 'unauthorized' }); return; }
    const { FieldValue } = require('firebase-admin/firestore');
    const fdb = refDb();
    const body = req.body || {};
    const chatId = String(body.chatId || '').replace(/[^\d-]/g, '');
    const clients = fdb.collection(`${REF_BASE}/clients`);

    const clientByChat = async () => {
      if (!chatId) return null;
      const q = await clients.where('tgChatId', '==', chatId).limit(1).get();
      return q.empty ? null : q.docs[0];
    };
    // У клиента нет кода — выдаём (уникальность — запросом)
    const ensureCode = async (docSnap) => {
      const d = docSnap.data();
      if (d.refCode) return d.refCode;
      for (let i = 0; i < 6; i++) {
        const code = REF.genRefCode();
        const clash = await clients.where('refCode', '==', code).limit(1).get();
        if (clash.empty) { await docSnap.ref.update({ refCode: code }); return code; }
      }
      throw new Error('code generation failed');
    };
    const cabinet = async (docSnap) => {
      const refCode = await ensureCode(docSnap);
      const client = { ...docSnap.data(), refCode };
      const [settings, gq, lq] = await Promise.all([
        refSettings(fdb),
        fdb.collection(`${REF_BASE}/guests`).where('referrerClientId', '==', docSnap.id).limit(200).get(),
        fdb.collection(`${REF_BASE}/referralLedger`).where('referrerClientId', '==', docSnap.id).limit(100).get(),
      ]);
      return REF.buildCabinet({ client, referees: gq.docs.map(d => d.data()), ledger: lq.docs.map(d => d.data()), settings });
    };

    try {
      switch (body.action) {
        case 'cabinet': {
          const c = await clientByChat();
          if (!c) { res.json({ ok: true, linked: false }); return; }
          res.json({ ok: true, linked: true, cabinet: await cabinet(c) });
          return;
        }
        case 'linkPhone': {
          // Телефон пришёл кнопкой «Поделиться контактом» — Telegram его подтверждает
          const phone = REF.normPhone(body.phone);
          if (!chatId || !phone) { res.json({ ok: false, error: 'bad_phone' }); return; }
          const all = await clients.where('phone', '!=', '').get();
          const hits = all.docs.filter(d => REF.normPhone(d.data().phone) === phone);
          if (hits.length !== 1) { res.json({ ok: true, linked: false, reason: hits.length ? 'ambiguous' : 'not_found' }); return; }
          const prev = await clientByChat();
          if (prev && prev.id !== hits[0].id) await prev.ref.update({ tgChatId: FieldValue.delete() });
          await hits[0].ref.update({ tgChatId: chatId, tgLinkedAt: new Date().toISOString(), tgLinkedBy: 'phone' });
          const fresh = await hits[0].ref.get();
          res.json({ ok: true, linked: true, cabinet: await cabinet(fresh) });
          return;
        }
        case 'linkCode': {
          // Одноразовый код: гость показывает его кассиру, тот вводит в «Бонусах»
          if (!chatId) { res.json({ ok: false, error: 'bad_chat' }); return; }
          const code = String(crypto.randomInt(100000, 1000000));
          await fdb.doc(`${REF_BASE}/tgLinkCodes/${code}`).set({
            chatId, name: String(body.name || '').slice(0, 60),
            createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 60000).toISOString(),
          });
          res.json({ ok: true, code, ttlMin: 30 });
          return;
        }
        case 'refInfo': {
          // Проверка кода из ссылки t.me/Hostellauzbot?start=ref_XXXXXX
          const code = REF.normCode(body.code);
          if (!code) { res.json({ ok: true, valid: false }); return; }
          const q = await clients.where('refCode', '==', code).limit(1).get();
          if (q.empty) { res.json({ ok: true, valid: false }); return; }
          const s = await refSettings(fdb);
          res.json({ ok: true, valid: true, code, name: REF.maskName(q.docs[0].data().fullName), active: !!s.active });
          return;
        }
        default:
          res.status(400).json({ ok: false, error: 'bad_action' });
      }
    } catch (e) {
      console.error('[referralBot]', e);
      res.status(500).json({ ok: false, error: 'server' });
    }
  });
