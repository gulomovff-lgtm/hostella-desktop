/**
 * emehmonSheetStore — копия листа убытия в Firebase Storage.
 *
 * Файл на диске стойки — для печати без сети; копия в облаке — чтобы лист
 * открывался с любого компьютера сети и чтобы гостю можно было отдать ссылку
 * (QR в карточке). Путь `sheets/{hostelId}/{guestId}/{имя}` — см. storage.rules.
 */
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

const seg = (s) => String(s || '').replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80);

export const sheetStoragePath = (hostelId, guestId, fileName) =>
  `sheets/${seg(hostelId) || 'hostel'}/${seg(guestId) || 'guest'}/${seg(fileName) || 'sheet.pdf'}`;

export async function uploadDepartureSheet({ base64, hostelId, guestId, fileName }) {
  if (!base64) throw new Error('нет данных листа');
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const path = sheetStoragePath(hostelId, guestId, fileName);
  const r = storageRef(storage, path);
  await uploadBytes(r, bytes, { contentType: 'application/pdf' });
  return { path, url: await getDownloadURL(r) };
}
