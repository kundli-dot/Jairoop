/**
 * IMS V7 - Textile Inventory Management System
 * Google Apps Script backend for a spreadsheet-bound web app.
 */

var SHEETS = {
  MASTER: "Master",
  ORDER_BOOK: "Order Book",
  JOB_WORK: "Job Work Tracker",
  DISPATCH: "Dispatch Log",
  AUDIT: "Audit Log",
  SETTINGS: "Settings"
};

var DEFAULT_SETTINGS = {
  WRITE_MODE: "OPEN",
  WRITE_ALLOWLIST: "",
  ADMIN_ALLOWLIST: "",
  PAYMENT_RATE_PER_MTR: "0.25",
  WASTAGE_ALERT_PCT: "4",
  DEFAULT_LEAD_TIME_DAYS: "7"
};

function doGet() {
  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("IMS V7 - Textile Control Tower")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function onOpen() {
  ensureCoreSheets_();
}

function onEdit(e) {
  if (!e || !e.source || !e.range) return;
  var sheet = e.source.getActiveSheet();
  if (!sheet || sheet.getName() !== SHEETS.ORDER_BOOK) return;

  var headerMap = getHeaderMap_(sheet);
  var statusCol = headerMap.status;
  if (statusCol && e.range.getColumn() === statusCol && e.range.getRow() > 1) {
    updateMasterAllocatedAndStock(e.source);
  }
}

function getAllIMSData() {
  ensureCoreSheets_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var settings = getSettingsMap_();
  var master = mapMaster_(getSheetObjects_(ss, SHEETS.MASTER));
  var orders = mapOrders_(getSheetObjects_(ss, SHEETS.ORDER_BOOK));
  var jobWork = mapJobWork_(getSheetObjects_(ss, SHEETS.JOB_WORK));
  var dispatch = mapDispatch_(getSheetObjects_(ss, SHEETS.DISPATCH));

  var kpis = computeKPIs_(master, orders, jobWork, dispatch);
  var alerts = computeAlerts_(master);
  var procurementPlan = computeProcurementPlan_(master, orders, settings);
  var workerScores = computeWorkerScores_(jobWork, settings);
  var recentActivity = getRecentActivity_(20);

  var clients = uniqueSorted_(orders.map(function (o) { return o.clientName; }));
  var workers = uniqueSorted_(jobWork.map(function (j) { return j.workerName; }));
  var itemCodes = uniqueSorted_(master.map(function (m) { return m.itemCode; }));

  return {
    master: master,
    orders: orders,
    jobWork: jobWork,
    dispatch: dispatch,
    clients: clients,
    workers: workers,
    itemCodes: itemCodes,
    kpis: kpis,
    alerts: alerts,
    procurementPlan: procurementPlan,
    workerScores: workerScores,
    recentActivity: recentActivity,
    settings: settings,
    currentUser: getCurrentUserEmail_(),
    lastSync: formatDateTime_(new Date())
  };
}

function saveNewOrder(orderData) {
  try {
    assertUserCanWrite_();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var orderId = nextId_("ORD");
    var now = new Date();
    var row = {
      OrderID: orderId,
      Date: orderData.date || formatDate_(now),
      ClientName: safeString_(orderData.clientName),
      ItemCode: safeString_(orderData.itemCode),
      OrderedQtyMtrKG: toNumber_(orderData.qty),
      Status: safeString_(orderData.status || "Pending"),
      DueDate: safeString_(orderData.dueDate),
      Priority: safeString_(orderData.priority || "Medium"),
      Remarks: safeString_(orderData.remarks)
    };

    appendObjectRow_(ss, SHEETS.ORDER_BOOK, row);
    updateMasterAllocatedAndStock(ss);
    logAudit_("CREATE_ORDER", orderId, row);
    return { success: true, orderId: orderId, message: "Order " + orderId + " saved." };
  } catch (err) {
    return { success: false, message: "Error: " + err.message };
  }
}

function updateOrderStatus(orderId, newStatus) {
  try {
    assertUserCanWrite_();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.ORDER_BOOK);
    if (!sheet) throw new Error("Order Book sheet not found.");

    var headerMap = getHeaderMap_(sheet);
    var orderIdCol = headerMap.orderid;
    var statusCol = headerMap.status;
    if (!orderIdCol || !statusCol) throw new Error("Order Book headers missing OrderID/Status.");

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) throw new Error("No orders found.");
    var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

    var targetRow = -1;
    for (var i = 0; i < data.length; i++) {
      if (safeString_(data[i][orderIdCol - 1]) === orderId) {
        targetRow = i + 2;
        break;
      }
    }

    if (targetRow === -1) return { success: false, message: "Order ID not found." };
    sheet.getRange(targetRow, statusCol).setValue(newStatus);
    updateMasterAllocatedAndStock(ss);
    logAudit_("UPDATE_ORDER_STATUS", orderId, { status: newStatus });
    return { success: true, message: "Order " + orderId + " -> " + newStatus };
  } catch (err) {
    return { success: false, message: "Error: " + err.message };
  }
}

function saveNewJobWork(jobData) {
  try {
    assertUserCanWrite_();
    var settings = getSettingsMap_();
    var rate = toNumber_(settings.PAYMENT_RATE_PER_MTR || "0.25");
    var receivedQty = toNumber_(jobData.receivedQty);
    var providedPayment = toNumber_(jobData.totalPayment);
    var payment = providedPayment > 0 ? providedPayment : round2_(receivedQty * rate);
    var jobId = nextId_("JOB");

    var row = {
      Date: jobData.date || formatDate_(new Date()),
      JobID: jobId,
      OrderID: safeString_(jobData.orderId),
      WorkerName: safeString_(jobData.workerName),
      ItemCode: safeString_(jobData.itemCode),
      SentQtyMtr: toNumber_(jobData.sentQty),
      ReceivedQtyMtr: receivedQty,
      WastageMtr: toNumber_(jobData.wastageMtr),
      Status: safeString_(jobData.status || "Out"),
      RatePerMtr: rate,
      TotalPayment: payment
    };

    appendObjectRow_(SpreadsheetApp.getActiveSpreadsheet(), SHEETS.JOB_WORK, row);
    logAudit_("CREATE_JOB_WORK", jobId, row);
    return { success: true, jobId: jobId, message: "Job work " + jobId + " saved." };
  } catch (err) {
    return { success: false, message: "Error: " + err.message };
  }
}

function saveNewDispatch(dispatchData) {
  try {
    assertUserCanWrite_();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var dispatchId = nextId_("DISP");
    var row = {
      DispatchID: dispatchId,
      OrderID: safeString_(dispatchData.orderId),
      ClientName: safeString_(dispatchData.clientName),
      ItemCode: safeString_(dispatchData.itemCode),
      DispatchedQty: toNumber_(dispatchData.dispatchedQty),
      DispatchDate: dispatchData.dispatchDate || formatDate_(new Date()),
      ChallanNo: safeString_(dispatchData.challanNo),
      VehicleNo: safeString_(dispatchData.vehicleNo)
    };

    appendObjectRow_(ss, SHEETS.DISPATCH, row);
    if (dispatchData.markCompleted) {
      updateOrderStatus(dispatchData.orderId, "Completed");
    } else {
      updateMasterAllocatedAndStock(ss);
    }
    logAudit_("CREATE_DISPATCH", dispatchId, row);
    return { success: true, dispatchId: dispatchId, message: "Dispatch " + dispatchId + " logged." };
  } catch (err) {
    return { success: false, message: "Error: " + err.message };
  }
}

function upsertSetting(key, value) {
  try {
    assertAdmin_();
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SETTINGS);
    if (!sheet) throw new Error("Settings sheet not found.");

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      sheet.appendRow([key, value, new Date()]);
      logAudit_("UPSERT_SETTING", key, { value: value });
      return { success: true, message: "Setting updated." };
    }

    var range = sheet.getRange(2, 1, lastRow - 1, 3);
    var values = range.getValues();
    var found = false;

    for (var i = 0; i < values.length; i++) {
      if (safeString_(values[i][0]) === key) {
        sheet.getRange(i + 2, 2).setValue(value);
        sheet.getRange(i + 2, 3).setValue(new Date());
        found = true;
        break;
      }
    }

    if (!found) {
      sheet.appendRow([key, value, new Date()]);
    }
    logAudit_("UPSERT_SETTING", key, { value: value });
    return { success: true, message: "Setting updated." };
  } catch (err) {
    return { success: false, message: "Error: " + err.message };
  }
}

function updateMasterAllocatedAndStock(ss) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  var masterSheet = spreadsheet.getSheetByName(SHEETS.MASTER);
  var orderSheet = spreadsheet.getSheetByName(SHEETS.ORDER_BOOK);
  if (!masterSheet || !orderSheet) return;

  var orderRows = getSheetObjects_(spreadsheet, SHEETS.ORDER_BOOK);
  var activeStatuses = { Pending: true, "In Production": true };
  var allocationByItem = {};

  mapOrders_(orderRows).forEach(function (order) {
    if (!activeStatuses[order.status]) return;
    allocationByItem[order.itemCode] = (allocationByItem[order.itemCode] || 0) + order.qty;
  });

  var masterRows = getSheetObjects_(spreadsheet, SHEETS.MASTER);
  if (!masterRows.length) return;

  var mapped = mapMaster_(masterRows);
  var masterHeaderMap = getHeaderMap_(masterSheet);
  var allocatedCol = masterHeaderMap.allocatedtoorders || masterHeaderMap.allocatedqty;
  var reorderStatusCol = masterHeaderMap.reorderstatus;
  if (!allocatedCol && !reorderStatusCol) return;

  var allocatedValues = [];
  var reorderValues = [];
  mapped.forEach(function (item) {
    var allocated = round2_(allocationByItem[item.itemCode] || 0);
    allocatedValues.push([allocated]);

    var status = item.reorderStatus || "NORMAL";
    if (item.reorderLevel > 0) {
      if (item.closingBalance <= item.reorderLevel) {
        status = "REORDER (LOW)";
      } else if (item.closingBalance > item.reorderLevel * 2) {
        status = "ABOVE LEVEL";
      } else {
        status = "NORMAL";
      }
    }
    reorderValues.push([status]);
  });

  if (allocatedCol) {
    masterSheet.getRange(2, allocatedCol, allocatedValues.length, 1).setValues(allocatedValues);
  }
  if (reorderStatusCol) {
    masterSheet.getRange(2, reorderStatusCol, reorderValues.length, 1).setValues(reorderValues);
  }
}

function syncSystemHealth() {
  try {
    assertUserCanWrite_();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    updateMasterAllocatedAndStock(ss);
    logAudit_("SYNC_HEALTH", "SYSTEM", {});
    return { success: true, message: "Master allocation and stock health refreshed." };
  } catch (err) {
    return { success: false, message: "Error: " + err.message };
  }
}

function getRecentActivity(limit) {
  return getRecentActivity_(limit || 20);
}

// ------------------------------
// Analytics
// ------------------------------

function computeKPIs_(master, orders, jobWork, dispatch) {
  var reorderCount = master.filter(function (m) { return m.reorderStatus === "REORDER (LOW)"; }).length;
  var activeOrderCount = orders.filter(function (o) { return o.status === "In Production"; }).length;
  var pendingOrderCount = orders.filter(function (o) { return o.status === "Pending"; }).length;
  var completedOrderCount = orders.filter(function (o) { return o.status === "Completed"; }).length;
  var totalOrderCount = orders.length;
  var totalInventory = sum_(master.map(function (m) { return m.closingBalance; }));
  var totalDispatched = sum_(dispatch.map(function (d) { return d.dispatchedQty; }));
  var liveJobCount = jobWork.filter(function (j) { return j.status === "Out"; }).length;
  var fulfilmentRate = totalOrderCount ? round2_(completedOrderCount * 100 / totalOrderCount) : 0;

  var lateOrders = orders.filter(function (o) {
    if (!o.dueDate || o.status === "Completed") return false;
    return toDate_(o.dueDate) < startOfDay_(new Date());
  }).length;

  var jobTotals = jobWork.reduce(function (acc, j) {
    acc.sent += j.sentQty;
    acc.wastage += j.wastageMtr;
    return acc;
  }, { sent: 0, wastage: 0 });
  var avgWastagePct = jobTotals.sent > 0 ? round2_(jobTotals.wastage * 100 / jobTotals.sent) : 0;

  var monthlyDispatch = {};
  dispatch.forEach(function (d) {
    if (!d.dispatchDate) return;
    var month = safeString_(d.dispatchDate).slice(0, 7);
    if (!month) return;
    monthlyDispatch[month] = (monthlyDispatch[month] || 0) + d.dispatchedQty;
  });

  var categoryBreakdown = {};
  master.forEach(function (m) {
    var category = m.category || "Other";
    if (!categoryBreakdown[category]) {
      categoryBreakdown[category] = { itemCount: 0, totalStock: 0 };
    }
    categoryBreakdown[category].itemCount += 1;
    categoryBreakdown[category].totalStock += m.closingBalance;
  });

  var statusSplit = {
    Completed: completedOrderCount,
    "In Production": activeOrderCount,
    Pending: pendingOrderCount
  };

  return {
    reorderCount: reorderCount,
    activeOrderCount: activeOrderCount,
    pendingOrderCount: pendingOrderCount,
    completedOrderCount: completedOrderCount,
    totalOrderCount: totalOrderCount,
    fulfilmentRate: fulfilmentRate,
    lateOrders: lateOrders,
    totalInventory: round2_(totalInventory),
    totalDispatched: round2_(totalDispatched),
    liveJobCount: liveJobCount,
    avgWastagePct: avgWastagePct,
    monthlyDispatch: monthlyDispatch,
    categoryBreakdown: categoryBreakdown,
    statusSplit: statusSplit
  };
}

function computeAlerts_(master) {
  var alerts = [];
  master.forEach(function (m) {
    if (m.reorderStatus === "REORDER (LOW)") {
      alerts.push({
        severity: "critical",
        itemCode: m.itemCode,
        itemName: m.itemName,
        message: "Stock below reorder level.",
        closingBalance: m.closingBalance,
        reorderLevel: m.reorderLevel
      });
      return;
    }
    if (m.closingBalance > 0 && m.allocatedQty / m.closingBalance >= 0.8) {
      alerts.push({
        severity: "warning",
        itemCode: m.itemCode,
        itemName: m.itemName,
        message: "More than 80% stock allocated to active orders.",
        closingBalance: m.closingBalance,
        allocatedQty: m.allocatedQty
      });
    }
  });
  return alerts;
}

function computeProcurementPlan_(master, orders, settings) {
  var leadDefault = toNumber_(settings.DEFAULT_LEAD_TIME_DAYS || "7");
  var openDemandByItem = {};

  orders.forEach(function (o) {
    if (o.status === "Completed") return;
    openDemandByItem[o.itemCode] = (openDemandByItem[o.itemCode] || 0) + o.qty;
  });

  return master
    .map(function (m) {
      var openDemand = openDemandByItem[m.itemCode] || 0;
      var netFree = m.closingBalance - m.allocatedQty;
      var reorderBase = m.reorderLevel || 0;
      var targetLevel = Math.max(reorderBase, openDemand * 1.1);
      var recommendedQty = Math.max(0, targetLevel - netFree);
      var leadDays = m.leadTimeDays > 0 ? m.leadTimeDays : leadDefault;

      return {
        itemCode: m.itemCode,
        itemName: m.itemName,
        vendor: m.preferredVendor,
        closingBalance: round2_(m.closingBalance),
        allocatedQty: round2_(m.allocatedQty),
        openDemand: round2_(openDemand),
        reorderLevel: round2_(reorderBase),
        netFree: round2_(netFree),
        recommendedQty: round2_(recommendedQty),
        leadTimeDays: leadDays,
        actionByDate: recommendedQty > 0 ? formatDate_(addDays_(new Date(), Math.max(0, leadDays * -1))) : ""
      };
    })
    .filter(function (p) { return p.recommendedQty > 0; })
    .sort(function (a, b) { return b.recommendedQty - a.recommendedQty; });
}

function computeWorkerScores_(jobWork, settings) {
  var wastageThreshold = toNumber_(settings.WASTAGE_ALERT_PCT || "4");
  var stats = {};
  jobWork.forEach(function (j) {
    var key = j.workerName || "Unknown";
    if (!stats[key]) {
      stats[key] = {
        workerName: key,
        jobs: 0,
        sentQty: 0,
        receivedQty: 0,
        wastageQty: 0,
        payment: 0
      };
    }
    stats[key].jobs += 1;
    stats[key].sentQty += j.sentQty;
    stats[key].receivedQty += j.receivedQty;
    stats[key].wastageQty += j.wastageMtr;
    stats[key].payment += j.totalPayment;
  });

  return Object.keys(stats).map(function (key) {
    var s = stats[key];
    var recoveryPct = s.sentQty > 0 ? (s.receivedQty * 100 / s.sentQty) : 0;
    var wastagePct = s.sentQty > 0 ? (s.wastageQty * 100 / s.sentQty) : 0;
    var efficiencyScore = Math.max(0, Math.min(100, round2_(recoveryPct - Math.max(0, wastagePct - wastageThreshold) * 1.8)));
    return {
      workerName: s.workerName,
      jobs: s.jobs,
      sentQty: round2_(s.sentQty),
      receivedQty: round2_(s.receivedQty),
      wastageQty: round2_(s.wastageQty),
      wastagePct: round2_(wastagePct),
      recoveryPct: round2_(recoveryPct),
      payment: round2_(s.payment),
      efficiencyScore: efficiencyScore
    };
  }).sort(function (a, b) { return b.efficiencyScore - a.efficiencyScore; });
}

// ------------------------------
// Sheet models
// ------------------------------

function mapMaster_(rows) {
  return rows.map(function (r) {
    return {
      itemCode: pickAny_(r, ["ItemCode", "Code", "SKU"]),
      itemName: pickAny_(r, ["ItemName", "Description", "ItemDescription"]),
      category: pickAny_(r, ["Category", "Group"]),
      weightMtr: toNumber_(pickAny_(r, ["WeightMtr", "Weight", "GSM"])),
      openingStock: toNumber_(pickAny_(r, ["OpeningStock"])),
      totalIn: toNumber_(pickAny_(r, ["TotalInMtrKG", "TotalIn", "Inward"])),
      totalOut: toNumber_(pickAny_(r, ["TotalOutMtrKG", "TotalOut", "Outward"])),
      allocatedQty: toNumber_(pickAny_(r, ["AllocatedtoOrders", "AllocatedQty"])),
      closingBalance: toNumber_(pickAny_(r, ["ClosingBalance", "Stock", "CurrentStock"])),
      reorderStatus: safeString_(pickAny_(r, ["ReorderStatus", "StockStatus"])) || "NORMAL",
      reorderLevel: toNumber_(pickAny_(r, ["ReorderLevel", "MinimumLevel", "MinStock"])),
      leadTimeDays: toNumber_(pickAny_(r, ["LeadTimeDays", "LeadDays"])),
      preferredVendor: pickAny_(r, ["PreferredVendor", "Supplier", "Vendor"]),
      _raw: r
    };
  }).filter(function (item) { return item.itemCode; });
}

function mapOrders_(rows) {
  return rows.map(function (r) {
    return {
      orderId: pickAny_(r, ["OrderID", "OrderNo", "ID"]),
      date: normalizeDateValue_(pickAny_(r, ["Date", "OrderDate"])),
      clientName: pickAny_(r, ["ClientName", "Client"]),
      itemCode: pickAny_(r, ["ItemCode", "SKU", "Code"]),
      qty: toNumber_(pickAny_(r, ["OrderedQtyMtrKG", "Qty", "Quantity"])),
      status: safeString_(pickAny_(r, ["Status"])) || "Pending",
      dueDate: normalizeDateValue_(pickAny_(r, ["DueDate", "CommittedDate"])),
      priority: safeString_(pickAny_(r, ["Priority"])) || "Medium",
      remarks: safeString_(pickAny_(r, ["Remarks", "Notes"])),
      _raw: r
    };
  }).filter(function (order) { return order.orderId; });
}

function mapJobWork_(rows) {
  return rows.map(function (r) {
    return {
      date: normalizeDateValue_(pickAny_(r, ["Date"])),
      jobId: pickAny_(r, ["JobID", "JobNo"]),
      orderId: pickAny_(r, ["OrderID"]),
      workerName: pickAny_(r, ["WorkerName", "Worker", "Vendor"]),
      itemCode: pickAny_(r, ["ItemCode", "SKU"]),
      sentQty: toNumber_(pickAny_(r, ["SentQtyMtr", "SentQty"])),
      receivedQty: toNumber_(pickAny_(r, ["ReceivedQtyMtr", "ReceivedQty"])),
      wastageMtr: toNumber_(pickAny_(r, ["WastageMtr", "Wastage"])),
      status: safeString_(pickAny_(r, ["Status"])) || "Out",
      ratePerMtr: toNumber_(pickAny_(r, ["RatePerMtr", "Rate"])),
      totalPayment: toNumber_(pickAny_(r, ["TotalPayment", "Payment"])),
      _raw: r
    };
  }).filter(function (job) { return job.jobId || job.workerName; });
}

function mapDispatch_(rows) {
  return rows.map(function (r) {
    return {
      dispatchId: pickAny_(r, ["DispatchID", "DispatchNo"]),
      orderId: pickAny_(r, ["OrderID"]),
      clientName: pickAny_(r, ["ClientName", "Client"]),
      itemCode: pickAny_(r, ["ItemCode", "SKU"]),
      dispatchedQty: toNumber_(pickAny_(r, ["DispatchedQty", "Qty"])),
      dispatchDate: normalizeDateValue_(pickAny_(r, ["DispatchDate", "Date"])),
      challanNo: pickAny_(r, ["ChallanNo", "Challan", "DCNo"]),
      vehicleNo: pickAny_(r, ["VehicleNo", "Vehicle"]),
      _raw: r
    };
  }).filter(function (d) { return d.dispatchId || d.orderId; });
}

// ------------------------------
// Security + settings
// ------------------------------

function getSettingsMap_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.SETTINGS);
  if (!sheet) return clone_(DEFAULT_SETTINGS);

  var values = sheet.getDataRange().getValues();
  var map = clone_(DEFAULT_SETTINGS);

  for (var i = 1; i < values.length; i++) {
    var key = safeString_(values[i][0]);
    if (!key) continue;
    map[key] = safeString_(values[i][1]);
  }
  return map;
}

function assertUserCanWrite_() {
  var settings = getSettingsMap_();
  var mode = safeString_(settings.WRITE_MODE || "OPEN").toUpperCase();
  if (mode !== "RESTRICTED") return;

  var email = getCurrentUserEmail_();
  var allowlist = splitCsv_(settings.WRITE_ALLOWLIST);
  var admins = splitCsv_(settings.ADMIN_ALLOWLIST);
  if (allowlist.indexOf(email) >= 0 || admins.indexOf(email) >= 0) return;

  throw new Error("Your account is not permitted for write actions.");
}

function assertAdmin_() {
  var settings = getSettingsMap_();
  var email = getCurrentUserEmail_();
  if (!email) throw new Error("Admin verification failed. Email unavailable.");
  var admins = splitCsv_(settings.ADMIN_ALLOWLIST);
  if (admins.indexOf(email) >= 0) return;
  throw new Error("Only admin allowlist users can change settings.");
}

function getCurrentUserEmail_() {
  return safeString_(Session.getActiveUser().getEmail()).toLowerCase();
}

// ------------------------------
// Audit
// ------------------------------

function logAudit_(action, entityId, payload) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.AUDIT);
  if (!sheet) return;
  var row = [
    new Date(),
    getCurrentUserEmail_(),
    action,
    entityId,
    JSON.stringify(payload || {})
  ];
  sheet.appendRow(row);
}

function getRecentActivity_(limit) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.AUDIT);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var rowCount = Math.min(limit || 20, sheet.getLastRow() - 1);
  var startRow = sheet.getLastRow() - rowCount + 1;
  var values = sheet.getRange(startRow, 1, rowCount, 5).getValues();
  return values.reverse().map(function (row) {
    return {
      timestamp: row[0] instanceof Date ? formatDateTime_(row[0]) : safeString_(row[0]),
      user: safeString_(row[1]),
      action: safeString_(row[2]),
      entityId: safeString_(row[3]),
      details: safeString_(row[4])
    };
  });
}

// ------------------------------
// Sheet IO helpers
// ------------------------------

function ensureCoreSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetWithHeaders_(ss, SHEETS.AUDIT, ["Timestamp", "User", "Action", "EntityID", "Details"]);
  ensureSheetWithHeaders_(ss, SHEETS.SETTINGS, ["Key", "Value", "UpdatedAt"]);
  seedDefaultSettings_();
}

function seedDefaultSettings_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SETTINGS);
  if (!sheet) return;
  var existing = getSettingsMap_();
  Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
    if (safeString_(existing[key])) return;
    sheet.appendRow([key, DEFAULT_SETTINGS[key], new Date()]);
  });
}

function ensureSheetWithHeaders_(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function getSheetObjects_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var values = sheet.getDataRange().getValues();
  var headers = values.shift().map(function (h) {
    return normalizeKey_(h);
  });

  return values.map(function (row) {
    var obj = {};
    var hasAny = false;
    headers.forEach(function (header, i) {
      var value = row[i];
      if (value !== "" && value !== null && value !== undefined) hasAny = true;
      obj[header] = value;
    });
    return hasAny ? obj : null;
  }).filter(Boolean);
}

function appendObjectRow_(ss, sheetName, rowObject) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(sheetName + " sheet not found.");

  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) {
    var keys = Object.keys(rowObject);
    sheet.getRange(1, 1, 1, keys.length).setValues([keys]);
    sheet.setFrozenRows(1);
    lastCol = keys.length;
  }

  var headerValues = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var row = headerValues.map(function (header) {
    var key = safeString_(header);
    if (!key) return "";
    var value = rowObject[key];
    if (value === undefined) {
      value = rowObject[denormalizeLookup_(key)] || "";
    }
    return value;
  });

  sheet.appendRow(row);
}

function getHeaderMap_(sheet) {
  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  headerRow.forEach(function (cell, idx) {
    var key = normalizeKey_(cell);
    if (key) map[key] = idx + 1;
  });
  return map;
}

// ------------------------------
// Generic helpers
// ------------------------------

function pickAny_(obj, keys) {
  for (var i = 0; i < keys.length; i++) {
    var k = normalizeKey_(keys[i]);
    if (obj.hasOwnProperty(k)) return obj[k];
  }
  return "";
}

function normalizeDateValue_(value) {
  if (!value) return "";
  if (value instanceof Date) return formatDate_(value);
  var parsed = new Date(value);
  if (isNaN(parsed.getTime())) return safeString_(value);
  return formatDate_(parsed);
}

function normalizeKey_(value) {
  return safeString_(value).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function denormalizeLookup_(headerName) {
  var dict = {
    orderid: "OrderID",
    clientname: "ClientName",
    itemcode: "ItemCode",
    orderedqtymtrkg: "OrderedQtyMtrKG",
    duedate: "DueDate",
    dispatchid: "DispatchID",
    challanno: "ChallanNo",
    vehicleno: "VehicleNo"
  };
  return dict[normalizeKey_(headerName)] || headerName;
}

function toNumber_(value) {
  var num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}

function round2_(num) {
  return Math.round(toNumber_(num) * 100) / 100;
}

function sum_(numbers) {
  return numbers.reduce(function (acc, curr) { return acc + toNumber_(curr); }, 0);
}

function safeString_(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function splitCsv_(value) {
  return safeString_(value)
    .split(",")
    .map(function (s) { return safeString_(s).toLowerCase(); })
    .filter(Boolean);
}

function uniqueSorted_(arr) {
  var map = {};
  arr.forEach(function (value) {
    var key = safeString_(value);
    if (key) map[key] = true;
  });
  return Object.keys(map).sort();
}

function nextId_(prefix) {
  var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmmss");
  var random = Math.floor(Math.random() * 900 + 100);
  return prefix + "-" + ts + "-" + random;
}

function formatDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function formatDateTime_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "dd MMM yyyy, hh:mm a");
}

function addDays_(date, days) {
  var d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function toDate_(value) {
  if (value instanceof Date) return value;
  return new Date(value);
}

function startOfDay_(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function clone_(obj) {
  return JSON.parse(JSON.stringify(obj));
}
