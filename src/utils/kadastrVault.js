// Хранилище сайта кадастра на сервере, по филиалам (функция kadastrVault,
// 13.11.2026). Интерфейс получает только маски («пароль задан», •••• 1234);
// открытые пароль ЭЦП и карты берёт сам главный процесс Electron — ему мы
// передаём адрес функции, токен входа и филиал (vaultArg).
import { httpsCallable } from 'firebase/functions';
import { app, auth, functions } from '../firebase';

const call = httpsCallable(functions, 'kadastrVault');

/** Маски и настройки филиала (без секретов). */
export async function vaultPublic(hostelId) {
    const r = await call({ action: 'public', hostelId });
    return r.data;
}
/** Изменить настройки филиала (только админ/супер). */
export async function vaultSet(hostelId, patch) {
    try {
        const r = await call({ action: 'set', hostelId, patch });
        return r.data;
    } catch (e) {
        return { ok: false, error: e?.message || 'error' };
    }
}
/** Аргумент для главного процесса: он сам заберёт секреты с сервера. */
export async function vaultArg(hostelId) {
    const user = auth.currentUser;
    if (!user || !hostelId) return null;
    const idToken = await user.getIdToken();
    return { url: `https://us-central1-${app.options.projectId}.cloudfunctions.net/kadastrVault`, idToken, hostelId };
}
