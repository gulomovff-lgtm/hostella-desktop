const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const vision = require("@google-cloud/vision");

// Load environment variables from .env.local (for local development)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

if (!admin.apps.length) {
  admin.initializeApp();
}

const client = new vision.ImageAnnotatorClient();

exports.scanPassport = functions
  .runWith({ 
    memory: "256MB", 
    timeoutSeconds: 60 
  })
  .https.onCall(async (data, context) => {

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  if (!data || !data.image) {
    throw new functions.https.HttpsError("invalid-argument", "Image data missing.");
  }

  try {
    const request = {
      image: { content: data.image },
      features: [{ type: "TEXT_DETECTION" }],
    };

    const [result] = await client.annotateImage(request);
    const fullText = result.fullTextAnnotation ? result.fullTextAnnotation.text : "";
    
    console.log("OCR Result Text:", fullText); // Debug log in Cloud Console

    // 1. Попытка найти MRZ (самый точный метод)
    let parsedData = parseMRZ(fullText);

    // 2. Если MRZ не дал результатов (или это ID-карта спереди), читаем визуальный текст
    if (!parsedData.passport || !parsedData.fullName) {
        console.log("MRZ failed, switching to Visual Parsing...");
        const visualData = parseVisualText(fullText);
        
        // Объединяем результаты (приоритет у непустых полей)
        parsedData = {
            fullName: parsedData.fullName || visualData.fullName,
            passport: parsedData.passport || visualData.passport,
            birthDate: parsedData.birthDate || visualData.birthDate,
            country: parsedData.country || visualData.country
        };
    }

    return { success: true, data: parsedData };

  } catch (error) {
    console.error("Vision API Error:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

// --- Парсер MRZ (Паспорта и ID-карты сзади) ---
function parseMRZ(text) {
  const lines = text.split('\n').map(l => l.trim().replace(/\s/g, ''));
  // Ищем строки с '<<'
  const mrzLines = lines.filter(l => l.includes('<<') && l.length > 25);
  
  let data = { fullName: "", passport: "", birthDate: "", country: "Узбекистан" };

  if (mrzLines.length === 0) return data;

  // Тип 1: Паспорт (2 строки ~44 символа)
  // Тип 2: ID-карта (3 строки ~30 символов)
  
  const lastLine = mrzLines[mrzLines.length - 1];
  const firstLine = mrzLines[0];

  // Извлечение Номера Документа (Обычно во второй строке для паспортов, в первой/третьей для ID)
  // Для паспортов (TD3): Строка 2, символы 1-9
  // Для ID (TD1): Строка 1, символы 6-14
  
  // Пробуем универсальный поиск номера (Буква + 7 цифр для паспорта, или 9 цифр для ID)
  const passportMatch = text.match(/([A-Z]{2}[0-9]{7})|([0-9]{9})/);
  if (passportMatch) data.passport = passportMatch[0];

  // Дата рождения (YYMMDD) - обычно в последней строке MRZ
  // Ищем 6 цифр подряд, за которыми следует контрольная цифра и пол (M/F)
  const dobMatch = lastLine.match(/([0-9]{6})[0-9][MF]/);
  if (dobMatch) {
      data.birthDate = parseDateYYMMDD(dobMatch[1]);
  }

  // Имя (обычно в первой строке после кода страны)
  // P<UZBSURNAME<<NAME
  // I<UZB...
  if (firstLine.includes('<<')) {
      const parts = firstLine.split('<<');
      let namePart = parts[0];
      // Убираем префикс (P<UZB, I<UZB, A<UZB)
      namePart = namePart.replace(/^[A-Z0-9<]{5}/, ''); 
      // Часто в начале остается часть фамилии, если она не отделена.
      // Попробуем просто взять то, что разделено <<
      if (parts.length > 1) {
          let surname = parts[0].substring(5).replace(/</g, ''); // Грубая очистка
          let name = parts[1].replace(/</g, '');
          data.fullName = `${surname} ${name}`.trim();
      }
  }

  return data;
}

// --- Парсер Визуального Текста (ID-карты спереди) ---
function parseVisualText(text) {
    const lines = text.split('\n').map(l => l.trim());
    let data = { fullName: "", passport: "", birthDate: "", country: "Узбекистан" };

    // 1. Поиск Номера ID карты / Паспорта
    // Форматы: AA1234567 (Паспорт) или 001234567 (ID)
    // Ищем строку, похожую на номер, но игнорируем даты
    const passportRegex = /\b([A-Z]{2}[0-9]{7})\b|\b([0-9]{9})\b/; 
    const passportMatch = text.match(passportRegex);
    if (passportMatch) {
        data.passport = passportMatch[0];
    }

    // 2. Поиск Даты Рождения
    // Ключевые слова: "Date of birth", "Tug'ilgan sanasi", "Дата рождения"
    // Или просто формат DD.MM.YYYY
    const dateRegex = /\b(\d{2})[./-](\d{2})[./-](\d{4})\b/;
    const dateMatch = text.match(dateRegex);
    if (dateMatch) {
        // Проверяем, что это не дата выдачи (обычно дата рождения идет раньше или имеет подпись)
        // Для простоты берем первую найденную дату, которая похожа на ДР (год < 2020)
        if (parseInt(dateMatch[3]) < 2025 && parseInt(dateMatch[3]) > 1900) {
             data.birthDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
        }
    }

    // 3. Поиск Имени и Фамилии
    // Обычно идут ПОСЛЕ слов "Surname/Familiyasi" и "Given Names/Ismi"
    // Или просто БОЛЬШИМИ БУКВАМИ
    
    let surname = "";
    let givenName = "";

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        
        // Фамилия
        if (line.includes("surname") || line.includes("familiya")) {
            // Если фамилия на той же строке
            let temp = lines[i].replace(/Surname|Familiyasi|Familiya/gi, '').replace(/[:.]/g, '').trim();
            if (temp.length > 2) surname = temp;
            // Если на следующей строке (чаще всего)
            else if (lines[i+1] && isUpperCase(lines[i+1])) surname = lines[i+1];
        }

        // Имя
        if (line.includes("given name") || line.includes("ismi")) {
            let temp = lines[i].replace(/Given Names|Given Name|Ismi/gi, '').replace(/[:.]/g, '').trim();
            if (temp.length > 2) givenName = temp;
            else if (lines[i+1] && isUpperCase(lines[i+1])) givenName = lines[i+1];
        }
    }

    if (surname || givenName) {
        data.fullName = `${surname} ${givenName}`.trim().toUpperCase();
    } else {
        // Fallback: Ищем две строки подряд, написанные CAPS LOCK, которые не являются служебными
        // Это грубый метод, но работает для ID карт, где имя написано крупно
        const capsLines = lines.filter(l => isUpperCase(l) && l.length > 3 && !l.includes('REPUBLIC') && !l.includes('ID CARD'));
        if (capsLines.length >= 2) {
            // Обычно Фамилия выше Имени
            // data.fullName = `${capsLines[0]} ${capsLines[1]}`; 
        }
    }

    return data;
}

function parseDateYYMMDD(yymmdd) {
    let yy = parseInt(yymmdd.substring(0, 2));
    let mm = yymmdd.substring(2, 4);
    let dd = yymmdd.substring(4, 6);
    // 50 - пороговый год. Если 95 -> 1995, если 15 -> 2015
    let year = yy > 30 ? 1900 + yy : 2000 + yy;
    return `${year}-${mm}-${dd}`;
}

function isUpperCase(str) {
    return str === str.toUpperCase() && /[A-Z]/.test(str);
}

// --- TELEGRAM MESSAGE FUNCTION ---
// Reads recipients from Firestore settings/telegram, filters by notificationType
exports.sendTelegramMessage = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to send messages');
    }
    if (!data || !data.text) {
        throw new functions.https.HttpsError('invalid-argument', 'Message text is required');
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        throw new functions.https.HttpsError('internal', 'Telegram bot not configured');
    }

    // If explicit chatIds override is provided (e.g. test sends), use main bot directly
    if (Array.isArray(data.chatIds) && data.chatIds.length > 0) {
        const results = await Promise.allSettled(data.chatIds.map(target => {
            const chatId = typeof target === 'string' ? target : target.chatId;
            const rawThreadId = typeof target === 'object' ? (target.threadId || '').toString().trim() : '';
            const tid = rawThreadId ? parseInt(rawThreadId, 10) : null;
            const payload = { chat_id: chatId, text: data.text, parse_mode: 'HTML' };
            if (tid && !isNaN(tid)) payload.message_thread_id = tid;
            return fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(res => res.json()).then(json => ({ ok: json.ok, chatId }));
        }));
        const successful = results.filter(r => r.status === 'fulfilled' && r.value?.ok).length;
        return { success: successful > 0, sent: successful, total: data.chatIds.length };
    }

    // Read recipients from Firestore
    let settings = null;
    try {
        const APP_ID = 'hostella-multi-v4';
        const { getFirestore } = require('firebase-admin/firestore');
        const hostellaDb = getFirestore('hostella');
        const settingsSnap = await hostellaDb
            .doc(`artifacts/${APP_ID}/public/data/settings/telegram`)
            .get();
        settings = settingsSnap.exists ? settingsSnap.data() : null;
    } catch (e) {
        console.error('Failed to read Telegram settings:', e.message);
        return { success: false, sent: 0, total: 0, skipped: 'settings_error', error: e.message };
    }

    const notificationType = data.notificationType || null;
    const disabledTypes = new Set(settings?.disabledTypes || []);

    // If this notification type is globally disabled, skip
    if (notificationType && disabledTypes.has(notificationType)) {
        return { success: true, sent: 0, total: 0, skipped: 'type_disabled' };
    }

    // ── Build sends: [ { token, target } ] ───────────────────────────────────
    const sends = [];

    // 1. Main bot recipients
    const mainRecipients = (settings?.recipients || []).filter(r => {
        if (!r.active || !r.telegramId) return false;
        if (notificationType) return r.notifications?.[notificationType] !== false;
        return true;
    });
    for (const r of mainRecipients) {
        sends.push({ token: botToken, chatId: r.telegramId, threadId: r.threadId || null });
    }

    // 2. KPP-bot recipients (if token is set)
    if (settings?.kppBotToken) {
        const kppRecipients = (settings?.kppBotRecipients || []).filter(r => {
            if (!r.active || !r.telegramId) return false;
            if (notificationType) return r.notifications?.[notificationType] !== false;
            return true;
        });
        for (const r of kppRecipients) {
            sends.push({ token: settings.kppBotToken, chatId: r.telegramId, threadId: r.threadId || null });
        }
    }

    if (sends.length === 0) {
        return { success: true, sent: 0, total: 0, skipped: 'no_recipients' };
    }

    const results = await Promise.allSettled(
        sends.map(({ token, chatId, threadId }) => {
            const rawThreadId = (threadId || '').toString().trim();
            const tid = rawThreadId ? parseInt(rawThreadId, 10) : null;
            const payload = { chat_id: chatId, text: data.text, parse_mode: 'HTML' };
            if (tid && !isNaN(tid)) payload.message_thread_id = tid;
            console.log(`Sending to chatId=${chatId} threadId=${tid ?? 'none'}`);
            return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(res => res.json()).then(json => {
                if (!json.ok) {
                    console.error(`Telegram error chatId=${chatId}: ${json.error_code} — ${json.description}`);
                    return { ok: false, chatId, errorCode: json.error_code, description: json.description };
                }
                return { ok: true, chatId };
            });
        })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value?.ok).length;
    const failed = results
        .filter(r => r.status === 'fulfilled' && !r.value?.ok)
        .map(r => ({ chatId: r.value.chatId, code: r.value.errorCode, msg: r.value.description }));
    const errors = results.filter(r => r.status === 'rejected').map(r => r.reason?.message);

    console.log(`Telegram [${notificationType || 'manual'}]: ${successful}/${sends.length} sent`, failed.length ? { failed } : '');

    return { success: successful > 0, sent: successful, total: sends.length, failed, errors };
});

// ─────────────────────────────────────────────────────────────────────────────
// getAvailability — public HTTP endpoint for the booking widget
// Returns booked date ranges from Firestore for a given hostel + bed type.
// Query params: hostelId, bedType, months (default=3)
// ─────────────────────────────────────────────────────────────────────────────
exports.getAvailability = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

    const { hostelId, bedType } = req.query;
    if (!hostelId || !bedType) {
        res.status(400).json({ ok: false, error: 'hostelId and bedType required' });
        return;
    }

    try {
        const { getFirestore } = require('firebase-admin/firestore');
        const hostellaDb = getFirestore('hostella');
        const APP_ID = 'hostella-multi-v4';

        // Fetch rooms to know capacity (needed to classify numeric bedIds as upper/lower)
        const roomsSnap = await hostellaDb
            .collection(`artifacts/${APP_ID}/public/data/rooms`)
            .where('hostelId', '==', hostelId)
            .get();

        const roomCapMap = {}; // roomId -> capacity
        roomsSnap.forEach(docSnap => {
            roomCapMap[docSnap.id] = parseInt(docSnap.data().capacity) || 0;
        });

        const snapshot = await hostellaDb
            .collection(`artifacts/${APP_ID}/public/data/guests`)
            .where('hostelId', '==', hostelId)
            .where('status', 'in', ['active', 'booking'])
            .get();

        const ranges = [];
        snapshot.forEach(docSnap => {
            const g = docSnap.data();
            if (!g.checkInDate || !g.checkOutDate) return;

            // Step 1: explicit bedType field
            let gBedType = g.bedType || null;

            // Step 2: infer from string bedId prefix (e.g. "upper-3")
            if (!gBedType && g.bedId && typeof g.bedId === 'string' && isNaN(g.bedId)) {
                const bl = g.bedId.toLowerCase();
                if (bl.startsWith('upper')) gBedType = 'upper';
                else if (bl.startsWith('lower')) gBedType = 'lower';
            }

            // Step 3: infer from numeric bedId + room capacity
            // App logic: bedNum <= ceil(cap/2) → lower, bedNum > ceil(cap/2) → upper
            if (!gBedType && g.bedId && g.roomId) {
                const cap    = roomCapMap[g.roomId] || 0;
                const bedNum = parseInt(g.bedId);
                if (cap > 0 && bedNum > 0) {
                    const mid = Math.ceil(cap / 2);
                    gBedType  = bedNum > mid ? 'upper' : 'lower';
                }
            }

            if (gBedType !== bedType) return;

            ranges.push({
                checkIn:   g.checkInDate,
                checkOut:  g.checkOutDate,
                bedsCount: g.bedsCount || 1,
            });
        });

        res.json({ ok: true, hostelId, bedType, count: ranges.length, ranges });
    } catch (e) {
        console.error('getAvailability error:', e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// createWebBooking — creates a guest/booking document in Firestore
// from the booking website so it appears instantly in the Hostella app.
// POST body (JSON): { fullName, phone, hostelId, bedType, bedsCount, checkIn,
//                    checkOut, nights, amount, pricePerDay, paymentMethod,
//                    paymentStatus, mysqlBookingId, comment }
// ─────────────────────────────────────────────────────────────────────────────
exports.createWebBooking = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST only' }); return; }

    try {
        const d = req.body || {};

        if (!d.fullName || !d.checkIn || !d.checkOut || !d.hostelId) {
            res.status(400).json({ ok: false, error: 'fullName, checkIn, checkOut, hostelId are required' });
            return;
        }

        const { getFirestore } = require('firebase-admin/firestore');
        const hostellaDb = getFirestore('hostella');
        const APP_ID = 'hostella-multi-v4';

        const hostelLabel = d.hostelId === 'hostel2' ? 'Хостел №2' : 'Хостел №1';
        const bedLabel    = d.bedType  === 'lower'   ? 'Нижнее место' : 'Верхнее место';

        const guestDoc = {
            fullName:       d.fullName || '',
            phone:          d.phone || '',
            status:         'booking',
            hostelId:       d.hostelId || 'hostel1',
            bedType:        d.bedType  || 'upper',
            bedsCount:      Number(d.bedsCount) || 1,
            checkInDate:    new Date(d.checkIn).toISOString(),
            checkOutDate:   new Date(d.checkOut).toISOString(),
            days:           Number(d.nights) || 1,
            totalPrice:     Number(d.amount) || 0,
            pricePerDay:    Number(d.pricePerDay) || 0,
            paidCash:       0,
            paidCard:       0,
            paidQR:         0,
            amountPaid:     0,
            comment:        d.comment || '',
            paymentMethod:  d.paymentMethod || 'cash',
            paymentStatus:  d.paymentStatus || 'pending',
            mysqlBookingId: Number(d.mysqlBookingId) || 0,
            source:         'website',
            createdAt:      new Date().toISOString(),
            createdBy:      'website',
        };

        const ref = await hostellaDb
            .collection(`artifacts/${APP_ID}/public/data/guests`)
            .add(guestDoc);

        // Telegram notification via existing sendTelegram function internals
        try {
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            if (botToken) {
                const settingsRef = hostellaDb.doc(`artifacts/${APP_ID}/public/data/settings/telegram`);
                const settingsSnap = await settingsRef.get();
                const settings     = settingsSnap.exists ? settingsSnap.data() : null;
                const recipients   = (settings?.recipients || []).filter(r =>
                    r.active && r.telegramId && r.notifications?.checkin !== false
                );

                if (recipients.length > 0) {
                    const ci = new Date(d.checkIn).toLocaleDateString('ru');
                    const co = new Date(d.checkOut).toLocaleDateString('ru');
                    const text = `🌐 <b>Онлайн-бронирование</b>\n`
                        + `👤 ${guestDoc.fullName}\n`
                        + `📞 ${guestDoc.phone}\n`
                        + `🏨 ${hostelLabel} · ${bedLabel} × ${guestDoc.bedsCount}\n`
                        + `📅 ${ci} → ${co} (${guestDoc.days} дн.)\n`
                        + `💰 ${Number(d.amount).toLocaleString('ru')} сум · ${d.paymentMethod === 'cash' ? 'Наличные' : d.paymentMethod === 'payme' ? 'Payme' : 'Click'}\n`
                        + `💬 ${guestDoc.comment || '—'}\n`
                        + `🔖 MySQL #${d.mysqlBookingId || '—'}`;

                    await Promise.allSettled(recipients.map(r => {
                        const payload = { chat_id: r.telegramId, text, parse_mode: 'HTML' };
                        if (r.threadId) payload.message_thread_id = parseInt(r.threadId, 10);
                        return fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                        });
                    }));
                }
            }
        } catch (tgErr) {
            console.warn('Telegram notification failed (non-fatal):', tgErr.message);
        }

        res.json({ ok: true, firestoreId: ref.id });
    } catch (e) {
        console.error('createWebBooking error:', e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// Admin Stats Password Verification
// Secure password check for admin-stats.html
exports.verifyAdminPassword = functions.https.onCall(async (data, context) => {
    const submittedPassword = data?.password;
    const adminPassword = process.env.ADMIN_STATS_PASSWORD || 'NOT_SET';

    if (!submittedPassword || !adminPassword || adminPassword === 'NOT_SET') {
        throw new functions.https.HttpsError(
            'unavailable',
            'Password verification not configured'
        );
    }

    // Compare passwords
    if (submittedPassword === adminPassword) {
        return { success: true, message: 'Password accepted' };
    } else {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Invalid password'
        );
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// getFreeBeds — текущая свободность мест для n8n бота
//
// GET /getFreeBeds?key=YOUR_API_KEY
// GET /getFreeBeds?key=YOUR_API_KEY&hostelId=hostel1   (фильтр по хостелу)
//
// Возвращает:
// {
//   ok: true,
//   updatedAt: "2026-04-21T10:00:00.000Z",
//   total: { capacity: 30, occupied: 12, free: 18 },
//   hostels: {
//     hostel1: { name: "Хостел №1", capacity: 16, occupied: 7, free: 9 },
//     hostel2: { name: "Хостел №2", capacity: 14, occupied: 5, free: 9 }
//   },
//   rooms: [
//     { hostelId: "hostel1", roomNumber: "1", capacity: 8, occupied: 3, free: 5 },
//     ...
//   ]
// }
// ─────────────────────────────────────────────────────────────────────────────
exports.getFreeBeds = functions
    .runWith({ secrets: ['N8N_API_KEY'] })
    .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

    // --- Проверка API-ключа ---
    const apiKey = req.query.key || req.headers['x-api-key'];
    const validKey = process.env.N8N_API_KEY;
    if (!validKey || validKey === 'NOT_SET') {
        res.status(503).json({ ok: false, error: 'API key not configured on server' });
        return;
    }
    if (!apiKey || apiKey !== validKey) {
        res.status(401).json({ ok: false, error: 'Invalid or missing API key' });
        return;
    }

    try {
        const { getFirestore } = require('firebase-admin/firestore');
        const hostellaDb = getFirestore('hostella');
        const APP_ID = 'hostella-multi-v4';
        const basePath = `artifacts/${APP_ID}/public/data`;

        const hostelFilter = req.query.hostelId || null; // опциональный фильтр

        // 1. Загружаем все комнаты
        let roomsQuery = hostellaDb.collection(`${basePath}/rooms`);
        if (hostelFilter) roomsQuery = roomsQuery.where('hostelId', '==', hostelFilter);
        const roomsSnap = await roomsQuery.get();

        const rooms = {};
        roomsSnap.forEach(doc => {
            const d = doc.data();
            rooms[doc.id] = {
                id: doc.id,
                hostelId: d.hostelId || 'hostel1',
                roomNumber: d.number || d.roomNumber || '?',
                capacity: parseInt(d.capacity) || 0,
                occupied: 0,
            };
        });

        // 2. Загружаем активных гостей (только status=active, прямо сейчас)
        let guestsQuery = hostellaDb.collection(`${basePath}/guests`)
            .where('status', '==', 'active');
        if (hostelFilter) guestsQuery = guestsQuery.where('hostelId', '==', hostelFilter);
        const guestsSnap = await guestsQuery.get();

        const now = new Date();
        guestsSnap.forEach(doc => {
            const g = doc.data();
            // Считаем занятыми всех активных гостей — в т.ч. просроченных,
            // которые ещё не выселены формально (авто-выселение могло не сработать).
            // Свободным место считается только если статус не 'active'.
            if (!g.roomId || !rooms[g.roomId]) return;
            rooms[g.roomId].occupied += 1;
        });

        // 3. Агрегируем по хостелам
        const HOSTEL_NAMES = { hostel1: 'Хостел №1', hostel2: 'Хостел №2' };
        const hostelStats = {};
        const roomList = [];

        Object.values(rooms).forEach(r => {
            const free = Math.max(0, r.capacity - r.occupied);
            roomList.push({
                hostelId: r.hostelId,
                roomNumber: r.roomNumber,
                capacity: r.capacity,
                occupied: r.occupied,
                free,
            });
            if (!hostelStats[r.hostelId]) {
                hostelStats[r.hostelId] = {
                    name: HOSTEL_NAMES[r.hostelId] || r.hostelId,
                    capacity: 0,
                    occupied: 0,
                    free: 0,
                };
            }
            hostelStats[r.hostelId].capacity += r.capacity;
            hostelStats[r.hostelId].occupied += r.occupied;
            hostelStats[r.hostelId].free     += free;
        });

        // 4. Итого
        const totalCapacity = roomList.reduce((s, r) => s + r.capacity, 0);
        const totalOccupied = roomList.reduce((s, r) => s + r.occupied, 0);
        const totalFree     = Math.max(0, totalCapacity - totalOccupied);

        // Сортируем комнаты по хостелу, потом по номеру
        roomList.sort((a, b) => {
            if (a.hostelId !== b.hostelId) return a.hostelId.localeCompare(b.hostelId);
            return String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true });
        });

        res.json({
            ok: true,
            updatedAt: now.toISOString(),
            total: { capacity: totalCapacity, occupied: totalOccupied, free: totalFree },
            hostels: hostelStats,
            rooms: roomList,
        });

    } catch (e) {
        console.error('getFreeBeds error:', e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Автоматический бэкап Firestore (именованная БД 'hostella')
// Ежедневно в 04:00 по Ташкенту экспортирует ВСЕ коллекции в GCS-бакет проекта
// по умолчанию, в папку firestore-backups/<timestamp>.
// Требует: план Blaze (уже включён, раз функции работают) и право экспорта у
// сервис-аккаунта функций (роль Editor у App Engine SA по умолчанию это покрывает).
// ─────────────────────────────────────────────────────────────────────────────
const { v1: firestoreV1 } = require("@google-cloud/firestore");
const firestoreAdminClient = new firestoreV1.FirestoreAdminClient();

exports.scheduledFirestoreBackup = functions
  .runWith({ memory: "256MB", timeoutSeconds: 540 })
  .pubsub.schedule("0 4 * * *")
  .timeZone("Asia/Tashkent")
  .onRun(async () => {
    const projectId  = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    const databaseId = "hostella";

    // Бакет проекта по умолчанию (Firebase Storage) — гарантированно существует.
    let bucketName;
    try { bucketName = admin.storage().bucket().name; }
    catch { bucketName = `${projectId}.appspot.com`; }

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const outputUriPrefix = `gs://${bucketName}/firestore-backups/${ts}`;
    const name = firestoreAdminClient.databasePath(projectId, databaseId);

    try {
      const [response] = await firestoreAdminClient.exportDocuments({
        name,
        outputUriPrefix,
        collectionIds: [], // [] = все коллекции
      });
      console.log(`✅ Firestore backup started: ${response.name} → ${outputUriPrefix}`);
      return response;
    } catch (err) {
      console.error("❌ Firestore backup failed:", err);
      throw err;
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Запрос на понижение цены: кассир отправляет запрос → Telegram с кнопками
// «Одобрить / Отклонить» → нажатие обрабатывается вебхуком telegramWebhook.
// ─────────────────────────────────────────────────────────────────────────────
const PRICE_APP_ID = 'hostella-multi-v4';
const PRICE_BASE = `artifacts/${PRICE_APP_ID}/public/data`;
const fmtMoneyRu = (n) => (Number(n) || 0).toLocaleString('ru-RU');

async function tgAnswerCallback(botToken, cbId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: cbId, text: text || '', show_alert: false }),
    });
  } catch (e) { console.error('answerCallbackQuery', e.message); }
}

exports.sendPriceRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Требуется авторизация');
  }
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new functions.https.HttpsError('internal', 'Telegram bot not configured');

  const { requestId, guestName, roomNumber, hostelId, cashierName, currentPrice, requestedPrice, chatIds } = data || {};
  if (!requestId || !Array.isArray(chatIds) || chatIds.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'requestId и chatIds обязательны');
  }
  const hostelName = hostelId === 'hostel2' ? 'Хостел №2' : 'Хостел №1';
  const lines = [
    '🔻 <b>Запрос на понижение цены</b>',
    `👤 Гость: <b>${guestName || '—'}</b>`,
    `🏨 ${hostelName} · комната ${roomNumber || '—'}`,
  ];
  if (Number(currentPrice) > 0) lines.push(`💵 Текущая цена: ${fmtMoneyRu(currentPrice)} сум/ночь`);
  lines.push(`🔻 Запрошенная: <b>${fmtMoneyRu(requestedPrice)} сум/ночь</b>`);
  lines.push(`👷 Кассир: ${cashierName || '—'}`);
  lines.push('');
  lines.push('Разрешить эту цену?');
  const text = lines.join('\n');
  const reply_markup = {
    inline_keyboard: [[
      { text: '✅ Одобрить', callback_data: `pricereq:approve:${requestId}` },
      { text: '❌ Отклонить', callback_data: `pricereq:reject:${requestId}` },
    ]],
  };
  const results = await Promise.allSettled((chatIds || []).map(chatId =>
    fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: String(chatId), text, parse_mode: 'HTML', reply_markup }),
    }).then(r => r.json())
  ));
  const sent = results.filter(r => r.status === 'fulfilled' && r.value && r.value.ok).length;
  return { success: sent > 0, sent };
});

exports.telegramWebhook = functions.https.onRequest(async (req, res) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  try {
    const update = req.body || {};
    const cb = update.callback_query;
    if (!cb) { res.status(200).send('ok'); return; }

    const m = /^pricereq:(approve|reject):(.+)$/.exec(cb.data || '');
    if (!m) { await tgAnswerCallback(botToken, cb.id, 'Неизвестное действие'); res.status(200).send('ok'); return; }
    const action = m[1];
    const requestId = m[2];

    const { getFirestore } = require('firebase-admin/firestore');
    const hostellaDb = getFirestore('hostella');
    const reqRef = hostellaDb.doc(`${PRICE_BASE}/priceRequests/${requestId}`);
    const snap = await reqRef.get();
    if (!snap.exists) { await tgAnswerCallback(botToken, cb.id, 'Заявка не найдена'); res.status(200).send('ok'); return; }
    const r = snap.data();
    if (r.status && r.status !== 'pending') {
      await tgAnswerCallback(botToken, cb.id, `Уже обработано: ${r.status === 'approved' ? 'одобрено' : 'отклонено'}`);
      res.status(200).send('ok'); return;
    }

    const approver = [cb.from && cb.from.first_name, cb.from && cb.from.last_name].filter(Boolean).join(' ')
      || (cb.from && cb.from.username) || String((cb.from && cb.from.id) || '');
    const nowIso = new Date().toISOString();

    if (action === 'approve') {
      await reqRef.update({ status: 'approved', decidedAt: nowIso, approvedBy: approver });
      if (r.guestId) {
        await hostellaDb.doc(`${PRICE_BASE}/guests/${r.guestId}`).update({
          priceReductionAllowed: true,
          approvedPrice: Number(r.requestedPrice) || 0,
          priceRequestId: requestId,
        });
      }
      // Добавляем человека в постоянный список разрешённых (по паспорту) —
      // при повторном заселении запрос больше не показывается.
      const pKey = String(r.passport || '').replace(/\s/g, '').toUpperCase();
      if (pKey) {
        try {
          await hostellaDb.doc(`${PRICE_BASE}/priceWhitelist/${pKey}`).set({
            passport: r.passport || '',
            name: r.guestName || '',
            price: Number(r.requestedPrice) || 0,
            addedBy: approver,
            addedAt: nowIso,
            source: 'telegram',
          }, { merge: true });
        } catch (e) { console.error('whitelist write', e.message); }
      }
    } else {
      await reqRef.update({ status: 'rejected', decidedAt: nowIso, approvedBy: approver });
    }

    await tgAnswerCallback(botToken, cb.id, action === 'approve' ? '✅ Одобрено' : '❌ Отклонено');
    if (cb.message) {
      const tail = action === 'approve' ? `\n\n✅ <b>ОДОБРЕНО</b> · ${approver}` : `\n\n❌ <b>ОТКЛОНЕНО</b> · ${approver}`;
      await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cb.message.chat.id, message_id: cb.message.message_id,
          text: (cb.message.text || 'Запрос на понижение цены') + tail, parse_mode: 'HTML',
        }),
      });
    }
    res.status(200).send('ok');
  } catch (e) {
    console.error('[telegramWebhook]', e);
    res.status(200).send('ok'); // всегда 200 — иначе Telegram будет ретраить
  }
});
