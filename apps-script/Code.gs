// ============================================================
// JAI ROOP TEXTILES — IMS V7 (Enterprise Edition)
// Code.gs — entry point + core write operations
// ============================================================

// ---- AUTO-TRIGGER: Status change in Order Book ----
function onEdit(e) {
  try {
    const sheet = e.source.getActiveSheet();
    if (sheet.getName() === "Order Book" && e.range.getColumn() === 6) {
      updateMasterAllocatedAndStock(e.source);
    }
  } catch (err) {
    console.warn("onEdit failed: " + err);
  }
}

function updateMasterAllocatedAndStock(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  const orderSheet = ss.getSheetByName("Order Book");
  const masterSheet = ss.getSheetByName("Master");
  if (!orderSheet || !masterSheet) return;
  const orderData = orderSheet.getDataRange().getValues();
  const masterData = masterSheet.getDataRange().getValues();
  const allocationMap = {};
  for (let i = 1; i < orderData.length; i++) {
    const itemCode = orderData[i][3];
    const qty = parseFloat(orderData[i][4]) || 0;
    const status = orderData[i][5];
    if (status === "In Production" || status === "Pending") {
      allocationMap[itemCode] = (allocationMap[itemCode] || 0) + qty;
    }
  }
  for (let j = 1; j < masterData.length; j++) {
    const code = masterData[j][0];
    if (code) masterSheet.getRange(j + 1, 9).setValue(allocationMap[code] || 0);
  }
}

// ============================================================
// WEB APP ENTRY POINT
// ============================================================
function doGet(e) {
  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("IMS Dashboard — V7")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================================
// Generic sheet reader — used by every module
// ============================================================
function readSheetObjects_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  const headers = rows.shift().map(h => String(h).replace(/[^a-zA-Z0-9]/g, ""));
  return rows.map(row => {
    let obj = {}, has = false;
    headers.forEach((h, i) => {
      let v = row[i];
      if (v !== "" && v !== null && v !== undefined) has = true;
      if (v instanceof Date) v = Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
      obj[h] = v;
    });
    return has ? obj : null;
  }).filter(Boolean);
}

// alias kept for backwards compatibility with V6 frontend snippets
function getSheetDataFast(ss, name) { return readSheetObjects_(name); }

// ============================================================
// MAIN BOOTSTRAP PAYLOAD
// ============================================================
function getAllIMSData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settings = getSettings();
  const user = getCurrentUserContext();

  // logo
  let logoBase64 = "";
  try {
    const fileId = settings["company.logoFileId"];
    if (fileId) {
      const blob = DriveApp.getFileById(fileId).getBlob();
      logoBase64 = "data:" + blob.getContentType() + ";base64," + Utilities.base64Encode(blob.getBytes());
    }
  } catch (e) { /* logo optional */ }

  const master = readSheetObjects_("Master");
  const orders = readSheetObjects_("Order Book");
  const jobWork = readSheetObjects_("Job Work Tracker");
  const dispatch = readSheetObjects_("Dispatch Log");
  const purchaseOrders = readSheetObjects_("Purchase Orders");
  const vendors = readSheetObjects_("Vendors");
  const clients = readSheetObjects_("Clients");
  const workers = readSheetObjects_("Workers");
  const payments = readSheetObjects_("Payments");

  const clientSet = {};
  orders.forEach(o => { if (o.ClientName) clientSet[o.ClientName] = true; });
  clients.forEach(c => { if (c.ClientName) clientSet[c.ClientName] = true; });

  const workerSet = {};
  jobWork.forEach(j => { if (j.WorkerName) workerSet[j.WorkerName] = true; });
  workers.forEach(w => { if (w.WorkerName) workerSet[w.WorkerName] = true; });

  const vendorSet = {};
  purchaseOrders.forEach(p => { if (p.VendorName) vendorSet[p.VendorName] = true; });
  vendors.forEach(v => { if (v.VendorName) vendorSet[v.VendorName] = true; });

  return {
    user: user,
    settings: settings,
    master: master,
    orders: orders,
    jobWork: jobWork,
    dispatch: dispatch,
    purchaseOrders: purchaseOrders,
    vendors: vendors,
    clients: clients,
    workers: workers,
    payments: payments,
    clientNames: Object.keys(clientSet).sort(),
    workerNames: Object.keys(workerSet).sort(),
    vendorNames: Object.keys(vendorSet).sort(),
    kpis: computeKPIs(master, orders, jobWork, dispatch),
    advanced: getAdvancedAnalytics(),
    logoUrl: logoBase64,
    lastSync: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd MMM yyyy, hh:mm a")
  };
}

// ============================================================
// CORE KPIs (unchanged from V6 logic, lightly extended)
// ============================================================
function computeKPIs(master, orders, jobWork, dispatch) {
  const reorderItems = master.filter(i => i.ReorderStatus === "REORDER (LOW)");
  const activeOrders = orders.filter(o => o.Status === "In Production");
  const pendingOrders = orders.filter(o => o.Status === "Pending");
  const completedOrders = orders.filter(o => o.Status === "Completed");
  const jwOut = jobWork.filter(j => j.Status === "Out");

  const totalDispatched = dispatch.reduce((s, d) => s + (parseFloat(d.DispatchedQty) || 0), 0);
  let totalSent = 0, totalWastage = 0;
  jobWork.forEach(j => {
    totalSent += parseFloat(j.SentQtyMtr) || 0;
    totalWastage += parseFloat(j.WastageMtr) || 0;
  });
  const avgWastagePct = totalSent > 0 ? +(totalWastage / totalSent * 100).toFixed(2) : 0;

  const categoryMap = {};
  master.forEach(it => {
    const cat = it.Category || "Other";
    if (!categoryMap[cat]) categoryMap[cat] = { count: 0, totalStock: 0 };
    categoryMap[cat].count++;
    categoryMap[cat].totalStock += parseFloat(it.ClosingBalance) || 0;
  });

  const topItems = master
    .filter(i => (parseFloat(i.ClosingBalance) || 0) > 0)
    .sort((a, b) => (parseFloat(b.ClosingBalance) || 0) - (parseFloat(a.ClosingBalance) || 0))
    .slice(0, 5)
    .map(i => ({ code: i.ItemCode, balance: parseFloat(i.ClosingBalance) || 0 }));

  const monthlyDispatch = {};
  dispatch.forEach(d => {
    if (d.DispatchDate) {
      const m = String(d.DispatchDate).substring(0, 7);
      monthlyDispatch[m] = (monthlyDispatch[m] || 0) + (parseFloat(d.DispatchedQty) || 0);
    }
  });

  const totalOrders = orders.length;
  const fulfilmentRate = totalOrders > 0 ? +((completedOrders.length / totalOrders) * 100).toFixed(1) : 0;
  const totalOrderValue = orders.reduce((s, o) => s + (parseFloat(o.TotalValue) || 0), 0);

  return {
    reorderCount: reorderItems.length,
    reorderItems: reorderItems.map(i => i.ItemCode),
    activeOrderCount: activeOrders.length,
    pendingOrderCount: pendingOrders.length,
    completedOrderCount: completedOrders.length,
    totalOrderCount: totalOrders,
    fulfilmentRate: fulfilmentRate,
    jwLiveCount: jwOut.length,
    totalDispatched: totalDispatched,
    avgWastagePct: avgWastagePct,
    totalItems: master.length,
    totalOrderValue: +totalOrderValue.toFixed(2),
    categoryBreakdown: categoryMap,
    topItems: topItems,
    monthlyDispatch: monthlyDispatch
  };
}

// ============================================================
// WRITE-BACK: Orders
// ============================================================
function saveNewOrder(orderData) {
  try {
    requirePerm_("write");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Order Book");
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");
    const orderId = "ORD-" + today + "-" + String(sheet.getLastRow()).padStart(3, "0");
    const qty = parseFloat(orderData.qty) || 0;
    const rate = parseFloat(orderData.ratePerMtr) || 0;
    const totalValue = qty * rate;
    const advance = parseFloat(orderData.advance) || 0;

    sheet.appendRow([
      orderId,
      orderData.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      orderData.clientName,
      orderData.itemCode,
      qty,
      orderData.status || "Pending",
      orderData.remarks || "",
      orderData.expectedDelivery || "",
      orderData.priority || "Normal",
      orderData.salesPerson || "",
      rate,
      totalValue,
      advance,
      totalValue - advance
    ]);
    updateMasterAllocatedAndStock(ss);
    logAudit_("CREATE", "Order Book", orderId, JSON.stringify(orderData));
    return { success: true, orderId: orderId, message: "Order " + orderId + " saved." };
  } catch (e) {
    return { success: false, message: "Error: " + e.message };
  }
}

function updateOrderStatus(orderId, newStatus) {
  try {
    requirePerm_("write");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Order Book");
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === orderId) {
        sheet.getRange(i + 1, 6).setValue(newStatus);
        updateMasterAllocatedAndStock(ss);
        logAudit_("UPDATE_STATUS", "Order Book", orderId, newStatus);
        return { success: true, message: "Order " + orderId + " → " + newStatus };
      }
    }
    return { success: false, message: "Order ID not found." };
  } catch (e) {
    return { success: false, message: "Error: " + e.message };
  }
}

// ============================================================
// WRITE-BACK: Job Work
// ============================================================
function saveNewJobWork(jobData) {
  try {
    requirePerm_("write");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Job Work Tracker");
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");
    const jobId = "JOB-" + today + "-" + String(sheet.getLastRow()).padStart(3, "0");
    const settings = getSettings();
    const defaultRate = parseFloat(settings["jobwork.defaultRate"]) || 0.25;
    const sent = parseFloat(jobData.sentQty) || 0;
    const received = parseFloat(jobData.receivedQty) || 0;
    const rate = parseFloat(jobData.ratePerMtr) || defaultRate;
    const payment = parseFloat(jobData.totalPayment) || (received * rate);

    sheet.appendRow([
      jobData.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      jobId, jobData.orderId, jobData.workerName, jobData.itemCode,
      sent, received, parseFloat(jobData.wastageMtr) || 0,
      jobData.status || "Out", payment,
      rate, jobData.expectedReturn || "", jobData.actualReturn || "",
      jobData.qualityGrade || "", jobData.remarks || ""
    ]);
    logAudit_("CREATE", "Job Work", jobId, JSON.stringify(jobData));
    return { success: true, jobId: jobId, message: "Job Work " + jobId + " saved." };
  } catch (e) {
    return { success: false, message: "Error: " + e.message };
  }
}

// ============================================================
// WRITE-BACK: Dispatch
// ============================================================
function saveNewDispatch(dispatchData) {
  try {
    requirePerm_("write");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Dispatch Log");
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");
    const dispId = "DISP-" + today + "-" + String(sheet.getLastRow()).padStart(3, "0");

    sheet.appendRow([
      dispId, dispatchData.orderId, dispatchData.clientName, dispatchData.itemCode,
      parseFloat(dispatchData.dispatchedQty) || 0,
      dispatchData.dispatchDate || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      dispatchData.challanNo || "",
      dispatchData.transporter || "", dispatchData.vehicleNo || "",
      dispatchData.lrNumber || "", dispatchData.invoiceNo || "",
      parseFloat(dispatchData.invoiceAmount) || 0, dispatchData.remarks || ""
    ]);
    if (dispatchData.markCompleted) updateOrderStatus(dispatchData.orderId, "Completed");
    logAudit_("CREATE", "Dispatch", dispId, JSON.stringify(dispatchData));
    return { success: true, dispId: dispId, message: "Dispatch " + dispId + " logged." };
  } catch (e) {
    return { success: false, message: "Error: " + e.message };
  }
}

// ============================================================
// WRITE-BACK: Purchase Orders (new in V7)
// ============================================================
function saveNewPurchaseOrder(po) {
  try {
    requirePerm_("write");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Purchase Orders");
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");
    const poId = "PO-" + today + "-" + String(sheet.getLastRow()).padStart(3, "0");
    const qty = parseFloat(po.orderedQty) || 0;
    const rate = parseFloat(po.ratePerMtr) || 0;
    const gst = parseFloat(po.gstPct) || 5;
    const total = qty * rate * (1 + gst / 100);

    sheet.appendRow([
      poId, po.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      po.vendorName, po.itemCode, qty, parseFloat(po.receivedQty) || 0,
      rate, gst, total, po.status || "Open",
      po.expectedDelivery || "", po.actualDelivery || "",
      po.invoiceNo || "", po.paymentStatus || "Unpaid", po.remarks || ""
    ]);
    logAudit_("CREATE", "Purchase Orders", poId, JSON.stringify(po));
    return { success: true, poId: poId, message: "PO " + poId + " saved." };
  } catch (e) {
    return { success: false, message: "Error: " + e.message };
  }
}

function receivePurchaseOrder(poId, receivedQty) {
  try {
    requirePerm_("write");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Purchase Orders");
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === poId) {
        const qty = parseFloat(receivedQty) || 0;
        sheet.getRange(i + 1, 6).setValue(qty);
        sheet.getRange(i + 1, 10).setValue(qty >= parseFloat(data[i][4]) ? "Received" : "Partially Received");
        sheet.getRange(i + 1, 12).setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"));

        // Add to Master stock & Stock Ledger
        const itemCode = data[i][3];
        addToStockLedger_(itemCode, qty, 0, "PO_RECEIPT", poId, data[i][2]);
        bumpMasterTotalIn_(itemCode, qty);

        logAudit_("RECEIVE_PO", "Purchase Orders", poId, receivedQty);
        return { success: true, message: "PO " + poId + " marked received." };
      }
    }
    return { success: false, message: "PO not found." };
  } catch (e) {
    return { success: false, message: "Error: " + e.message };
  }
}

function bumpMasterTotalIn_(itemCode, qty) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Master");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === itemCode) {
      const prev = parseFloat(data[i][5]) || 0;
      sheet.getRange(i + 1, 6).setValue(prev + qty);
      return;
    }
  }
}

function addToStockLedger_(itemCode, qtyIn, qtyOut, txnType, refId, party) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Stock Ledger");
  if (!sheet) return;
  const balance = computeRunningBalance_(itemCode) + (qtyIn || 0) - (qtyOut || 0);
  const txnId = "TXN-" + Date.now();
  sheet.appendRow([txnId, new Date(), itemCode, txnType, refId, qtyIn || 0, qtyOut || 0, balance, party || "", ""]);
}

function computeRunningBalance_(itemCode) {
  const ledger = readSheetObjects_("Stock Ledger").filter(t => t.ItemCode === itemCode);
  return ledger.reduce((s, t) => s + (parseFloat(t.QtyIn) || 0) - (parseFloat(t.QtyOut) || 0), 0);
}

// ============================================================
// WRITE-BACK: Vendors / Clients / Workers (CRUD lite)
// ============================================================
function upsertParty(table, payload) {
  requirePerm_("write");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(table);
  if (!sheet) throw new Error("Sheet not found: " + table);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const keyCol = headers.indexOf(table === "Vendors" ? "VendorName" : table === "Clients" ? "ClientName" : "WorkerName");
  const idCol = 0;
  const idPrefix = table === "Vendors" ? "VEN-" : table === "Clients" ? "CLT-" : "WRK-";

  for (let i = 1; i < data.length; i++) {
    if (data[i][keyCol] === payload[Object.keys(payload).find(k => k.toLowerCase().includes("name"))]) {
      const row = headers.map(h => payload[h] !== undefined ? payload[h] : data[i][headers.indexOf(h)]);
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
      logAudit_("UPDATE", table, data[i][idCol], JSON.stringify(payload));
      return { success: true, message: table + " updated." };
    }
  }
  const newId = idPrefix + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmmss");
  const row = headers.map(h => h === headers[0] ? newId : (payload[h] !== undefined ? payload[h] : ""));
  sheet.appendRow(row);
  logAudit_("CREATE", table, newId, JSON.stringify(payload));
  return { success: true, message: table + " added." };
}

function saveVendor(payload) { return upsertParty("Vendors", payload); }
function saveClient(payload) { return upsertParty("Clients", payload); }
function saveWorker(payload) { return upsertParty("Workers", payload); }

// ============================================================
// WRITE-BACK: Payments
// ============================================================
function recordPayment(payload) {
  try {
    requirePerm_("payments");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Payments");
    const paymentId = "PAY-" + Date.now();
    sheet.appendRow([
      paymentId, payload.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      payload.type || "Received",     // Received | Paid
      payload.partyType || "Client",  // Client | Vendor | Worker
      payload.partyName, payload.refId || "",
      parseFloat(payload.amount) || 0,
      payload.mode || "Bank Transfer",
      payload.txnReference || "", payload.notes || ""
    ]);
    logAudit_("CREATE", "Payments", paymentId, JSON.stringify(payload));
    return { success: true, message: "Payment " + paymentId + " recorded." };
  } catch (e) {
    return { success: false, message: "Error: " + e.message };
  }
}

// ============================================================
// STOCK ALERTS (notification feed)
// ============================================================
function getStockAlerts() {
  const master = readSheetObjects_("Master");
  const alerts = [];
  master.forEach(item => {
    const balance = parseFloat(item.ClosingBalance) || 0;
    const allocated = parseFloat(item.AllocatedtoOrders) || 0;
    if (item.ReorderStatus === "REORDER (LOW)") {
      alerts.push({ type: "critical", itemCode: item.ItemCode, itemName: item.ItemName, balance: balance, message: "CRITICAL: Stock below reorder level." });
    } else if (balance > 0 && allocated > balance * 0.8) {
      alerts.push({ type: "warning", itemCode: item.ItemCode, itemName: item.ItemName, balance: balance, message: "WARNING: Over 80% of stock allocated." });
    }
  });
  return alerts;
}

// ============================================================
// EXPORT — CSV bundle of all sheets for backup
// ============================================================
function exportAllSheetsCsvZip() {
  requirePerm_("read");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const blobs = ss.getSheets().map(sheet => {
    const data = sheet.getDataRange().getValues()
      .map(row => row.map(c => {
        const s = String(c == null ? "" : c).replace(/"/g, '""');
        return /[",\n]/.test(s) ? '"' + s + '"' : s;
      }).join(","))
      .join("\n");
    return Utilities.newBlob(data, "text/csv", sheet.getName() + ".csv");
  });
  const zip = Utilities.zip(blobs, "IMS-Backup-" +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmm") + ".zip");
  const file = getOrCreateFolder_("IMS Backups").createFile(zip);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  logAudit_("EXPORT_BACKUP", "System", file.getName(), "");
  return { ok: true, url: file.getUrl() };
}

// ============================================================
// Light wrapper to surface server errors as friendly toasts
// ============================================================
function safeCall(name, args) {
  try { return this[name].apply(this, args || []); }
  catch (e) { return { success: false, message: e.message }; }
}
