import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Download,
  Plus,
  Search,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Play,
  ChevronDown,
  ChevronUp,
  Pencil,
  X,
  Check,
  LayoutGrid,
  List,
  ArrowRightLeft,
  FileText,
  Save,
  Loader2,
  Archive,
  ArchiveRestore,
  Wallet,
  Home,
  Lightbulb,
  Briefcase,
  Coins,
  ShoppingCart,
  Landmark,
  ClipboardList,
  Globe,
  Megaphone,
  Flame,
  Zap,
  Droplets,
  Wrench,
  Package,
  RotateCcw,
  Calendar,
  CalendarDays,
  Banknote
} from "lucide-react";
import TRANSLATIONS from "../../constants/translations";
import { getConfig } from "../../utils/appConfig";
const CAT_META = [
  { key: "\u0410\u0440\u0435\u043D\u0434\u0430", icon: "\u{1F3E0}", bg: "#ede9fe", text: "#6d28d9", bar: "#7c3aed", darkBg: "rgba(124,58,237,0.2)", darkText: "#c4b5fd" },
  { key: "\u041A\u043E\u043C\u043C\u0443\u043D\u0430\u043B\u044C\u043D\u044B\u0435 \u0443\u0441\u043B\u0443\u0433\u0438", icon: "\u{1F4A1}", bg: "#e0f2fe", text: "#0369a1", bar: "#0284c7", darkBg: "rgba(2,132,199,0.2)", darkText: "#7dd3fc" },
  { key: "\u0417\u0430\u0440\u043F\u043B\u0430\u0442\u0430", icon: "\u{1F4BC}", bg: "#eef2ff", text: "#4338ca", bar: "#4f46e5", darkBg: "rgba(79,70,229,0.2)", darkText: "#a5b4fc" },
  { key: "\u0410\u0432\u0430\u043D\u0441", icon: "\u{1F4B0}", bg: "#fef9c3", text: "#a16207", bar: "#ca8a04", darkBg: "rgba(202,138,4,0.2)", darkText: "#fcd34d" },
  { key: "\u041F\u0440\u043E\u0434\u0443\u043A\u0442\u044B", icon: "\u{1F6D2}", bg: "#dcfce7", text: "#15803d", bar: "#16a34a", darkBg: "rgba(22,163,74,0.2)", darkText: "#86efac" },
  { key: "\u041D\u0430\u043B\u043E\u0433\u0438", icon: "\u{1F3DB}\uFE0F", bg: "#f1f5f9", text: "#475569", bar: "#94a3b8", darkBg: "rgba(100,116,139,0.2)", darkText: "#94a3b8" },
  { key: "\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044F", icon: "\u{1F4CB}", bg: "#ffedd5", text: "#c2410c", bar: "#ea580c", darkBg: "rgba(234,88,12,0.2)", darkText: "#fdba74" },
  { key: "\u0418\u043D\u0442\u0435\u0440\u043D\u0435\u0442", icon: "\u{1F310}", bg: "#ccfbf1", text: "#0f766e", bar: "#0d9488", darkBg: "rgba(13,148,136,0.2)", darkText: "#5eead4" },
  { key: "\u0420\u0435\u043A\u043B\u0430\u043C\u0430", icon: "\u{1F4E3}", bg: "#fce7f3", text: "#be185d", bar: "#db2777", darkBg: "rgba(219,39,119,0.2)", darkText: "#f9a8d4" },
  { key: "\u0413\u0430\u0437", icon: "\u{1F525}", bg: "#fff7ed", text: "#c2410c", bar: "#f97316", darkBg: "rgba(249,115,22,0.2)", darkText: "#fdba74" },
  { key: "\u042D\u043B\u0435\u043A\u0442\u0440\u0438\u0447\u0435\u0441\u0442\u0432\u043E", icon: "\u26A1", bg: "#fefce8", text: "#ca8a04", bar: "#eab308", darkBg: "rgba(234,179,8,0.2)", darkText: "#fde047" },
  { key: "\u0412\u043E\u0434\u0430", icon: "\u{1F4A7}", bg: "#eff6ff", text: "#1d4ed8", bar: "#3b82f6", darkBg: "rgba(59,130,246,0.2)", darkText: "#93c5fd" },
  { key: "\u0420\u0435\u043C\u043E\u043D\u0442", icon: "\u{1F527}", bg: "#f8fafc", text: "#475569", bar: "#64748b", darkBg: "rgba(100,116,139,0.2)", darkText: "#94a3b8" },
  { key: "\u0414\u0440\u0443\u0433\u043E\u0435", icon: "\u{1F4E6}", bg: "#f8fafc", text: "#64748b", bar: "#94a3b8", darkBg: "rgba(100,116,139,0.2)", darkText: "#94a3b8" }
];
const CAT_FALLBACK = { icon: "\u{1F4E6}", bg: "#f8fafc", text: "#64748b", bar: "#94a3b8", darkBg: "rgba(100,116,139,0.2)", darkText: "#94a3b8" };
const ymdLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const getCat = (c) => {
  if (!c) return CAT_FALLBACK;
  const norm = c.trim().toLowerCase().replace(/ё/g, "\u0435").replace(/\s+/g, " ");
  const ns = norm.replace(/\s/g, "");
  return CAT_META.find((m) => m.key.toLowerCase().replace(/ё/g, "\u0435") === norm) || CAT_META.find((m) => m.key.toLowerCase().replace(/ё/g, "\u0435").replace(/\s/g, "") === ns) || CAT_META.find((m) => {
    const mk = m.key.toLowerCase().replace(/ё/g, "\u0435");
    return norm.includes(mk) || mk.includes(norm);
  }) || CAT_META.find((m) => {
    const mk = m.key.toLowerCase().replace(/ё/g, "\u0435").replace(/\s/g, "");
    return ns.includes(mk) || mk.includes(ns);
  }) || CAT_FALLBACK;
};
const CATS = ["\u0410\u0440\u0435\u043D\u0434\u0430", "\u041A\u043E\u043C\u043C\u0443\u043D\u0430\u043B\u044C\u043D\u044B\u0435 \u0443\u0441\u043B\u0443\u0433\u0438", "\u0417\u0430\u0440\u043F\u043B\u0430\u0442\u0430", "\u041F\u0440\u043E\u0434\u0443\u043A\u0442\u044B", "\u041D\u0430\u043B\u043E\u0433\u0438", "\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044F", "\u0418\u043D\u0442\u0435\u0440\u043D\u0435\u0442", "\u0420\u0435\u043A\u043B\u0430\u043C\u0430", "\u0414\u0440\u0443\u0433\u043E\u0435"];
const fmt = (n) => Number(n).toLocaleString("ru");
const CAT_ICON_MAP = {
  "\u0410\u0440\u0435\u043D\u0434\u0430": Home,
  "\u041A\u043E\u043C\u043C\u0443\u043D\u0430\u043B\u044C\u043D\u044B\u0435 \u0443\u0441\u043B\u0443\u0433\u0438": Lightbulb,
  "\u0417\u0430\u0440\u043F\u043B\u0430\u0442\u0430": Briefcase,
  "\u0410\u0432\u0430\u043D\u0441": Coins,
  "\u041F\u0440\u043E\u0434\u0443\u043A\u0442\u044B": ShoppingCart,
  "\u041D\u0430\u043B\u043E\u0433\u0438": Landmark,
  "\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044F": ClipboardList,
  "\u0418\u043D\u0442\u0435\u0440\u043D\u0435\u0442": Globe,
  "\u0420\u0435\u043A\u043B\u0430\u043C\u0430": Megaphone,
  "\u0413\u0430\u0437": Flame,
  "\u042D\u043B\u0435\u043A\u0442\u0440\u0438\u0447\u0435\u0441\u0442\u0432\u043E": Zap,
  "\u0412\u043E\u0434\u0430": Droplets,
  "\u0420\u0435\u043C\u043E\u043D\u0442": Wrench,
  "\u0414\u0440\u0443\u0433\u043E\u0435": Package,
  "\u0412\u043E\u0437\u0432\u0440\u0430\u0442": RotateCcw
};
const CAT_FILE = {
  "\u043A\u043E\u043C\u043C\u0443\u043D\u0430\u043B\u044C\u043D\u044B\u0435 \u0443\u0441\u043B\u0443\u0433\u0438": "utilities.png",
  "\u044D\u043B\u0435\u043A\u0442\u0440\u0438\u0447\u0435\u0441\u0442\u0432\u043E": "electricity.svg",
  "\u0441\u0432\u0435\u0442": "electricity.svg",
  "\u0434\u0440\u0443\u0433\u043E\u0435": "box.svg"
};
const ICON_BASE = import.meta.env.BASE_URL;
const normCatName = (c) => (c || "").trim().toLowerCase().replace(/ё/g, "\u0435");
const CatIcon = ({ cat, emoji, size = 18, color }) => {
  const meta = getCat(cat);
  const key = meta && meta.key;
  const file = CAT_FILE[normCatName(cat)] || (key ? CAT_FILE[normCatName(key)] : null);
  const [imgFailed, setImgFailed] = useState(false);
  if (file && !imgFailed) {
    const isSvg = file.endsWith(".svg");
    return /* @__PURE__ */ React.createElement("span", { style: { display: "inline-flex", width: size + 4, height: size + 4, alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 6, flexShrink: 0 } }, /* @__PURE__ */ React.createElement(
      "img",
      {
        src: `${ICON_BASE}icons/${file}`,
        alt: "",
        draggable: false,
        onError: () => setImgFailed(true),
        style: { width: "100%", height: "100%", objectFit: isSvg ? "contain" : "cover" }
      }
    ));
  }
  const Icon = key ? CAT_ICON_MAP[key] : null;
  if (Icon) {
    return /* @__PURE__ */ React.createElement(Icon, { size, strokeWidth: 2.2, style: { color: color || meta.bar || "#0f9688" } });
  }
  return /* @__PURE__ */ React.createElement("span", { style: { fontSize: Math.round(size * 0.95), lineHeight: 1 } }, emoji ?? (meta && meta.icon) ?? "\u{1F4E6}");
};
const guessIcon = (name) => {
  const n = (name || "").toLowerCase().replace(/ё/g, "\u0435");
  const map = [
    ["\u0433\u0430\u0437", "\u{1F525}"],
    ["\u043F\u043B\u0438\u0442", "\u{1F525}"],
    ["\u0441\u0432\u0435\u0442", "\u26A1"],
    ["\u044D\u043B\u0435\u043A\u0442\u0440", "\u26A1"],
    ["\u0432\u043E\u0434\u0430", "\u{1F4A7}"],
    ["\u0432\u043E\u0434\u043E\u043F\u0440\u043E\u0432\u043E\u0434", "\u{1F4A7}"],
    ["\u0430\u0440\u0435\u043D\u0434", "\u{1F3E0}"],
    ["\u043A\u0432\u0430\u0440\u0442\u0438\u0440", "\u{1F3E0}"],
    ["\u043F\u043E\u043C\u0435\u0449\u0435\u043D", "\u{1F3E2}"],
    ["\u043E\u0444\u0438\u0441", "\u{1F3E2}"],
    ["\u0438\u043D\u0442\u0435\u0440\u043D\u0435\u0442", "\u{1F310}"],
    ["\u0441\u0432\u044F\u0437", "\u{1F4E1}"],
    ["\u0442\u0435\u043B\u0435\u0444\u043E\u043D", "\u{1F4F1}"],
    ["\u0437\u0430\u0440\u043F\u043B\u0430\u0442", "\u{1F4BC}"],
    ["\u0430\u0432\u0430\u043D\u0441", "\u{1F4B0}"],
    ["\u043D\u0430\u043B\u043E\u0433", "\u{1F3DB}\uFE0F"],
    ["\u0448\u0442\u0440\u0430\u0444", "\u26A0\uFE0F"],
    ["\u043F\u0435\u043D\u044F", "\u26A0\uFE0F"],
    ["\u0435\u0434\u0430", "\u{1F37D}\uFE0F"],
    ["\u043F\u0440\u043E\u0434\u0443\u043A\u0442", "\u{1F6D2}"],
    ["\u043C\u0430\u0433\u0430\u0437\u0438\u043D", "\u{1F6CD}\uFE0F"],
    ["\u0440\u0435\u043A\u043B\u0430\u043C", "\u{1F4E3}"],
    ["\u043C\u0430\u0440\u043A\u0435\u0442\u0438\u043D\u0433", "\u{1F4CA}"],
    ["\u0440\u0435\u043C\u043E\u043D\u0442", "\u{1F527}"],
    ["\u0441\u0442\u0440\u043E\u0438\u0442", "\u{1F3D7}\uFE0F"],
    ["\u043C\u0430\u0442\u0435\u0440\u0438", "\u{1F9F1}"],
    ["\u0443\u0431\u043E\u0440\u043A", "\u{1F9F9}"],
    ["\u0447\u0438\u0441\u0442\u043A", "\u{1F9FD}"],
    ["\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446", "\u{1F4CB}"],
    ["\u0434\u043E\u043A\u0443\u043C\u0435\u043D", "\u{1F4C4}"],
    ["\u043C\u0435\u0434\u0438\u0446", "\u{1F48A}"],
    ["\u0432\u0440\u0430\u0447", "\u{1F3E5}"],
    ["\u0437\u0434\u043E\u0440\u043E\u0432", "\u{1F48A}"],
    ["\u0442\u0440\u0430\u043D\u0441\u043F\u043E\u0440\u0442", "\u{1F697}"],
    ["\u0431\u0435\u043D\u0437\u0438\u043D", "\u26FD"],
    ["\u0442\u043E\u043F\u043B\u0438\u0432", "\u26FD"],
    ["\u0441\u0442\u0440\u0430\u0445\u043E\u0432\u043A", "\u{1F6E1}\uFE0F"],
    ["\u0431\u0430\u043D\u043A", "\u{1F3E6}"],
    ["\u043A\u0440\u0435\u0434\u0438\u0442", "\u{1F4B3}"],
    ["\u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D", "\u{1F5A5}\uFE0F"],
    ["\u0442\u0435\u0445\u043D\u0438\u043A", "\u{1F50C}"],
    ["\u043A\u043E\u043C\u043C\u0443\u043D\u0430\u043B", "\u{1F4A1}"],
    ["\u0436\u043A\u0445", "\u{1F3E2}"],
    ["\u043C\u0443\u0441\u043E\u0440", "\u{1F5D1}\uFE0F"],
    ["\u0432\u044B\u0432\u043E\u0437", "\u{1F5D1}\uFE0F"],
    ["\u043E\u0445\u0440\u0430\u043D", "\u{1F510}"],
    ["\u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D", "\u{1F510}"],
    ["\u043F\u0438\u0442\u0430\u043D", "\u{1F37D}\uFE0F"],
    ["\u043A\u043E\u0444\u0435", "\u2615"],
    ["\u043A\u043E\u043D\u0434\u0438\u0446\u0438\u043E\u043D", "\u2744\uFE0F"],
    ["\u043E\u0442\u043E\u043F\u043B\u0435\u043D", "\u{1F321}\uFE0F"],
    ["\u043B\u0438\u0446\u0435\u043D\u0437\u0438", "\u{1F4DC}"],
    ["\u0441\u0435\u0440\u0442\u0438\u0444\u0438\u043A", "\u{1F4DC}"],
    ["\u0445\u043E\u0437\u0442\u043E\u0432\u0430\u0440", "\u{1F9F4}"],
    ["\u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440", "\u{1F4E6}"],
    ["\u0431\u0435\u043B\u044C", "\u{1F6CF}\uFE0F"],
    ["\u043F\u043E\u0441\u0442\u0435\u043B\u044C", "\u{1F6CF}\uFE0F"],
    ["\u043C\u0430\u0442\u0440\u0430\u0441", "\u{1F6CF}\uFE0F"],
    ["\u043F\u043E\u043B\u043E\u0442\u0435\u043D\u0446", "\u{1F9FA}"],
    ["\u043F\u0440\u0430\u0447\u0435\u0447\u043D", "\u{1F9FA}"],
    ["\u0441\u0442\u0438\u0440\u043A", "\u{1F9FA}"],
    ["\u043F\u043E\u0440\u043E\u0448", "\u{1F9F4}"],
    ["\u043C\u0435\u0431\u0435\u043B", "\u{1FA91}"],
    ["\u043F\u043E\u0441\u0443\u0434", "\u{1F37D}\uFE0F"],
    ["\u043A\u0443\u0445", "\u{1F37D}\uFE0F"],
    ["\u0437\u0435\u0440\u043A\u0430\u043B", "\u{1FA9E}"],
    ["\u043B\u0430\u043C\u043F\u043E\u0447\u043A", "\u{1F4A1}"],
    ["\u0440\u043E\u0437\u0435\u0442\u043A", "\u{1F50C}"],
    ["\u0441\u0430\u0434\u043E\u0432\u043D\u0438\u043A", "\u{1F333}"],
    ["\u043E\u0437\u0435\u043B\u0435\u043D", "\u{1F333}"],
    ["\u0446\u0432\u0435\u0442", "\u{1F33F}"],
    ["\u0431\u0443\u0445\u0433\u0430\u043B\u0442", "\u{1F9FE}"],
    ["\u044E\u0440\u0438\u0441\u0442", "\u2696\uFE0F"],
    ["\u043A\u043E\u043D\u0441\u0443\u043B\u044C\u0442", "\u{1F4AC}"],
    ["\u043A\u043E\u043C\u0438\u0441\u0441\u0438", "\u{1F4B3}"],
    ["\u044D\u043A\u0432\u0430\u0439\u0440", "\u{1F4B3}"],
    ["\u043F\u0440\u043E\u0446\u0435\u043D\u0442", "\u{1F4B3}"],
    ["\u0441\u0430\u043D\u0442\u0435\u0445\u043D\u0438\u043A", "\u{1F6BF}"],
    ["\u044D\u043B\u0435\u043A\u0442\u0440\u0438\u043A", "\u26A1"],
    ["\u043C\u0430\u0441\u0442\u0435\u0440", "\u{1F6E0}\uFE0F"],
    ["\u043A\u043B\u044E\u0447", "\u{1F511}"],
    ["\u0437\u0430\u043C\u043E\u043A", "\u{1F511}"],
    ["\u0434\u043E\u043C\u043E\u0444\u043E\u043D", "\u{1F514}"],
    ["\u043A\u0430\u043D\u0446\u0435\u043B", "\u270F\uFE0F"],
    ["\u0431\u0443\u043C\u0430\u0433", "\u{1F4C4}"],
    ["\u043F\u0435\u0447\u0430\u0442", "\u{1F5A8}\uFE0F"],
    ["\u043F\u043E\u0434\u0430\u0440", "\u{1F381}"],
    ["\u043F\u0440\u0435\u043C\u044C", "\u{1F3C6}"],
    ["\u0431\u043E\u043D\u0443\u0441", "\u{1F381}"],
    ["\u0434\u043E\u0441\u0442\u0430\u0432\u043A", "\u{1F69A}"],
    ["\u043B\u043E\u0433\u0438\u0441\u0442", "\u{1F69A}"],
    ["\u043A\u0443\u0440\u044C\u0435\u0440", "\u{1F6F5}"],
    ["\u043A\u0430\u0434\u0430\u0441\u0442\u0440", "\u{1F3D8}\uFE0F"],
    ["e-mehmon", "\u{1F4CB}"],
    ["\u044D\u043C\u0435\u0445\u043C\u043E\u043D", "\u{1F4CB}"],
    ["\u043C\u0438\u0433\u0440\u0430\u0446", "\u{1F6C2}"],
    ["\u0447\u0430\u0439", "\u{1F375}"],
    ["\u0441\u0430\u0445\u0430\u0440", "\u{1F36C}"],
    ["\u0431\u0443\u0444\u0435\u0442", "\u{1F96A}"],
    ["\u0432\u0438\u0434\u0435\u043E\u043D\u0430\u0431\u043B\u044E\u0434", "\u{1F4F9}"],
    ["\u043A\u0430\u043C\u0435\u0440", "\u{1F4F9}"],
    ["wifi", "\u{1F4F6}"],
    ["\u0432\u0430\u0439\u0444\u0430\u0439", "\u{1F4F6}"],
    ["\u0432\u0435\u043D\u0442\u0438\u043B\u044F\u0446", "\u{1F300}"],
    ["\u043E\u0431\u043E\u0433\u0440\u0435\u0432", "\u{1F321}\uFE0F"],
    ["\u043A\u043E\u0442\u0451\u043B", "\u{1F525}"],
    ["\u043A\u043E\u0442\u0435\u043B", "\u{1F525}"]
  ];
  for (const [kw, em] of map) {
    if (n.includes(kw)) return em;
  }
  const POOL = ["\u{1F9FE}", "\u{1F5C2}\uFE0F", "\u{1F4CC}", "\u{1F3AF}", "\u{1F9F0}", "\u{1F529}", "\u{1FAA3}", "\u{1F9EF}", "\u{1F50C}", "\u{1F6AA}", "\u{1FA9F}", "\u{1F9F2}", "\u2699\uFE0F", "\u{1F5DC}\uFE0F", "\u{1F6E0}\uFE0F", "\u{1F4CE}", "\u{1F3F7}\uFE0F", "\u{1F392}", "\u23F0", "\u{1F511}", "\u{1F4A1}", "\u{1F3A8}", "\u{1F9FF}", "\u{1F33F}"];
  let h = 0;
  for (let i = 0; i < n.length; i++) h = h * 31 + n.charCodeAt(i) >>> 0;
  return POOL[h % POOL.length];
};
const ExpenseEditForm = ({ expense, onSave, onCancel, saving }) => {
  const toLocal = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [comment, setComment] = useState(expense.comment || "");
  const [amount, setAmount] = useState(expense.amount || "");
  const [date, setDate] = useState(() => toLocal(expense.date));
  const handleSubmit = (ev) => {
    ev.preventDefault();
    const patch = {};
    if (comment !== (expense.comment || "")) patch.comment = comment;
    if (amount && String(amount) !== String(expense.amount)) patch.amount = Number(amount);
    if (date) {
      const newDate = new Date(date).toISOString();
      if (newDate !== expense.date) patch.date = newDate;
    }
    onSave(patch);
  };
  return /* @__PURE__ */ React.createElement("form", { onSubmit: handleSubmit, className: "flex flex-wrap items-end gap-2 px-5 py-3 bg-indigo-50 border-t border-indigo-100" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col gap-1 flex-1 min-w-[160px]" }, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold text-indigo-500 uppercase tracking-wide" }, "\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435"), /* @__PURE__ */ React.createElement(
    "input",
    {
      value: comment,
      onChange: (e) => setComment(e.target.value),
      placeholder: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439\u2026",
      autoFocus: true,
      className: "text-sm px-3 py-1.5 border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col gap-1 w-32" }, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold text-indigo-500 uppercase tracking-wide" }, "\u0421\u0443\u043C\u043C\u0430"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "number",
      min: "0",
      value: amount,
      onChange: (e) => setAmount(e.target.value),
      className: "text-sm px-3 py-1.5 border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col gap-1 w-44" }, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold text-indigo-500 uppercase tracking-wide" }, "\u0414\u0430\u0442\u0430"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "datetime-local",
      value: date,
      onChange: (e) => setDate(e.target.value),
      className: "text-sm px-3 py-1.5 border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
    }
  )), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "submit",
      disabled: saving,
      className: "w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white transition-colors"
    },
    saving ? /* @__PURE__ */ React.createElement(Loader2, { size: 14, className: "animate-spin" }) : /* @__PURE__ */ React.createElement(Save, { size: 14 })
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: onCancel,
      className: "w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-100"
    },
    /* @__PURE__ */ React.createElement(X, { size: 14 })
  ));
};
export default function ExpensesView({
  filteredExpenses = [],
  expenseCatFilter,
  setExpenseCatFilter,
  expSearch,
  setExpSearch,
  usersList = [],
  onDownloadCSV,
  onAddExpense,
  onDeleteExpense,
  onEditExpenseCategory,
  recurringExpenses = [],
  onAddRecurring,
  onUpdateRecurring,
  onDeleteRecurring,
  onToggleActive,
  onFireNow,
  onAddAdvance,
  onAddRecurringAdvance,
  recurringAdvances = {},
  onBackfillComments,
  onUpdateExpense,
  onAddExpensesBulk,
  notify,
  currentUser,
  selectedHostelFilter,
  lang = "ru"
}) {
  const t = (k) => TRANSLATIONS[lang]?.[k] || k;
  const isDark = document.documentElement.dataset.theme === "dark";
  const locale = lang === "uz" ? "uz-UZ" : "ru-RU";
  const now = /* @__PURE__ */ new Date();
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "super" || currentUser?.login === "fazliddin";
  const catBg = (m) => m ? isDark ? m.darkBg : m.bg : "#f8fafc";
  const catClr = (m) => m ? isDark ? m.darkText : m.text : "#64748b";
  const hostelKey = (currentUser?.role === "admin" || currentUser?.role === "super" ? selectedHostelFilter : currentUser?.hostelId) || "all";
  const lsKey = (base) => `${base}_${hostelKey}`;
  const readLS = (base, fb) => {
    try {
      const v = localStorage.getItem(lsKey(base));
      return v ? JSON.parse(v) : fb;
    } catch {
      return fb;
    }
  };
  const [viewMode, setViewMode] = useState("dashboard");
  const [expandedCard, setExpandedCard] = useState(null);
  const [movingId, setMovingId] = useState(null);
  const [moveTarget, setMoveTarget] = useState("");
  const [moveStaff, setMoveStaff] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [customCategories, setCustomCategories] = useState(() => readLS("exp_custom_cats", []));
  const [customCatIcons, setCustomCatIcons] = useState(() => readLS("exp_custom_icons", {}));
  const [cardOrder, setCardOrder] = useState(() => readLS("exp_card_order", null));
  const [archivedCategories, setArchivedCategories] = useState(() => readLS("exp_archived_cats", []));
  const [showArchive, setShowArchive] = useState(false);
  const [showCatBreakdown, setShowCatBreakdown] = useState(false);
  const [confirmArchiveCat, setConfirmArchiveCat] = useState(null);
  useEffect(() => {
    setCustomCategories(readLS("exp_custom_cats", []));
    setCustomCatIcons(readLS("exp_custom_icons", {}));
    setCardOrder(readLS("exp_card_order", null));
    setArchivedCategories(readLS("exp_archived_cats", []));
    setExpandedCard(null);
  }, [hostelKey]);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const dragIdx = useRef(null);
  const [salaryOpenStaff, setSalaryOpenStaff] = useState(null);
  const [confirmDeleteCat, setConfirmDeleteCat] = useState(null);
  const [confirmDeleteExp, setConfirmDeleteExp] = useState(null);
  const [editCat, setEditCat] = useState(null);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [addForm, setAddForm] = useState(false);
  const [form, setForm] = useState({ name: "", category: "\u0410\u0440\u0435\u043D\u0434\u0430", amount: "", comment: "", dayOfMonth: 1, hostelId: "all" });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [advanceTargetId, setAdvanceTargetId] = useState(null);
  const [advanceAmt, setAdvanceAmt] = useState("");
  const [recurringAdvanceTargetId, setRecurringAdvanceTargetId] = useState(null);
  const [recurringAdvanceAmt, setRecurringAdvanceAmt] = useState("");
  const [expDateFrom, setExpDateFrom] = useState("");
  const [expDateTo, setExpDateTo] = useState("");
  const [editingExpId, setEditingExpId] = useState(null);
  const [editExpSaving, setEditExpSaving] = useState(false);
  const amtFn = (e) => e.category === "\u0410\u0432\u0430\u043D\u0441" ? -(Number(e.amount) || 0) : Number(e.amount) || 0;
  const mainExpenses = useMemo(() => filteredExpenses.filter((e) => e.category !== "\u0412\u043E\u0437\u0432\u0440\u0430\u0442" && e.category !== "\u0410\u0432\u0430\u043D\u0441"), [filteredExpenses]);
  const refunds = useMemo(() => filteredExpenses.filter((e) => e.category === "\u0412\u043E\u0437\u0432\u0440\u0430\u0442"), [filteredExpenses]);
  const prevMonthDate = useMemo(() => new Date(now.getFullYear(), now.getMonth() - 1, 1), []);
  const thisMonth = useMemo(() => filteredExpenses.filter((e) => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && e.category !== "\u0412\u043E\u0437\u0432\u0440\u0430\u0442";
  }).reduce((s, e) => s + amtFn(e), 0), [filteredExpenses]);
  const prevMonthExp = useMemo(
    () => filteredExpenses.filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === prevMonthDate.getMonth() && d.getFullYear() === prevMonthDate.getFullYear() && e.category !== "\u0412\u043E\u0437\u0432\u0440\u0430\u0442";
    }),
    [filteredExpenses]
  );
  const prevMonth = useMemo(() => prevMonthExp.reduce((s, e) => s + amtFn(e), 0), [prevMonthExp]);
  const monthDiff = prevMonth ? Math.round((thisMonth - prevMonth) / prevMonth * 100) : null;
  const totalAll = useMemo(() => filteredExpenses.filter((e) => e.category !== "\u0412\u043E\u0437\u0432\u0440\u0430\u0442").reduce((s, e) => s + amtFn(e), 0), [filteredExpenses]);
  const totalRefunds = useMemo(() => refunds.reduce((s, e) => s + (Number(e.amount) || 0), 0), [refunds]);
  const centralCats = useMemo(() => {
    try {
      return (getConfig().expenseCategories || []).filter((c) => c && c.name);
    } catch {
      return [];
    }
  }, []);
  const allCatNames = useMemo(() => {
    const fromData = [...new Set(mainExpenses.map((e) => e.category).filter(Boolean))];
    const all = [.../* @__PURE__ */ new Set([...fromData, ...customCategories, ...centralCats.map((c) => c.name)])];
    return all.filter((c) => !archivedCategories.includes(c));
  }, [mainExpenses, customCategories, archivedCategories, centralCats]);
  const cashierList = useMemo(
    () => [
      ...usersList.filter((u) => u.role === "cashier" || u.role === "admin").map((u) => ({ id: u.id || u.login, name: u.name || u.login })),
      { id: "__cleaning__", name: "\u{1F9F9} \u0423\u0431\u043E\u0440\u043A\u0430" }
    ],
    [usersList]
  );
  const cardData = useMemo(() => {
    const pm = prevMonthDate;
    return allCatNames.map((cat) => {
      const thisMonthItems = mainExpenses.filter((e) => {
        const d = new Date(e.date);
        return e.category === cat && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      });
      const lastMonthItems = mainExpenses.filter((e) => {
        const d = new Date(e.date);
        return e.category === cat && d.getFullYear() === pm.getFullYear() && d.getMonth() === pm.getMonth();
      });
      const thisMonthTotal = thisMonthItems.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const lastMonthTotal = lastMonthItems.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const allRecent = mainExpenses.filter((e) => e.category === cat).sort((a, b) => new Date(b.date) - new Date(a.date));
      return { cat, thisMonthTotal, lastMonthTotal, allRecent };
    }).sort((a, b) => b.thisMonthTotal - a.thisMonthTotal);
  }, [allCatNames, mainExpenses, prevMonthDate]);
  const orderedCardData = useMemo(() => {
    if (!cardOrder || cardOrder.length === 0) return cardData;
    const ordered = [];
    cardOrder.forEach((cat) => {
      const item = cardData.find((d) => d.cat === cat);
      if (item) ordered.push(item);
    });
    cardData.forEach((d) => {
      if (!cardOrder.includes(d.cat)) ordered.push(d);
    });
    return ordered;
  }, [cardData, cardOrder]);
  const getEffectiveIcon = useCallback((cat) => {
    const m = getCat(cat);
    if (m !== CAT_FALLBACK) return m.icon;
    const central = centralCats.find((c) => c.name === cat);
    return customCatIcons[cat] || central && central.icon || guessIcon(cat);
  }, [customCatIcons, centralCats]);
  const handleAddCustomCat = useCallback(() => {
    const name = newCatName.trim();
    if (!name) return;
    const icon = guessIcon(name);
    const updated = [.../* @__PURE__ */ new Set([...customCategories, name])];
    setCustomCategories(updated);
    localStorage.setItem(lsKey("exp_custom_cats"), JSON.stringify(updated));
    const updatedIcons = { ...customCatIcons, [name]: icon };
    setCustomCatIcons(updatedIcons);
    localStorage.setItem(lsKey("exp_custom_icons"), JSON.stringify(updatedIcons));
    setNewCatName("");
    setAddingCat(false);
    setExpandedCard(name);
  }, [newCatName, customCategories, customCatIcons, hostelKey]);
  const handleRemoveCustomCat = useCallback((cat) => {
    const updated = customCategories.filter((c) => c !== cat);
    setCustomCategories(updated);
    localStorage.setItem(lsKey("exp_custom_cats"), JSON.stringify(updated));
    if (expandedCard === cat) setExpandedCard(null);
  }, [customCategories, expandedCard, hostelKey]);
  const handleArchiveCat = useCallback((cat) => {
    const updated = [.../* @__PURE__ */ new Set([...archivedCategories, cat])];
    setArchivedCategories(updated);
    localStorage.setItem(lsKey("exp_archived_cats"), JSON.stringify(updated));
    if (expandedCard === cat) setExpandedCard(null);
  }, [archivedCategories, expandedCard, hostelKey]);
  const handleUnarchiveCat = useCallback((cat) => {
    const updated = archivedCategories.filter((c) => c !== cat);
    setArchivedCategories(updated);
    localStorage.setItem(lsKey("exp_archived_cats"), JSON.stringify(updated));
  }, [archivedCategories, hostelKey]);
  const handleEditCustomCat = useCallback(async (oldName, newNameRaw, newIcon) => {
    const newName = (newNameRaw || "").trim() || oldName;
    const renamed = newName !== oldName;
    let cats2 = customCategories;
    if (renamed) cats2 = [...new Set(customCategories.map((c) => c === oldName ? newName : c))];
    setCustomCategories(cats2);
    localStorage.setItem(lsKey("exp_custom_cats"), JSON.stringify(cats2));
    const icons = { ...customCatIcons };
    if (renamed) delete icons[oldName];
    icons[newName] = newIcon || guessIcon(newName);
    setCustomCatIcons(icons);
    localStorage.setItem(lsKey("exp_custom_icons"), JSON.stringify(icons));
    if (renamed && onEditExpenseCategory) {
      const toRetag = filteredExpenses.filter((e) => e.category === oldName);
      for (const e of toRetag) {
        try {
          await onEditExpenseCategory(e.id, newName);
        } catch {
        }
      }
    }
    if (expandedCard === oldName) setExpandedCard(newName);
  }, [customCategories, customCatIcons, filteredExpenses, onEditExpenseCategory, expandedCard, hostelKey]);
  const ICON_CHOICES = ["\u{1F4E6}", "\u{1F3E0}", "\u{1F3E2}", "\u{1F4A1}", "\u26A1", "\u{1F4A7}", "\u{1F525}", "\u{1F310}", "\u{1F4F1}", "\u{1F4BC}", "\u{1F4B0}", "\u{1F6D2}", "\u{1F37D}\uFE0F", "\u2615", "\u{1F9FA}", "\u{1F6CF}\uFE0F", "\u{1FA91}", "\u{1F527}", "\u{1F6E0}\uFE0F", "\u{1F9F9}", "\u{1F9F4}", "\u{1F697}", "\u26FD", "\u{1F3E6}", "\u{1F4B3}", "\u{1F4E3}", "\u{1F4CA}", "\u{1F4CB}", "\u{1F4C4}", "\u{1F5A8}\uFE0F", "\u{1F511}", "\u{1F510}", "\u{1F4F9}", "\u{1F333}", "\u{1F48A}", "\u{1F3E5}", "\u{1F381}", "\u{1F69A}", "\u{1F9FE}", "\u2696\uFE0F", "\u2744\uFE0F", "\u{1F321}\uFE0F", "\u{1F5D1}\uFE0F"];
  const handleMove = useCallback(async (expenseId) => {
    if (!moveTarget) return;
    if (moveTarget === "\u0417\u0430\u0440\u043F\u043B\u0430\u0442\u0430") {
      if (!moveStaff || !onUpdateExpense) return;
      await onUpdateExpense(expenseId, { category: "\u0417\u0430\u0440\u043F\u043B\u0430\u0442\u0430", targetStaffId: moveStaff });
    } else if (onEditExpenseCategory) {
      await onEditExpenseCategory(expenseId, moveTarget);
    }
    setMovingId(null);
    setMoveTarget("");
    setMoveStaff("");
  }, [moveTarget, moveStaff, onEditExpenseCategory, onUpdateExpense]);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState(() => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10));
  const [bulkRows, setBulkRows] = useState([{ id: 1, category: "", amount: "", comment: "" }]);
  const [bulkAddBusy, setBulkAddBusy] = useState(false);
  const bulkRowId = useRef(1);
  const addBulkRow = () => setBulkRows((r) => [...r, { id: ++bulkRowId.current, category: "", amount: "", comment: "" }]);
  const updBulkRow = (id, patch) => setBulkRows((r) => r.map((x) => x.id === id ? { ...x, ...patch } : x));
  const delBulkRow = (id) => setBulkRows((r) => r.length > 1 ? r.filter((x) => x.id !== id) : r);
  const bulkAddTotal = useMemo(
    () => bulkRows.reduce((s, r) => s + (parseInt(r.amount, 10) || 0), 0),
    [bulkRows]
  );
  const bulkAddValid = bulkRows.filter((r) => r.category && (parseInt(r.amount, 10) || 0) > 0);
  const submitBulkAdd = async () => {
    if (!bulkAddValid.length || bulkAddBusy) return;
    setBulkAddBusy(true);
    try {
      const d = /* @__PURE__ */ new Date(bulkDate + "T12:00:00");
      await onAddExpensesBulk?.(
        bulkAddValid.map((r) => ({ category: r.category, amount: parseInt(r.amount, 10), comment: r.comment })),
        isNaN(d.getTime()) ? void 0 : d.toISOString()
      );
      setBulkRows([{ id: ++bulkRowId.current, category: "", amount: "", comment: "" }]);
      setBulkAddOpen(false);
    } finally {
      setBulkAddBusy(false);
    }
  };
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => /* @__PURE__ */ new Set());
  const [bulkTarget, setBulkTarget] = useState("");
  const [bulkStaff, setBulkStaff] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const toggleSelected = useCallback((id) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);
  const clearSelection = useCallback(() => {
    setSelectedIds(/* @__PURE__ */ new Set());
    setBulkTarget("");
    setBulkStaff("");
  }, []);
  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    clearSelection();
  }, [clearSelection]);
  const selectedList = useMemo(
    () => filteredExpenses.filter((e) => selectedIds.has(e.id)),
    [filteredExpenses, selectedIds]
  );
  const selectedSum = useMemo(
    () => selectedList.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [selectedList]
  );
  const toggleCategorySelection = useCallback((catName, items) => {
    const ids = items.map((e) => e.id);
    setSelectedIds((prev) => {
      const n = new Set(prev);
      const allIn = ids.length > 0 && ids.every((id) => n.has(id));
      ids.forEach((id) => allIn ? n.delete(id) : n.add(id));
      return n;
    });
  }, []);
  const handleBulkMove = useCallback(async () => {
    if (!bulkTarget || selectedIds.size === 0 || bulkBusy) return;
    if (bulkTarget === "\u0417\u0430\u0440\u043F\u043B\u0430\u0442\u0430" && !bulkStaff) return;
    setBulkBusy(true);
    let ok = 0, failed = 0;
    for (const e of selectedList) {
      try {
        if (bulkTarget === "\u0417\u0430\u0440\u043F\u043B\u0430\u0442\u0430") {
          if (!onUpdateExpense) {
            failed++;
            continue;
          }
          await onUpdateExpense(e.id, { category: "\u0417\u0430\u0440\u043F\u043B\u0430\u0442\u0430", targetStaffId: bulkStaff });
        } else if (onEditExpenseCategory) {
          await onEditExpenseCategory(e.id, bulkTarget);
        } else {
          failed++;
          continue;
        }
        ok++;
      } catch {
        failed++;
      }
    }
    setBulkBusy(false);
    clearSelection();
    setSelectMode(false);
    if (failed > 0) notify?.(`\u041F\u0435\u0440\u0435\u043D\u0435\u0441\u0435\u043D\u043E ${ok}, \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C ${failed}`, "warning");
    else notify?.(`\u041F\u0435\u0440\u0435\u043D\u0435\u0441\u0435\u043D\u043E \u0440\u0430\u0441\u0445\u043E\u0434\u043E\u0432: ${ok} \u2192 \xAB${bulkTarget}\xBB`, "success");
  }, [bulkTarget, bulkStaff, bulkBusy, selectedIds, selectedList, onEditExpenseCategory, onUpdateExpense, clearSelection, notify]);
  const cats = useMemo(() => Array.from(new Set(filteredExpenses.filter((e) => e.category !== "\u0412\u043E\u0437\u0432\u0440\u0430\u0442").map((e) => e.category).filter(Boolean))), [filteredExpenses]);
  const byCategory = useMemo(() => cats.map((c) => ({ name: c, total: filteredExpenses.filter((e) => e.category === c).reduce((s, e) => s + (Number(e.amount) || 0), 0) })).sort((a, b) => b.total - a.total), [cats, filteredExpenses]);
  const displayed = expenseCatFilter === "\u0412\u0441\u0435" ? filteredExpenses.filter((e) => e.category !== "\u0412\u043E\u0437\u0432\u0440\u0430\u0442") : filteredExpenses.filter((e) => e.category === expenseCatFilter && e.category !== "\u0412\u043E\u0437\u0432\u0440\u0430\u0442");
  const sorted = [...displayed].sort((a, b) => new Date(b.date) - new Date(a.date));
  const dateSorted = expDateFrom || expDateTo ? sorted.filter((e) => {
    const d = new Date(e.date);
    if (expDateFrom && d < new Date(expDateFrom)) return false;
    if (expDateTo && d > /* @__PURE__ */ new Date(expDateTo + "T23:59:59")) return false;
    return true;
  }) : sorted;
  const byMonth = {};
  dateSorted.forEach((e) => {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { items: [], total: 0 };
    byMonth[key].items.push(e);
    byMonth[key].total += amtFn(e);
  });
  const searchLow = expSearch.toLowerCase();
  const matchFn = (e) => !searchLow || (e.category || "").toLowerCase().includes(searchLow) || (e.comment || "").toLowerCase().includes(searchLow);
  const startEdit = (tmpl) => {
    setEditId(tmpl.id);
    setEditForm({ name: tmpl.name, category: tmpl.category || "\u0410\u0440\u0435\u043D\u0434\u0430", amount: tmpl.amount, comment: tmpl.comment || "", dayOfMonth: tmpl.dayOfMonth || 1, hostelId: tmpl.hostelId || "all" });
    setAddForm(false);
  };
  const handleAddForm = async (e) => {
    e.preventDefault();
    if (!form.name || !form.amount) return;
    await onAddRecurring?.(form);
    setForm({ name: "", category: "\u0410\u0440\u0435\u043D\u0434\u0430", amount: "", comment: "", dayOfMonth: 1, hostelId: "all" });
    setAddForm(false);
  };
  const handleEditForm = async (e) => {
    e.preventDefault();
    if (!editForm.name || !editForm.amount) return;
    await onUpdateRecurring?.(editId, { ...editForm, amount: Number(editForm.amount), dayOfMonth: Number(editForm.dayOfMonth) });
    setEditId(null);
    setEditForm({});
  };
  const allCatsForSelect = [...CATS, ...customCategories.filter((c) => !CATS.includes(c))];
  const now_today = now.getDate();
  const RecurringSection = () => isAdmin ? /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden" }, /* @__PURE__ */ React.createElement("button", { onClick: () => setRecurringOpen((o) => !o), className: "w-full flex items-center justify-between px-5 py-3.5 bg-indigo-50 hover:bg-indigo-100 transition-colors" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2.5" }, /* @__PURE__ */ React.createElement("span", { className: "text-base" }, "\u{1F504}"), /* @__PURE__ */ React.createElement("span", { className: "text-sm font-black text-indigo-700" }, t("expRecurring")), recurringExpenses.length > 0 && /* @__PURE__ */ React.createElement("span", { className: "text-xs bg-indigo-200 text-indigo-700 rounded-full px-2 py-0.5 font-bold" }, recurringExpenses.length)), recurringOpen ? /* @__PURE__ */ React.createElement(ChevronUp, { size: 16, className: "text-indigo-400" }) : /* @__PURE__ */ React.createElement(ChevronDown, { size: 16, className: "text-indigo-400" })), recurringOpen && /* @__PURE__ */ React.createElement("div", { className: "divide-y divide-slate-50" }, recurringExpenses.length === 0 && !addForm && /* @__PURE__ */ React.createElement("div", { className: "py-8 text-center text-slate-400 text-sm" }, t("expNoTemplates")), recurringExpenses.map((tmpl) => {
    const m = getCat(tmpl.category);
    const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const firedThisMonth = tmpl.lastFiredMonth === curMonthKey;
    const isEditing = editId === tmpl.id;
    const isSalaryTemplate = tmpl.category === "\u0417\u0430\u0440\u043F\u043B\u0430\u0442\u0430";
    const advancedThisMonth = recurringAdvances[tmpl.id] || 0;
    const isAdvanceOpen = recurringAdvanceTargetId === tmpl.id;
    return /* @__PURE__ */ React.createElement("div", { key: tmpl.id }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors" }, /* @__PURE__ */ React.createElement("div", { className: "w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0", style: { background: m.bg } }, /* @__PURE__ */ React.createElement(CatIcon, { cat: tmpl.category, emoji: m.icon, size: 18 })), /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 flex-wrap" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm font-bold text-slate-700" }, tmpl.name), /* @__PURE__ */ React.createElement("span", { className: "text-xs font-semibold", style: { color: m.text } }, tmpl.category), firedThisMonth && /* @__PURE__ */ React.createElement("span", { className: "text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold" }, "\u2713 ", t("expCharged")), advancedThisMonth > 0 && /* @__PURE__ */ React.createElement("span", { className: "text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold" }, t("expAdvanceBadge"), " ", fmt(advancedThisMonth))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mt-0.5 flex-wrap" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs text-slate-400" }, "\u{1F4C5} ", tmpl.dayOfMonth, "-\u0433\u043E \u0447\u0438\u0441\u043B\u0430"), tmpl.hostelId !== "all" && /* @__PURE__ */ React.createElement("span", { className: "text-xs text-slate-400" }, "\xB7 ", tmpl.hostelId === "hostel1" ? "\u0425\u043E\u0441\u0442\u0435\u043B \u21161" : tmpl.hostelId === "hostel2" ? "\u0425\u043E\u0441\u0442\u0435\u043B \u21162" : tmpl.hostelId), tmpl.comment && /* @__PURE__ */ React.createElement("span", { className: "text-xs text-slate-400 truncate" }, "\xB7 ", tmpl.comment), isSalaryTemplate && advancedThisMonth > 0 && /* @__PURE__ */ React.createElement("span", { className: "text-xs text-indigo-500" }, "\xB7 \u043A \u0432\u044B\u043F\u043B\u0430\u0442\u0435: ", fmt(Math.max(0, Number(tmpl.amount) - advancedThisMonth))))), /* @__PURE__ */ React.createElement("span", { className: "text-sm font-black text-rose-600 shrink-0" }, fmt(tmpl.amount)), isSalaryTemplate && /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => {
          setRecurringAdvanceTargetId(isAdvanceOpen ? null : tmpl.id);
          setRecurringAdvanceAmt("");
        },
        title: "\u0412\u044B\u0434\u0430\u0442\u044C \u0430\u0432\u0430\u043D\u0441",
        className: `p-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0 text-xs font-bold ${isAdvanceOpen ? "bg-amber-300 text-amber-900" : "bg-amber-100 hover:bg-amber-200"}`
      },
      "\u{1F4B0}"
    ), /* @__PURE__ */ React.createElement("button", { onClick: () => onToggleActive?.(tmpl.id, tmpl.active), title: tmpl.active ? "\u0412\u044B\u043A\u043B\u044E\u0447\u0438\u0442\u044C" : "\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C", style: { color: tmpl.active ? "#6366f1" : "#94a3b8" }, className: "p-0 shrink-0" }, tmpl.active ? /* @__PURE__ */ React.createElement(ToggleRight, { size: 28 }) : /* @__PURE__ */ React.createElement(ToggleLeft, { size: 28 })), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => isEditing ? setEditId(null) : startEdit(tmpl),
        title: isEditing ? "\u041E\u0442\u043C\u0435\u043D\u0430" : "\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
        style: { color: isEditing ? "#4f46e5" : "#334155" },
        className: `p-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0 ${isEditing ? "bg-indigo-100" : "bg-slate-100 hover:bg-indigo-100"}`
      },
      isEditing ? /* @__PURE__ */ React.createElement(X, { size: 16 }) : /* @__PURE__ */ React.createElement(Pencil, { size: 16 })
    ), /* @__PURE__ */ React.createElement("button", { onClick: () => onFireNow?.(tmpl), title: "\u0412\u043D\u0435\u0441\u0442\u0438 \u0441\u0435\u0439\u0447\u0430\u0441", className: "p-0 w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-100 hover:bg-emerald-200 transition-colors shrink-0 text-emerald-700" }, /* @__PURE__ */ React.createElement(Play, { size: 16 })), /* @__PURE__ */ React.createElement("button", { onClick: () => onDeleteRecurring?.(tmpl.id), className: "p-0 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-rose-100 transition-colors shrink-0 text-slate-600" }, /* @__PURE__ */ React.createElement(Trash2, { size: 16 }))), isAdvanceOpen && /* @__PURE__ */ React.createElement("div", { className: "px-5 py-3 bg-amber-50 border-t border-amber-100 flex items-center gap-3 flex-wrap" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold text-amber-700 shrink-0" }, "\u{1F4B0} ", t("expAdvanceBadge"), " (", tmpl.name, "):"), advancedThisMonth > 0 && /* @__PURE__ */ React.createElement("span", { className: "text-xs text-amber-600" }, "\u0443\u0436\u0435 \u0432\u044B\u0434\u0430\u043D\u043E ", fmt(advancedThisMonth)), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        min: "1",
        max: tmpl.amount,
        value: recurringAdvanceAmt,
        onChange: (e) => setRecurringAdvanceAmt(e.target.value),
        placeholder: "\u0421\u0443\u043C\u043C\u0430\u2026",
        autoFocus: true,
        className: "w-36 px-3 py-1.5 text-sm border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-200"
      }
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        disabled: !recurringAdvanceAmt,
        onClick: async () => {
          if (!recurringAdvanceAmt) return;
          await onAddRecurringAdvance?.({ template: tmpl, amount: Number(recurringAdvanceAmt) });
          setRecurringAdvanceTargetId(null);
          setRecurringAdvanceAmt("");
        },
        className: "px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-bold transition-colors"
      },
      t("done")
    ), /* @__PURE__ */ React.createElement("button", { onClick: () => setRecurringAdvanceTargetId(null), className: "px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-100 transition-colors" }, t("cancel"))), isEditing && /* @__PURE__ */ React.createElement("form", { onSubmit: handleEditForm, className: "px-5 py-4 bg-indigo-50 border-t border-indigo-100 space-y-3" }, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "col-span-2" }, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1" }, t("expName"), " *"), /* @__PURE__ */ React.createElement("input", { value: editForm.name, onChange: (e) => setEditForm((f) => ({ ...f, name: e.target.value })), required: true, className: "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1" }, t("category")), /* @__PURE__ */ React.createElement("select", { value: editForm.category, onChange: (e) => setEditForm((f) => ({ ...f, category: e.target.value })), className: "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" }, allCatsForSelect.map((c) => /* @__PURE__ */ React.createElement("option", { key: c }, c)))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1" }, t("amount"), " *"), /* @__PURE__ */ React.createElement("input", { type: "number", min: "1", value: editForm.amount, onChange: (e) => setEditForm((f) => ({ ...f, amount: e.target.value })), required: true, className: "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1" }, t("expDayOfMonth")), /* @__PURE__ */ React.createElement("input", { type: "number", min: "1", max: "28", value: editForm.dayOfMonth, onChange: (e) => setEditForm((f) => ({ ...f, dayOfMonth: parseInt(e.target.value) || 1 })), className: "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1" }, t("expHostel")), /* @__PURE__ */ React.createElement("select", { value: editForm.hostelId, onChange: (e) => setEditForm((f) => ({ ...f, hostelId: e.target.value })), className: "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" }, /* @__PURE__ */ React.createElement("option", { value: "all" }, t("expAllHostels")), /* @__PURE__ */ React.createElement("option", { value: "hostel1" }, t("expHostel1")), /* @__PURE__ */ React.createElement("option", { value: "hostel2" }, t("expHostel2")))), /* @__PURE__ */ React.createElement("div", { className: "col-span-2" }, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1" }, t("comment")), /* @__PURE__ */ React.createElement("input", { value: editForm.comment, onChange: (e) => setEditForm((f) => ({ ...f, comment: e.target.value })), placeholder: "\u041D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u2026", className: "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" }))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("button", { type: "submit", className: "flex-1 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold transition-colors" }, t("save")), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setEditId(null), className: "px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-100 transition-colors" }, t("cancel")))));
  }), addForm ? /* @__PURE__ */ React.createElement("form", { onSubmit: handleAddForm, className: "px-5 py-4 bg-slate-50 space-y-3" }, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "col-span-2" }, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1" }, t("expName"), " *"), /* @__PURE__ */ React.createElement("input", { value: form.name, onChange: (e) => setForm((f) => ({ ...f, name: e.target.value })), placeholder: "\u0410\u0440\u0435\u043D\u0434\u0430 \u043E\u0444\u0438\u0441\u0430\u2026", required: true, className: "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1" }, t("category")), /* @__PURE__ */ React.createElement("select", { value: form.category, onChange: (e) => setForm((f) => ({ ...f, category: e.target.value })), className: "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" }, allCatsForSelect.map((c) => /* @__PURE__ */ React.createElement("option", { key: c }, c)))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1" }, t("amount"), " *"), /* @__PURE__ */ React.createElement("input", { type: "number", min: "1", value: form.amount, onChange: (e) => setForm((f) => ({ ...f, amount: e.target.value })), placeholder: "0", required: true, className: "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1" }, t("expDayOfMonth")), /* @__PURE__ */ React.createElement("input", { type: "number", min: "1", max: "28", value: form.dayOfMonth, onChange: (e) => setForm((f) => ({ ...f, dayOfMonth: parseInt(e.target.value) || 1 })), className: "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1" }, t("expHostel")), /* @__PURE__ */ React.createElement("select", { value: form.hostelId, onChange: (e) => setForm((f) => ({ ...f, hostelId: e.target.value })), className: "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" }, /* @__PURE__ */ React.createElement("option", { value: "all" }, t("expAllHostels")), /* @__PURE__ */ React.createElement("option", { value: "hostel1" }, t("expHostel1")), /* @__PURE__ */ React.createElement("option", { value: "hostel2" }, t("expHostel2")))), /* @__PURE__ */ React.createElement("div", { className: "col-span-2" }, /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1" }, t("comment")), /* @__PURE__ */ React.createElement("input", { value: form.comment, onChange: (e) => setForm((f) => ({ ...f, comment: e.target.value })), placeholder: "\u041D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u2026", className: "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" }))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("button", { type: "submit", className: "flex-1 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold transition-colors" }, "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setAddForm(false), className: "px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-100 transition-colors" }, "\u041E\u0442\u043C\u0435\u043D\u0430"))) : /* @__PURE__ */ React.createElement("div", { className: "px-5 py-3" }, /* @__PURE__ */ React.createElement("button", { onClick: () => setAddForm(true), className: "flex items-center gap-2 text-sm font-semibold text-indigo-500 hover:text-indigo-700 transition-colors" }, /* @__PURE__ */ React.createElement(Plus, { size: 15 }), " ", t("expAddTemplate"))))) : null;
  const MoveForm = ({ expId, currentCat }) => /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5 px-2 py-2 bg-indigo-50 rounded-lg my-0.5 flex-wrap" }, /* @__PURE__ */ React.createElement("span", { className: "text-[11px] text-indigo-600 font-semibold shrink-0" }, "\u2192"), /* @__PURE__ */ React.createElement(
    "select",
    {
      value: moveTarget,
      onChange: (ev) => {
        setMoveTarget(ev.target.value);
        setMoveStaff("");
      },
      className: "flex-1 min-w-[120px] text-xs px-2 py-1 border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
    },
    /* @__PURE__ */ React.createElement("option", { value: "" }, "\u2014 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u2014"),
    allCatNames.filter((c) => c !== currentCat).map((c) => /* @__PURE__ */ React.createElement("option", { key: c, value: c }, getCat(c).icon, " ", c))
  ), moveTarget === "\u0417\u0430\u0440\u043F\u043B\u0430\u0442\u0430" && /* @__PURE__ */ React.createElement(
    "select",
    {
      value: moveStaff,
      onChange: (ev) => setMoveStaff(ev.target.value),
      className: "flex-1 min-w-[120px] text-xs px-2 py-1 border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
    },
    /* @__PURE__ */ React.createElement("option", { value: "" }, "\u2014 \u043A\u0430\u0441\u0441\u0438\u0440 \u2014"),
    cashierList.map((u) => /* @__PURE__ */ React.createElement("option", { key: u.id, value: u.id }, u.name))
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => handleMove(expId),
      disabled: !moveTarget || moveTarget === "\u0417\u0430\u0440\u043F\u043B\u0430\u0442\u0430" && !moveStaff,
      className: "w-6 h-6 flex items-center justify-center rounded-lg bg-indigo-500 disabled:opacity-40 hover:bg-indigo-600 text-white transition-colors"
    },
    /* @__PURE__ */ React.createElement(Check, { size: 11 })
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => {
        setMovingId(null);
        setMoveTarget("");
        setMoveStaff("");
      },
      className: "w-6 h-6 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-100 transition-colors"
    },
    /* @__PURE__ */ React.createElement(X, { size: 11 })
  ));
  return /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3 flex-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0" }, /* @__PURE__ */ React.createElement(Wallet, { size: 20, className: "text-rose-600" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { className: "text-xl font-black text-slate-800" }, t("expenses")), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-400 mt-0.5" }, filteredExpenses.filter((e) => e.category !== "\u0412\u043E\u0437\u0432\u0440\u0430\u0442").length, " \u0437\u0430\u043F\u0438\u0441\u0435\u0439", refunds.length > 0 ? ` \xB7 ${refunds.length} \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u043E\u0432` : ""))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 items-center flex-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center bg-slate-100 rounded-xl p-1 gap-0.5" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setViewMode("dashboard"),
      className: `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "dashboard" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`
    },
    /* @__PURE__ */ React.createElement(LayoutGrid, { size: 12 }),
    " \u0414\u0430\u0448\u0431\u043E\u0440\u0434"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setViewMode("list"),
      className: `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "list" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`
    },
    /* @__PURE__ */ React.createElement(List, { size: 12 }),
    " \u0421\u043F\u0438\u0441\u043E\u043A"
  )), /* @__PURE__ */ React.createElement("button", { onClick: onDownloadCSV, className: "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors" }, /* @__PURE__ */ React.createElement(Download, { size: 15 }), " CSV"), isAdmin && /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => onBackfillComments?.(),
      title: "\u0417\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u043F\u0443\u0441\u0442\u044B\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u044F \u0440\u0430\u0441\u0445\u043E\u0434\u043E\u0432 \u0437\u0430 \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u043C\u0435\u0441\u044F\u0446",
      className: "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
    },
    /* @__PURE__ */ React.createElement(FileText, { size: 15 }),
    " \u041E\u043F\u0438\u0441\u0430\u043D\u0438\u044F"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => selectMode ? exitSelectMode() : setSelectMode(true),
      title: "\u0412\u044B\u0434\u0435\u043B\u0438\u0442\u044C \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0440\u0430\u0441\u0445\u043E\u0434\u043E\u0432 \u0438 \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0442\u0438 \u0432 \u0434\u0440\u0443\u0433\u043E\u0439 \u0440\u0430\u0437\u0434\u0435\u043B",
      className: `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${selectMode ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`
    },
    /* @__PURE__ */ React.createElement(ArrowRightLeft, { size: 15 }),
    " ",
    selectMode ? "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u0435" : "\u041F\u0435\u0440\u0435\u043D\u0435\u0441\u0442\u0438"
  ), onAddExpensesBulk && /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setBulkAddOpen(true),
      title: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0440\u0430\u0441\u0445\u043E\u0434\u043E\u0432 \u043E\u0434\u043D\u043E\u0439 \u0434\u0430\u0442\u043E\u0439",
      className: "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
    },
    /* @__PURE__ */ React.createElement(ClipboardList, { size: 15 }),
    " \u041C\u0430\u0441\u0441\u043E\u0432\u043E"
  ), /* @__PURE__ */ React.createElement("button", { onClick: () => onAddExpense?.(), className: "flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-sm shadow-rose-200 transition-colors" }, /* @__PURE__ */ React.createElement(Plus, { size: 16 }), " ", t("addExpense2")))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-3 gap-3" }, [
    {
      Icon: Calendar,
      iconClr: "#b45309",
      label: "\u042D\u0442\u043E\u0442 \u043C\u0435\u0441\u044F\u0446",
      value: thisMonth,
      valColor: "#b45309",
      chipBg: "#fef3c7",
      circle: "rgba(245,158,11,0.12)",
      badge: monthDiff !== null ? { up: monthDiff > 0, pct: Math.abs(monthDiff) } : null,
      sub: null
    },
    {
      Icon: CalendarDays,
      iconClr: "#475569",
      label: "\u041F\u0440\u043E\u0448\u043B\u044B\u0439 \u043C\u0435\u0441\u044F\u0446",
      value: prevMonth,
      valColor: "#334155",
      chipBg: "#f1f5f9",
      circle: "rgba(148,163,184,0.14)",
      badge: null,
      sub: `${prevMonthExp.length} \u0437\u0430\u043F\u0438\u0441\u0435\u0439`
    },
    {
      Icon: Banknote,
      iconClr: "#e11d48",
      label: "\u0412\u0441\u0435\u0433\u043E",
      value: totalAll,
      valColor: "#e11d48",
      chipBg: "#ffe4e6",
      circle: "rgba(244,63,94,0.12)",
      badge: null,
      sub: `${cats.length} \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0439`
    }
  ].map((c) => /* @__PURE__ */ React.createElement("div", { key: c.label, className: "relative bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md" }, /* @__PURE__ */ React.createElement("div", { className: "absolute -right-5 -top-5 w-20 h-20 rounded-full", style: { background: isDark ? "rgba(148,163,184,0.1)" : c.circle } }), /* @__PURE__ */ React.createElement("div", { className: "relative" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-3" }, /* @__PURE__ */ React.createElement("span", { className: "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm", style: { background: isDark ? "rgba(148,163,184,0.15)" : c.chipBg } }, /* @__PURE__ */ React.createElement(c.Icon, { size: 18, strokeWidth: 2.2, style: { color: isDark ? "#94a3b8" : c.iconClr } })), c.badge ? /* @__PURE__ */ React.createElement("span", { className: `text-[10px] font-black px-2 py-0.5 rounded-full ${c.badge.up ? "bg-rose-50 text-rose-600" : "bg-teal-50 text-teal-600"}` }, c.badge.up ? "\u2191" : "\u2193", " ", c.badge.pct, "%") : c.sub ? /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-bold text-slate-400 bg-white/80 border border-slate-100 px-2 py-0.5 rounded-full" }, c.sub) : null), /* @__PURE__ */ React.createElement("div", { className: "text-2xl font-black tabular-nums", style: { color: c.valColor } }, fmt(c.value)), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] font-semibold text-slate-400 mt-0.5 uppercase tracking-wide" }, c.label))))), viewMode === "dashboard" && /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, /* @__PURE__ */ React.createElement(RecurringSection, null), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" }, orderedCardData.map(({ cat, thisMonthTotal, lastMonthTotal, allRecent }, idx) => {
    const m = getCat(cat);
    const effectiveIcon = getEffectiveIcon(cat);
    const isExpanded = expandedCard === cat;
    const delta = lastMonthTotal > 0 ? Math.round((thisMonthTotal - lastMonthTotal) / lastMonthTotal * 100) : null;
    const barPct = lastMonthTotal > 0 ? Math.min(100, Math.round(thisMonthTotal / lastMonthTotal * 100)) : thisMonthTotal > 0 ? 100 : 0;
    const displayItems = isExpanded ? allRecent : allRecent.slice(0, 4);
    const isCustom = customCategories.includes(cat) && !CAT_META.find((x) => x.key === cat);
    const isDraggingOver = dragOverIdx === idx;
    const isSalaryCard = cat === "\u0417\u0430\u0440\u043F\u043B\u0430\u0442\u0430";
    const salaryByMonth = isSalaryCard ? (() => {
      const byMonth2 = {};
      allRecent.forEach((e) => {
        const d = new Date(e.date);
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!byMonth2[mk]) byMonth2[mk] = { mk, total: 0, byStaff: {} };
        const sid = e.targetStaffId || e.staffId || "__unknown__";
        if (!byMonth2[mk].byStaff[sid]) byMonth2[mk].byStaff[sid] = { sid, total: 0 };
        byMonth2[mk].byStaff[sid].total += Number(e.amount) || 0;
        byMonth2[mk].total += Number(e.amount) || 0;
      });
      return Object.values(byMonth2).sort((a, b) => b.mk.localeCompare(a.mk));
    })() : null;
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        key: cat,
        draggable: true,
        onDragStart: () => {
          dragIdx.current = idx;
        },
        onDragOver: (e) => {
          e.preventDefault();
          if (dragIdx.current !== idx) setDragOverIdx(idx);
        },
        onDragLeave: () => setDragOverIdx(null),
        onDrop: () => {
          if (dragIdx.current === null || dragIdx.current === idx) {
            setDragOverIdx(null);
            return;
          }
          const newOrder = orderedCardData.map((d) => d.cat);
          const [removed] = newOrder.splice(dragIdx.current, 1);
          newOrder.splice(idx, 0, removed);
          setCardOrder(newOrder);
          localStorage.setItem(lsKey("exp_card_order"), JSON.stringify(newOrder));
          dragIdx.current = null;
          setDragOverIdx(null);
        },
        onDragEnd: () => {
          dragIdx.current = null;
          setDragOverIdx(null);
        },
        className: `bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col transition-all cursor-grab active:cursor-grabbing select-none
                                        ${isDraggingOver ? "border-teal-400 shadow-lg shadow-teal-100 scale-[1.01]" : "border-slate-200 hover:shadow-md"}`
      },
      /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between px-4 py-3 border-b border-slate-100", style: { background: isDark ? m.darkBg : m.bg } }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement(CatIcon, { cat, emoji: effectiveIcon, size: 22 }), /* @__PURE__ */ React.createElement("span", { className: "font-black text-sm", style: { color: catClr(m) } }, cat), allRecent.length > 0 && /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-bold px-1.5 py-0.5 rounded-full", style: { background: "rgba(255,255,255,0.6)", color: catClr(m) } }, allRecent.length)), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1" }, isCustom && /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => setEditCat({ old: cat, name: cat, icon: effectiveIcon }),
          title: "\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043F\u043E\u0434\u0433\u0440\u0443\u043F\u043F\u0443",
          className: "w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
        },
        /* @__PURE__ */ React.createElement(Pencil, { size: 12 })
      ), isCustom && /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => setConfirmDeleteCat(cat),
          title: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043A\u0430\u0440\u0442\u0443",
          className: "w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
        },
        /* @__PURE__ */ React.createElement(X, { size: 12 })
      ), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => setConfirmArchiveCat(cat),
          title: "\u0423\u0431\u0440\u0430\u0442\u044C \u0440\u0430\u0437\u0434\u0435\u043B \u0432 \u0430\u0440\u0445\u0438\u0432",
          className: "w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
        },
        /* @__PURE__ */ React.createElement(Archive, { size: 12 })
      ), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => setExpandedCard(isExpanded ? null : cat),
          className: "w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:bg-white/50 transition-colors"
        },
        isExpanded ? /* @__PURE__ */ React.createElement(ChevronUp, { size: 14 }) : /* @__PURE__ */ React.createElement(ChevronDown, { size: 14 })
      ))),
      /* @__PURE__ */ React.createElement("div", { className: "px-4 pt-3 pb-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between mb-2" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[10px] font-semibold text-slate-400 uppercase tracking-wide" }, "\u042D\u0442\u043E\u0442 \u043C\u0435\u0441\u044F\u0446"), /* @__PURE__ */ React.createElement("div", { className: "text-2xl font-black", style: { color: catClr(m) } }, fmt(thisMonthTotal))), delta !== null && /* @__PURE__ */ React.createElement("div", { className: `text-xs font-bold px-2 py-1 rounded-lg ${delta > 0 ? "bg-rose-50 text-rose-600" : delta < 0 ? "bg-teal-50 text-teal-600" : "bg-slate-50 text-slate-400"}` }, delta > 0 ? "\u2191" : delta < 0 ? "\u2193" : "=", " ", Math.abs(delta), "%")), lastMonthTotal > 0 && /* @__PURE__ */ React.createElement("div", { className: "space-y-1" }, /* @__PURE__ */ React.createElement("div", { className: "h-1.5 bg-slate-100 rounded-full overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "h-full rounded-full transition-all duration-700", style: { width: `${barPct}%`, background: m.bar } })), /* @__PURE__ */ React.createElement("div", { className: "text-[10px] text-slate-400" }, "\u043F\u0440\u0435\u0434. ", fmt(lastMonthTotal)))),
      isSalaryCard && salaryByMonth && salaryByMonth.length > 0 ? /* @__PURE__ */ React.createElement("div", { className: "px-4 pb-2" }, /* @__PURE__ */ React.createElement("div", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2" }, "\u041F\u043E \u043C\u0435\u0441\u044F\u0446\u0430\u043C"), /* @__PURE__ */ React.createElement("div", { className: "space-y-1.5" }, salaryByMonth.map(({ mk, total, byStaff }) => {
        const [yr, mo] = mk.split("-");
        const label = new Date(Number(yr), Number(mo) - 1, 1).toLocaleDateString("ru", { month: "long", year: "numeric" });
        const isOpen = salaryOpenStaff === mk;
        const staffEntries = Object.values(byStaff).sort((a, b) => b.total - a.total);
        return /* @__PURE__ */ React.createElement("div", { key: mk, className: "rounded-xl border border-slate-100 overflow-hidden" }, /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setSalaryOpenStaff(isOpen ? null : mk),
            className: "w-full flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 transition-colors text-left"
          },
          /* @__PURE__ */ React.createElement("span", { className: "text-base" }, "\u{1F4C5}"),
          /* @__PURE__ */ React.createElement("span", { className: "flex-1 text-sm font-bold text-slate-700 capitalize" }, label),
          /* @__PURE__ */ React.createElement("span", { className: "text-sm font-black text-indigo-600 tabular-nums shrink-0" }, fmt(total)),
          /* @__PURE__ */ React.createElement("span", { className: "text-slate-300 text-xs shrink-0" }, isOpen ? "\u25B2" : "\u25BC")
        ), isOpen && /* @__PURE__ */ React.createElement("div", { className: "bg-indigo-50 divide-y divide-indigo-100" }, staffEntries.map(({ sid, total: amt }) => {
          const staff = usersList.find((u) => u.id === sid || u.login === sid);
          const name = sid === "__unknown__" ? "\u0411\u0435\u0437 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430" : sid === "__cleaning__" ? "\u{1F9F9} \u0423\u0431\u043E\u0440\u043A\u0430" : staff?.name || staff?.login || sid;
          const initial = name.charAt(0).toUpperCase();
          return /* @__PURE__ */ React.createElement("div", { key: sid, className: "flex items-center gap-2 px-4 py-2" }, /* @__PURE__ */ React.createElement("div", { className: "w-6 h-6 rounded-full bg-indigo-400 flex items-center justify-center text-white text-[10px] font-black shrink-0" }, initial), /* @__PURE__ */ React.createElement("span", { className: "flex-1 text-[12px] text-indigo-700 truncate" }, name), /* @__PURE__ */ React.createElement("span", { className: "text-[12px] font-black text-indigo-600 tabular-nums" }, fmt(amt)));
        })));
      }))) : allRecent.length > 0 ? /* @__PURE__ */ React.createElement("div", { className: "px-4 pb-2" }, /* @__PURE__ */ React.createElement("div", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5" }, isExpanded ? "\u0412\u0441\u0435 \u043F\u043B\u0430\u0442\u0435\u0436\u0438" : "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 \u043F\u043B\u0430\u0442\u0435\u0436\u0438"), /* @__PURE__ */ React.createElement("div", { className: "space-y-0" }, displayItems.map((e) => {
        const d = new Date(e.date);
        const dateStr = `${d.getDate()} ${d.toLocaleDateString("ru", { month: "short" })}`;
        const isMovingThis = movingId === e.id;
        const isSel = selectedIds.has(e.id);
        return /* @__PURE__ */ React.createElement("div", { key: e.id }, /* @__PURE__ */ React.createElement("div", { className: `group flex items-center gap-1.5 py-1 px-1 rounded-lg transition-colors ${isSel ? "bg-indigo-50" : "hover:bg-slate-50"}` }, selectMode && /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "checkbox",
            checked: isSel,
            onChange: () => toggleSelected(e.id),
            className: "w-4 h-4 shrink-0 accent-indigo-600 cursor-pointer"
          }
        ), /* @__PURE__ */ React.createElement("span", { className: "text-[11px] text-slate-400 shrink-0 w-10 tabular-nums" }, dateStr), /* @__PURE__ */ React.createElement("span", { className: "flex-1 text-[12px] text-slate-600 truncate min-w-0" }, e.comment || "\u2014"), /* @__PURE__ */ React.createElement("span", { className: "text-[12px] font-black shrink-0 tabular-nums", style: { color: catClr(m) } }, fmt(e.amount)), !selectMode && onEditExpenseCategory && /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => {
              setMovingId(isMovingThis ? null : e.id);
              setMoveTarget("");
              setMoveStaff("");
            },
            title: "\u041F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u0442\u044C",
            className: `w-5 h-5 shrink-0 flex items-center justify-center rounded transition-colors opacity-0 group-hover:opacity-100
                                                                            ${isMovingThis ? "opacity-100 bg-indigo-100 text-indigo-600" : "text-slate-300 hover:text-indigo-500 hover:bg-indigo-50"}`
          },
          /* @__PURE__ */ React.createElement(ArrowRightLeft, { size: 10 })
        ), !selectMode && /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => setConfirmDeleteExp(e),
            className: "w-5 h-5 shrink-0 flex items-center justify-center rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
          },
          /* @__PURE__ */ React.createElement(Trash2, { size: 10 })
        )), isMovingThis && /* @__PURE__ */ React.createElement(MoveForm, { expId: e.id, currentCat: cat }));
      }), !isExpanded && allRecent.length > 4 && /* @__PURE__ */ React.createElement("button", { onClick: () => setExpandedCard(cat), className: "text-[11px] text-indigo-500 font-bold hover:underline pl-1 pt-1" }, "+ \u0435\u0449\u0451 ", allRecent.length - 4, " \u043F\u043B\u0430\u0442\u0435\u0436\u0435\u0439"))) : /* @__PURE__ */ React.createElement("div", { className: "px-4 pb-2 text-[11px] text-slate-400 italic" }, "\u041D\u0435\u0442 \u0437\u0430\u043F\u0438\u0441\u0435\u0439"),
      /* @__PURE__ */ React.createElement("div", { className: "px-4 py-2.5 border-t border-slate-100 mt-auto" }, /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => onAddExpense?.(cat),
          className: "w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
        },
        /* @__PURE__ */ React.createElement(Plus, { size: 11 }),
        " \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0440\u0430\u0441\u0445\u043E\u0434"
      ))
    );
  }), addingCat ? /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-2xl border-2 border-dashed border-indigo-300 p-5 flex flex-col items-center justify-center gap-3 min-h-[180px]" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-3xl transition-all duration-200" }, newCatName.trim() ? guessIcon(newCatName) : "\u{1F4E6}"), /* @__PURE__ */ React.createElement("span", { className: "text-sm font-bold text-indigo-600" }, "\u041D\u043E\u0432\u0430\u044F \u043F\u043E\u0434\u0433\u0440\u0443\u043F\u043F\u0430")), /* @__PURE__ */ React.createElement(
    "input",
    {
      value: newCatName,
      onChange: (e) => setNewCatName(e.target.value),
      onKeyDown: (e) => {
        if (e.key === "Enter") handleAddCustomCat();
        if (e.key === "Escape") setAddingCat(false);
      },
      placeholder: "\u0413\u0430\u0437, \u0421\u0432\u0435\u0442, \u0412\u043E\u0434\u0430\u2026",
      autoFocus: true,
      className: "w-full text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
    }
  ), newCatName.trim() && /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-slate-400 text-center" }, "\u0418\u043A\u043E\u043D\u043A\u0430: ", /* @__PURE__ */ React.createElement("span", { className: "text-base" }, guessIcon(newCatName)), guessIcon(newCatName) === "\u{1F4E6}" && " \u2014 \u043D\u0435 \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u043D\u0430, \u0431\u0443\u0434\u0435\u0442 \u{1F4E6}"), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 w-full" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: handleAddCustomCat,
      disabled: !newCatName.trim(),
      className: "flex-1 py-2 rounded-xl bg-indigo-500 disabled:opacity-40 hover:bg-indigo-600 text-white text-xs font-bold transition-colors"
    },
    "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043A\u0430\u0440\u0442\u0443"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => {
        setAddingCat(false);
        setNewCatName("");
      },
      className: "px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-100 transition-colors"
    },
    "\u041E\u0442\u043C\u0435\u043D\u0430"
  ))) : /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setAddingCat(true),
      className: "bg-white rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 p-5 flex flex-col items-center justify-center gap-2 transition-all min-h-[180px] group"
    },
    /* @__PURE__ */ React.createElement("div", { className: "w-12 h-12 rounded-full bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors" }, /* @__PURE__ */ React.createElement(Plus, { size: 22, className: "text-slate-400 group-hover:text-indigo-500 transition-colors" })),
    /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold text-slate-400 group-hover:text-indigo-500 transition-colors" }, "\u041D\u043E\u0432\u0430\u044F \u043F\u043E\u0434\u0433\u0440\u0443\u043F\u043F\u0430"),
    /* @__PURE__ */ React.createElement("span", { className: "text-[10px] text-slate-300 group-hover:text-indigo-400 transition-colors text-center" }, "\u0413\u0430\u0437, \u0421\u0432\u0435\u0442, \u0412\u043E\u0434\u0430\u2026")
  )), archivedCategories.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm" }, /* @__PURE__ */ React.createElement("button", { onClick: () => setShowArchive((v) => !v), className: "w-full flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm font-black text-slate-600 flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Archive, { size: 15 }), " \u0410\u0440\u0445\u0438\u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u043E\u0432 \xB7 ", archivedCategories.length), showArchive ? /* @__PURE__ */ React.createElement(ChevronUp, { size: 16, className: "text-slate-400" }) : /* @__PURE__ */ React.createElement(ChevronDown, { size: 16, className: "text-slate-400" })), showArchive && /* @__PURE__ */ React.createElement("div", { className: "divide-y divide-slate-50" }, archivedCategories.map((cat) => /* @__PURE__ */ React.createElement("div", { key: cat, className: "flex items-center gap-3 px-5 py-3" }, /* @__PURE__ */ React.createElement(CatIcon, { cat, emoji: getEffectiveIcon(cat), size: 18 }), /* @__PURE__ */ React.createElement("span", { className: "flex-1 text-sm font-semibold text-slate-600" }, cat), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => handleUnarchiveCat(cat),
      className: "flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
    },
    /* @__PURE__ */ React.createElement(ArchiveRestore, { size: 14 }),
    " \u0412\u0435\u0440\u043D\u0443\u0442\u044C"
  ))))), refunds.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-2xl border border-teal-200 overflow-hidden shadow-sm" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between px-5 py-3 bg-teal-50 border-b border-teal-100" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm font-black text-teal-700" }, "\u{1F49A} \u0412\u043E\u0437\u0432\u0440\u0430\u0442\u044B \u0433\u043E\u0441\u0442\u044F\u043C"), /* @__PURE__ */ React.createElement("span", { className: "text-sm font-black text-teal-600" }, fmt(totalRefunds), " \u0441\u0443\u043C \xB7 ", refunds.length, " \u0437\u0430\u043F\u0438\u0441\u0435\u0439")), /* @__PURE__ */ React.createElement("div", { className: "divide-y divide-slate-50" }, [...refunds].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5).map((e) => {
    const d = new Date(e.date);
    return /* @__PURE__ */ React.createElement("div", { key: e.id, className: "group flex items-center gap-3 px-5 py-3 hover:bg-teal-50 transition-colors" }, /* @__PURE__ */ React.createElement("span", { className: "text-base" }, "\u{1F49A}"), /* @__PURE__ */ React.createElement("span", { className: "flex-1 text-sm text-teal-700 font-semibold" }, e.comment || "\u0412\u043E\u0437\u0432\u0440\u0430\u0442"), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-slate-400" }, d.getDate(), " ", d.toLocaleDateString("ru", { month: "short" })), /* @__PURE__ */ React.createElement("span", { className: "text-sm font-black text-teal-600 tabular-nums" }, "\u21A9 ", fmt(e.amount)), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setConfirmDeleteExp(e),
        className: "w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-rose-100 transition-colors shrink-0 opacity-0 group-hover:opacity-100 text-slate-500"
      },
      /* @__PURE__ */ React.createElement(Trash2, { size: 13 })
    ));
  })))), viewMode === "list" && /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, byCategory.length > 0 && /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "sticky top-0 z-20 -mx-3 md:-mx-6 -mb-1 px-3 md:px-6 py-2 border-b border-slate-200",
      style: { background: isDark ? "rgba(15,23,42,0.96)" : "rgba(240,242,245,0.96)", backdropFilter: "blur(6px)" }
    },
    /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-1.5" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setExpenseCatFilter("\u0412\u0441\u0435"),
        className: `px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${expenseCatFilter === "\u0412\u0441\u0435" ? "bg-rose-500 text-white shadow-sm" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"}`
      },
      "\u0412\u0441\u0435"
    ), byCategory.filter((c) => !archivedCategories.includes(c.name)).map((c) => {
      const m = getCat(c.name);
      const active = expenseCatFilter === c.name;
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: c.name,
          onClick: () => setExpenseCatFilter(active ? "\u0412\u0441\u0435" : c.name),
          className: `flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border ${active ? "text-white shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`,
          style: active ? { background: m.bar || "#f43f5e", borderColor: "transparent" } : {}
        },
        /* @__PURE__ */ React.createElement(CatIcon, { cat: c.name, emoji: getEffectiveIcon(c.name), size: 13, color: active ? "#fff" : void 0 }),
        c.name
      );
    }))
  ), byCategory.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" }, /* @__PURE__ */ React.createElement("button", { onClick: () => setShowCatBreakdown((v) => !v), className: "w-full flex items-center justify-between px-4 py-3" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm font-black text-slate-600 uppercase tracking-wide" }, t("expByCategory")), /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs text-slate-400" }, fmt(totalAll), " \u0441\u0443\u043C"), showCatBreakdown ? /* @__PURE__ */ React.createElement(ChevronUp, { size: 16, className: "text-slate-400" }) : /* @__PURE__ */ React.createElement(ChevronDown, { size: 16, className: "text-slate-400" }))), showCatBreakdown && /* @__PURE__ */ React.createElement("div", { className: "px-3 pb-3 max-h-72 overflow-y-auto" }, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5" }, byCategory.map((c) => {
    const m = getCat(c.name);
    const pct = totalAll ? Math.round(c.total / totalAll * 100) : 0;
    const active = expenseCatFilter === c.name;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: c.name,
        onClick: () => setExpenseCatFilter(active ? "\u0412\u0441\u0435" : c.name),
        className: `flex items-center gap-2 py-1 px-2 rounded-lg text-left transition-colors ${active ? "bg-slate-100" : "hover:bg-slate-50"}`,
        style: { outline: "none" }
      },
      /* @__PURE__ */ React.createElement(CatIcon, { cat: c.name, emoji: getEffectiveIcon(c.name), size: 16 }),
      /* @__PURE__ */ React.createElement("span", { className: "text-xs font-semibold flex-1 truncate", style: { color: active ? catClr(m) : "#475569" } }, c.name),
      /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold tabular-nums", style: { color: catClr(m) } }, fmt(c.total)),
      /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-normal text-slate-400 w-8 text-right tabular-nums" }, pct, "%")
    );
  })))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 flex-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "relative flex-1 min-w-48" }, /* @__PURE__ */ React.createElement(Search, { size: 14, className: "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" }), /* @__PURE__ */ React.createElement(
    "input",
    {
      value: expSearch,
      onChange: (e) => setExpSearch(e.target.value),
      placeholder: t("expSearchPlaceholder"),
      className: "w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-200 transition-all"
    }
  )), [
    { label: "\u042D\u0442\u043E\u0442 \u043C\u0435\u0441\u044F\u0446", f: () => {
      const n = /* @__PURE__ */ new Date();
      setExpDateFrom(ymdLocal(new Date(n.getFullYear(), n.getMonth(), 1)));
      setExpDateTo(ymdLocal(new Date(n.getFullYear(), n.getMonth() + 1, 0)));
    } },
    { label: "\u041F\u0440\u043E\u0448\u043B\u044B\u0439", f: () => {
      const n = /* @__PURE__ */ new Date();
      setExpDateFrom(ymdLocal(new Date(n.getFullYear(), n.getMonth() - 1, 1)));
      setExpDateTo(ymdLocal(new Date(n.getFullYear(), n.getMonth(), 0)));
    } },
    { label: "7 \u0434\u043D\u0435\u0439", f: () => {
      const n = /* @__PURE__ */ new Date();
      const s = new Date(n);
      s.setDate(s.getDate() - 6);
      setExpDateFrom(ymdLocal(s));
      setExpDateTo(ymdLocal(n));
    } }
  ].map((q) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: q.label,
      onClick: q.f,
      className: "px-2.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors shrink-0"
    },
    q.label
  )), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "date",
      value: expDateFrom,
      onChange: (e) => setExpDateFrom(e.target.value),
      className: "px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-200 w-36"
    }
  ), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-slate-400 shrink-0" }, "\u2014"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "date",
      value: expDateTo,
      onChange: (e) => setExpDateTo(e.target.value),
      className: "px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-200 w-36"
    }
  ), (expDateFrom || expDateTo) && /* @__PURE__ */ React.createElement("button", { onClick: () => {
    setExpDateFrom("");
    setExpDateTo("");
  }, className: "text-xs font-bold text-slate-400 hover:text-rose-500 px-2 py-1 rounded-lg border border-slate-200 bg-white" }, "\xD7 ", t("expResetFilter")), expenseCatFilter !== "\u0412\u0441\u0435" && /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold shrink-0", style: { background: catBg(getCat(expenseCatFilter)), color: catClr(getCat(expenseCatFilter)) } }, /* @__PURE__ */ React.createElement(CatIcon, { cat: expenseCatFilter, size: 14, color: catClr(getCat(expenseCatFilter)) }), " ", expenseCatFilter, /* @__PURE__ */ React.createElement("button", { onClick: () => setExpenseCatFilter("\u0412\u0441\u0435"), className: "ml-1 opacity-60 hover:opacity-100" }, "\u2715")), /* @__PURE__ */ React.createElement("span", { className: "text-sm text-slate-400 shrink-0" }, dateSorted.filter(matchFn).length, " \u0437\u0430\u043F\u0438\u0441\u0435\u0439")), /* @__PURE__ */ React.createElement(RecurringSection, null), Object.keys(byMonth).length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-2xl border border-slate-200 py-16 text-center text-slate-400 text-sm" }, t("expNoExpenses")) : /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, Object.entries(byMonth).map(([mk, mg]) => {
    const monthItems = mg.items.filter(matchFn);
    if (monthItems.length === 0) return null;
    const monthLabel = (/* @__PURE__ */ new Date(mk + "-01")).toLocaleDateString(locale, { month: "long", year: "numeric" });
    return /* @__PURE__ */ React.createElement("div", { key: mk, className: "bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm font-black text-slate-700 capitalize" }, monthLabel), /* @__PURE__ */ React.createElement("span", { className: "text-sm font-black text-rose-600" }, "\u208A", fmt(monthItems.reduce((s, e) => s + amtFn(e), 0)))), /* @__PURE__ */ React.createElement("div", { className: "divide-y divide-slate-50" }, (() => {
      const byCat = {};
      monthItems.forEach((x) => {
        const c = x.category || "\u0414\u0440\u0443\u0433\u043E\u0435";
        (byCat[c] = byCat[c] || []).push(x);
      });
      const catGroups = Object.entries(byCat).map(([c, items]) => ({ c, items, catSum: items.reduce((s, x) => s + amtFn(x), 0) })).sort((a, b) => b.catSum - a.catSum);
      const out = [];
      catGroups.forEach(({ c, items, catSum }) => {
        const cm = getCat(c);
        const cicon = getEffectiveIcon(c);
        out.push(
          /* @__PURE__ */ React.createElement("div", { key: "cat-" + mk + "-" + c, className: "flex items-center gap-2 px-5 py-2", style: { background: isDark ? "rgba(148,163,184,0.08)" : "#f8fafc" } }, /* @__PURE__ */ React.createElement("span", { className: "w-6 h-6 rounded-lg flex items-center justify-center text-sm shrink-0", style: { background: catBg(cm) } }, /* @__PURE__ */ React.createElement(CatIcon, { cat: c, emoji: cicon, size: 14 })), /* @__PURE__ */ React.createElement("span", { className: "text-xs font-black", style: { color: catClr(cm) } }, c), /* @__PURE__ */ React.createElement("span", { className: "text-[10px] text-slate-400 font-semibold" }, "\xB7 ", items.length), /* @__PURE__ */ React.createElement("span", { className: "ml-auto text-sm font-black text-slate-700 tabular-nums" }, fmt(catSum)))
        );
        items.forEach((e) => {
          const m = getCat(e.category);
          const staff = usersList.find((u) => u.id === e.staffId || u.login === e.staffId);
          const d = new Date(e.date);
          const dateStr = `${d.getDate()} ${d.toLocaleDateString(locale, { month: "short" })}`;
          const isSalary = e.category === "\u0417\u0430\u0440\u043F\u043B\u0430\u0442\u0430";
          const isAdvanceRow = e.category === "\u0410\u0432\u0430\u043D\u0441";
          const staffAdvances = isSalary ? monthItems.filter((x) => x.category === "\u0410\u0432\u0430\u043D\u0441" && x.staffId === e.staffId) : [];
          const totalAdvances = staffAdvances.reduce((s, x) => s + (Number(x.amount) || 0), 0);
          const remaining = (Number(e.amount) || 0) - totalAdvances;
          const isAdvanceOpen = advanceTargetId === e.id;
          const isMovingThis = movingId === e.id;
          out.push(
            /* @__PURE__ */ React.createElement("div", { key: e.id, className: `group flex flex-col gap-0 ${isAdvanceRow ? "bg-amber-50/40" : ""}` }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors" }, /* @__PURE__ */ React.createElement("div", { className: "w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 font-bold", style: { background: catBg(m) } }, /* @__PURE__ */ React.createElement(CatIcon, { cat: e.category, emoji: m.icon, size: 18 })), /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm font-bold", style: { color: catClr(m) } }, e.category), staff && /* @__PURE__ */ React.createElement("span", { className: "text-xs text-slate-400" }, staff.name.split(" ")[0]), isAdvanceRow && /* @__PURE__ */ React.createElement("span", { className: "text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold" }, t("expAdvanceBadge"))), e.comment && /* @__PURE__ */ React.createElement("div", { className: "text-xs text-slate-500 truncate mt-0.5" }, e.comment), isSalary && totalAdvances > 0 && /* @__PURE__ */ React.createElement("div", { className: "text-xs text-amber-700 mt-0.5 font-semibold" }, "\u0430\u0432\u0430\u043D\u0441: \u2212", fmt(totalAdvances), " \xB7 ", /* @__PURE__ */ React.createElement("span", { className: "text-indigo-600" }, "\u043A \u0432\u044B\u043F\u043B\u0430\u0442\u0435: ", fmt(remaining < 0 ? 0 : remaining)))), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-slate-400 shrink-0 hidden sm:block" }, dateStr), isAdvanceRow ? /* @__PURE__ */ React.createElement("span", { className: "text-base font-black text-amber-600 shrink-0 tabular-nums" }, "\u2212", fmt(e.amount)) : /* @__PURE__ */ React.createElement("span", { className: "text-base font-black text-rose-600 shrink-0 tabular-nums" }, "\u208A", fmt(e.amount)), isAdmin && /* @__PURE__ */ React.createElement(
              "button",
              {
                onClick: () => {
                  if (editingExpId === e.id) {
                    setEditingExpId(null);
                    return;
                  }
                  setEditingExpId(e.id);
                  setMovingId(null);
                },
                title: "\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
                className: `w-7 h-7 flex items-center justify-center rounded-lg transition-colors shrink-0
                                                                        ${editingExpId === e.id ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 hover:bg-indigo-50 text-slate-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100"}`
              },
              /* @__PURE__ */ React.createElement(Pencil, { size: 13 })
            ), onEditExpenseCategory && /* @__PURE__ */ React.createElement(
              "button",
              {
                onClick: () => {
                  setMovingId(isMovingThis ? null : e.id);
                  setMoveTarget("");
                  setMoveStaff("");
                  setEditingExpId(null);
                },
                title: "\u041F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u0442\u044C",
                className: `w-7 h-7 flex items-center justify-center rounded-lg transition-colors shrink-0
                                                                        ${isMovingThis ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 hover:bg-indigo-50 text-slate-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100"}`
              },
              /* @__PURE__ */ React.createElement(ArrowRightLeft, { size: 14 })
            ), isSalary && !isAdvanceOpen && /* @__PURE__ */ React.createElement(
              "button",
              {
                onClick: () => {
                  setAdvanceTargetId(e.id);
                  setAdvanceAmt("");
                },
                title: "\u0412\u044B\u0434\u0430\u0442\u044C \u0430\u0432\u0430\u043D\u0441",
                className: "w-7 h-7 flex items-center justify-center rounded-lg text-amber-400 hover:bg-amber-50 transition-colors shrink-0 text-base"
              },
              "\u{1F4B0}"
            ), /* @__PURE__ */ React.createElement(
              "button",
              {
                onClick: () => setConfirmDeleteExp(e),
                className: "w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-rose-100 transition-all shrink-0 text-slate-500"
              },
              /* @__PURE__ */ React.createElement(Trash2, { size: 16 })
            )), editingExpId === e.id && /* @__PURE__ */ React.createElement(
              ExpenseEditForm,
              {
                expense: e,
                saving: editExpSaving,
                onCancel: () => setEditingExpId(null),
                onSave: async (patch) => {
                  if (Object.keys(patch).length > 0) {
                    setEditExpSaving(true);
                    try {
                      await onUpdateExpense?.(e.id, patch);
                    } finally {
                      setEditExpSaving(false);
                    }
                  }
                  setEditingExpId(null);
                }
              }
            ), isMovingThis && /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 px-5 py-2.5 bg-indigo-50 border-t border-indigo-100 flex-wrap" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs font-semibold text-indigo-600 shrink-0" }, "\u041F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u0442\u044C \u0432:"), /* @__PURE__ */ React.createElement(
              "select",
              {
                value: moveTarget,
                onChange: (ev) => {
                  setMoveTarget(ev.target.value);
                  setMoveStaff("");
                },
                className: "flex-1 min-w-[140px] text-xs px-2 py-1.5 border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              },
              /* @__PURE__ */ React.createElement("option", { value: "" }, "\u2014 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u2014"),
              allCatNames.filter((c2) => c2 !== e.category).map((c2) => /* @__PURE__ */ React.createElement("option", { key: c2, value: c2 }, getCat(c2).icon, " ", c2))
            ), moveTarget === "\u0417\u0430\u0440\u043F\u043B\u0430\u0442\u0430" && /* @__PURE__ */ React.createElement(
              "select",
              {
                value: moveStaff,
                onChange: (ev) => setMoveStaff(ev.target.value),
                className: "flex-1 min-w-[140px] text-xs px-2 py-1.5 border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              },
              /* @__PURE__ */ React.createElement("option", { value: "" }, "\u2014 \u043A\u0430\u0441\u0441\u0438\u0440 (\u0432\u0437\u044F\u043B \u0417\u041F) \u2014"),
              cashierList.map((u) => /* @__PURE__ */ React.createElement("option", { key: u.id, value: u.id }, u.name))
            ), /* @__PURE__ */ React.createElement(
              "button",
              {
                onClick: () => handleMove(e.id),
                disabled: !moveTarget || moveTarget === "\u0417\u0430\u0440\u043F\u043B\u0430\u0442\u0430" && !moveStaff,
                className: "w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-500 disabled:opacity-40 hover:bg-indigo-600 text-white"
              },
              /* @__PURE__ */ React.createElement(Check, { size: 14 })
            ), /* @__PURE__ */ React.createElement(
              "button",
              {
                onClick: () => {
                  setMovingId(null);
                  setMoveTarget("");
                  setMoveStaff("");
                },
                className: "w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-100"
              },
              /* @__PURE__ */ React.createElement(X, { size: 14 })
            )), isAdvanceOpen && /* @__PURE__ */ React.createElement(
              "form",
              {
                onSubmit: async (ev) => {
                  ev.preventDefault();
                  if (!advanceAmt) return;
                  await onAddAdvance?.({ staffExpense: e, amount: Number(advanceAmt) });
                  setAdvanceTargetId(null);
                  setAdvanceAmt("");
                },
                className: "flex items-center gap-2 px-5 py-2.5 bg-amber-50 border-t border-amber-100"
              },
              /* @__PURE__ */ React.createElement("span", { className: "text-xs font-semibold text-amber-700 shrink-0" }, "\u{1F4B0} \u0421\u0443\u043C\u043C\u0430 \u0430\u0432\u0430\u043D\u0441\u0430:"),
              /* @__PURE__ */ React.createElement(
                "input",
                {
                  type: "number",
                  min: "1",
                  autoFocus: true,
                  value: advanceAmt,
                  onChange: (ev) => setAdvanceAmt(ev.target.value),
                  placeholder: "0",
                  className: "flex-1 min-w-0 text-sm px-3 py-1.5 border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                }
              ),
              /* @__PURE__ */ React.createElement("button", { type: "submit", className: "w-8 h-8 flex items-center justify-center rounded-xl bg-amber-400 hover:bg-amber-500 text-white" }, /* @__PURE__ */ React.createElement(Check, { size: 14 })),
              /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setAdvanceTargetId(null), className: "w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-100" }, /* @__PURE__ */ React.createElement(X, { size: 14 }))
            ))
          );
        });
      });
      return out;
    })()));
  })), refunds.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-2xl border border-teal-200 overflow-hidden shadow-sm" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between px-5 py-3 bg-teal-50 border-b border-teal-100" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm font-black text-teal-700" }, "\u{1F49A} \u0412\u043E\u0437\u0432\u0440\u0430\u0442\u044B \u0433\u043E\u0441\u0442\u044F\u043C"), /* @__PURE__ */ React.createElement("span", { className: "text-sm font-black text-teal-600" }, fmt(totalRefunds), " \u0441\u0443\u043C \xB7 ", refunds.length, " \u0437\u0430\u043F\u0438\u0441\u0435\u0439")), /* @__PURE__ */ React.createElement("div", { className: "divide-y divide-slate-50" }, [...refunds].sort((a, b) => new Date(b.date) - new Date(a.date)).map((e) => {
    const staff = usersList.find((u) => u.id === e.staffId || u.login === e.staffId);
    const d = new Date(e.date);
    return /* @__PURE__ */ React.createElement("div", { key: e.id, className: "group flex items-center gap-3 px-5 py-3.5 hover:bg-teal-50 transition-colors" }, /* @__PURE__ */ React.createElement("div", { className: "w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 bg-teal-100" }, "\u{1F49A}"), /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm font-bold text-teal-700" }, t("expRefund")), staff && /* @__PURE__ */ React.createElement("span", { className: "text-xs text-slate-400" }, staff.name.split(" ")[0])), e.comment && /* @__PURE__ */ React.createElement("div", { className: "text-xs text-slate-500 truncate mt-0.5" }, e.comment)), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-slate-400 shrink-0 hidden sm:block" }, d.getDate(), " ", d.toLocaleDateString("ru", { month: "short" })), /* @__PURE__ */ React.createElement("span", { className: "text-base font-black text-teal-600 shrink-0 tabular-nums" }, "\u21A9 ", fmt(e.amount)), /* @__PURE__ */ React.createElement("button", { onClick: () => setConfirmDeleteExp(e), className: "w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-rose-100 transition-all shrink-0 text-slate-500" }, /* @__PURE__ */ React.createElement(Trash2, { size: 16 })));
  })))), confirmArchiveCat && /* @__PURE__ */ React.createElement("div", { className: "modal-centered fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pb-[84px] sm:pb-4", onClick: () => setConfirmArchiveCat(null) }, /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 mb-4" }, /* @__PURE__ */ React.createElement("div", { className: "w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0" }, /* @__PURE__ */ React.createElement(Archive, { size: 18, className: "text-amber-600" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { className: "font-bold text-slate-800" }, "\u0423\u0431\u0440\u0430\u0442\u044C \u0440\u0430\u0437\u0434\u0435\u043B \u0432 \u0430\u0440\u0445\u0438\u0432?"), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-500" }, "\xAB", confirmArchiveCat, "\xBB"))), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-500 mb-5" }, "\u0420\u0430\u0437\u0434\u0435\u043B \u0441\u043A\u0440\u043E\u0435\u0442\u0441\u044F \u0438\u0437 \u0441\u043F\u0438\u0441\u043A\u0430. \u0417\u0430\u043F\u0438\u0441\u0438 \u0440\u0430\u0441\u0445\u043E\u0434\u043E\u0432 \u043E\u0441\u0442\u0430\u043D\u0443\u0442\u0441\u044F, \u0440\u0430\u0437\u0434\u0435\u043B \u043C\u043E\u0436\u043D\u043E \u0432\u0435\u0440\u043D\u0443\u0442\u044C \u0438\u0437 \u0430\u0440\u0445\u0438\u0432\u0430."), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setConfirmArchiveCat(null),
      className: "flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
    },
    "\u041E\u0442\u043C\u0435\u043D\u0430"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => {
        handleArchiveCat(confirmArchiveCat);
        setConfirmArchiveCat(null);
      },
      className: "flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors"
    },
    "\u0412 \u0430\u0440\u0445\u0438\u0432"
  )))), selectMode && selectedIds.size > 0 && /* @__PURE__ */ React.createElement("div", { className: "sticky bottom-4 z-30 mt-4" }, /* @__PURE__ */ React.createElement("div", { className: "mx-auto max-w-4xl bg-white rounded-2xl border-2 border-indigo-300 shadow-2xl px-4 py-3 flex items-center gap-3 flex-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 shrink-0" }, /* @__PURE__ */ React.createElement("div", { className: "w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-black" }, selectedIds.size), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-sm font-black text-slate-800" }, "\u0412\u044B\u0431\u0440\u0430\u043D\u043E \u0440\u0430\u0441\u0445\u043E\u0434\u043E\u0432"), /* @__PURE__ */ React.createElement("div", { className: "text-xs text-slate-500 tabular-nums" }, "\u043D\u0430 ", fmt(selectedSum), " \u0441\u0443\u043C"))), /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-[180px]" }, /* @__PURE__ */ React.createElement(
    "select",
    {
      value: bulkTarget,
      onChange: (e) => {
        setBulkTarget(e.target.value);
        setBulkStaff("");
      },
      className: "w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
    },
    /* @__PURE__ */ React.createElement("option", { value: "" }, "\u2014 \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0442\u0438 \u0432 \u0440\u0430\u0437\u0434\u0435\u043B \u2014"),
    allCatNames.map((c) => /* @__PURE__ */ React.createElement("option", { key: c, value: c }, getCat(c).icon, " ", c))
  )), bulkTarget === "\u0417\u0430\u0440\u043F\u043B\u0430\u0442\u0430" && /* @__PURE__ */ React.createElement("div", { className: "min-w-[170px]" }, /* @__PURE__ */ React.createElement(
    "select",
    {
      value: bulkStaff,
      onChange: (e) => setBulkStaff(e.target.value),
      className: "w-full px-3 py-2 bg-white border-2 border-amber-300 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-amber-500"
    },
    /* @__PURE__ */ React.createElement("option", { value: "" }, "\u2014 \u043A\u043E\u043C\u0443 \u0437\u0430\u0441\u0447\u0438\u0442\u0430\u0442\u044C \u2014"),
    usersList.map((u) => /* @__PURE__ */ React.createElement("option", { key: u.id || u.login, value: u.id || u.login }, u.name || u.login))
  )), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: handleBulkMove,
      disabled: !bulkTarget || bulkBusy || bulkTarget === "\u0417\u0430\u0440\u043F\u043B\u0430\u0442\u0430" && !bulkStaff,
      className: "px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black shadow-sm transition-all active:scale-95 disabled:opacity-40"
    },
    bulkBusy ? "\u041F\u0435\u0440\u0435\u043D\u043E\u0448\u0443\u2026" : "\u041F\u0435\u0440\u0435\u043D\u0435\u0441\u0442\u0438"
  ), /* @__PURE__ */ React.createElement("button", { onClick: exitSelectMode, className: "p-2.5 rounded-xl text-slate-400 hover:bg-slate-100" }, /* @__PURE__ */ React.createElement(X, { size: 18 })))), bulkAddOpen && /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4", onClick: () => !bulkAddBusy && setBulkAddOpen(false) }, /* @__PURE__ */ React.createElement("div", { className: "bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col", style: { maxHeight: "90vh" }, onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 font-black text-slate-800" }, /* @__PURE__ */ React.createElement(ClipboardList, { size: 18, className: "text-rose-500" }), " \u041C\u0430\u0441\u0441\u043E\u0432\u043E\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0440\u0430\u0441\u0445\u043E\u0434\u043E\u0432"), /* @__PURE__ */ React.createElement("button", { onClick: () => setBulkAddOpen(false), className: "p-2 hover:bg-slate-100 rounded-full text-slate-400" }, /* @__PURE__ */ React.createElement(X, { size: 18 }))), /* @__PURE__ */ React.createElement("div", { className: "px-5 py-3 border-b border-slate-100 shrink-0 flex items-center gap-3 flex-wrap" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "block text-[10px] font-black text-slate-400 uppercase mb-1" }, "\u0414\u0430\u0442\u0430 (\u043E\u0434\u043D\u0430 \u043D\u0430 \u0432\u0441\u0435)"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "date",
      value: bulkDate,
      onChange: (e) => setBulkDate(e.target.value),
      className: "px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-rose-400"
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "ml-auto text-right" }, /* @__PURE__ */ React.createElement("div", { className: "text-[10px] font-black text-slate-400 uppercase" }, "\u0418\u0442\u043E\u0433\u043E"), /* @__PURE__ */ React.createElement("div", { className: "text-xl font-black text-rose-600 tabular-nums" }, fmt(bulkAddTotal), " \u0441\u0443\u043C"))), /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto px-5 py-3 space-y-2" }, bulkRows.map((r, i) => /* @__PURE__ */ React.createElement("div", { key: r.id, className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs font-black text-slate-300 w-5 shrink-0 text-right" }, i + 1), /* @__PURE__ */ React.createElement(
    "select",
    {
      value: r.category,
      onChange: (e) => updBulkRow(r.id, { category: e.target.value }),
      className: "w-[34%] px-2.5 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-rose-400"
    },
    /* @__PURE__ */ React.createElement("option", { value: "" }, "\u2014 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u2014"),
    allCatNames.map((c) => /* @__PURE__ */ React.createElement("option", { key: c, value: c }, getCat(c).icon, " ", c))
  ), /* @__PURE__ */ React.createElement(
    "input",
    {
      value: r.amount,
      inputMode: "numeric",
      placeholder: "\u0421\u0443\u043C\u043C\u0430",
      onChange: (e) => updBulkRow(r.id, { amount: e.target.value.replace(/\D/g, "") }),
      onKeyDown: (e) => {
        if (e.key === "Enter" && i === bulkRows.length - 1) addBulkRow();
      },
      className: "w-[22%] px-2.5 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm font-black text-right tabular-nums text-slate-800 outline-none focus:border-rose-400"
    }
  ), /* @__PURE__ */ React.createElement(
    "input",
    {
      value: r.comment,
      placeholder: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)",
      onChange: (e) => updBulkRow(r.id, { comment: e.target.value }),
      className: "flex-1 min-w-0 px-2.5 py-2 bg-white border-2 border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-rose-400"
    }
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => delBulkRow(r.id),
      disabled: bulkRows.length === 1,
      className: "p-2 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 disabled:opacity-30 shrink-0"
    },
    /* @__PURE__ */ React.createElement(Trash2, { size: 14 })
  ))), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: addBulkRow,
      className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 text-sm font-bold hover:border-rose-400 hover:text-rose-500 transition-colors"
    },
    /* @__PURE__ */ React.createElement(Plus, { size: 14 }),
    " \u0415\u0449\u0451 \u0441\u0442\u0440\u043E\u043A\u0430"
  )), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 px-5 py-4 border-t border-slate-100 shrink-0" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setBulkAddOpen(false),
      disabled: bulkAddBusy,
      className: "flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50"
    },
    "\u041E\u0442\u043C\u0435\u043D\u0430"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: submitBulkAdd,
      disabled: !bulkAddValid.length || bulkAddBusy,
      className: "flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
    },
    /* @__PURE__ */ React.createElement(Check, { size: 16 }),
    " ",
    bulkAddBusy ? "\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u044E\u2026" : `\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C ${bulkAddValid.length} \u0448\u0442.`
  )))), confirmDeleteExp && /* @__PURE__ */ React.createElement("div", { className: "modal-centered fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pb-[84px] sm:pb-4", onClick: () => setConfirmDeleteExp(null) }, /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 mb-4" }, /* @__PURE__ */ React.createElement("div", { className: "w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0" }, /* @__PURE__ */ React.createElement(Trash2, { size: 18, className: "text-rose-500" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { className: "font-bold text-slate-800" }, "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0440\u0430\u0441\u0445\u043E\u0434?"), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-500 flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(CatIcon, { cat: confirmDeleteExp.category, size: 14 }), " ", confirmDeleteExp.category, " \xB7 ", fmt(confirmDeleteExp.amount), " \u0441\u0443\u043C"))), confirmDeleteExp.comment && /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-500 mb-3 truncate" }, "\u{1F4AC} ", confirmDeleteExp.comment), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-500 mb-5" }, "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043D\u0435\u043B\u044C\u0437\u044F \u043E\u0442\u043C\u0435\u043D\u0438\u0442\u044C."), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setConfirmDeleteExp(null),
      className: "flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
    },
    "\u041E\u0442\u043C\u0435\u043D\u0430"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => {
        onDeleteExpense(confirmDeleteExp.id, confirmDeleteExp);
        setConfirmDeleteExp(null);
      },
      className: "flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold transition-colors"
    },
    "\u0423\u0434\u0430\u043B\u0438\u0442\u044C"
  )))), confirmDeleteCat && /* @__PURE__ */ React.createElement("div", { className: "modal-centered fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pb-[84px] sm:pb-4" }, /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 mb-4" }, /* @__PURE__ */ React.createElement("div", { className: "w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0" }, /* @__PURE__ */ React.createElement(Trash2, { size: 18, className: "text-rose-500" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { className: "font-bold text-slate-800" }, "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u043E\u0434\u0433\u0440\u0443\u043F\u043F\u0443?"), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-500" }, "\xAB", confirmDeleteCat, "\xBB"))), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-500 mb-5" }, "\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u0431\u0443\u0434\u0435\u0442 \u0443\u0434\u0430\u043B\u0435\u043D\u0430. \u0417\u0430\u043F\u0438\u0441\u0438 \u0440\u0430\u0441\u0445\u043E\u0434\u043E\u0432 \u043E\u0441\u0442\u0430\u043D\u0443\u0442\u0441\u044F."), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setConfirmDeleteCat(null),
      className: "flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
    },
    "\u041E\u0442\u043C\u0435\u043D\u0430"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => {
        handleRemoveCustomCat(confirmDeleteCat);
        setConfirmDeleteCat(null);
      },
      className: "flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold transition-colors"
    },
    "\u0423\u0434\u0430\u043B\u0438\u0442\u044C"
  )))), editCat && /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4", onClick: () => setEditCat(null) }, /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 mb-4" }, /* @__PURE__ */ React.createElement("div", { className: "w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 text-2xl" }, editCat.icon), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { className: "font-bold text-slate-800" }, "\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043F\u043E\u0434\u0433\u0440\u0443\u043F\u043F\u0443"), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-400" }, "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0438 \u0437\u043D\u0430\u0447\u043E\u043A"))), /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1" }, "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435"), /* @__PURE__ */ React.createElement(
    "input",
    {
      value: editCat.name,
      autoFocus: true,
      onChange: (e) => setEditCat((s) => ({ ...s, name: e.target.value })),
      onKeyDown: (e) => {
        if (e.key === "Enter") {
          handleEditCustomCat(editCat.old, editCat.name, editCat.icon);
          setEditCat(null);
        }
      },
      className: "w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 mb-3"
    }
  ), /* @__PURE__ */ React.createElement("label", { className: "text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5" }, "\u0417\u043D\u0430\u0447\u043E\u043A"), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-9 gap-1 max-h-40 overflow-y-auto mb-4 p-1 rounded-xl bg-slate-50" }, ICON_CHOICES.map((ic) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: ic,
      onClick: () => setEditCat((s) => ({ ...s, icon: ic })),
      className: `w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-all ${editCat.icon === ic ? "bg-indigo-500 scale-110" : "hover:bg-slate-200"}`
    },
    ic
  ))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setEditCat(null),
      className: "flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
    },
    "\u041E\u0442\u043C\u0435\u043D\u0430"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => {
        handleEditCustomCat(editCat.old, editCat.name, editCat.icon);
        setEditCat(null);
      },
      disabled: !editCat.name.trim(),
      className: "flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-bold transition-colors"
    },
    "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C"
  )))));
}
