// ============================================================
//  JAI ROOP TEXTILES — IMS System V7.1
//  Google Apps Script Backend — Code.gs
//  OPTIMIZED: Fast data load, logo loaded separately
//
//  MASTER SHEET COLUMN ORDER:
//    A: Item Code   B: Item Name    C: Color
//    D: Category    E: Weight/Mtr   F: Max Level
//    G: Opening Stock               H: Total In
//    I: Total Out   J: Allocated    K: Closing Balance
//    L: Reorder Status
// ============================================================

// ---- UNIT HELPER ----
function getUnitForCategory(category) {
  if (!category) return 'Mtr';
  var cat = category.toString().trim().toLowerCase();
  var kgCats = ['raw','chemical','color','colour','machine part','semi finished','semi-finished'];
  for (var i = 0; i < kgCats.length; i++) { if (cat === kgCats[i]) return 'KG'; }
  return 'Mtr';
}

// ---- REORDER STATUS ----
function getReorderStatus(openingStock, maxLevel) {
  if (!maxLevel || maxLevel <= 0) return 'NORMAL';
  var pct = (openingStock / maxLevel) * 100;
  if (pct < 50) return 'STOCK OUT';
  if (pct < 80) return 'REORDER';
  return 'NORMAL';
}

// ---- AUTO-TRIGGER ----
function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  if (sheet.getName() == "Order Book" && e.range.getColumn() == 6) {
    updateMasterAllocatedAndStock(e.source);
  }
}

// ---- ALLOCATED QTY SYNC ----
function updateMasterAllocatedAndStock(ss) {
  var orderSheet  = ss.getSheetByName("Order Book");
  var masterSheet = ss.getSheetByName("Master");
  if (!orderSheet || !masterSheet) return;

  var orderData  = orderSheet.getDataRange().getValues();
  var masterData = masterSheet.getDataRange().getValues();
  var allocationMap = {};

  for (var i = 1; i < orderData.length; i++) {
    var itemCode = orderData[i][3];
    var qty      = parseFloat(orderData[i][4]) || 0;
    var status   = orderData[i][5];
    if ((status == "In Production" || status == "Pending") && itemCode) {
      allocationMap[itemCode] = (allocationMap[itemCode] || 0) + qty;
    }
  }

  for (var j = 1; j < masterData.length; j++) {
    var code = masterData[j][0];
    if (!code) continue;
    var allocQty = allocationMap[code] || 0;
    var openStock = parseFloat(masterData[j][6]) || 0;
    var totalIn   = parseFloat(masterData[j][7]) || 0;
    var totalOut  = parseFloat(masterData[j][8]) || 0;
    var closing   = openStock + totalIn - totalOut - allocQty;
    var maxLevel  = parseFloat(masterData[j][5]) || 0;
    masterSheet.getRange(j + 1, 10).setValue(allocQty);
    masterSheet.getRange(j + 1, 11).setValue(closing);
    masterSheet.getRange(j + 1, 12).setValue(getReorderStatus(openStock, maxLevel));
  }
}

// ============================================================
//  WEB APP ENTRY POINT
// ============================================================
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('IMS Dashboard — Jai Roop Textiles')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============================================================
//  FAST DATA FETCH — No logo, loads instantly
// ============================================================
function getAllIMSData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var masterRaw   = getSheetDataFast(ss, "Master");
  var ordersRaw   = getSheetDataFast(ss, "Order Book");
  var jobWorkRaw  = getSheetDataFast(ss, "Job Work Tracker");
  var dispatchRaw = getSheetDataFast(ss, "Dispatch Log");

  // Attach unit + reorder status to every master item
  masterRaw = masterRaw.map(function(item) {
    item._unit = getUnitForCategory(item.Category);
    var openStk = parseFloat(item.OpeningStock) || 0;
    var maxLvl  = parseFloat(item.MaxLevel) || 0;
    item._maxLevel   = maxLvl;
    item.ReorderStatus = getReorderStatus(openStk, maxLvl);
    return item;
  });

  var clientSet = {};
  ordersRaw.forEach(function(o) { if (o.ClientName) clientSet[o.ClientName] = true; });

  var workerSet = {};
  jobWorkRaw.forEach(function(j) { if (j.WorkerName) workerSet[j.WorkerName] = true; });

  return {
    master:   masterRaw,
    orders:   ordersRaw,
    jobWork:  jobWorkRaw,
    dispatch: dispatchRaw,
    clients:  Object.keys(clientSet).sort(),
    workers:  Object.keys(workerSet).sort(),
    kpis:     computeKPIs(masterRaw, ordersRaw, jobWorkRaw, dispatchRaw),
    lastSync: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd MMM yyyy, hh:mm a")
  };
}

// ============================================================
//  KPI COMPUTATION
// ============================================================
function computeKPIs(master, orders, jobWork, dispatch) {
  var reorderItems    = master.filter(function(i) { return i.ReorderStatus === 'REORDER' || i.ReorderStatus === 'STOCK OUT'; });
  var stockOutItems   = master.filter(function(i) { return i.ReorderStatus === 'STOCK OUT'; });
  var activeOrders    = orders.filter(function(o) { return o.Status === 'In Production'; });
  var pendingOrders   = orders.filter(function(o) { return o.Status === 'Pending'; });
  var completedOrders = orders.filter(function(o) { return o.Status === 'Completed'; });
  var jwOut           = jobWork.filter(function(j) {
    var s = (j.Status || '').toLowerCase();
    return s === 'out' || s === 'active';
  });

  var totalSent = 0, totalWastage = 0;
  jobWork.forEach(function(j) {
    totalSent    += parseFloat(j.SentQtyMtr) || 0;
    totalWastage += parseFloat(j.WastageMtr) || 0;
  });

  var categoryMap = {};
  master.forEach(function(item) {
    var cat  = item.Category || 'Other';
    var unit = item._unit || 'Mtr';
    if (!categoryMap[cat]) categoryMap[cat] = { count: 0, totalStock: 0, unit: unit };
    categoryMap[cat].count++;
    categoryMap[cat].totalStock += parseFloat(item.ClosingBalance) || 0;
  });

  var topItems = master
    .filter(function(i) { return (parseFloat(i.ClosingBalance) || 0) > 0; })
    .sort(function(a, b) { return (parseFloat(b.ClosingBalance)||0) - (parseFloat(a.ClosingBalance)||0); })
    .slice(0, 5)
    .map(function(i) { return { code: i.ItemCode, balance: parseFloat(i.ClosingBalance)||0, unit: i._unit }; });

  var monthlyDispatch = {};
  dispatch.forEach(function(d) {
    if (d.DispatchDate) {
      var month = d.DispatchDate.substring(0, 7);
      monthlyDispatch[month] = (monthlyDispatch[month] || 0) + (parseFloat(d.DispatchedQty) || 0);
    }
  });

  var totalMtrStock = 0, totalKGStock = 0;
  master.forEach(function(item) {
    var bal = parseFloat(item.ClosingBalance) || 0;
    if (item._unit === 'KG') totalKGStock += bal;
    else totalMtrStock += bal;
  });

  var totalOrders = orders.length;
  return {
    reorderCount:        reorderItems.length,
    stockOutCount:       stockOutItems.length,
    reorderItems:        reorderItems.map(function(i) { return i.ItemCode + ' [' + i._unit + ']'; }),
    activeOrderCount:    activeOrders.length,
    pendingOrderCount:   pendingOrders.length,
    completedOrderCount: completedOrders.length,
    totalOrderCount:     totalOrders,
    fulfilmentRate:      totalOrders > 0 ? ((completedOrders.length / totalOrders) * 100).toFixed(1) : 0,
    jwLiveCount:         jwOut.length,
    avgWastagePct:       totalSent > 0 ? (totalWastage / totalSent * 100).toFixed(2) : 0,
    totalMtrStock:       totalMtrStock,
    totalKGStock:        totalKGStock,
    categoryBreakdown:   categoryMap,
    topItems:            topItems,
    monthlyDispatch:     monthlyDispatch
  };
}

// ============================================================
//  OPTIMIZED SHEET READER — stops at first truly empty row
// ============================================================
function getSheetDataFast(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) return [];

  // Use getLastRow() to avoid reading thousands of empty rows
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var range = sheet.getRange(1, 1, lastRow, sheet.getLastColumn());
  var rows  = range.getValues();
  if (rows.length < 2) return [];

  var headers = rows.shift().map(function(h) {
    return h.toString().replace(/[^a-zA-Z0-9]/g, "");
  });

  var result = [];
  for (var i = 0; i < rows.length; i++) {
    var row     = rows[i];
    var obj     = {};
    var hasData = false;
    for (var j = 0; j < headers.length; j++) {
      var val = row[j];
      if (val !== "" && val !== null && val !== undefined) hasData = true;
      obj[headers[j]] = (val instanceof Date)
        ? Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd")
        : val;
    }
    if (hasData) result.push(obj);
  }
  return result;
}

// ============================================================
//  GENERATE NEXT ORDER ID → ORD-00001
// ============================================================
function getNextOrderId() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Order Book");
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 'ORD-00001';

  var data  = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var maxNum = 0;
  for (var i = 0; i < data.length; i++) {
    var id = data[i][0] ? data[i][0].toString() : '';
    var match = id.match(/ORD-(\d+)/);
    if (match) {
      var num = parseInt(match[1]);
      if (num > maxNum) maxNum = num;
    }
  }
  return 'ORD-' + String(maxNum + 1).padStart(5, '0');
}

// ============================================================
//  WRITE-BACK: ADD NEW ORDER
// ============================================================
function saveNewOrder(orderData) {
  try {
    var ss     = SpreadsheetApp.getActiveSpreadsheet();
    var sheet  = ss.getSheetByName("Order Book");
    var orderId = getNextOrderId();

    sheet.appendRow([
      orderId,
      orderData.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      orderData.clientName,
      orderData.itemCode,
      parseFloat(orderData.qty),
      orderData.status || "Pending",
      orderData.remarks || ""
    ]);

    updateMasterAllocatedAndStock(ss);
    return { success: true, orderId: orderId, message: "Order " + orderId + " saved!" };
  } catch (e) {
    return { success: false, message: "Error: " + e.toString() };
  }
}

// ============================================================
//  WRITE-BACK: UPDATE ORDER STATUS
// ============================================================
function updateOrderStatus(orderId, newStatus) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Order Book");
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, message: "No orders found." };

    var data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] == orderId) {
        sheet.getRange(i + 2, 6).setValue(newStatus);
        updateMasterAllocatedAndStock(ss);
        return { success: true, message: "Order " + orderId + " → " + newStatus };
      }
    }
    return { success: false, message: "Order ID not found." };
  } catch (e) {
    return { success: false, message: "Error: " + e.toString() };
  }
}

// ============================================================
//  WRITE-BACK: ADD NEW JOB WORK
// ============================================================
function saveNewJobWork(jobData) {
  try {
    var ss      = SpreadsheetApp.getActiveSpreadsheet();
    var sheet   = ss.getSheetByName("Job Work Tracker");
    var lastRow = sheet.getLastRow();
    var today   = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");
    var jobId   = "JOB-" + today + "-" + String(lastRow).padStart(3, '0');

    sheet.appendRow([
      jobData.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      jobId,
      jobData.orderId,
      jobData.workerName,
      jobData.itemCode,
      parseFloat(jobData.sentQty)      || 0,
      parseFloat(jobData.receivedQty)  || 0,
      parseFloat(jobData.wastageMtr)   || 0,
      jobData.status || "Out",
      parseFloat(jobData.totalPayment) || 0
    ]);

    return { success: true, jobId: jobId, message: "Job Work " + jobId + " saved!" };
  } catch (e) {
    return { success: false, message: "Error: " + e.toString() };
  }
}

// ============================================================
//  WRITE-BACK: EDIT JOB WORK
// ============================================================
function updateJobWork(jobId, receivedQty, wastageMtr, status, totalPayment) {
  try {
    var ss      = SpreadsheetApp.getActiveSpreadsheet();
    var sheet   = ss.getSheetByName("Job Work Tracker");
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, message: "No job work found." };

    var data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][1] == jobId) {
        var row = i + 2;
        sheet.getRange(row, 7).setValue(parseFloat(receivedQty) || 0);
        sheet.getRange(row, 8).setValue(parseFloat(wastageMtr)  || 0);
        sheet.getRange(row, 9).setValue(status || "Completed");
        sheet.getRange(row, 10).setValue(parseFloat(totalPayment) || 0);
        return { success: true, message: "Job Work " + jobId + " updated!" };
      }
    }
    return { success: false, message: "Job ID not found." };
  } catch (e) {
    return { success: false, message: "Error: " + e.toString() };
  }
}

// ============================================================
//  WRITE-BACK: ADD NEW DISPATCH
// ============================================================
function saveNewDispatch(dispatchData) {
  try {
    var ss      = SpreadsheetApp.getActiveSpreadsheet();
    var sheet   = ss.getSheetByName("Dispatch Log");
    var lastRow = sheet.getLastRow();
    var today   = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");
    var dispId  = "DISP-" + today + "-" + String(lastRow).padStart(3, '0');

    sheet.appendRow([
      dispId,
      dispatchData.orderId,
      dispatchData.clientName,
      dispatchData.itemCode,
      parseFloat(dispatchData.dispatchedQty) || 0,
      dispatchData.dispatchDate || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      dispatchData.challanNo || ""
    ]);

    if (dispatchData.markCompleted) {
      updateOrderStatus(dispatchData.orderId, "Completed");
    }

    return { success: true, dispId: dispId, message: "Dispatch " + dispId + " logged!" };
  } catch (e) {
    return { success: false, message: "Error: " + e.toString() };
  }
}

// ============================================================
//  WRITE-BACK: ADD NEW MASTER ITEM
// ============================================================
function saveNewMasterItem(itemData) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Master");
    var lastRow = sheet.getLastRow();

    if (lastRow >= 2) {
      var existing = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < existing.length; i++) {
        if (existing[i][0] && existing[i][0].toString().toLowerCase() === itemData.itemCode.toString().toLowerCase()) {
          return { success: false, message: "Item Code '" + itemData.itemCode + "' already exists!" };
        }
      }
    }

    var openingStock = parseFloat(itemData.openingStock) || 0;
    var maxLevel     = parseFloat(itemData.maxLevel) || 0;

    sheet.appendRow([
      itemData.itemCode,
      itemData.itemName,
      itemData.color || "",
      itemData.category,
      parseFloat(itemData.weightPerMtr) || 0,
      maxLevel,
      openingStock,
      0, 0, 0,
      openingStock,
      getReorderStatus(openingStock, maxLevel)
    ]);

    return { success: true, message: "Item '" + itemData.itemCode + "' added!" };
  } catch (e) {
    return { success: false, message: "Error: " + e.toString() };
  }
}

// ============================================================
//  WRITE-BACK: UPDATE ITEM QTY (Stock In / Out)
// ============================================================
function updateItemQty(itemCode, addQty, type) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Master");
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, message: "Master sheet empty." };

    var data = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === itemCode.toString()) {
        var row      = i + 2;
        var qty      = parseFloat(addQty) || 0;
        var colIdx   = type === 'in' ? 8 : 9; // Col H=8, I=9 (1-based)
        var current  = parseFloat(data[i][colIdx - 1]) || 0;
        sheet.getRange(row, colIdx).setValue(current + qty);

        // Recalculate closing
        var openStock = parseFloat(data[i][6]) || 0;
        var totalIn   = parseFloat(data[i][7]) || 0;
        var totalOut  = parseFloat(data[i][8]) || 0;
        var allocated = parseFloat(data[i][9]) || 0;
        if (type === 'in')  totalIn  += qty;
        if (type === 'out') totalOut += qty;
        sheet.getRange(row, 11).setValue(openStock + totalIn - totalOut - allocated);
        sheet.getRange(row, 12).setValue(getReorderStatus(openStock, parseFloat(data[i][5]) || 0));

        return { success: true, message: "Stock updated for " + itemCode };
      }
    }
    return { success: false, message: "Item not found." };
  } catch (e) {
    return { success: false, message: "Error: " + e.toString() };
  }
}

// ============================================================
//  WRITE-BACK: ADD NEW CLIENT
// ============================================================
function saveNewClient(clientData) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var clientSheet = ss.getSheetByName("Clients");
    if (!clientSheet) {
      clientSheet = ss.insertSheet("Clients");
      clientSheet.appendRow(["Client Name","Contact Person","Phone","Email","Address","Created Date"]);
    }

    var lastRow = clientSheet.getLastRow();
    if (lastRow >= 2) {
      var existing = clientSheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < existing.length; i++) {
        if (existing[i][0] && existing[i][0].toString().toLowerCase() === clientData.clientName.toString().toLowerCase()) {
          return { success: false, message: "Client '" + clientData.clientName + "' already exists!" };
        }
      }
    }

    clientSheet.appendRow([
      clientData.clientName,
      clientData.contactPerson || "",
      clientData.phone || "",
      clientData.email || "",
      clientData.address || "",
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd")
    ]);

    return { success: true, message: "Client '" + clientData.clientName + "' created!" };
  } catch (e) {
    return { success: false, message: "Error: " + e.toString() };
  }
}
