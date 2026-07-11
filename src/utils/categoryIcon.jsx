/**
 * categoryIcon — SVG-иконки (Lucide) для встроенных категорий расходов.
 *
 * Иконки пользовательских категорий — эмодзи, выбранные пользователем и
 * хранящиеся в localStorage/центральном конфиге. Их НЕ конвертируем:
 * это данные, совместимые со старыми версиями клиентов. Для них компонент
 * рендерит эмодзи как фолбэк. В <option> (нативные дропдауны) SVG невозможен —
 * там эмодзи остаются намеренно.
 */
import React from 'react';
import {
    Home, Lightbulb, Briefcase, Coins, ShoppingCart, Landmark, ClipboardList,
    Globe, Megaphone, Flame, Zap, Droplet, Wrench, Package, RotateCcw,
} from 'lucide-react';

const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е').trim();

export const CATEGORY_ICONS = {
    'аренда':              Home,
    'коммунальные услуги': Lightbulb,
    'зарплата':            Briefcase,
    'аванс':               Coins,
    'продукты':            ShoppingCart,
    'налоги':              Landmark,
    'регистрация':         ClipboardList,
    'интернет':            Globe,
    'реклама':             Megaphone,
    'газ':                 Flame,
    'электричество':       Zap,
    'вода':                Droplet,
    'ремонт':              Wrench,
    'другое':              Package,
    'возврат':             RotateCcw,
};

/**
 * Иконка категории: Lucide для встроенных, эмодзи-фолбэк для пользовательских.
 * @param {string} cat    — название категории
 * @param {string} emoji  — эмодзи-фолбэк (для кастомных категорий)
 * @param {number} size   — размер в px
 * @param {string} color  — цвет SVG (наследует, если не задан)
 */
export const CategoryIcon = ({ cat, emoji, size = 18, color, style }) => {
    const Icon = CATEGORY_ICONS[norm(cat)];
    if (Icon) return <Icon size={size} color={color} strokeWidth={2.2} style={style} aria-hidden="true" />;
    return <span style={{ fontSize: Math.round(size * 0.95), lineHeight: 1, ...style }}>{emoji || '•'}</span>;
};

export default CategoryIcon;
