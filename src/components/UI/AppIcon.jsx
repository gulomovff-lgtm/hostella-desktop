import React, { useState } from 'react';

/**
 * Брендовая иконка приложения.
 *
 * Пытается показать кастомную иконку из public/icons/<name>.(svg|png).
 * Если файла нет или он не загрузился — откатывается на emoji (ничего не ломается).
 *
 * Так можно постепенно заменять эмодзи на сгенерированный под стиль лого набор:
 * просто кладёшь файл public/icons/<name>.svg — и иконка появляется автоматически.
 *
 * @param {string} name   - ключ иконки = имя файла без расширения (напр. "rent", "salary")
 * @param {string} emoji  - запасной emoji, если кастомной иконки ещё нет
 * @param {number} size   - размер в px
 * @param {'svg'|'png'} ext - формат набора (по умолчанию svg)
 */
const ICON_BASE = `${import.meta.env.BASE_URL}icons/`;

export default function AppIcon({ name, emoji = '📦', size = 20, ext = 'svg', className = '', style }) {
    const [failed, setFailed] = useState(false);

    if (!name || failed) {
        return (
            <span className={className} style={{ fontSize: size * 0.92, lineHeight: 1, ...style }} aria-hidden>
                {emoji}
            </span>
        );
    }

    return (
        <img
            src={`${ICON_BASE}${name}.${ext}`}
            alt=""
            aria-hidden
            draggable={false}
            width={size}
            height={size}
            onError={() => setFailed(true)}
            className={className}
            style={{ width: size, height: size, objectFit: 'contain', display: 'inline-block', ...style }}
        />
    );
}
