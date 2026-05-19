/**
 * Textile IMS — Google Apps Script backend
 * Bind this project to your IMS spreadsheet (Extensions → Apps Script).
 * Sheet tabs: Master, Order Book, Job Work Tracker, Dispatch Log
 *
 * Optional: Script properties → LOGO_FILE_ID = Google Drive file ID for PNG/JPG logo
 */

/** Order Book: column index (1-based) for Status — edits here trigger allocation sync */
var ORDER_STATUS_COL = 6;

function onEdit(e) {
  if (!e || !e.source || !e.range) return;
  var sheet = e.source.getActiveSheet();
  if (sheet.getName() === 'Order Book' && e.range.getColumn() === ORDER_STATUS_COL) {
    updateMasterAllocatedAndStock(e.source);
  }
}

/**
 * Finds 1-based column index whose header contains substring (case-insensitive).
 */
function getColumnIndexByHeader_(sheet, substring) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return -1;
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var sub = substring.toLowerCase();
  for (var i = 0; i < headerRow.length; i++) {
    var cell = headerRow[i];
    if (cell !== '' && cell !== null && cell !== undefined && cell.toString().toLowerCase().indexOf(sub) !== -1) {
      return i + 1;
    }
  }
  return -1;
}

/**
 * Order Book → Master: sum ordered qty per item for Pending / In Production into Allocated column.
 */
function updateMasterAllocatedAndStock(ss) {
  var orderSheet = ss.getSheetByName('Order Book');
  var masterSheet = ss.getSheetByName('Master');
  if (!orderSheet || !masterSheet) return;

  var orderData = orderSheet.getDataRange().getValues();
  var masterData = masterSheet.getDataRange().getValues();
  if (orderData.length < 2 || masterData.length < 2) return;

  var allocCol = getColumnIndexByHeader_(masterSheet, 'allocat');
  if (allocCol < 1) {
    allocCol = masterSheet.getLastColumn() + 1;
    masterSheet.getRange(1, allocCol).setValue('Allocated to Orders');
  }

  var allocationMap = {};
  for (var i = 1; i < orderData.length; i++) {
    var itemCode = orderData[i][3];
    var qty = parseFloat(orderData[i][4]) || 0;
    var status = orderData[i][5];
    if (status === 'In Production' || status === 'Pending') {
      if (itemCode) allocationMap[itemCode] = (allocationMap[itemCode] || 0) + qty;
    }
  }

  for (var j = 1; j < masterData.length; j++) {
    var masterItemCode = masterData[j][0];
    if (masterItemCode) {
      masterSheet.getRange(j + 1, allocCol).setValue(allocationMap[masterItemCode] || 0);
    }
  }
}

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('IMS Dashboard — Textile IMS')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getAllIMSData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logoBase64 = '';
  try {
    var fileId = PropertiesService.getScriptProperties().getProperty('LOGO_FILE_ID');
    if (fileId) {
      var file = DriveApp.getFileById(fileId);
      var blob = file.getBlob();
      logoBase64 = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
    }
  } catch (err) {
    Logger.log('Logo load failed: ' + err);
  }

  var masterRaw = getSheetDataFast_(ss, 'Master');
  var ordersRaw = getSheetDataFast_(ss, 'Order Book');
  var jobWorkRaw = getSheetDataFast_(ss, 'Job Work Tracker');
  var dispatchRaw = getSheetDataFast_(ss, 'Dispatch Log');

  var clientSet = {};
  ordersRaw.forEach(function (o) {
    if (o.ClientName) clientSet[o.ClientName] = true;
  });
  var workerSet = {};
  jobWorkRaw.forEach(function (j) {
    if (j.WorkerName) workerSet[j.WorkerName] = true;
  });

  var kpis = computeKPIs_(masterRaw, ordersRaw, jobWorkRaw, dispatchRaw);

  return {
    master: masterRaw,
    orders: ordersRaw,
    jobWork: jobWorkRaw,
    dispatch: dispatchRaw,
    clients: Object.keys(clientSet).sort(),
    workers: Object.keys(workerSet).sort(),
    kpis: kpis,
    logoUrl: logoBase64,
    lastSync: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd MMM yyyy, hh:mm a'),
  };
}

function computeKPIs_(master, orders, jobWork, dispatch) {
  var reorderItems = master.filter(function (i) {
    return i.ReorderStatus === 'REORDER (LOW)';
  });
  var activeOrders = orders.filter(function (o) {
    return o.Status === 'In Production';
  });
  var pendingOrders = orders.filter(function (o) {
    return o.Status === 'Pending';
  });
  var completedOrders = orders.filter(function (o) {
    return o.Status === 'Completed';
  });
  var jwOut = jobWork.filter(function (j) {
    return j.Status === 'Out';
  });

  var totalDispatched = dispatch.reduce(function (sum, d) {
    return sum + (parseFloat(d.DispatchedQty) || 0);
  }, 0);

  var totalSent = 0;
  var totalWastage = 0;
  jobWork.forEach(function (j) {
    totalSent += parseFloat(j.SentQtyMtr) || 0;
    totalWastage += parseFloat(j.WastageMtr) || 0;
  });
  var avgWastagePct = totalSent > 0 ? (totalWastage / totalSent) * 100 : 0;

  var categoryMap = {};
  master.forEach(function (item) {
    var cat = item.Category || 'Other';
    if (!categoryMap[cat]) categoryMap[cat] = { count: 0, totalStock: 0 };
    categoryMap[cat].count++;
    categoryMap[cat].totalStock += parseFloat(item.ClosingBalance) || 0;
  });

  var topItems = master
    .filter(function (i) {
      return (parseFloat(i.ClosingBalance) || 0) > 0;
    })
    .sort(function (a, b) {
      return (parseFloat(b.ClosingBalance) || 0) - (parseFloat(a.ClosingBalance) || 0);
    })
    .slice(0, 5)
    .map(function (i) {
      return { code: i.ItemCode, balance: parseFloat(i.ClosingBalance) || 0 };
    });

  var monthlyDispatch = {};
  dispatch.forEach(function (d) {
    if (d.DispatchDate) {
      var month = d.DispatchDate.toString().substring(0, 7);
      monthlyDispatch[month] = (monthlyDispatch[month] || 0) + (parseFloat(d.DispatchedQty) || 0);
    }
  });

  var totalOrders = orders.length;
  var fulfilmentRate = totalOrders > 0 ? ((completedOrders.length / totalOrders) * 100).toFixed(1) : 0;

  return {
    reorderCount: reorderItems.length,
    reorderItems: reorderItems.map(function (i) {
      return i.ItemCode;
    }),
    activeOrderCount: activeOrders.length,
    pendingOrderCount: pendingOrders.length,
    completedOrderCount: completedOrders.length,
    totalOrderCount: totalOrders,
    fulfilmentRate: fulfilmentRate,
    jwLiveCount: jwOut.length,
    totalDispatched: totalDispatched,
    avgWastagePct: avgWastagePct.toFixed(2),
    totalItems: master.length,
    categoryBreakdown: categoryMap,
    topItems: topItems,
    monthlyDispatch: monthlyDispatch,
  };
}

function getSheetDataFast_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  var headers = rows.shift().map(function (h) {
    return h.toString().replace(/[^a-zA-Z0-9]/g, '');
  });
  return rows
    .map(function (row) {
      var obj = {};
      var hasData = false;
      headers.forEach(function (h, i) {
        var val = row[i];
        if (val !== '' && val !== null && val !== undefined) hasData = true;
        if (val instanceof Date) {
          obj[h] = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else {
          obj[h] = val;
        }
      });
      return hasData ? obj : null;
    })
    .filter(Boolean);
}

function saveNewOrder(orderData) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Order Book');
    if (!sheet) return { success: false, message: 'Sheet "Order Book" not found.' };

    var lastRow = sheet.getLastRow();
    var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
    var orderId = 'ORD-' + today + '-' + String(lastRow).padStart(3, '0');

    sheet.appendRow([
      orderId,
      orderData.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      orderData.clientName,
      orderData.itemCode,
      parseFloat(orderData.qty),
      orderData.status || 'Pending',
      orderData.remarks || '',
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
    if (!sheet) return { success: false, message: 'Sheet "Order Book" not found.' };

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == orderId) {
        sheet.getRange(i + 1, ORDER_STATUS_COL).setValue(newStatus);
        updateMasterAllocatedAndStock(ss);
        return { success: true, message: 'Order ' + orderId + ' updated to: ' + newStatus };
      }
    }
    return { success: false, message: 'Order ID not found.' };
  } catch (e) {
    return { success: false, message: 'Error: ' + e.toString() };
  }
}

function saveNewJobWork(jobData) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Job Work Tracker');
    if (!sheet) return { success: false, message: 'Sheet "Job Work Tracker" not found.' };

    var lastRow = sheet.getLastRow();
    var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
    var jobId = 'JOB-' + today + '-' + String(lastRow).padStart(3, '0');

    sheet.appendRow([
      jobData.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      jobId,
      jobData.orderId,
      jobData.workerName,
      jobData.itemCode,
      parseFloat(jobData.sentQty) || 0,
      parseFloat(jobData.receivedQty) || 0,
      parseFloat(jobData.wastageMtr) || 0,
      jobData.status || 'Out',
      parseFloat(jobData.totalPayment) || 0,
    ]);
    return { success: true, jobId: jobId, message: 'Job Work ' + jobId + ' saved successfully!' };
  } catch (e) {
    return { success: false, message: 'Error: ' + e.toString() };
  }
}

function saveNewDispatch(dispatchData) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Dispatch Log');
    if (!sheet) return { success: false, message: 'Sheet "Dispatch Log" not found.' };

    var lastRow = sheet.getLastRow();
    var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
    var dispId = 'DISP-' + today + '-' + String(lastRow).padStart(3, '0');

    sheet.appendRow([
      dispId,
      dispatchData.orderId,
      dispatchData.clientName,
      dispatchData.itemCode,
      parseFloat(dispatchData.dispatchedQty) || 0,
      dispatchData.dispatchDate || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      dispatchData.challanNo || '',
    ]);

    if (dispatchData.markCompleted) {
      updateOrderStatus(dispatchData.orderId, 'Completed');
    }
    return { success: true, dispId: dispId, message: 'Dispatch ' + dispId + ' logged successfully!' };
  } catch (e) {
    return { success: false, message: 'Error: ' + e.toString() };
  }
}

function getStockAlerts() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var master = getSheetDataFast_(ss, 'Master');
  var alerts = [];
  master.forEach(function (item) {
    var balance = parseFloat(item.ClosingBalance) || 0;
    var allocated = parseFloat(item.AllocatedtoOrders) || 0;
    if (item.ReorderStatus === 'REORDER (LOW)') {
      alerts.push({
        type: 'critical',
        itemCode: item.ItemCode,
        itemName: item.ItemName,
        balance: balance,
        message: 'CRITICAL: Stock below reorder level!',
      });
    } else if (balance > 0 && allocated > balance * 0.8) {
      alerts.push({
        type: 'warning',
        itemCode: item.ItemCode,
        itemName: item.ItemName,
        balance: balance,
        message: 'WARNING: Over 80% stock allocated to orders',
      });
    }
  });
  return alerts;
}

/** Manual menu: Extensions is default; optional custom menu */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('IMS')
    .addItem('Recalculate allocations (Order Book → Master)', 'menuRecalculateAllocations')
    .addToUi();
}

function menuRecalculateAllocations() {
  updateMasterAllocatedAndStock(SpreadsheetApp.getActiveSpreadsheet());
  SpreadsheetApp.getUi().alert('Allocations updated on Master sheet.');
}
