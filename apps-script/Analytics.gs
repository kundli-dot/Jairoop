// ============================================================
// Analytics.gs — advanced reporting & forecasting
// ============================================================

// -------- ABC Analysis (80/15/5 by closing-balance value) ----
function abcAnalysis() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const master = readSheetObjects_("Master");
  const ranked = master.map(i => ({
    code: i.ItemCode,
    name: i.ItemName,
    value: (parseFloat(i.ClosingBalance) || 0) * (parseFloat(i.CostPerMtr) || 0)
  })).filter(x => x.value > 0)
     .sort((a, b) => b.value - a.value);
  const total = ranked.reduce((s, x) => s + x.value, 0);
  let cum = 0;
  return ranked.map(x => {
    cum += x.value;
    const pct = total ? (cum / total) * 100 : 0;
    return Object.assign(x, {
      cumPct: +pct.toFixed(1),
      grade: pct <= 80 ? "A" : (pct <= 95 ? "B" : "C")
    });
  });
}

// -------- Stock aging buckets from Stock Ledger ---------------
function stockAging() {
  const ledger = readSheetObjects_("Stock Ledger");
  const buckets = {}; // by ItemCode
  ledger.forEach(t => {
    if (!t.ItemCode) return;
    if (!buckets[t.ItemCode]) buckets[t.ItemCode] = { code: t.ItemCode, d0_30: 0, d31_60: 0, d61_90: 0, d90p: 0 };
    const daysOld = (new Date() - new Date(t.Date)) / 86400000;
    const qty = (parseFloat(t.QtyIn) || 0) - (parseFloat(t.QtyOut) || 0);
    if (qty <= 0) return;
    if (daysOld <= 30) buckets[t.ItemCode].d0_30 += qty;
    else if (daysOld <= 60) buckets[t.ItemCode].d31_60 += qty;
    else if (daysOld <= 90) buckets[t.ItemCode].d61_90 += qty;
    else buckets[t.ItemCode].d90p += qty;
  });
  return Object.values(buckets);
}

// -------- Reorder Point math (avg consumption × lead time + safety) ----
function reorderRecommendations() {
  const master = readSheetObjects_("Master");
  const dispatch = readSheetObjects_("Dispatch Log");
  const consumption = {};
  const earliest = {};
  dispatch.forEach(d => {
    if (!d.ItemCode || !d.DispatchDate) return;
    consumption[d.ItemCode] = (consumption[d.ItemCode] || 0) + (parseFloat(d.DispatchedQty) || 0);
    const t = new Date(d.DispatchDate).getTime();
    if (!earliest[d.ItemCode] || t < earliest[d.ItemCode]) earliest[d.ItemCode] = t;
  });
  const now = Date.now();
  return master.map(i => {
    const days = earliest[i.ItemCode] ? Math.max(1, (now - earliest[i.ItemCode]) / 86400000) : 30;
    const avgPerDay = (consumption[i.ItemCode] || 0) / days;
    const leadDays = 14;
    const safety = avgPerDay * 7;
    const rop = +(avgPerDay * leadDays + safety).toFixed(1);
    const balance = parseFloat(i.ClosingBalance) || 0;
    const suggestedOrder = balance < rop ? Math.max(rop * 2 - balance, avgPerDay * 30) : 0;
    return {
      code: i.ItemCode,
      name: i.ItemName,
      balance: balance,
      avgPerDay: +avgPerDay.toFixed(2),
      reorderPoint: rop,
      suggestedOrder: +suggestedOrder.toFixed(1),
      action: balance < rop ? "REORDER" : "OK"
    };
  });
}

// -------- Demand forecast (3-month moving average per item) ---
function demandForecast() {
  const dispatch = readSheetObjects_("Dispatch Log");
  const monthly = {}; // code -> {YYYY-MM: qty}
  dispatch.forEach(d => {
    if (!d.ItemCode || !d.DispatchDate) return;
    const m = String(d.DispatchDate).substring(0, 7);
    if (!monthly[d.ItemCode]) monthly[d.ItemCode] = {};
    monthly[d.ItemCode][m] = (monthly[d.ItemCode][m] || 0) + (parseFloat(d.DispatchedQty) || 0);
  });
  return Object.keys(monthly).map(code => {
    const months = Object.keys(monthly[code]).sort();
    const last3 = months.slice(-3).map(m => monthly[code][m]);
    const avg = last3.length ? last3.reduce((a, b) => a + b, 0) / last3.length : 0;
    return {
      code: code,
      months: months,
      history: months.map(m => ({ month: m, qty: monthly[code][m] })),
      forecastNextMonth: +avg.toFixed(1)
    };
  });
}

// -------- Worker performance scoreboard ----------------------
function workerScoreboard() {
  const jw = readSheetObjects_("Job Work Tracker");
  const map = {};
  jw.forEach(j => {
    if (!j.WorkerName) return;
    const w = map[j.WorkerName] = map[j.WorkerName] || {
      worker: j.WorkerName, jobs: 0, sent: 0, received: 0, wastage: 0, paid: 0, completed: 0
    };
    w.jobs++;
    w.sent += parseFloat(j.SentQtyMtr) || 0;
    w.received += parseFloat(j.ReceivedQtyMtr) || 0;
    w.wastage += parseFloat(j.WastageMtr) || 0;
    w.paid += parseFloat(j.TotalPayment) || 0;
    if (j.Status === "Completed") w.completed++;
  });
  return Object.values(map).map(w => Object.assign(w, {
    wastagePct: w.sent > 0 ? +(w.wastage / w.sent * 100).toFixed(2) : 0,
    completionPct: w.jobs > 0 ? +(w.completed / w.jobs * 100).toFixed(1) : 0
  })).sort((a, b) => b.received - a.received);
}

// -------- Client ledger summary (receivables) -----------------
function clientReceivables() {
  const orders = readSheetObjects_("Order Book");
  const payments = readSheetObjects_("Payments");
  const dispatch = readSheetObjects_("Dispatch Log");
  const map = {};
  orders.forEach(o => {
    if (!o.ClientName) return;
    const c = map[o.ClientName] = map[o.ClientName] || {
      client: o.ClientName, orders: 0, billed: 0, advance: 0, received: 0, balance: 0
    };
    c.orders++;
    c.billed += parseFloat(o.TotalValue) || 0;
    c.advance += parseFloat(o.AdvanceReceived) || 0;
  });
  payments.forEach(p => {
    if (p.PartyType === "Client" && map[p.PartyName] && p.Type === "Received") {
      map[p.PartyName].received += parseFloat(p.Amount) || 0;
    }
  });
  Object.values(map).forEach(c => {
    c.balance = +(c.billed - c.advance - c.received).toFixed(2);
  });
  return Object.values(map).sort((a, b) => b.balance - a.balance);
}

// -------- Vendor ledger summary (payables) --------------------
function vendorPayables() {
  const pos = readSheetObjects_("Purchase Orders");
  const payments = readSheetObjects_("Payments");
  const map = {};
  pos.forEach(p => {
    if (!p.VendorName) return;
    const v = map[p.VendorName] = map[p.VendorName] || {
      vendor: p.VendorName, pos: 0, billed: 0, paid: 0, balance: 0
    };
    v.pos++;
    v.billed += parseFloat(p.TotalValue) || 0;
  });
  payments.forEach(p => {
    if (p.PartyType === "Vendor" && map[p.PartyName] && p.Type === "Paid") {
      map[p.PartyName].paid += parseFloat(p.Amount) || 0;
    }
  });
  Object.values(map).forEach(v => {
    v.balance = +(v.billed - v.paid).toFixed(2);
  });
  return Object.values(map).sort((a, b) => b.balance - a.balance);
}

// -------- All analytics in one shot for the dashboard ---------
function getAdvancedAnalytics() {
  return {
    abc: abcAnalysis(),
    aging: stockAging(),
    reorder: reorderRecommendations(),
    forecast: demandForecast(),
    workers: workerScoreboard(),
    receivables: clientReceivables(),
    payables: vendorPayables()
  };
}
