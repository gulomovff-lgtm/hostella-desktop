import { collection, doc, addDoc, updateDoc, deleteDoc, increment } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db, PUBLIC_DATA_PATH } from "../firebase";
import { sendTelegramMessage } from "../utils/telegram";
import { enqueueTelegram } from "../utils/offlineQueue";
import { logAction } from "../utils/auditLog";
import TRANSLATIONS from "../constants/translations";
import { HOSTELS } from "../utils/helpers";
export function buildExpenseComment(expense) {
  const category = (expense.category || "").trim();
  const comment = (expense.comment || "").trim();
  if (!comment) return category;
  if (comment.startsWith(category + ": ")) return comment;
  return `${category}: ${comment}`;
}
export function useExpenseActions({
  currentUser,
  selectedHostelFilter,
  expenses,
  usersList,
  lang,
  guests = [],
  clients = [],
  setExpenseModal,
  setUndoStack,
  showNotification,
  isOnline = true
}) {
  const pushUndo = (item) => {
    setUndoStack((prev) => [
      { ...item, id: Date.now(), timestamp: (/* @__PURE__ */ new Date()).toISOString() },
      ...prev
    ].slice(0, 5));
  };
  const handleAddExpense = async (d) => {
    try {
      const isFazliddin = currentUser.login === "fazliddin";
      const hostelId = currentUser.role === "admin" || currentUser.role === "super" ? selectedHostelFilter : isFazliddin ? selectedHostelFilter && selectedHostelFilter !== "all" ? selectedHostelFilter : currentUser.hostelId : currentUser.hostelId;
      const skipCashbox = !!d.skipCashbox || isFazliddin && hostelId === "hostel1";
      const expRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, "expenses"), {
        ...d,
        comment: buildExpenseComment(d),
        hostelId,
        staffId: currentUser.id || currentUser.login,
        date: d.date || (/* @__PURE__ */ new Date()).toISOString(),
        skipCashbox
      });
      pushUndo({
        type: "expense",
        label: `${d.category}: ${(+d.amount).toLocaleString()} \u0441\u0443\u043C${skipCashbox ? " (\u0431\u0435\u0437 \u0432\u044B\u0447\u0435\u0442\u0430 \u0441 \u043A\u0430\u0441\u0441\u044B)" : ""}${d.comment ? " \u2014 " + d.comment : ""}`,
        expenseId: expRef.id
      });
      setExpenseModal(false);
      showNotification("\u0420\u0430\u0441\u0445\u043E\u0434 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D", "success");
      logAction(currentUser, "expense_add", { amount: d.amount, category: d.category, comment: d.comment });
      if (d.category !== "\u0412\u043E\u0437\u0432\u0440\u0430\u0442" && !skipCashbox && currentUser.role !== "admin" && currentUser.role !== "super") {
        const hostelLabel = hostelId === "hostel1" ? "\u0425\u043E\u0441\u0442\u0435\u043B \u21161" : hostelId === "hostel2" ? "\u0425\u043E\u0441\u0442\u0435\u043B \u21162" : hostelId || "\u2014";
        const tgMsg = `\u{1F4B3} <b>\u0420\u0430\u0441\u0445\u043E\u0434</b>
\u{1F3E8} ${hostelLabel}
\u{1F4C2} ${d.category}
\u{1F4B0} ${(+d.amount).toLocaleString()} \u0441\u0443\u043C${d.comment ? "\n\u{1F4AC} " + d.comment : ""}
\u{1F464} \u041A\u0430\u0441\u0441\u0438\u0440: ${currentUser.name || currentUser.login}`;
        if (isOnline) {
          await sendTelegramMessage(tgMsg, "expenseAdded");
        } else {
          enqueueTelegram(tgMsg, "expenseAdded");
        }
      }
    } catch (err) {
      console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0440\u0430\u0441\u0445\u043E\u0434\u0430:", err);
      showNotification("\u041E\u0448\u0438\u0431\u043A\u0430: " + (err.message || "\u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C"), "error");
    }
  };
  const handleAddExpensesBulk = async (items = [], dateIso) => {
    const list = (items || []).map((i) => ({ ...i, amount: Number(i.amount) || 0 })).filter((i) => i.category && i.amount > 0);
    if (!list.length) return { ok: 0 };
    const isFazliddin = currentUser.login === "fazliddin";
    const hostelId = currentUser.role === "admin" || currentUser.role === "super" ? selectedHostelFilter : isFazliddin ? selectedHostelFilter && selectedHostelFilter !== "all" ? selectedHostelFilter : currentUser.hostelId : currentUser.hostelId;
    const date = dateIso || (/* @__PURE__ */ new Date()).toISOString();
    const ids = [];
    let failed = 0;
    for (const d of list) {
      try {
        const skipCashbox = !!d.skipCashbox || isFazliddin && hostelId === "hostel1";
        const ref = await addDoc(collection(db, ...PUBLIC_DATA_PATH, "expenses"), {
          category: d.category,
          amount: d.amount,
          comment: buildExpenseComment(d),
          hostelId,
          staffId: currentUser.id || currentUser.login,
          date,
          skipCashbox
        });
        ids.push(ref.id);
        logAction(currentUser, "expense_add", { amount: d.amount, category: d.category, comment: d.comment, bulk: true });
      } catch (e) {
        failed++;
        console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u043C\u0430\u0441\u0441\u043E\u0432\u043E\u0433\u043E \u0440\u0430\u0441\u0445\u043E\u0434\u0430:", e);
      }
    }
    const total = list.reduce((s, i) => s + i.amount, 0);
    if (ids.length) {
      pushUndo({
        type: "expense_bulk",
        label: `\u041C\u0430\u0441\u0441\u043E\u0432\u044B\u0439 \u0440\u0430\u0441\u0445\u043E\u0434: ${ids.length} \u0448\u0442. \u043D\u0430 ${total.toLocaleString()} \u0441\u0443\u043C`,
        expenseIds: ids
      });
      if (currentUser.role !== "admin" && currentUser.role !== "super") {
        const hostelLabel = hostelId === "hostel1" ? "\u0425\u043E\u0441\u0442\u0435\u043B \u21161" : hostelId === "hostel2" ? "\u0425\u043E\u0441\u0442\u0435\u043B \u21162" : hostelId || "\u2014";
        const lines = list.map((i) => `\u2022 ${i.category}: ${i.amount.toLocaleString()} \u0441\u0443\u043C${i.comment ? " \u2014 " + i.comment : ""}`).join("\n");
        const tgMsg = `\u{1F4B3} <b>\u0420\u0430\u0441\u0445\u043E\u0434\u044B (${ids.length})</b>
\u{1F3E8} ${hostelLabel}
\u{1F4C5} ${new Date(date).toLocaleDateString("ru")}
${lines}

<b>\u0418\u0442\u043E\u0433\u043E: ${total.toLocaleString()} \u0441\u0443\u043C</b>
\u{1F464} \u041A\u0430\u0441\u0441\u0438\u0440: ${currentUser.name || currentUser.login}`;
        if (isOnline) await sendTelegramMessage(tgMsg, "expenseAdded");
        else enqueueTelegram(tgMsg, "expenseAdded");
      }
    }
    showNotification(
      failed ? `\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E ${ids.length}, \u043E\u0448\u0438\u0431\u043E\u043A ${failed}` : `\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u0440\u0430\u0441\u0445\u043E\u0434\u043E\u0432: ${ids.length} \u043D\u0430 ${total.toLocaleString()} \u0441\u0443\u043C`,
      failed ? "warning" : "success"
    );
    return { ok: ids.length, failed, total };
  };
  const handleDeletePayment = async (id, type, record = {}) => {
    if (type === "income" && record.guestId && record.category !== "registration") {
      try {
        const cash = Number(record.cash) || 0;
        const card = Number(record.card) || 0;
        const qr = Number(record.qr) || 0;
        const transfer = Number(record.transfer) || 0;
        const total = Number(record.amount) || cash + card + qr + transfer;
        const patch = {
          paidCash: increment(-cash),
          paidCard: increment(-card),
          paidQR: increment(-qr),
          amountPaid: increment(-total),
          ...transfer > 0 ? { paidTransfer: increment(-transfer) } : {}
        };
        const g = guests.find((x) => x.id === record.guestId);
        const credited = Number(g?.balanceCredited) || 0;
        if (credited > 0) {
          const paidNow = (Number(g?.amountPaid) || 0) - total;
          const overAfter = Math.max(0, paidNow - (Number(g?.totalPrice) || 0));
          const clawback = Math.min(credited, Math.max(0, credited - overAfter));
          if (clawback > 0) {
            const norm = (s) => (s || "").replace(/\s/g, "").toUpperCase();
            const cli = g.passport && clients.find((c) => c.passport && norm(c.passport) === norm(g.passport)) || null;
            if (cli) {
              await updateDoc(doc(db, ...PUBLIC_DATA_PATH, "clients", cli.id), { balance: increment(-clawback) });
              showNotification(`\u0421 \u0431\u0430\u043B\u0430\u043D\u0441\u0430 \u043A\u043B\u0438\u0435\u043D\u0442\u0430 \u0441\u043D\u044F\u0442\u0430 \u043F\u0435\u0440\u0435\u043F\u043B\u0430\u0442\u0430 ${clawback.toLocaleString()} \u0441\u0443\u043C`, "info");
            }
            patch.balanceCredited = increment(-clawback);
          }
        }
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, "guests", record.guestId), patch);
      } catch (e) {
        console.warn("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0431\u0430\u043B\u0430\u043D\u0441 \u0433\u043E\u0441\u0442\u044F:", e.message);
      }
    }
    await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, type === "income" ? "payments" : "expenses", id));
    let msg = `\u{1F5D1} <b>\u0423\u0434\u0430\u043B\u0435\u043D\u0430 \u0437\u0430\u043F\u0438\u0441\u044C</b>
\u0422\u0438\u043F: ${type === "income" ? "\u041F\u043B\u0430\u0442\u0451\u0436" : record.category === "\u0412\u043E\u0437\u0432\u0440\u0430\u0442" ? "\u0412\u043E\u0437\u0432\u0440\u0430\u0442" : "\u0420\u0430\u0441\u0445\u043E\u0434"}`;
    if (type === "income") {
      if (record.guestName || record.guest) msg += `
\u{1F464} \u0413\u043E\u0441\u0442\u044C: ${record.guestName || record.guest}`;
      if (record.amount) msg += `
\u{1F4B5} \u0421\u0443\u043C\u043C\u0430: ${Number(record.amount).toLocaleString()} \u0441\u0443\u043C`;
      if (record.method) msg += `
\u{1F4B3} \u041C\u0435\u0442\u043E\u0434: ${record.method}`;
      if (record.date) msg += `
\u{1F4C5} \u0414\u0430\u0442\u0430: ${new Date(record.date).toLocaleString("ru")}`;
    } else {
      if (record.category) msg += `
\u{1F4C2} \u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F: ${record.category}`;
      if (record.amount) msg += `
\u{1F4B5} \u0421\u0443\u043C\u043C\u0430: ${Number(record.amount).toLocaleString()} \u0441\u0443\u043C`;
      if (record.comment) msg += `
\u{1F4AC} ${record.comment}`;
      if (record.date) msg += `
\u{1F4C5} \u0414\u0430\u0442\u0430: ${new Date(record.date).toLocaleString("ru")}`;
    }
    msg += `
\u{1F464} \u0423\u0434\u0430\u043B\u0438\u043B: ${currentUser?.name || currentUser?.login || "\u2014"}`;
    showNotification("\u0417\u0430\u043F\u0438\u0441\u044C \u0443\u0434\u0430\u043B\u0435\u043D\u0430");
  };
  const downloadExpensesCSV = () => {
    const filtered = currentUser?.role === "super" ? expenses : expenses.filter((e) => e.hostelId === (currentUser?.role === "admin" ? selectedHostelFilter : currentUser?.hostelId));
    const today = (/* @__PURE__ */ new Date()).toLocaleDateString("ru-RU");
    const reportDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const hostelKey = currentUser?.role === "super" ? "all" : currentUser?.role === "admin" ? selectedHostelFilter : currentUser?.hostelId;
    const hostelSlug = hostelKey === "hostel1" ? "\u0425\u043E\u0441\u0442\u0435\u043B1" : hostelKey === "hostel2" ? "\u0425\u043E\u0441\u0442\u0435\u043B2" : "\u0412\u0441\u0435";
    const rows = filtered.map((e) => {
      const d = new Date(e.date);
      return {
        "\u0414\u0430\u0442\u0430": d.toLocaleDateString("ru-RU"),
        "\u0412\u0440\u0435\u043C\u044F": d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
        "\u0425\u043E\u0441\u0442\u0435\u043B": HOSTELS[e.hostelId]?.name || e.hostelId || "\u2014",
        "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F": e.category || "\u2014",
        "\u0421\u0443\u043C\u043C\u0430 (\u0441\u0443\u043C)": Number(e.amount) || 0,
        "\u041A\u0430\u0441\u0441\u0438\u0440": usersList.find((u) => u.id === e.staffId || u.login === e.staffId)?.name || e.staffId || "\u2014",
        "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439": e.comment || ""
      };
    }).sort((a, b) => a["\u0414\u0430\u0442\u0430"].localeCompare(b["\u0414\u0430\u0442\u0430"]));
    const totalAmount = rows.reduce((s, r) => s + r["\u0421\u0443\u043C\u043C\u0430 (\u0441\u0443\u043C)"], 0);
    rows.push({
      "\u0414\u0430\u0442\u0430": "\u0418\u0422\u041E\u0413\u041E",
      "\u0412\u0440\u0435\u043C\u044F": "",
      "\u0425\u043E\u0441\u0442\u0435\u043B": "",
      "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F": "",
      "\u0421\u0443\u043C\u043C\u0430 (\u0441\u0443\u043C)": totalAmount,
      "\u041A\u0430\u0441\u0441\u0438\u0440": "",
      "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439": ""
    });
    const byCategory = {};
    filtered.forEach((e) => {
      const cat = e.category || "\u0414\u0440\u0443\u0433\u043E\u0435";
      byCategory[cat] = (byCategory[cat] || 0) + (Number(e.amount) || 0);
    });
    const summaryRows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, sum]) => ({
      "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F": cat,
      "\u0421\u0443\u043C\u043C\u0430 (\u0441\u0443\u043C)": sum,
      "\u0414\u043E\u043B\u044F (%)": totalAmount > 0 ? +(sum / totalAmount * 100).toFixed(1) : 0
    }));
    summaryRows.push({ "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F": "\u0418\u0422\u041E\u0413\u041E", "\u0421\u0443\u043C\u043C\u0430 (\u0441\u0443\u043C)": totalAmount, "\u0414\u043E\u043B\u044F (%)": 100 });
    const byHostel = {};
    filtered.forEach((e) => {
      const h = HOSTELS[e.hostelId]?.name || e.hostelId || "\u2014";
      byHostel[h] = (byHostel[h] || 0) + (Number(e.amount) || 0);
    });
    const hostelRows = Object.entries(byHostel).sort((a, b) => b[1] - a[1]).map(([h, sum]) => ({
      "\u0425\u043E\u0441\u0442\u0435\u043B": h,
      "\u0421\u0443\u043C\u043C\u0430 (\u0441\u0443\u043C)": sum,
      "\u0414\u043E\u043B\u044F (%)": totalAmount > 0 ? +(sum / totalAmount * 100).toFixed(1) : 0
    }));
    hostelRows.push({ "\u0425\u043E\u0441\u0442\u0435\u043B": "\u0418\u0422\u041E\u0413\u041E", "\u0421\u0443\u043C\u043C\u0430 (\u0441\u0443\u043C)": totalAmount, "\u0414\u043E\u043B\u044F (%)": 100 });
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(rows);
    ws1["!cols"] = [
      { wch: 12 },
      // Дата
      { wch: 7 },
      // Время
      { wch: 16 },
      // Хостел
      { wch: 18 },
      // Категория
      { wch: 16 },
      // Сумма
      { wch: 18 },
      // Кассир
      { wch: 35 }
      // Комментарий
    ];
    ws1["!freeze"] = { xSplit: 0, ySplit: 1 };
    ws1["!autofilter"] = { ref: ws1["!ref"] };
    XLSX.utils.book_append_sheet(wb, ws1, "\u0420\u0430\u0441\u0445\u043E\u0434\u044B");
    const ws2 = XLSX.utils.json_to_sheet(summaryRows);
    ws2["!cols"] = [{ wch: 22 }, { wch: 16 }, { wch: 12 }];
    ws2["!freeze"] = { xSplit: 0, ySplit: 1 };
    ws2["!autofilter"] = { ref: ws2["!ref"] };
    XLSX.utils.book_append_sheet(wb, ws2, "\u041F\u043E \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F\u043C");
    const ws3 = XLSX.utils.json_to_sheet(hostelRows);
    ws3["!cols"] = [{ wch: 20 }, { wch: 16 }, { wch: 12 }];
    ws3["!freeze"] = { xSplit: 0, ySplit: 1 };
    ws3["!autofilter"] = { ref: ws3["!ref"] };
    XLSX.utils.book_append_sheet(wb, ws3, "\u041F\u043E \u0445\u043E\u0441\u0442\u0435\u043B\u0430\u043C");
    XLSX.writeFile(wb, `\u0420\u0430\u0441\u0445\u043E\u0434\u044B_${hostelSlug}_${reportDate}.xlsx`);
  };
  const handleCashToTerminal = async (amount, comment = "", dateOverride = null, receipt = null) => {
    try {
      const hostelId = currentUser.role === "admin" || currentUser.role === "super" ? selectedHostelFilter : currentUser.hostelId;
      await addDoc(collection(db, ...PUBLIC_DATA_PATH, "payments"), {
        type: "cash_to_terminal",
        amount: Number(amount),
        method: "cash",
        comment: comment || "\u0418\u043D\u043A\u0430\u0441\u0441\u0430\u0446\u0438\u044F \u2014 \u043F\u0435\u0440\u0435\u0432\u043E\u0434 \u043D\u0430\u043B\u0438\u0447\u043D\u044B\u0445 \u0432 \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043B",
        staffId: currentUser.id || currentUser.login,
        staffName: currentUser.name || currentUser.login,
        hostelId,
        date: dateOverride || (/* @__PURE__ */ new Date()).toISOString(),
        ...receipt ? { receipt } : {}
      });
      showNotification(`\u2705 \u0418\u043D\u043A\u0430\u0441\u0441\u0430\u0446\u0438\u044F \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u0430: ${Number(amount).toLocaleString()} \u0441\u0443\u043C`, "success");
      logAction(currentUser, "cash_to_terminal", { amount, hostelId, comment });
    } catch (err) {
      showNotification("\u041E\u0448\u0438\u0431\u043A\u0430: " + (err.message || "\u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C"), "error");
    }
  };
  const handleEditExpenseCategory = async (expenseId, newCategory) => {
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, "expenses", expenseId), { category: newCategory });
      showNotification("\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0430", "success");
    } catch (err) {
      showNotification("\u041E\u0448\u0438\u0431\u043A\u0430: " + (err.message || "\u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C"), "error");
    }
  };
  const handleBackfillComments = async () => {
    const now = /* @__PURE__ */ new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    const toUpdate = expenses.filter(
      (e) => e.date >= monthStart && e.date < monthEnd && e.category !== "\u0412\u043E\u0437\u0432\u0440\u0430\u0442"
    );
    if (toUpdate.length === 0) {
      showNotification("\u041D\u0435\u0442 \u0437\u0430\u043F\u0438\u0441\u0435\u0439 \u0434\u043B\u044F \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F", "info");
      return;
    }
    let updated = 0;
    for (const e of toUpdate) {
      const newComment = buildExpenseComment(e);
      if (newComment !== (e.comment || "").trim()) {
        try {
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, "expenses", e.id), { comment: newComment });
          updated++;
        } catch (_) {
        }
      }
    }
    showNotification(`\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E ${updated} \u0438\u0437 ${toUpdate.length} \u0437\u0430\u043F\u0438\u0441\u0435\u0439`, "success");
  };
  const handleUpdateExpense = async (expenseId, patch) => {
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, "expenses", expenseId), patch);
      showNotification("\u0420\u0430\u0441\u0445\u043E\u0434 \u043E\u0431\u043D\u043E\u0432\u043B\u0451\u043D", "success");
    } catch (err) {
      showNotification("\u041E\u0448\u0438\u0431\u043A\u0430: " + (err.message || "\u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C"), "error");
    }
  };
  return { handleAddExpense, handleAddExpensesBulk, handleDeletePayment, downloadExpensesCSV, handleCashToTerminal, handleEditExpenseCategory, handleBackfillComments, handleUpdateExpense };
}
