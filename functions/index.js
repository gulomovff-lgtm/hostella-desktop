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

    let targetChatIds = [];

    // If explicit chatIds override is provided (e.g. test sends), use them directly
    if (Array.isArray(data.chatIds) && data.chatIds.length > 0) {
        targetChatIds = data.chatIds;
    } else {
        // Read recipients from Firestore
        try {
            // Determine the app settings path to match the frontend PUBLIC_DATA_PATH
            // path: artifacts/{appId}/public/data/settings/telegram
            const APP_ID = 'hostella-multi-v4';
            const settingsRef = admin.firestore()
                .doc(`artifacts/${APP_ID}/public/data/settings/telegram`);
            const settingsSnap = await settingsRef.get();
            const settings = settingsSnap.exists ? settingsSnap.data() : null;

            const recipients = settings?.recipients || [];
            const disabledTypes = new Set(settings?.disabledTypes || []);
            const notificationType = data.notificationType || null;

            // If this notification type is globally disabled, skip
            if (notificationType && disabledTypes.has(notificationType)) {
                return { success: true, sent: 0, total: 0, skipped: 'type_disabled' };
            }

            // Filter active recipients subscribed to this notification type
            const filteredRecipients = recipients.filter(r => {
                if (!r.active) return false;
                if (!r.telegramId) return false;
                if (notificationType) {
                    return r.notifications?.[notificationType] !== false;
                }
                return true;
            });

            targetChatIds = filteredRecipients.map(r => ({
                chatId: r.telegramId,
                threadId: r.threadId || null
            }));

            // If no recipients configured in Firestore — skip silently
            if (targetChatIds.length === 0 && recipients.length === 0) {
                return { success: true, sent: 0, total: 0, skipped: 'no_recipients' };
            }
        } catch (e) {
            console.error('Failed to read Telegram settings:', e.message);
            return { success: false, sent: 0, total: 0, skipped: 'settings_error', error: e.message };
        }
    }

    if (targetChatIds.length === 0) {
        return { success: true, sent: 0, total: 0, skipped: 'no_recipients' };
    }

    const sendOne = async (target) => {
        const chatId = typeof target === 'string' ? target : target.chatId;
        const threadId = typeof target === 'object' && target.threadId ? parseInt(target.threadId) : null;
        const payload = { chat_id: chatId, text: data.text, parse_mode: 'HTML' };
        if (threadId) payload.message_thread_id = threadId;
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!json.ok) {
            return { ok: false, chatId, errorCode: json.error_code, description: json.description };
        }
        return { ok: true, chatId };
    };

    const results = await Promise.allSettled(targetChatIds.map(sendOne));
    const successful = results.filter(r => r.status === 'fulfilled' && r.value?.ok).length;
    const failed = results
        .filter(r => r.status === 'fulfilled' && !r.value?.ok)
        .map(r => ({ chatId: r.value.chatId, code: r.value.errorCode, msg: r.value.description }));
    const errors = results.filter(r => r.status === 'rejected').map(r => r.reason?.message);

    console.log(`Telegram [${data.notificationType || 'manual'}]: ${successful}/${targetChatIds.length} sent`, failed.length ? { failed } : '');

    return { success: successful > 0, sent: successful, total: targetChatIds.length, failed, errors };
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
