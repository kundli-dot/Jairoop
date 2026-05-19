// ============================================================
// JAI ROOP TEXTILES — IMS System V7
// Google Apps Script Backend
// ============================================================

var CONFIG = {
  logoFileId: '12xaMnlUBwVFr_kdKYuJozypKuLWPyHmH',
  wastageCriticalPct: 4.0,
  paymentPerMtr: 0.25,
  allocationWarningPct: 0.8
};

// ---- AUTO-TRIGGER: Status change in Order Book ----
function onEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.source.getActiveSheet();
  if (sheet.getName() === 'Order Book' && e.range.getColumn() === 6) {
    updateMasterAllocatedAndStock(e.source);
  }
}

// ---- ALLOCATED QTY SYNC: Order Book → Master ----
function updateMasterAllocatedAndStock(ss) {
  var orderSheet = ss.getSheetByName('Order Book');
  var masterSheet = ss.getSheetByName('Master');
  if (!orderSheet || !masterSheet) return;

  var orderData = orderSheet.getDataRange().getValues();
  var masterData = masterSheet.getDataRange().getValues();
  var allocationMap = {};

  for (var i = 1; i < orderData.length; i++) {
    var itemCode = orderData[i][3];
    var qty = parseFloat(orderData[i][4]) || 0;
    var status = orderData[i][5];
    if (status === 'In Production' || status === 'Pending') {
      allocationMap[itemCode] = (allocationMap[itemCode] || 0) + qty;
    }
  }

  for (var j = 1; j < masterData.length; j++) {
    var masterItemCode = masterData[j][0];
    if (masterItemCode) {
      masterSheet.getRange(j + 1, 9).setValue(allocationMap[masterItemCode] || 0);
    }
  }
}

// ============================================================
// WEB APP ENTRY POINT
// ============================================================
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('IMS Dashboard — Jai Roop Textiles')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================================
// MASTER DATA FETCH
// ============================================================
function getAllIMSData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logoBase64 = '';

  try {
    var file = DriveApp.getFileById(CONFIG.logoFileId);
    var blob = file.getBlob();
    logoBase64 = 'data:' + blob.getContentType() + ';base64,' +
      Utilities.base64Encode(blob.getBytes());
  } catch (e) {
    Logger.log('Logo load failed: ' + e.toString());
  }

  var masterRaw = getSheetDataFast(ss, 'Master');
  var ordersRaw = getSheetDataFast(ss, 'Order Book');
  var jobWorkRaw = getSheetDataFast(ss, 'Job Work Tracker');
  var dispatchRaw = getSheetDataFast(ss, 'Dispatch Log');
  var stockMoveRaw = getSheetDataFast(ss, 'Stock Movements');

  var clientSet = {};
  ordersRaw.forEach(function(o) {
    if (o.ClientName) clientSet[o.ClientName] = true;
  });

  var workerSet = {};
  jobWorkRaw.forEach(function(j) {
    if (j.WorkerName) workerSet[j.WorkerName] = true;
  });

  var kpis = computeKPIs(masterRaw, ordersRaw, jobWorkRaw, dispatchRaw);

  return {
    master: masterRaw,
    orders: ordersRaw,
    jobWork: jobWorkRaw,
    dispatch: dispatchRaw,
    stockMovements: stockMoveRaw,
    clients: Object.keys(clientSet).sort(),
    workers: Object.keys(workerSet).sort(),
    kpis: kpis,
    logoUrl: logoBase64,
    config: {
      wastageCriticalPct: CONFIG.wastageCriticalPct,
      paymentPerMtr: CONFIG.paymentPerMtr
    },
    lastSync: Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'dd MMM yyyy, hh:mm a'
    )
  };
}

// ============================================================
// KPI COMPUTATION
// ============================================================
function computeKPIs(master, orders, jobWork, dispatch) {
  var reorderItems = master.filter(function(i) {
    return i.ReorderStatus === 'REORDER (LOW)';
  });
  var activeOrders = orders.filter(function(o) { return o.Status === 'In Production'; });
  var pendingOrders = orders.filter(function(o) { return o.Status === 'Pending'; });
  var completedOrders = orders.filter(function(o) { return o.Status === 'Completed'; });
  var jwOut = jobWork.filter(function(j) { return j.Status === 'Out'; });

  var totalDispatched = dispatch.reduce(function(sum, d) {
    return sum + (parseFloat(d.DispatchedQty) || 0);
  }, 0);

  var totalSent = 0;
  var totalWastage = 0;
  jobWork.forEach(function(j) {
    totalSent += parseFloat(j.SentQtyMtr) || 0;
    totalWastage += parseFloat(j.WastageMtr) || 0;
  });
  var avgWastagePct = totalSent > 0 ? (totalWastage / totalSent * 100).toFixed(2) : 0;

  var categoryMap = {};
  master.forEach(function(item) {
    var cat = item.Category || 'Other';
    if (!categoryMap[cat]) categoryMap[cat] = { count: 0, totalStock: 0 };
    categoryMap[cat].count++;
    categoryMap[cat].totalStock += parseFloat(item.ClosingBalance) || 0;
  });

  var topItems = master
    .filter(function(i) { return (parseFloat(i.ClosingBalance) || 0) > 0; })
    .sort(function(a, b) {
      return (parseFloat(b.ClosingBalance) || 0) - (parseFloat(a.ClosingBalance) || 0);
    })
    .slice(0, 5)
    .map(function(i) {
      return { code: i.ItemCode, balance: parseFloat(i.ClosingBalance) || 0 };
    });

  var monthlyDispatch = {};
  dispatch.forEach(function(d) {
    if (d.DispatchDate) {
      var month = d.DispatchDate.substring(0, 7);
      monthlyDispatch[month] = (monthlyDispatch[month] || 0) +
        (parseFloat(d.DispatchedQty) || 0);
    }
  });

  var totalStockValue = master.reduce(function(sum, i) {
    return sum + (parseFloat(i.ClosingBalance) || 0);
  }, 0);

  var totalOrders = orders.length;
  var fulfilmentRate = totalOrders > 0
    ? ((completedOrders.length / totalOrders) * 100).toFixed(1)
    : 0;

  return {
    reorderCount: reorderItems.length,
    reorderItems: reorderItems.map(function(i) { return i.ItemCode; }),
    activeOrderCount: activeOrders.length,
    pendingOrderCount: pendingOrders.length,
    completedOrderCount: completedOrders.length,
    totalOrderCount: totalOrders,
    fulfilmentRate: fulfilmentRate,
    jwLiveCount: jwOut.length,
    totalDispatched: totalDispatched,
    totalStockMtr: totalStockValue,
    avgWastagePct: avgWastagePct,
    totalItems: master.length,
    categoryBreakdown: categoryMap,
    topItems: topItems,
    monthlyDispatch: monthlyDispatch
  };
}

// ============================================================
// SHEET DATA READER
// ============================================================
function getSheetDataFast(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];

  var headers = rows.shift().map(function(h) {
    return h.toString().replace(/[^a-zA-Z0-9]/g, '');
  });

  return rows.map(function(row) {
    var obj = {};
    var hasData = false;
    headers.forEach(function(h, i) {
      var val = row[i];
      if (val !== '' && val !== null && val !== undefined) hasData = true;
      if (val instanceof Date) {
        obj[h] = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else {
        obj[h] = val;
      }
    });
    return hasData ? obj : null;
  }).filter(Boolean);
}

// ============================================================
// ID GENERATORS
// ============================================================
function generateId(prefix, sheet) {
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  var lastRow = sheet.getLastRow();
  var seq = String(Math.max(1, lastRow)).padStart(3, '0');
  return prefix + '-' + today + '-' + seq;
}

// ============================================================
// WRITE-BACK: ORDERS
// ============================================================
function saveNewOrder(orderData) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Order Book');
    var orderId = generateId('ORD', sheet);

    sheet.appendRow([
      orderId,
      orderData.date || todayStr(),
      orderData.clientName,
      orderData.itemCode,
      parseFloat(orderData.qty),
      orderData.status || 'Pending',
      orderData.remarks || ''
    ]);

    updateMasterAllocatedAndStock(ss);
    return { success: true, orderId: orderId, message: 'Order ' + orderId + ' saved successfully!' };
  } catch (e) {
    return { success: false, message: 'Error: ' + e.toString() };
  }
}

function updateOrderStatus(orderId, newStatus) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Order Book');
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === orderId) {
        sheet.getRange(i + 1, 6).setValue(newStatus);
        updateMasterAllocatedAndStock(ss);
        return { success: true, message: 'Order ' + orderId + ' updated to: ' + newStatus };
      }
    }
    return { success: false, message: 'Order ID not found.' };
  } catch (e) {
    return { success: false, message: 'Error: ' + e.toString() };
  }
}

// ============================================================
// WRITE-BACK: JOB WORK
// ============================================================
function saveNewJobWork(jobData) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Job Work Tracker');
    var jobId = generateId('JOB', sheet);

    var sent = parseFloat(jobData.sentQty) || 0;
    var received = parseFloat(jobData.receivedQty) || 0;
    var wastage = parseFloat(jobData.wastageMtr) || 0;
    var payment = parseFloat(jobData.totalPayment) || (received * CONFIG.paymentPerMtr);

    sheet.appendRow([
      jobData.date || todayStr(),
      jobId,
      jobData.orderId || '',
      jobData.workerName,
      jobData.itemCode,
      sent,
      received,
      wastage,
      jobData.status || 'Out',
      payment
    ]);

    return { success: true, jobId: jobId, message: 'Job Work ' + jobId + ' saved successfully!' };
  } catch (e) {
    return { success: false, message: 'Error: ' + e.toString() };
  }
}

// ============================================================
// WRITE-BACK: DISPATCH
// ============================================================
function saveNewDispatch(dispatchData) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Dispatch Log');
    var dispId = generateId('DISP', sheet);

    sheet.appendRow([
      dispId,
      dispatchData.orderId,
      dispatchData.clientName,
      dispatchData.itemCode,
      parseFloat(dispatchData.dispatchedQty) || 0,
      dispatchData.dispatchDate || todayStr(),
      dispatchData.challanNo || ''
    ]);

    if (dispatchData.markCompleted) {
      updateOrderStatus(dispatchData.orderId, 'Completed');
    }

    return { success: true, dispId: dispId, message: 'Dispatch ' + dispId + ' logged successfully!' };
  } catch (e) {
    return { success: false, message: 'Error: ' + e.toString() };
  }
}

// ============================================================
// WRITE-BACK: STOCK MOVEMENT (V7)
// ============================================================
function saveStockMovement(moveData) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureStockMovementsSheet(ss);

    var moveSheet = ss.getSheetByName('Stock Movements');
    var moveId = generateId('MOV', moveSheet);
    var qty = parseFloat(moveData.qty) || 0;
    var type = moveData.type; // 'IN' or 'OUT'

    moveSheet.appendRow([
      moveId,
      moveData.date || todayStr(),
      moveData.itemCode,
      type,
      qty,
      moveData.reference || '',
      moveData.remarks || ''
    ]);

    updateMasterStock(ss, moveData.itemCode, type, qty);

    return { success: true, moveId: moveId, message: 'Stock movement ' + moveId + ' recorded.' };
  } catch (e) {
    return { success: false, message: 'Error: ' + e.toString() };
  }
}

function updateMasterStock(ss, itemCode, type, qty) {
  var masterSheet = ss.getSheetByName('Master');
  if (!masterSheet) return;

  var data = masterSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === itemCode) {
      var totalInCol = 6;  // Column F - Total In
      var totalOutCol = 7; // Column G - Total Out
      var currentIn = parseFloat(data[i][totalInCol - 1]) || 0;
      var currentOut = parseFloat(data[i][totalOutCol - 1]) || 0;

      if (type === 'IN') {
        masterSheet.getRange(i + 1, totalInCol).setValue(currentIn + qty);
      } else if (type === 'OUT') {
        masterSheet.getRange(i + 1, totalOutCol).setValue(currentOut + qty);
      }
      break;
    }
  }
}

function ensureStockMovementsSheet(ss) {
  var sheet = ss.getSheetByName('Stock Movements');
  if (sheet) return sheet;

  sheet = ss.insertSheet('Stock Movements');
  sheet.appendRow([
    'Move ID', 'Date', 'Item Code', 'Type', 'Qty (Mtr/KG)', 'Reference', 'Remarks'
  ]);
  sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#0d1b2a').setFontColor('#ffffff');
  return sheet;
}

// ============================================================
// STOCK ALERTS
// ============================================================
function getStockAlerts() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var master = getSheetDataFast(ss, 'Master');
  var alerts = [];

  master.forEach(function(item) {
    var balance = parseFloat(item.ClosingBalance) || 0;
    var allocated = parseFloat(item.AllocatedtoOrders) || 0;

    if (item.ReorderStatus === 'REORDER (LOW)') {
      alerts.push({
        type: 'critical',
        itemCode: item.ItemCode,
        itemName: item.ItemName,
        balance: balance,
        allocated: allocated,
        message: 'CRITICAL: Stock below reorder level!'
      });
    } else if (balance > 0 && allocated / balance > CONFIG.allocationWarningPct) {
      alerts.push({
        type: 'warning',
        itemCode: item.ItemCode,
        itemName: item.ItemName,
        balance: balance,
        allocated: allocated,
        message: 'WARNING: Over 80% stock allocated to orders'
      });
    }
  });

  return alerts;
}

// ============================================================
// CHALLAN DATA (for print)
// ============================================================
function getChallanData(dispatchId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dispatch = getSheetDataFast(ss, 'Dispatch Log');
  var record = dispatch.find(function(d) { return d.DispatchID === dispatchId; });
  if (!record) return { success: false, message: 'Dispatch not found' };

  return {
    success: true,
    challan: {
      dispatchId: record.DispatchID,
      orderId: record.OrderID,
      clientName: record.ClientName,
      itemCode: record.ItemCode,
      qty: record.DispatchedQty,
      date: record.DispatchDate,
      challanNo: record.ChallanNo || record.DispatchID,
      company: 'Jai Roop Textiles'
    }
  };
}

// ============================================================
// DAILY EMAIL ALERTS (optional — set trigger in Apps Script)
// ============================================================
function sendDailyReorderEmail() {
  var alerts = getStockAlerts().filter(function(a) { return a.type === 'critical'; });
  if (!alerts.length) return;

  var email = Session.getActiveUser().getEmail();
  if (!email) return;

  var body = 'Jai Roop Textiles — Daily Reorder Alert\n\n';
  body += 'The following items need immediate reorder:\n\n';
  alerts.forEach(function(a) {
    body += '• ' + a.itemCode + ' (' + (a.itemName || '') + ') — Balance: ' + a.balance + ' Mtr\n';
  });
  body += '\nOpen your IMS dashboard to take action.';

  MailApp.sendEmail({
    to: email,
    subject: '[IMS] ' + alerts.length + ' item(s) need reorder — Jai Roop Textiles',
    body: body
  });
}

function todayStr() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
