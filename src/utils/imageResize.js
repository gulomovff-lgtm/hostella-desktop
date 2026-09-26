/**
 * imageResize.js — уменьшить фото перед загрузкой.
 *
 * Фото товара с телефона весит 3–8 МБ, а на плитке продажи оно 100 пикселей.
 * Справочник читают все кассы, и тяжёлые картинки грузили бы сеть и память
 * при каждом открытии окна продажи. Поэтому ужимаем до стороны 512 px в JPEG
 * (обычно 20–60 КБ) прямо в браузере.
 */

/** Размеры с сохранением пропорций, длинная сторона не больше maxSide. */
export const fitSize = (w, h, maxSide = 512) => {
  const W = Number(w) || 0, H = Number(h) || 0;
  if (!W || !H) return { width: 0, height: 0 };
  const k = Math.min(1, maxSide / Math.max(W, H));
  return { width: Math.round(W * k), height: Math.round(H * k) };
};

/** Файл изображения → уменьшенный JPEG (Blob). Бросает ошибку, если это не картинка. */
export async function resizeImage(file, { maxSide = 512, quality = 0.82 } = {}) {
  if (!file || !/^image\//.test(file.type || '')) throw new Error('not_image');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('not_image'));
      i.src = url;
    });
    const { width, height } = fitSize(img.naturalWidth, img.naturalHeight, maxSide);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';               // прозрачный PNG → белый фон, а не чёрный
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) throw new Error('encode_failed');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
