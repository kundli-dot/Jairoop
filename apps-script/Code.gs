/**
 * Jai Roop Textiles - IMS System (Advanced)
 * Google Apps Script backend for Sheet + Web App dashboard.
 */

var IMS_CONFIG = {
  SHEETS: {
    MASTER: 'Master',
    ORDER_BOOK: 'Order Book',
    JOB_WORK: 'Job Work Tracker',
    DISPATCH: 'Dispatch Log',
    PURCHASE: 'Purchase Log',
    ACTIVITY: 'Activity Log',
    SETTINGS: 'Settings'
  },
  STATUS: {
    PENDING: 'Pending',
    IN_PRODUCTION: 'In Production',
    COMPLETED: 'Completed',
    OUT: 'Out'
  }
};

function doGet() {
  initializeIMS();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('IMS Dashboard - Jai Roop Textiles')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function onEdit(e) {
  if (!e || !e.source || !e.range) return;
  var sheet = e.range.getSheet();
  var sheetName = sheet.getName();
  if (sheetName === IMS_CONFIG.SHEETS.ORDER_BOOK || sheetName === IMS_CONFIG.SHEETS.DISPATCH || sheetName === IMS_CONFIG.SHEETS.PURCHASE) {
    // Keep allocations and stock indicators fresh when operational sheets change.
    updateMasterRollups(e.source);
  }
}

function initializeIMS() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  ensureSheet(ss, IMS_CONFIG.SHEETS.PURCHASE, [
    'Purchase ID', 'Date', 'Vendor Name', 'Item Code', 'Purchased Qty',
    'Rate Per Unit', 'Total Amount', 'Invoice No', 'Remarks'
  ]);

  ensureSheet(ss, IMS_CONFIG.SHEETS.ACTIVITY, [
    'Timestamp', 'Event Type', 'Details', 'User'
  ]);

  var settingsSheet = ensureSheet(ss, IMS_CONFIG.SHEETS.SETTINGS, ['Key', 'Value']);
  if (settingsSheet.getLastRow() < 2) {
    settingsSheet.getRange(2, 1, 5, 2).setValues([
      ['LOGO_FILE_ID', ''],
      ['CRITICAL_WASTAGE_PCT', '4'],
      ['AUTO_COMPLETE_ON_DISPATCH', 'false'],
      ['LOW_COVERAGE_DAYS', '15'],
      ['ENABLE_MASTER_AUTO_ROLLUP', 'false']
    ]);
  }
}

function getAllIMSData() {
  initializeIMS();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var master = getSheetObjects(ss, IMS_CONFIG.SHEETS.MASTER);
  var orders = getSheetObjects(ss, IMS_CONFIG.SHEETS.ORDER_BOOK);
  var jobWork = getSheetObjects(ss, IMS_CONFIG.SHEETS.JOB_WORK);
  var dispatch = getSheetObjects(ss, IMS_CONFIG.SHEETS.DISPATCH);
  var purchase = getSheetObjects(ss, IMS_CONFIG.SHEETS.PURCHASE);
  var recentActivity = getRecentActivity(120);
  var settings = getSettingsMap(ss);

  updateMasterRollups(ss, {
    master: master.rows,
    orders: orders.rows,
    dispatch: dispatch.rows,
    purchase: purchase.rows,
    settings: settings
  });

  // Re-read master in case rollup updated values.
  master = getSheetObjects(ss, IMS_CONFIG.SHEETS.MASTER);

  return {
    master: master.rows,
    orders: orders.rows,
    jobWork: jobWork.rows,
    dispatch: dispatch.rows,
    purchase: purchase.rows,
    activity: recentActivity,
    clients: uniqueFromRows(orders.rows, 'ClientName'),
    workers: uniqueFromRows(jobWork.rows, 'WorkerName'),
    kpis: computeKPIs(master.rows, orders.rows, jobWork.rows, dispatch.rows, purchase.rows, settings),
    settings: settings,
    logoUrl: getLogoDataUrl(settings.LOGO_FILE_ID),
    lastSync: formatDateTime(new Date())
  };
}

function saveNewOrder(payload) {
  try {
    initializeIMS();
    var data = payload || {};
    if (!data.clientName || !data.itemCode || !data.qty) {
      return fail_('Client, item and qty are required.');
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var orderSheet = ss.getSheetByName(IMS_CONFIG.SHEETS.ORDER_BOOK);
    var orderId = generateRecordId(orderSheet, 'ORD');

    appendObjectBySheetHeaders(orderSheet, {
      OrderID: orderId,
      Date: safeDate(data.date),
      ClientName: trim_(data.clientName),
      ItemCode: trim_(data.itemCode),
      OrderedQtyMtrKG: toNum_(data.qty),
      Status: data.status || IMS_CONFIG.STATUS.PENDING,
      Remarks: trim_(data.remarks || '')
    });

    updateMasterRollups(ss);
    logActivity_('ORDER_CREATED', orderId + ' | ' + data.clientName + ' | ' + data.itemCode + ' | ' + toNum_(data.qty));
    return ok_('Order ' + orderId + ' saved successfully.', { orderId: orderId });
  } catch (err) {
    return fail_('Order save failed: ' + err.message);
  }
}

function updateOrderStatus(orderId, newStatus) {
  try {
    if (!orderId || !newStatus) return fail_('Order ID and status are required.');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var orderSheet = ss.getSheetByName(IMS_CONFIG.SHEETS.ORDER_BOOK);
    if (!orderSheet) return fail_('Order Book sheet not found.');

    var map = getHeaderMap_(orderSheet);
    var idCol = map.OrderID;
    var statusCol = map.Status;
    if (!idCol || !statusCol) return fail_('Order Book must include "Order ID" and "Status".');

    var values = orderSheet.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][idCol - 1]).trim() === String(orderId).trim()) {
        orderSheet.getRange(i + 1, statusCol).setValue(newStatus);
        updateMasterRollups(ss);
        logActivity_('ORDER_STATUS_CHANGED', orderId + ' -> ' + newStatus);
        return ok_('Order ' + orderId + ' updated to ' + newStatus + '.');
      }
    }
    return fail_('Order ID not found: ' + orderId);
  } catch (err) {
    return fail_('Status update failed: ' + err.message);
  }
}

function saveNewJobWork(payload) {
  try {
    initializeIMS();
    var data = payload || {};
    if (!data.workerName || !data.itemCode || !data.sentQty) {
      return fail_('Worker, item and sent qty are required.');
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(IMS_CONFIG.SHEETS.JOB_WORK);
    if (!sheet) return fail_('Job Work Tracker sheet not found.');
    var jobId = generateRecordId(sheet, 'JOB');

    appendObjectBySheetHeaders(sheet, {
      Date: safeDate(data.date),
      JobID: jobId,
      OrderID: trim_(data.orderId || ''),
      WorkerName: trim_(data.workerName),
      ItemCode: trim_(data.itemCode),
      SentQtyMtr: toNum_(data.sentQty),
      ReceivedQtyMtr: toNum_(data.receivedQty),
      WastageMtr: toNum_(data.wastageMtr),
      Status: data.status || IMS_CONFIG.STATUS.OUT,
      TotalPayment: toNum_(data.totalPayment)
    });

    logActivity_('JOBWORK_CREATED', jobId + ' | ' + data.workerName + ' | ' + data.itemCode);
    return ok_('Job Work ' + jobId + ' saved successfully.', { jobId: jobId });
  } catch (err) {
    return fail_('Job Work save failed: ' + err.message);
  }
}

function saveNewDispatch(payload) {
  try {
    initializeIMS();
    var data = payload || {};
    if (!data.orderId || !data.clientName || !data.dispatchedQty) {
      return fail_('Order, client and dispatch qty are required.');
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var dispatchSheet = ss.getSheetByName(IMS_CONFIG.SHEETS.DISPATCH);
    if (!dispatchSheet) return fail_('Dispatch Log sheet not found.');
    var dispatchId = generateRecordId(dispatchSheet, 'DISP');

    appendObjectBySheetHeaders(dispatchSheet, {
      DispatchID: dispatchId,
      OrderID: trim_(data.orderId),
      ClientName: trim_(data.clientName),
      ItemCode: trim_(data.itemCode || ''),
      DispatchedQty: toNum_(data.dispatchedQty),
      DispatchDate: safeDate(data.dispatchDate),
      ChallanNo: trim_(data.challanNo || '')
    });

    var settings = getSettingsMap(ss);
    var autoComplete = String(settings.AUTO_COMPLETE_ON_DISPATCH || '').toLowerCase() === 'true';
    if (data.markCompleted || autoComplete) {
      updateOrderStatus(data.orderId, IMS_CONFIG.STATUS.COMPLETED);
    } else {
      updateMasterRollups(ss);
    }

    logActivity_('DISPATCH_CREATED', dispatchId + ' | ' + data.orderId + ' | ' + toNum_(data.dispatchedQty));
    return ok_('Dispatch ' + dispatchId + ' logged successfully.', { dispatchId: dispatchId });
  } catch (err) {
    return fail_('Dispatch save failed: ' + err.message);
  }
}

function saveNewPurchase(payload) {
  try {
    initializeIMS();
    var data = payload || {};
    if (!data.vendorName || !data.itemCode || !data.purchasedQty) {
      return fail_('Vendor, item and purchased qty are required.');
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(IMS_CONFIG.SHEETS.PURCHASE);
    var purchaseId = generateRecordId(sheet, 'PUR');
    var qty = toNum_(data.purchasedQty);
    var rate = toNum_(data.ratePerUnit);

    appendObjectBySheetHeaders(sheet, {
      PurchaseID: purchaseId,
      Date: safeDate(data.date),
      VendorName: trim_(data.vendorName),
      ItemCode: trim_(data.itemCode),
      PurchasedQty: qty,
      RatePerUnit: rate,
      TotalAmount: qty * rate,
      InvoiceNo: trim_(data.invoiceNo || ''),
      Remarks: trim_(data.remarks || '')
    });

    updateMasterRollups(ss);
    logActivity_('PURCHASE_CREATED', purchaseId + ' | ' + data.vendorName + ' | ' + data.itemCode + ' | ' + qty);
    return ok_('Purchase ' + purchaseId + ' saved successfully.', { purchaseId: purchaseId });
  } catch (err) {
    return fail_('Purchase save failed: ' + err.message);
  }
}

function recalculateMasterStock() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  updateMasterRollups(ss);
  logActivity_('MASTER_RECALCULATED', 'Manual stock rollup executed.');
  return ok_('Master allocations and stock rollups updated.');
}

function getRecentActivity(limit) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(IMS_CONFIG.SHEETS.ACTIVITY);
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];

  var headers = rows.shift().map(sanitizeHeader_);
  var items = rows.map(function(r) {
    var o = {};
    headers.forEach(function(h, i) {
      o[h] = r[i] instanceof Date ? formatDateTime(r[i]) : r[i];
    });
    return o;
  }).filter(function(r) { return r.Timestamp; });

  items.reverse();
  return items.slice(0, limit || 60);
}

function computeKPIs(master, orders, jobWork, dispatch, purchase, settings) {
  var reorderItems = master.filter(function(i) { return i.ReorderStatus === 'REORDER (LOW)'; });
  var activeOrders = orders.filter(function(o) { return o.Status === IMS_CONFIG.STATUS.IN_PRODUCTION; });
  var pendingOrders = orders.filter(function(o) { return o.Status === IMS_CONFIG.STATUS.PENDING; });
  var completedOrders = orders.filter(function(o) { return o.Status === IMS_CONFIG.STATUS.COMPLETED; });
  var liveJobWork = jobWork.filter(function(j) { return j.Status === IMS_CONFIG.STATUS.OUT; });

  var totalDispatched = sumBy_(dispatch, 'DispatchedQty');
  var totalPurchased = sumBy_(purchase, 'PurchasedQty');
  var openOrderQty = orders
    .filter(function(o) { return o.Status !== IMS_CONFIG.STATUS.COMPLETED; })
    .reduce(function(sum, o) { return sum + toNum_(o.OrderedQtyMtrKG); }, 0);

  var wastage = jobWork.reduce(function(acc, j) {
    acc.sent += toNum_(j.SentQtyMtr);
    acc.waste += toNum_(j.WastageMtr);
    return acc;
  }, { sent: 0, waste: 0 });
  var avgWastagePct = wastage.sent > 0 ? round2_(wastage.waste / wastage.sent * 100) : 0;

  var categoryBreakdown = {};
  master.forEach(function(item) {
    var c = item.Category || 'Other';
    if (!categoryBreakdown[c]) categoryBreakdown[c] = { count: 0, totalStock: 0 };
    categoryBreakdown[c].count++;
    categoryBreakdown[c].totalStock += toNum_(item.ClosingBalance);
  });

  var monthlyDispatch = aggregateByMonth_(dispatch, 'DispatchDate', 'DispatchedQty');
  var monthlyPurchase = aggregateByMonth_(purchase, 'Date', 'PurchasedQty');

  var topItems = master
    .map(function(i) {
      return { code: i.ItemCode, balance: toNum_(i.ClosingBalance), alloc: toNum_(i.AllocatedtoOrders) };
    })
    .filter(function(i) { return i.code; })
    .sort(function(a, b) { return b.balance - a.balance; })
    .slice(0, 8);

  var topConsumed = aggregateByKey_(dispatch, 'ItemCode', 'DispatchedQty')
    .slice(0, 8);

  var stockCoverage = computeCoverageDays_(master, dispatch);
  var criticalWastage = toNum_(settings.CRITICAL_WASTAGE_PCT || 4);
  var lowCoverageDays = toNum_(settings.LOW_COVERAGE_DAYS || 15);

  return {
    reorderCount: reorderItems.length,
    reorderItems: reorderItems.map(function(i) { return i.ItemCode; }),
    activeOrderCount: activeOrders.length,
    pendingOrderCount: pendingOrders.length,
    completedOrderCount: completedOrders.length,
    totalOrderCount: orders.length,
    fulfilmentRate: orders.length ? round1_(completedOrders.length * 100 / orders.length) : 0,
    jwLiveCount: liveJobWork.length,
    totalDispatched: round2_(totalDispatched),
    totalPurchased: round2_(totalPurchased),
    openOrderQty: round2_(openOrderQty),
    avgWastagePct: avgWastagePct,
    categoryBreakdown: categoryBreakdown,
    topItems: topItems,
    topConsumed: topConsumed,
    monthlyDispatch: monthlyDispatch,
    monthlyPurchase: monthlyPurchase,
    stockCoverage: stockCoverage,
    lowCoverageItems: stockCoverage.filter(function(i) { return i.coverageDays <= lowCoverageDays; }).slice(0, 20),
    criticalWastageThreshold: criticalWastage
  };
}

function updateMasterRollups(ss, preloaded) {
  var source = preloaded || {};
  var masterRows = source.master || getSheetObjects(ss, IMS_CONFIG.SHEETS.MASTER).rows;
  var orders = source.orders || getSheetObjects(ss, IMS_CONFIG.SHEETS.ORDER_BOOK).rows;
  var dispatch = source.dispatch || getSheetObjects(ss, IMS_CONFIG.SHEETS.DISPATCH).rows;
  var purchase = source.purchase || getSheetObjects(ss, IMS_CONFIG.SHEETS.PURCHASE).rows;
  var settings = source.settings || getSettingsMap(ss);
  var autoRollup = String(settings.ENABLE_MASTER_AUTO_ROLLUP || '').toLowerCase() === 'true';

  var masterSheet = ss.getSheetByName(IMS_CONFIG.SHEETS.MASTER);
  if (!masterSheet || masterRows.length === 0) return;

  var map = getHeaderMap_(masterSheet);
  var colItem = map.ItemCode;
  if (!colItem) return;

  var allocMap = {};
  orders.forEach(function(o) {
    if (o.Status === IMS_CONFIG.STATUS.PENDING || o.Status === IMS_CONFIG.STATUS.IN_PRODUCTION) {
      allocMap[o.ItemCode] = (allocMap[o.ItemCode] || 0) + toNum_(o.OrderedQtyMtrKG);
    }
  });

  var purchaseMap = indexSum_(purchase, 'ItemCode', 'PurchasedQty');
  var dispatchMap = indexSum_(dispatch, 'ItemCode', 'DispatchedQty');

  var rowCount = masterRows.length;
  var allocVals = [];
  var inVals = [];
  var outVals = [];
  var closeVals = [];
  var statusVals = [];

  for (var i = 0; i < rowCount; i++) {
    var m = masterRows[i];
    var itemCode = m.ItemCode;
    var opening = toNum_(m.OpeningStock);
    var inQty = autoRollup ? toNum_(purchaseMap[itemCode]) : toNum_(m.TotalInMtrKG);
    var outQty = autoRollup ? toNum_(dispatchMap[itemCode]) : toNum_(m.TotalOutMtrKG);
    var allocated = toNum_(allocMap[itemCode]);
    var closing = autoRollup ? (opening + inQty - outQty) : toNum_(m.ClosingBalance);
    if (!isFinite(closing)) closing = toNum_(m.ClosingBalance);

    var reorderLevel = firstNonZero_([
      m.ReorderLevel, m.MinimumStock, m.MinStock, m.SafetyStock
    ]);
    var status = m.ReorderStatus || 'NORMAL';
    if (reorderLevel > 0) {
      if (closing <= reorderLevel) status = 'REORDER (LOW)';
      else if (closing > reorderLevel * 2) status = 'ABOVE LEVEL';
      else status = 'NORMAL';
    } else {
      if (closing <= 0) status = 'REORDER (LOW)';
      else if (opening > 0 && closing >= opening * 1.2) status = 'ABOVE LEVEL';
      else status = 'NORMAL';
    }

    allocVals.push([round2_(allocated)]);
    inVals.push([round2_(inQty)]);
    outVals.push([round2_(outQty)]);
    closeVals.push([round2_(closing)]);
    statusVals.push([status]);
  }

  var startRow = 2;
  if (map.AllocatedtoOrders) {
    masterSheet.getRange(startRow, map.AllocatedtoOrders, rowCount, 1).setValues(allocVals);
  }
  if (autoRollup && map.TotalInMtrKG) {
    masterSheet.getRange(startRow, map.TotalInMtrKG, rowCount, 1).setValues(inVals);
  }
  if (autoRollup && map.TotalOutMtrKG) {
    masterSheet.getRange(startRow, map.TotalOutMtrKG, rowCount, 1).setValues(outVals);
  }
  if (autoRollup && map.ClosingBalance) {
    masterSheet.getRange(startRow, map.ClosingBalance, rowCount, 1).setValues(closeVals);
  }
  if (map.ReorderStatus) {
    masterSheet.getRange(startRow, map.ReorderStatus, rowCount, 1).setValues(statusVals);
  }
}

// ---------- Helpers ----------

function getSettingsMap(ss) {
  var sheet = ss.getSheetByName(IMS_CONFIG.SHEETS.SETTINGS);
  if (!sheet || sheet.getLastRow() < 2) return {};
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  var map = {};
  rows.forEach(function(r) {
    if (r[0]) map[String(r[0]).trim()] = r[1];
  });
  return map;
}

function getLogoDataUrl(fileId) {
  if (!fileId) return '';
  try {
    var blob = DriveApp.getFileById(fileId).getBlob();
    return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (err) {
    return '';
  }
}

function getSheetObjects(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { headers: [], rows: [] };
  var values = sheet.getDataRange().getValues();
  if (values.length < 1) return { headers: [], rows: [] };
  var headers = values[0].map(sanitizeHeader_);
  var rows = values.slice(1).map(function(row) {
    var obj = {};
    var hasData = false;
    headers.forEach(function(h, i) {
      var val = row[i];
      if (val !== '' && val !== null && val !== undefined) hasData = true;
      obj[h] = val instanceof Date ? Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd') : val;
    });
    return hasData ? obj : null;
  }).filter(Boolean);
  return { headers: headers, rows: rows };
}

function ensureSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() < 1 && headers && headers.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function appendObjectBySheetHeaders(sheet, dataObj) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (!headers.length || !headers[0]) throw new Error('Missing headers in sheet ' + sheet.getName());
  var row = headers.map(function(h) {
    var k = sanitizeHeader_(h);
    return dataObj[k] !== undefined ? dataObj[k] : '';
  });
  sheet.appendRow(row);
}

function getHeaderMap_(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  headers.forEach(function(h, i) {
    map[sanitizeHeader_(h)] = i + 1;
  });
  return map;
}

function generateRecordId(sheet, prefix) {
  var datePart = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  var rowNum = Math.max(sheet.getLastRow(), 1);
  return prefix + '-' + datePart + '-' + String(rowNum).padStart(3, '0');
}

function logActivity_(eventType, details) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ensureSheet(ss, IMS_CONFIG.SHEETS.ACTIVITY, ['Timestamp', 'Event Type', 'Details', 'User']);
  var user = '';
  try { user = Session.getActiveUser().getEmail(); } catch (e) { user = 'unknown'; }
  sheet.appendRow([new Date(), eventType, details, user]);
}

function sanitizeHeader_(header) {
  return String(header || '').replace(/[^a-zA-Z0-9]/g, '');
}

function uniqueFromRows(rows, key) {
  var map = {};
  rows.forEach(function(r) {
    if (r[key]) map[r[key]] = true;
  });
  return Object.keys(map).sort();
}

function safeDate(val) {
  if (!val) return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (Object.prototype.toString.call(val) === '[object Date]') {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(val).substring(0, 10);
}

function toNum_(value) {
  var n = parseFloat(value);
  return isNaN(n) ? 0 : n;
}

function trim_(value) {
  return String(value || '').trim();
}

function round1_(n) { return Math.round(toNum_(n) * 10) / 10; }
function round2_(n) { return Math.round(toNum_(n) * 100) / 100; }

function sumBy_(rows, key) {
  return rows.reduce(function(sum, row) { return sum + toNum_(row[key]); }, 0);
}

function indexSum_(rows, keyField, valueField) {
  var out = {};
  rows.forEach(function(r) {
    var key = r[keyField];
    if (!key) return;
    out[key] = (out[key] || 0) + toNum_(r[valueField]);
  });
  return out;
}

function aggregateByMonth_(rows, dateField, valueField) {
  var out = {};
  rows.forEach(function(r) {
    if (!r[dateField]) return;
    var month = String(r[dateField]).substring(0, 7);
    out[month] = (out[month] || 0) + toNum_(r[valueField]);
  });
  return out;
}

function aggregateByKey_(rows, keyField, valueField) {
  var tmp = {};
  rows.forEach(function(r) {
    var key = r[keyField];
    if (!key) return;
    tmp[key] = (tmp[key] || 0) + toNum_(r[valueField]);
  });
  return Object.keys(tmp).map(function(k) {
    return { key: k, value: round2_(tmp[k]) };
  }).sort(function(a, b) { return b.value - a.value; });
}

function computeCoverageDays_(master, dispatch) {
  var today = new Date();
  var sixtyDaysAgo = new Date(today.getTime() - (60 * 24 * 60 * 60 * 1000));
  var itemUsage = {};

  dispatch.forEach(function(d) {
    var item = d.ItemCode;
    if (!item || !d.DispatchDate) return;
    var dt = new Date(d.DispatchDate);
    if (isNaN(dt.getTime()) || dt < sixtyDaysAgo) return;
    itemUsage[item] = (itemUsage[item] || 0) + toNum_(d.DispatchedQty);
  });

  var result = master.map(function(m) {
    var item = m.ItemCode;
    var closing = toNum_(m.ClosingBalance);
    var avgDaily = (itemUsage[item] || 0) / 60;
    var days = avgDaily > 0 ? closing / avgDaily : 9999;
    return {
      itemCode: item,
      closingBalance: round2_(closing),
      avgDailyDispatch: round2_(avgDaily),
      coverageDays: avgDaily > 0 ? round1_(days) : 9999
    };
  }).filter(function(x) { return x.itemCode; });

  result.sort(function(a, b) { return a.coverageDays - b.coverageDays; });
  return result;
}

function firstNonZero_(arr) {
  for (var i = 0; i < arr.length; i++) {
    var n = toNum_(arr[i]);
    if (n > 0) return n;
  }
  return 0;
}

function formatDateTime(d) {
  return Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), 'dd MMM yyyy, hh:mm a');
}

function ok_(message, extra) {
  var out = { success: true, message: message };
  if (extra) {
    Object.keys(extra).forEach(function(k) { out[k] = extra[k]; });
  }
  return out;
}

function fail_(message) {
  return { success: false, message: message };
}

