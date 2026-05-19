/**
 * Jai Roop Textiles IMS
 * Advanced Google Sheets + Apps Script inventory management backend.
 *
 * Sheet link:
 * https://docs.google.com/spreadsheets/d/19DMKtsGlL2GvDAZSW7tfJ8S-8Vi_vk0dka_IG-hIbWw/edit
 */

const IMS_CONFIG = {
  spreadsheetId: '19DMKtsGlL2GvDAZSW7tfJ8S-8Vi_vk0dka_IG-hIbWw',
  companyName: 'Jai Roop Textiles',
  currency: 'INR',
  defaultJobRate: 0.25,
  criticalWastagePct: 4,
  defaultReorderLevel: 100,
  defaultTargetLevel: 500
};

const IMS_SHEETS = {
  settings: 'Settings',
  master: 'Master',
  ledger: 'Stock Ledger',
  orders: 'Order Book',
  jobs: 'Job Work Tracker',
  dispatch: 'Dispatch Log',
  clients: 'Clients',
  vendors: 'Vendors'
};

const IMS_HEADERS = {};
IMS_HEADERS[IMS_SHEETS.settings] = ['Key', 'Value', 'Notes'];
IMS_HEADERS[IMS_SHEETS.master] = [
  'Item Code',
  'Item Name',
  'Category',
  'UOM',
  'Color',
  'Width',
  'GSM',
  'Weight/Mtr',
  'Opening Stock',
  'Total In',
  'Total Out',
  'Allocated to Orders',
  'Reorder Level',
  'Target Level',
  'Rate',
  'Closing Balance',
  'Stock Value',
  'Reorder Status',
  'Location',
  'Supplier',
  'Last Updated'
];
IMS_HEADERS[IMS_SHEETS.ledger] = [
  'Movement ID',
  'Date',
  'Item Code',
  'Type',
  'Qty',
  'UOM',
  'Source',
  'Reference ID',
  'Party',
  'Rate',
  'Amount',
  'Remarks',
  'Created At'
];
IMS_HEADERS[IMS_SHEETS.orders] = [
  'Order ID',
  'Date',
  'Client Name',
  'Item Code',
  'Ordered Qty',
  'Rate',
  'Due Date',
  'Priority',
  'Status',
  'Remarks',
  'Created At',
  'Last Updated'
];
IMS_HEADERS[IMS_SHEETS.jobs] = [
  'Date',
  'Job ID',
  'Order ID',
  'Worker Name',
  'Item Code',
  'Sent Qty',
  'Received Qty',
  'Wastage',
  'Rate',
  'Total Payment',
  'Status',
  'Due Date',
  'Remarks',
  'Created At',
  'Last Updated'
];
IMS_HEADERS[IMS_SHEETS.dispatch] = [
  'Dispatch ID',
  'Order ID',
  'Client Name',
  'Item Code',
  'Dispatched Qty',
  'Dispatch Date',
  'Challan No',
  'Transporter',
  'LR No',
  'Remarks',
  'Created At'
];
IMS_HEADERS[IMS_SHEETS.clients] = [
  'Client Name',
  'Contact Person',
  'Phone',
  'Email',
  'City',
  'GSTIN',
  'Credit Days',
  'Remarks'
];
IMS_HEADERS[IMS_SHEETS.vendors] = [
  'Vendor Name',
  'Type',
  'Contact Person',
  'Phone',
  'City',
  'Default Rate',
  'Remarks'
];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('IMS Dashboard - Jai Roop Textiles')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Textile IMS')
    .addItem('Open IMS Dashboard', 'showIMSDialog')
    .addSeparator()
    .addItem('Setup / Repair IMS Sheets', 'setupIMS')
    .addItem('Recalculate Inventory', 'recalculateInventory')
    .addToUi();
}

function showIMSDialog() {
  var html = HtmlService.createHtmlOutputFromFile('Index')
    .setWidth(1280)
    .setHeight(820);
  SpreadsheetApp.getUi().showModalDialog(html, 'Jai Roop Textiles IMS');
}

function getSpreadsheet_() {
  if (IMS_CONFIG.spreadsheetId) {
    return SpreadsheetApp.openById(IMS_CONFIG.spreadsheetId);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function setupIMS() {
  var ss = getSpreadsheet_();
  Object.keys(IMS_HEADERS).forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    ensureHeaders_(sheet, IMS_HEADERS[sheetName]);
    formatSheet_(sheet, sheetName);
  });
  seedSettings_(ss);
  seedStarterRows_(ss);
  applyValidations_(ss);
  recalculateInventory();
  return {
    success: true,
    message: 'IMS sheets are ready. Refresh the dashboard to load current data.'
  };
}

function getAllIMSData() {
  setupIMS();
  var ss = getSpreadsheet_();
  var master = readRecords_(ss, IMS_SHEETS.master);
  var ledger = readRecords_(ss, IMS_SHEETS.ledger);
  var orders = readRecords_(ss, IMS_SHEETS.orders);
  var jobs = readRecords_(ss, IMS_SHEETS.jobs);
  var dispatch = readRecords_(ss, IMS_SHEETS.dispatch);
  var clients = readRecords_(ss, IMS_SHEETS.clients);
  var vendors = readRecords_(ss, IMS_SHEETS.vendors);
  var kpis = computeKPIs_(master, ledger, orders, jobs, dispatch);

  return {
    config: getPublicConfig_(),
    master: master,
    ledger: ledger,
    orders: orders,
    jobWork: jobs,
    dispatch: dispatch,
    clients: uniqueValues_(clients.map(function(c) { return c.ClientName; }).concat(orders.map(function(o) { return o.ClientName; }))),
    clientRecords: clients,
    workers: uniqueValues_(vendors.map(function(v) { return v.VendorName; }).concat(jobs.map(function(j) { return j.WorkerName; }))),
    vendors: vendors,
    items: master.map(function(item) { return item.ItemCode; }).filter(Boolean),
    kpis: kpis,
    alerts: buildAlerts_(master, orders, jobs),
    lastSync: formatDateTime_(new Date())
  };
}

function getPublicConfig_() {
  return {
    companyName: IMS_CONFIG.companyName,
    currency: IMS_CONFIG.currency,
    defaultJobRate: IMS_CONFIG.defaultJobRate,
    criticalWastagePct: IMS_CONFIG.criticalWastagePct,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + IMS_CONFIG.spreadsheetId + '/edit'
  };
}

function saveMasterItem(itemData) {
  try {
    var ss = getSpreadsheet_();
    setupIMS();
    requireFields_(itemData, ['itemCode', 'itemName']);
    var sheet = ss.getSheetByName(IMS_SHEETS.master);
    var itemCode = normalizeCode_(itemData.itemCode);
    var existingRow = findRowByValue_(sheet, 'Item Code', itemCode);
    var row = [
      itemCode,
      itemData.itemName,
      itemData.category || 'Fabric',
      itemData.uom || 'Mtr',
      itemData.color || '',
      itemData.width || '',
      itemData.gsm || '',
      toNumber_(itemData.weightMtr),
      toNumber_(itemData.openingStock),
      0,
      0,
      0,
      toNumber_(itemData.reorderLevel) || IMS_CONFIG.defaultReorderLevel,
      toNumber_(itemData.targetLevel) || IMS_CONFIG.defaultTargetLevel,
      toNumber_(itemData.rate),
      0,
      0,
      'NORMAL',
      itemData.location || '',
      itemData.supplier || '',
      formatDateTime_(new Date())
    ];
    if (existingRow > 1) {
      sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
    recalculateInventory();
    return { success: true, message: 'Item ' + itemCode + ' saved.', itemCode: itemCode };
  } catch (err) {
    return fail_(err);
  }
}

function saveStockMovement(movementData) {
  try {
    var ss = getSpreadsheet_();
    setupIMS();
    requireFields_(movementData, ['itemCode', 'type', 'qty']);
    var itemCode = normalizeCode_(movementData.itemCode);
    ensureItemExists_(ss, itemCode);
    var qty = toNumber_(movementData.qty);
    if (qty <= 0) throw new Error('Qty must be greater than zero.');
    var type = String(movementData.type || '').trim();
    if (['IN', 'OUT', 'ADJUSTMENT'].indexOf(type) === -1) {
      throw new Error('Movement type must be IN, OUT or ADJUSTMENT.');
    }
    var rate = toNumber_(movementData.rate);
    var movementId = generateId_(ss.getSheetByName(IMS_SHEETS.ledger), 'MOV');
    ss.getSheetByName(IMS_SHEETS.ledger).appendRow([
      movementId,
      movementData.date || today_(),
      itemCode,
      type,
      qty,
      movementData.uom || 'Mtr',
      movementData.source || 'Manual',
      movementData.referenceId || '',
      movementData.party || '',
      rate,
      rate * qty,
      movementData.remarks || '',
      formatDateTime_(new Date())
    ]);
    recalculateInventory();
    return { success: true, message: 'Stock movement ' + movementId + ' saved.', movementId: movementId };
  } catch (err) {
    return fail_(err);
  }
}

function saveNewOrder(orderData) {
  try {
    var ss = getSpreadsheet_();
    setupIMS();
    requireFields_(orderData, ['clientName', 'itemCode', 'qty']);
    var itemCode = normalizeCode_(orderData.itemCode);
    ensureItemExists_(ss, itemCode);
    var orderId = generateId_(ss.getSheetByName(IMS_SHEETS.orders), 'ORD');
    var qty = toNumber_(orderData.qty);
    if (qty <= 0) throw new Error('Order quantity must be greater than zero.');
    var rate = toNumber_(orderData.rate);
    ss.getSheetByName(IMS_SHEETS.orders).appendRow([
      orderId,
      orderData.date || today_(),
      orderData.clientName,
      itemCode,
      qty,
      rate,
      orderData.dueDate || '',
      orderData.priority || 'Normal',
      orderData.status || 'Pending',
      orderData.remarks || '',
      formatDateTime_(new Date()),
      formatDateTime_(new Date())
    ]);
    upsertClient_(ss, orderData.clientName);
    recalculateInventory();
    return { success: true, orderId: orderId, message: 'Order ' + orderId + ' saved.' };
  } catch (err) {
    return fail_(err);
  }
}

function updateOrderStatus(orderId, newStatus) {
  try {
    var ss = getSpreadsheet_();
    var sheet = ss.getSheetByName(IMS_SHEETS.orders);
    var row = findRowByValue_(sheet, 'Order ID', orderId);
    if (row < 2) throw new Error('Order ID not found.');
    setCellByHeader_(sheet, row, 'Status', newStatus);
    setCellByHeader_(sheet, row, 'Last Updated', formatDateTime_(new Date()));
    recalculateInventory();
    return { success: true, message: 'Order ' + orderId + ' updated to ' + newStatus + '.' };
  } catch (err) {
    return fail_(err);
  }
}

function saveNewJobWork(jobData) {
  try {
    var ss = getSpreadsheet_();
    setupIMS();
    requireFields_(jobData, ['workerName', 'itemCode', 'sentQty']);
    var itemCode = normalizeCode_(jobData.itemCode);
    ensureItemExists_(ss, itemCode);
    var sentQty = toNumber_(jobData.sentQty);
    if (sentQty <= 0) throw new Error('Sent quantity must be greater than zero.');
    var receivedQty = toNumber_(jobData.receivedQty);
    var wastage = toNumber_(jobData.wastageMtr);
    var rate = toNumber_(jobData.rate) || IMS_CONFIG.defaultJobRate;
    var jobId = generateId_(ss.getSheetByName(IMS_SHEETS.jobs), 'JOB');
    ss.getSheetByName(IMS_SHEETS.jobs).appendRow([
      jobData.date || today_(),
      jobId,
      jobData.orderId || '',
      jobData.workerName,
      itemCode,
      sentQty,
      receivedQty,
      wastage,
      rate,
      (receivedQty || sentQty) * rate,
      jobData.status || 'Out',
      jobData.dueDate || '',
      jobData.remarks || '',
      formatDateTime_(new Date()),
      formatDateTime_(new Date())
    ]);
    upsertVendor_(ss, jobData.workerName, 'Job Work', rate);
    if (jobData.orderId) updateOrderStatus(jobData.orderId, 'In Production');
    return { success: true, jobId: jobId, message: 'Job work ' + jobId + ' saved.' };
  } catch (err) {
    return fail_(err);
  }
}

function updateJobWork(jobId, patch) {
  try {
    var ss = getSpreadsheet_();
    var sheet = ss.getSheetByName(IMS_SHEETS.jobs);
    var row = findRowByValue_(sheet, 'Job ID', jobId);
    if (row < 2) throw new Error('Job ID not found.');
    var fields = {
      receivedQty: 'Received Qty',
      wastageMtr: 'Wastage',
      rate: 'Rate',
      status: 'Status',
      dueDate: 'Due Date',
      remarks: 'Remarks'
    };
    Object.keys(fields).forEach(function(key) {
      if (patch[key] !== undefined) setCellByHeader_(sheet, row, fields[key], patch[key]);
    });
    var received = toNumber_(getCellByHeader_(sheet, row, 'Received Qty'));
    var rate = toNumber_(getCellByHeader_(sheet, row, 'Rate')) || IMS_CONFIG.defaultJobRate;
    setCellByHeader_(sheet, row, 'Total Payment', received * rate);
    setCellByHeader_(sheet, row, 'Last Updated', formatDateTime_(new Date()));
    return { success: true, message: 'Job work ' + jobId + ' updated.' };
  } catch (err) {
    return fail_(err);
  }
}

function saveNewDispatch(dispatchData) {
  try {
    var ss = getSpreadsheet_();
    setupIMS();
    requireFields_(dispatchData, ['orderId', 'clientName', 'itemCode', 'dispatchedQty']);
    var itemCode = normalizeCode_(dispatchData.itemCode);
    ensureItemExists_(ss, itemCode);
    var qty = toNumber_(dispatchData.dispatchedQty);
    if (qty <= 0) throw new Error('Dispatch quantity must be greater than zero.');
    var dispatchId = generateId_(ss.getSheetByName(IMS_SHEETS.dispatch), 'DISP');
    ss.getSheetByName(IMS_SHEETS.dispatch).appendRow([
      dispatchId,
      dispatchData.orderId,
      dispatchData.clientName,
      itemCode,
      qty,
      dispatchData.dispatchDate || today_(),
      dispatchData.challanNo || '',
      dispatchData.transporter || '',
      dispatchData.lrNo || '',
      dispatchData.remarks || '',
      formatDateTime_(new Date())
    ]);
    saveStockMovement({
      date: dispatchData.dispatchDate || today_(),
      itemCode: itemCode,
      type: 'OUT',
      qty: qty,
      source: 'Dispatch',
      referenceId: dispatchId,
      party: dispatchData.clientName,
      remarks: 'Dispatch against ' + dispatchData.orderId
    });
    if (dispatchData.markCompleted || isOrderFullyDispatched_(ss, dispatchData.orderId)) {
      updateOrderStatus(dispatchData.orderId, 'Completed');
    }
    return { success: true, dispatchId: dispatchId, message: 'Dispatch ' + dispatchId + ' logged.' };
  } catch (err) {
    return fail_(err);
  }
}

function recalculateInventory() {
  var ss = getSpreadsheet_();
  Object.keys(IMS_HEADERS).forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    ensureHeaders_(sheet, IMS_HEADERS[sheetName]);
  });

  var masterSheet = ss.getSheetByName(IMS_SHEETS.master);
  var master = readRecords_(ss, IMS_SHEETS.master);
  var ledger = readRecords_(ss, IMS_SHEETS.ledger);
  var orders = readRecords_(ss, IMS_SHEETS.orders);

  var movementMap = {};
  ledger.forEach(function(m) {
    var code = normalizeCode_(m.ItemCode);
    if (!movementMap[code]) movementMap[code] = { inQty: 0, outQty: 0, adjustment: 0 };
    var qty = toNumber_(m.Qty);
    if (m.Type === 'IN') movementMap[code].inQty += qty;
    if (m.Type === 'OUT') movementMap[code].outQty += qty;
    if (m.Type === 'ADJUSTMENT') movementMap[code].adjustment += qty;
  });

  var allocationMap = {};
  orders.forEach(function(order) {
    if (['Pending', 'In Production', 'Ready'].indexOf(order.Status) !== -1) {
      var code = normalizeCode_(order.ItemCode);
      allocationMap[code] = (allocationMap[code] || 0) + toNumber_(order.OrderedQty);
    }
  });

  master.forEach(function(item, index) {
    var row = index + 2;
    var code = normalizeCode_(item.ItemCode);
    var movement = movementMap[code] || { inQty: 0, outQty: 0, adjustment: 0 };
    var opening = toNumber_(item.OpeningStock);
    var closing = opening + movement.inQty - movement.outQty + movement.adjustment;
    var allocated = allocationMap[code] || 0;
    var reorder = toNumber_(item.ReorderLevel) || IMS_CONFIG.defaultReorderLevel;
    var target = toNumber_(item.TargetLevel) || IMS_CONFIG.defaultTargetLevel;
    var rate = toNumber_(item.Rate);
    var status = 'NORMAL';
    if (closing <= reorder) status = 'REORDER (LOW)';
    if (closing >= target) status = 'ABOVE LEVEL';

    setCellByHeader_(masterSheet, row, 'Total In', movement.inQty);
    setCellByHeader_(masterSheet, row, 'Total Out', movement.outQty);
    setCellByHeader_(masterSheet, row, 'Allocated to Orders', allocated);
    setCellByHeader_(masterSheet, row, 'Closing Balance', closing);
    setCellByHeader_(masterSheet, row, 'Stock Value', closing * rate);
    setCellByHeader_(masterSheet, row, 'Reorder Status', status);
    setCellByHeader_(masterSheet, row, 'Last Updated', formatDateTime_(new Date()));
  });

  return { success: true, message: 'Inventory recalculated.' };
}

function getStockAlerts() {
  var ss = getSpreadsheet_();
  recalculateInventory();
  return buildAlerts_(
    readRecords_(ss, IMS_SHEETS.master),
    readRecords_(ss, IMS_SHEETS.orders),
    readRecords_(ss, IMS_SHEETS.jobs)
  );
}

function computeKPIs_(master, ledger, orders, jobs, dispatch) {
  var openStatuses = ['Pending', 'In Production', 'Ready'];
  var today = today_();
  var reorderItems = master.filter(function(item) { return item.ReorderStatus === 'REORDER (LOW)'; });
  var activeOrders = orders.filter(function(o) { return openStatuses.indexOf(o.Status) !== -1; });
  var completedOrders = orders.filter(function(o) { return o.Status === 'Completed'; });
  var overdueOrders = activeOrders.filter(function(o) { return o.DueDate && o.DueDate < today; });
  var liveJobs = jobs.filter(function(j) { return j.Status !== 'Completed'; });
  var overdueJobs = liveJobs.filter(function(j) { return j.DueDate && j.DueDate < today; });
  var totalStockValue = sum_(master, 'StockValue');
  var totalClosing = sum_(master, 'ClosingBalance');
  var totalDispatched = sum_(dispatch, 'DispatchedQty');
  var totalOrderQty = sum_(orders, 'OrderedQty');
  var totalDispatchValue = dispatch.reduce(function(sum, d) {
    var item = master.find(function(m) { return normalizeCode_(m.ItemCode) === normalizeCode_(d.ItemCode); });
    return sum + (toNumber_(d.DispatchedQty) * (item ? toNumber_(item.Rate) : 0));
  }, 0);

  var dispatchedByOrder = {};
  dispatch.forEach(function(d) {
    dispatchedByOrder[d.OrderID] = (dispatchedByOrder[d.OrderID] || 0) + toNumber_(d.DispatchedQty);
  });
  var pendingDispatchQty = orders.reduce(function(sum, o) {
    return sum + Math.max(0, toNumber_(o.OrderedQty) - (dispatchedByOrder[o.OrderID] || 0));
  }, 0);

  var sent = 0;
  var waste = 0;
  jobs.forEach(function(j) {
    sent += toNumber_(j.SentQty);
    waste += toNumber_(j.Wastage);
  });

  return {
    totalItems: master.length,
    totalStockMtr: totalClosing,
    totalStockValue: totalStockValue,
    reorderCount: reorderItems.length,
    reorderItems: reorderItems.map(function(i) { return i.ItemCode; }).slice(0, 8),
    totalOrderCount: orders.length,
    activeOrderCount: activeOrders.length,
    pendingOrderCount: orders.filter(function(o) { return o.Status === 'Pending'; }).length,
    productionOrderCount: orders.filter(function(o) { return o.Status === 'In Production'; }).length,
    readyOrderCount: orders.filter(function(o) { return o.Status === 'Ready'; }).length,
    completedOrderCount: completedOrders.length,
    overdueOrderCount: overdueOrders.length,
    fulfilmentRate: orders.length ? round_((completedOrders.length / orders.length) * 100, 1) : 0,
    totalOrderQty: totalOrderQty,
    pendingDispatchQty: pendingDispatchQty,
    jwLiveCount: liveJobs.length,
    overdueJobCount: overdueJobs.length,
    avgWastagePct: sent ? round_((waste / sent) * 100, 2) : 0,
    totalDispatched: totalDispatched,
    totalDispatchValue: totalDispatchValue,
    categoryBreakdown: categoryBreakdown_(master),
    topItems: topItems_(master),
    topClients: topClients_(orders, dispatch),
    monthlyDispatch: monthlyDispatch_(dispatch),
    ledgerMovement: movementSummary_(ledger),
    stockStatusCounts: stockStatusCounts_(master)
  };
}

function buildAlerts_(master, orders, jobs) {
  var today = today_();
  var alerts = [];
  master.forEach(function(item) {
    var bal = toNumber_(item.ClosingBalance);
    var alloc = toNumber_(item.AllocatedtoOrders);
    if (item.ReorderStatus === 'REORDER (LOW)') {
      alerts.push({
        type: 'critical',
        area: 'Inventory',
        title: item.ItemCode + ' is below reorder level',
        detail: (item.ItemName || '') + ' has ' + bal + ' ' + (item.UOM || 'Mtr') + ' against reorder level ' + item.ReorderLevel + '.',
        action: 'Raise purchase / production immediately.'
      });
    } else if (bal > 0 && alloc / bal >= 0.8) {
      alerts.push({
        type: 'warning',
        area: 'Inventory',
        title: item.ItemCode + ' is heavily allocated',
        detail: alloc + ' of ' + bal + ' ' + (item.UOM || 'Mtr') + ' is committed to open orders.',
        action: 'Check upcoming dispatch and replenishment.'
      });
    }
  });
  orders.forEach(function(order) {
    if (order.DueDate && order.DueDate < today && order.Status !== 'Completed') {
      alerts.push({
        type: 'critical',
        area: 'Orders',
        title: order.OrderID + ' is overdue',
        detail: order.ClientName + ' / ' + order.ItemCode + ' was due on ' + order.DueDate + '.',
        action: 'Review job work and dispatch status.'
      });
    }
  });
  jobs.forEach(function(job) {
    var sent = toNumber_(job.SentQty);
    var wastagePct = sent ? (toNumber_(job.Wastage) / sent) * 100 : 0;
    if (wastagePct > IMS_CONFIG.criticalWastagePct) {
      alerts.push({
        type: 'warning',
        area: 'Job Work',
        title: job.JobID + ' wastage is high',
        detail: job.WorkerName + ' recorded ' + round_(wastagePct, 1) + '% wastage.',
        action: 'Verify cutting/processing loss before payment.'
      });
    }
  });
  return alerts;
}

function categoryBreakdown_(master) {
  var map = {};
  master.forEach(function(item) {
    var category = item.Category || 'Other';
    if (!map[category]) map[category] = { count: 0, totalStock: 0, value: 0 };
    map[category].count += 1;
    map[category].totalStock += toNumber_(item.ClosingBalance);
    map[category].value += toNumber_(item.StockValue);
  });
  return map;
}

function topItems_(master) {
  return master
    .slice()
    .sort(function(a, b) { return toNumber_(b.StockValue) - toNumber_(a.StockValue); })
    .slice(0, 8)
    .map(function(item) {
      return {
        code: item.ItemCode,
        name: item.ItemName,
        balance: toNumber_(item.ClosingBalance),
        value: toNumber_(item.StockValue)
      };
    });
}

function topClients_(orders, dispatch) {
  var map = {};
  orders.forEach(function(order) {
    var client = order.ClientName || 'Unknown';
    if (!map[client]) map[client] = { client: client, orders: 0, qty: 0, dispatched: 0 };
    map[client].orders += 1;
    map[client].qty += toNumber_(order.OrderedQty);
  });
  dispatch.forEach(function(d) {
    var client = d.ClientName || 'Unknown';
    if (!map[client]) map[client] = { client: client, orders: 0, qty: 0, dispatched: 0 };
    map[client].dispatched += toNumber_(d.DispatchedQty);
  });
  return Object.keys(map).map(function(k) { return map[k]; })
    .sort(function(a, b) { return b.qty - a.qty; })
    .slice(0, 8);
}

function monthlyDispatch_(dispatch) {
  var map = {};
  dispatch.forEach(function(d) {
    if (!d.DispatchDate) return;
    var month = String(d.DispatchDate).substring(0, 7);
    map[month] = (map[month] || 0) + toNumber_(d.DispatchedQty);
  });
  return map;
}

function movementSummary_(ledger) {
  return ledger.reduce(function(summary, movement) {
    var type = movement.Type || 'OTHER';
    summary[type] = (summary[type] || 0) + toNumber_(movement.Qty);
    return summary;
  }, {});
}

function stockStatusCounts_(master) {
  return master.reduce(function(summary, item) {
    var status = item.ReorderStatus || 'NORMAL';
    summary[status] = (summary[status] || 0) + 1;
    return summary;
  }, {});
}

function readRecords_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(keyForHeader_);
  return values.slice(1).map(function(row, rowIndex) {
    var obj = { _row: rowIndex + 2 };
    var hasData = false;
    headers.forEach(function(key, idx) {
      var value = normalizeValue_(row[idx]);
      if (value !== '' && value !== null && value !== undefined) hasData = true;
      obj[key] = value;
    });
    return hasData ? obj : null;
  }).filter(Boolean);
}

function ensureHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }
  var current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  headers.forEach(function(header, index) {
    if (current[index] !== header) sheet.getRange(1, index + 1).setValue(header);
  });
}

function formatSheet_(sheet, sheetName) {
  var headers = IMS_HEADERS[sheetName];
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#0d1b2a')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  sheet.autoResizeColumns(1, headers.length);
}

function seedSettings_(ss) {
  var sheet = ss.getSheetByName(IMS_SHEETS.settings);
  if (sheet.getLastRow() > 1) return;
  sheet.getRange(2, 1, 6, 3).setValues([
    ['Company Name', IMS_CONFIG.companyName, 'Shown in dashboard'],
    ['Default Job Rate', IMS_CONFIG.defaultJobRate, 'Payment per metre'],
    ['Critical Wastage %', IMS_CONFIG.criticalWastagePct, 'Job work warning threshold'],
    ['Default Reorder Level', IMS_CONFIG.defaultReorderLevel, 'Used for new items'],
    ['Default Target Level', IMS_CONFIG.defaultTargetLevel, 'Used for new items'],
    ['Currency', IMS_CONFIG.currency, 'Dashboard currency label']
  ]);
}

function seedStarterRows_(ss) {
  var master = ss.getSheetByName(IMS_SHEETS.master);
  if (master.getLastRow() < 2) {
    master.getRange(2, 1, 4, IMS_HEADERS[IMS_SHEETS.master].length).setValues([
      ['SATIN-3MM-WHT', '3 MM Satin White', 'Satin', 'Mtr', 'White', '3 MM', '', 0, 1200, 0, 0, 0, 250, 1500, 18, 0, 0, 'NORMAL', 'Rack A1', 'Primary Supplier', formatDateTime_(new Date())],
      ['TAPE-25MM-BLK', '25 MM Tape Black', 'Tape', 'Mtr', 'Black', '25 MM', '', 0, 800, 0, 0, 0, 150, 1000, 7.5, 0, 0, 'NORMAL', 'Rack B2', 'Primary Supplier', formatDateTime_(new Date())],
      ['ELASTIC-12MM', '12 MM Elastic', 'Elastic', 'Mtr', 'Natural', '12 MM', '', 0, 500, 0, 0, 0, 100, 800, 5.25, 0, 0, 'NORMAL', 'Rack C1', 'Primary Supplier', formatDateTime_(new Date())],
      ['LINING-60GSM', '60 GSM Lining Fabric', 'Fabric', 'Mtr', 'Grey', '44 in', 60, 0, 300, 0, 0, 0, 75, 600, 22, 0, 0, 'NORMAL', 'Rack D1', 'Primary Supplier', formatDateTime_(new Date())]
    ]);
  }
  var clients = ss.getSheetByName(IMS_SHEETS.clients);
  if (clients.getLastRow() < 2) {
    clients.getRange(2, 1, 3, IMS_HEADERS[IMS_SHEETS.clients].length).setValues([
      ['Sample Buyer', 'Purchase Manager', '', '', 'Delhi', '', 30, 'Starter client'],
      ['Export House A', 'Merchandiser', '', '', 'Noida', '', 45, 'Starter client'],
      ['Garment Unit B', 'Owner', '', '', 'Jaipur', '', 30, 'Starter client']
    ]);
  }
  var vendors = ss.getSheetByName(IMS_SHEETS.vendors);
  if (vendors.getLastRow() < 2) {
    vendors.getRange(2, 1, 3, IMS_HEADERS[IMS_SHEETS.vendors].length).setValues([
      ['In-house Cutting', 'Job Work', 'Supervisor', '', 'Factory', IMS_CONFIG.defaultJobRate, ''],
      ['Dyeing Partner', 'Processing', 'Manager', '', 'Local', 0, ''],
      ['Packing Team', 'Packing', 'Supervisor', '', 'Factory', 0, '']
    ]);
  }
}

function applyValidations_(ss) {
  setValidation_(ss.getSheetByName(IMS_SHEETS.ledger), 'Type', ['IN', 'OUT', 'ADJUSTMENT']);
  setValidation_(ss.getSheetByName(IMS_SHEETS.orders), 'Priority', ['Low', 'Normal', 'High', 'Urgent']);
  setValidation_(ss.getSheetByName(IMS_SHEETS.orders), 'Status', ['Pending', 'In Production', 'Ready', 'Completed', 'Cancelled']);
  setValidation_(ss.getSheetByName(IMS_SHEETS.jobs), 'Status', ['Out', 'Part Received', 'Completed', 'Hold']);
}

function setValidation_(sheet, header, values) {
  if (!sheet) return;
  var col = headerIndex_(sheet, header);
  if (col < 1) return;
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(values, true).build();
  sheet.getRange(2, col, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(rule);
}

function generateId_(sheet, prefix) {
  var datePart = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  var count = Math.max(sheet.getLastRow() - 1, 0) + 1;
  return prefix + '-' + datePart + '-' + String(count).padStart(4, '0');
}

function ensureItemExists_(ss, itemCode) {
  var row = findRowByValue_(ss.getSheetByName(IMS_SHEETS.master), 'Item Code', itemCode);
  if (row < 2) throw new Error('Item Code not found in Master: ' + itemCode);
}

function upsertClient_(ss, clientName) {
  if (!clientName) return;
  var sheet = ss.getSheetByName(IMS_SHEETS.clients);
  if (findRowByValue_(sheet, 'Client Name', clientName) > 1) return;
  sheet.appendRow([clientName, '', '', '', '', '', 30, 'Auto-created from order']);
}

function upsertVendor_(ss, vendorName, type, rate) {
  if (!vendorName) return;
  var sheet = ss.getSheetByName(IMS_SHEETS.vendors);
  if (findRowByValue_(sheet, 'Vendor Name', vendorName) > 1) return;
  sheet.appendRow([vendorName, type || 'Job Work', '', '', '', rate || 0, 'Auto-created from job work']);
}

function isOrderFullyDispatched_(ss, orderId) {
  var orders = readRecords_(ss, IMS_SHEETS.orders);
  var dispatch = readRecords_(ss, IMS_SHEETS.dispatch);
  var order = orders.find(function(o) { return o.OrderID === orderId; });
  if (!order) return false;
  var dispatched = dispatch.reduce(function(sum, d) {
    return d.OrderID === orderId ? sum + toNumber_(d.DispatchedQty) : sum;
  }, 0);
  return dispatched >= toNumber_(order.OrderedQty);
}

function findRowByValue_(sheet, header, value) {
  if (!sheet || sheet.getLastRow() < 2) return -1;
  var col = headerIndex_(sheet, header);
  if (col < 1) return -1;
  var values = sheet.getRange(2, col, sheet.getLastRow() - 1, 1).getValues();
  var needle = String(value).trim().toLowerCase();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === needle) return i + 2;
  }
  return -1;
}

function headerIndex_(sheet, header) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return -1;
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (headers[i] === header) return i + 1;
  }
  return -1;
}

function setCellByHeader_(sheet, row, header, value) {
  var col = headerIndex_(sheet, header);
  if (col > 0) sheet.getRange(row, col).setValue(value);
}

function getCellByHeader_(sheet, row, header) {
  var col = headerIndex_(sheet, header);
  if (col < 1) return '';
  return sheet.getRange(row, col).getValue();
}

function normalizeValue_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return value;
}

function keyForHeader_(header) {
  return String(header).replace(/[^a-zA-Z0-9]/g, '');
}

function normalizeCode_(value) {
  return String(value || '').trim().toUpperCase();
}

function requireFields_(data, fields) {
  fields.forEach(function(field) {
    if (data[field] === undefined || data[field] === null || String(data[field]).trim() === '') {
      throw new Error(field + ' is required.');
    }
  });
}

function toNumber_(value) {
  var number = parseFloat(value);
  return isNaN(number) ? 0 : number;
}

function sum_(rows, key) {
  return rows.reduce(function(total, row) { return total + toNumber_(row[key]); }, 0);
}

function uniqueValues_(values) {
  var seen = {};
  values.filter(Boolean).forEach(function(value) {
    seen[String(value).trim()] = true;
  });
  return Object.keys(seen).sort();
}

function round_(value, places) {
  var factor = Math.pow(10, places || 0);
  return Math.round(value * factor) / factor;
}

function today_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function formatDateTime_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd MMM yyyy, hh:mm a');
}

function fail_(err) {
  return {
    success: false,
    message: err && err.message ? err.message : String(err)
  };
}
