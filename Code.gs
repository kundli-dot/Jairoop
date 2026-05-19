// ============================================================
// JAI ROOP TEXTILES - IMS System V7
// Google Apps Script backend for a Google Sheets based IMS
// ============================================================

const IMS_CONFIG = {
  VERSION: '7.0',
  COMPANY: 'Jai Roop Textiles',
  SPREADSHEET_ID: '19DMKtsGlL2GvDAZSW7tfJ8S-8Vi_vk0dka_IG-hIbWw',
  SHEETS: {
    MASTER: 'Master',
    ORDERS: 'Order Book',
    JOB_WORK: 'Job Work Tracker',
    DISPATCH: 'Dispatch Log',
    PURCHASES: 'Purchase Register',
    LEDGER: 'Stock Ledger',
    SETTINGS: 'Settings'
  },
  ACTIVE_ORDER_STATUSES: ['Pending', 'In Production'],
  LOW_WASTAGE_LIMIT: 4
};

const IMS_SCHEMAS = {
  'Master': [
    'Item Code', 'Item Name', 'Category', 'Unit', 'Colour', 'GSM/Weight',
    'Opening Stock', 'Reorder Level', 'Target Stock', 'Total In', 'Total Out',
    'Allocated To Orders', 'In Job Work', 'Closing Balance', 'Available Stock',
    'Reorder Status', 'Avg Rate', 'Location', 'Supplier', 'Last Updated'
  ],
  'Order Book': [
    'Order ID', 'Date', 'Client Name', 'PO No', 'Item Code', 'Ordered Qty',
    'Required Date', 'Rate', 'Status', 'Priority', 'Remarks', 'Created At', 'Updated At'
  ],
  'Job Work Tracker': [
    'Date', 'Job ID', 'Order ID', 'Worker Name', 'Process', 'Item Code',
    'Sent Qty', 'Received Qty', 'Wastage Qty', 'Rate', 'Total Payment',
    'Due Date', 'Status', 'Remarks', 'Created At'
  ],
  'Dispatch Log': [
    'Dispatch ID', 'Order ID', 'Client Name', 'Item Code', 'Dispatched Qty',
    'Dispatch Date', 'Challan No', 'Transport', 'LR No', 'Freight',
    'Remarks', 'Created At'
  ],
  'Purchase Register': [
    'Purchase ID', 'Date', 'Supplier', 'Item Code', 'Qty', 'Rate',
    'Amount', 'Invoice No', 'Status', 'Remarks', 'Created At'
  ],
  'Stock Ledger': [
    'Txn ID', 'Date', 'Type', 'Item Code', 'Qty', 'Unit', 'Reference Type',
    'Reference ID', 'Party', 'Rate', 'Amount', 'Remarks', 'Created At'
  ],
  'Settings': ['Key', 'Value', 'Notes']
};

function doGet() {
  ensureIMSSetup();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('IMS Dashboard - Jai Roop Textiles')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Jai Roop IMS')
    .addItem('Setup / Repair IMS Sheets', 'setupIMS')
    .addItem('Refresh Stock Balances', 'refreshStockBalances')
    .addItem('Open Web App', 'showWebAppHint')
    .addToUi();
}

function onEdit(e) {
  if (!e || !e.range) return;
  const sheetName = e.range.getSheet().getName();
  if ([IMS_CONFIG.SHEETS.ORDERS, IMS_CONFIG.SHEETS.JOB_WORK, IMS_CONFIG.SHEETS.DISPATCH, IMS_CONFIG.SHEETS.LEDGER, IMS_CONFIG.SHEETS.PURCHASES].indexOf(sheetName) !== -1) {
    syncMasterStock_(getIMSSpreadsheet_());
  }
}

function showWebAppHint() {
  SpreadsheetApp.getUi().alert('Deploy this Apps Script as a Web App, then open the deployment URL to use the dashboard.');
}

function setupIMS() {
  const ss = getIMSSpreadsheet_();
  Object.keys(IMS_SCHEMAS).forEach(function(sheetName) {
    ensureSheet_(ss, sheetName, IMS_SCHEMAS[sheetName]);
  });
  seedSettings_(ss);
  syncMasterStock_(ss);
  return { success: true, message: 'IMS sheets are ready.' };
}

function ensureIMSSetup() {
  return setupIMS();
}

function refreshStockBalances() {
  syncMasterStock_(getIMSSpreadsheet_());
  return { success: true, message: 'Stock balances refreshed.' };
}

function getAllIMSData() {
  const ss = getIMSSpreadsheet_();
  ensureIMSSetup();

  const master = readSheetObjects_(ss, IMS_CONFIG.SHEETS.MASTER);
  const orders = readSheetObjects_(ss, IMS_CONFIG.SHEETS.ORDERS);
  const jobWork = readSheetObjects_(ss, IMS_CONFIG.SHEETS.JOB_WORK);
  const dispatch = readSheetObjects_(ss, IMS_CONFIG.SHEETS.DISPATCH);
  const purchases = readSheetObjects_(ss, IMS_CONFIG.SHEETS.PURCHASES);
  const ledger = readSheetObjects_(ss, IMS_CONFIG.SHEETS.LEDGER);
  const settings = readSheetObjects_(ss, IMS_CONFIG.SHEETS.SETTINGS);
  const alerts = computeAlerts_(master, orders, jobWork);

  return {
    version: IMS_CONFIG.VERSION,
    company: IMS_CONFIG.COMPANY,
    master: master,
    orders: orders,
    jobWork: jobWork,
    dispatch: dispatch,
    purchases: purchases,
    ledger: ledger,
    settings: settings,
    clients: uniqueSorted_(orders.map(function(o) { return o.ClientName; })),
    workers: uniqueSorted_(jobWork.map(function(j) { return j.WorkerName; })),
    suppliers: uniqueSorted_(purchases.map(function(p) { return p.Supplier; }).concat(master.map(function(m) { return m.Supplier; }))),
    items: uniqueSorted_(master.map(function(i) { return i.ItemCode; })),
    alerts: alerts,
    kpis: computeKPIs_(master, orders, jobWork, dispatch, purchases, alerts),
    lastSync: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd MMM yyyy, hh:mm a')
  };
}

function saveMasterItem(itemData) {
  try {
    requireFields_(itemData, ['itemCode', 'itemName']);
    const ss = getIMSSpreadsheet_();
    ensureIMSSetup();
    const sheet = ss.getSheetByName(IMS_CONFIG.SHEETS.MASTER);
    const row = findRowByKey_(sheet, 'Item Code', itemData.itemCode);
    const payload = {
      'Item Code': clean_(itemData.itemCode),
      'Item Name': clean_(itemData.itemName),
      'Category': clean_(itemData.category),
      'Unit': clean_(itemData.unit) || 'Mtr',
      'Colour': clean_(itemData.colour),
      'GSM/Weight': clean_(itemData.gsmWeight),
      'Opening Stock': num_(itemData.openingStock),
      'Reorder Level': num_(itemData.reorderLevel),
      'Target Stock': num_(itemData.targetStock),
      'Avg Rate': num_(itemData.avgRate),
      'Location': clean_(itemData.location),
      'Supplier': clean_(itemData.supplier),
      'Last Updated': now_()
    };
    upsertRow_(sheet, row, payload);
    syncMasterStock_(ss);
    return { success: true, message: 'Item saved successfully.' };
  } catch (err) {
    return error_(err);
  }
}

function savePurchase(purchaseData) {
  try {
    requireFields_(purchaseData, ['supplier', 'itemCode', 'qty']);
    const ss = getIMSSpreadsheet_();
    ensureIMSSetup();
    const qty = num_(purchaseData.qty);
    const rate = num_(purchaseData.rate);
    const purchaseId = generateId_('PUR', ss.getSheetByName(IMS_CONFIG.SHEETS.PURCHASES));

    appendRow_(ss, IMS_CONFIG.SHEETS.PURCHASES, {
      'Purchase ID': purchaseId,
      'Date': normalizeDate_(purchaseData.date),
      'Supplier': clean_(purchaseData.supplier),
      'Item Code': clean_(purchaseData.itemCode),
      'Qty': qty,
      'Rate': rate,
      'Amount': qty * rate,
      'Invoice No': clean_(purchaseData.invoiceNo),
      'Status': clean_(purchaseData.status) || 'Received',
      'Remarks': clean_(purchaseData.remarks),
      'Created At': now_()
    });

    appendStockLedger_(ss, {
      date: purchaseData.date,
      type: 'Purchase In',
      itemCode: purchaseData.itemCode,
      qty: qty,
      referenceType: 'Purchase',
      referenceId: purchaseId,
      party: purchaseData.supplier,
      rate: rate,
      remarks: purchaseData.remarks
    });

    syncMasterStock_(ss);
    return { success: true, purchaseId: purchaseId, message: 'Purchase ' + purchaseId + ' saved.' };
  } catch (err) {
    return error_(err);
  }
}

function saveStockMovement(moveData) {
  try {
    requireFields_(moveData, ['type', 'itemCode', 'qty']);
    const ss = getIMSSpreadsheet_();
    ensureIMSSetup();
    const txnId = appendStockLedger_(ss, moveData);
    syncMasterStock_(ss);
    return { success: true, txnId: txnId, message: 'Stock movement ' + txnId + ' saved.' };
  } catch (err) {
    return error_(err);
  }
}

function saveNewOrder(orderData) {
  try {
    requireFields_(orderData, ['clientName', 'itemCode', 'qty']);
    const ss = getIMSSpreadsheet_();
    ensureIMSSetup();
    const orderId = generateId_('ORD', ss.getSheetByName(IMS_CONFIG.SHEETS.ORDERS));
    appendRow_(ss, IMS_CONFIG.SHEETS.ORDERS, {
      'Order ID': orderId,
      'Date': normalizeDate_(orderData.date),
      'Client Name': clean_(orderData.clientName),
      'PO No': clean_(orderData.poNo),
      'Item Code': clean_(orderData.itemCode),
      'Ordered Qty': num_(orderData.qty),
      'Required Date': optionalDate_(orderData.requiredDate),
      'Rate': num_(orderData.rate),
      'Status': clean_(orderData.status) || 'Pending',
      'Priority': clean_(orderData.priority) || 'Normal',
      'Remarks': clean_(orderData.remarks),
      'Created At': now_(),
      'Updated At': now_()
    });
    syncMasterStock_(ss);
    return { success: true, orderId: orderId, message: 'Order ' + orderId + ' saved.' };
  } catch (err) {
    return error_(err);
  }
}

function updateOrderStatus(orderId, newStatus) {
  try {
    requireFields_({ orderId: orderId, newStatus: newStatus }, ['orderId', 'newStatus']);
    const ss = getIMSSpreadsheet_();
    const sheet = ss.getSheetByName(IMS_CONFIG.SHEETS.ORDERS);
    const row = findRowByKey_(sheet, 'Order ID', orderId);
    if (!row) throw new Error('Order ID not found.');
    setRowValues_(sheet, row, { 'Status': clean_(newStatus), 'Updated At': now_() });
    syncMasterStock_(ss);
    return { success: true, message: 'Order ' + orderId + ' updated to ' + newStatus + '.' };
  } catch (err) {
    return error_(err);
  }
}

function saveNewJobWork(jobData) {
  try {
    requireFields_(jobData, ['workerName', 'itemCode', 'sentQty']);
    const ss = getIMSSpreadsheet_();
    ensureIMSSetup();
    const sentQty = num_(jobData.sentQty);
    const receivedQty = num_(jobData.receivedQty);
    const wastageQty = num_(jobData.wastageQty || jobData.wastageMtr);
    const rate = num_(jobData.rate);
    const jobId = generateId_('JOB', ss.getSheetByName(IMS_CONFIG.SHEETS.JOB_WORK));
    appendRow_(ss, IMS_CONFIG.SHEETS.JOB_WORK, {
      'Date': normalizeDate_(jobData.date),
      'Job ID': jobId,
      'Order ID': clean_(jobData.orderId),
      'Worker Name': clean_(jobData.workerName),
      'Process': clean_(jobData.process) || 'Job Work',
      'Item Code': clean_(jobData.itemCode),
      'Sent Qty': sentQty,
      'Received Qty': receivedQty,
      'Wastage Qty': wastageQty,
      'Rate': rate,
      'Total Payment': num_(jobData.totalPayment) || receivedQty * rate,
      'Due Date': optionalDate_(jobData.dueDate),
      'Status': clean_(jobData.status) || 'Out',
      'Remarks': clean_(jobData.remarks),
      'Created At': now_()
    });
    syncMasterStock_(ss);
    return { success: true, jobId: jobId, message: 'Job work ' + jobId + ' saved.' };
  } catch (err) {
    return error_(err);
  }
}

function updateJobWork(jobId, jobData) {
  try {
    requireFields_({ jobId: jobId }, ['jobId']);
    const ss = getIMSSpreadsheet_();
    const sheet = ss.getSheetByName(IMS_CONFIG.SHEETS.JOB_WORK);
    const row = findRowByKey_(sheet, 'Job ID', jobId);
    if (!row) throw new Error('Job ID not found.');
    setRowValues_(sheet, row, {
      'Received Qty': num_(jobData.receivedQty),
      'Wastage Qty': num_(jobData.wastageQty),
      'Total Payment': num_(jobData.totalPayment),
      'Status': clean_(jobData.status) || 'Completed',
      'Remarks': clean_(jobData.remarks)
    });
    syncMasterStock_(ss);
    return { success: true, message: 'Job work ' + jobId + ' updated.' };
  } catch (err) {
    return error_(err);
  }
}

function saveNewDispatch(dispatchData) {
  try {
    requireFields_(dispatchData, ['orderId', 'clientName', 'itemCode', 'dispatchedQty']);
    const ss = getIMSSpreadsheet_();
    ensureIMSSetup();
    const qty = num_(dispatchData.dispatchedQty);
    const dispId = generateId_('DISP', ss.getSheetByName(IMS_CONFIG.SHEETS.DISPATCH));

    appendRow_(ss, IMS_CONFIG.SHEETS.DISPATCH, {
      'Dispatch ID': dispId,
      'Order ID': clean_(dispatchData.orderId),
      'Client Name': clean_(dispatchData.clientName),
      'Item Code': clean_(dispatchData.itemCode),
      'Dispatched Qty': qty,
      'Dispatch Date': normalizeDate_(dispatchData.dispatchDate),
      'Challan No': clean_(dispatchData.challanNo),
      'Transport': clean_(dispatchData.transport),
      'LR No': clean_(dispatchData.lrNo),
      'Freight': num_(dispatchData.freight),
      'Remarks': clean_(dispatchData.remarks),
      'Created At': now_()
    });

    appendStockLedger_(ss, {
      date: dispatchData.dispatchDate,
      type: 'Dispatch Out',
      itemCode: dispatchData.itemCode,
      qty: qty,
      referenceType: 'Dispatch',
      referenceId: dispId,
      party: dispatchData.clientName,
      rate: dispatchData.rate,
      remarks: dispatchData.challanNo
    });

    if (dispatchData.markCompleted) {
      updateOrderStatus(dispatchData.orderId, 'Completed');
    }
    syncMasterStock_(ss);
    return { success: true, dispId: dispId, message: 'Dispatch ' + dispId + ' logged.' };
  } catch (err) {
    return error_(err);
  }
}

function getStockAlerts() {
  const ss = getIMSSpreadsheet_();
  syncMasterStock_(ss);
  return computeAlerts_(
    readSheetObjects_(ss, IMS_CONFIG.SHEETS.MASTER),
    readSheetObjects_(ss, IMS_CONFIG.SHEETS.ORDERS),
    readSheetObjects_(ss, IMS_CONFIG.SHEETS.JOB_WORK)
  );
}

function syncMasterStock_(ss) {
  const masterSheet = ensureSheet_(ss, IMS_CONFIG.SHEETS.MASTER, IMS_SCHEMAS[IMS_CONFIG.SHEETS.MASTER]);
  const master = readSheetObjects_(ss, IMS_CONFIG.SHEETS.MASTER);
  const orders = readSheetObjects_(ss, IMS_CONFIG.SHEETS.ORDERS);
  const jobs = readSheetObjects_(ss, IMS_CONFIG.SHEETS.JOB_WORK);
  const ledger = readSheetObjects_(ss, IMS_CONFIG.SHEETS.LEDGER);

  const ledgerMap = {};
  ledger.forEach(function(txn) {
    const item = txn.ItemCode;
    if (!item) return;
    if (!ledgerMap[item]) ledgerMap[item] = { inQty: 0, outQty: 0, valueIn: 0 };
    const qty = num_(txn.Qty);
    const amount = num_(txn.Amount);
    if (isInType_(txn.Type)) {
      ledgerMap[item].inQty += qty;
      ledgerMap[item].valueIn += amount;
    } else if (isOutType_(txn.Type)) {
      ledgerMap[item].outQty += qty;
    }
  });

  const allocatedMap = {};
  orders.forEach(function(order) {
    if (IMS_CONFIG.ACTIVE_ORDER_STATUSES.indexOf(order.Status) === -1) return;
    const item = order.ItemCode;
    if (!item) return;
    allocatedMap[item] = (allocatedMap[item] || 0) + num_(order.OrderedQty || order.OrderedQtyMtrKG);
  });

  const jobMap = {};
  jobs.forEach(function(job) {
    const item = job.ItemCode;
    if (!item || job.Status === 'Completed') return;
    const pending = Math.max(0, num_(job.SentQty || job.SentQtyMtr) - num_(job.ReceivedQty || job.ReceivedQtyMtr));
    jobMap[item] = (jobMap[item] || 0) + pending;
  });

  const headers = getHeaders_(masterSheet);
  const headerMap = headerIndexMap_(headers);
  master.forEach(function(item, i) {
    const itemCode = item.ItemCode;
    if (!itemCode) return;
    const ledgerTotals = ledgerMap[itemCode] || { inQty: 0, outQty: 0, valueIn: 0 };
    const opening = num_(item.OpeningStock);
    const totalIn = ledgerTotals.inQty;
    const totalOut = ledgerTotals.outQty;
    const closing = opening + totalIn - totalOut;
    const allocated = allocatedMap[itemCode] || 0;
    const inJobWork = jobMap[itemCode] || 0;
    const available = closing - allocated - inJobWork;
    const reorderLevel = num_(item.ReorderLevel);
    const targetStock = num_(item.TargetStock);
    const status = closing <= 0 ? 'STOCK OUT' :
      (reorderLevel && closing <= reorderLevel ? 'REORDER (LOW)' :
      (targetStock && closing > targetStock ? 'ABOVE LEVEL' : 'NORMAL'));
    const avgRate = totalIn > 0 ? ledgerTotals.valueIn / totalIn : num_(item.AvgRate);

    const rowNumber = i + 2;
    setRowValuesByMap_(masterSheet, rowNumber, headerMap, {
      'Total In': totalIn,
      'Total Out': totalOut,
      'Allocated To Orders': allocated,
      'In Job Work': inJobWork,
      'Closing Balance': closing,
      'Available Stock': available,
      'Reorder Status': status,
      'Avg Rate': avgRate,
      'Last Updated': now_()
    });
  });
}

function computeKPIs_(master, orders, jobWork, dispatch, purchases, alerts) {
  const activeOrders = orders.filter(function(o) { return o.Status === 'In Production'; });
  const pendingOrders = orders.filter(function(o) { return o.Status === 'Pending'; });
  const completedOrders = orders.filter(function(o) { return o.Status === 'Completed'; });
  const totalDispatched = sum_(dispatch, 'DispatchedQty');
  const totalPurchaseValue = purchases.reduce(function(sum, p) { return sum + num_(p.Amount || (num_(p.Qty) * num_(p.Rate))); }, 0);
  const stockValue = master.reduce(function(sum, item) { return sum + num_(item.ClosingBalance) * num_(item.AvgRate); }, 0);
  const totalSent = sum_(jobWork, 'SentQty') + sum_(jobWork, 'SentQtyMtr');
  const totalWastage = sum_(jobWork, 'WastageQty') + sum_(jobWork, 'WastageMtr');
  const fulfilmentRate = orders.length ? (completedOrders.length / orders.length * 100) : 0;

  const categoryBreakdown = {};
  master.forEach(function(item) {
    const category = item.Category || 'Other';
    if (!categoryBreakdown[category]) categoryBreakdown[category] = { count: 0, totalStock: 0, stockValue: 0 };
    categoryBreakdown[category].count += 1;
    categoryBreakdown[category].totalStock += num_(item.ClosingBalance);
    categoryBreakdown[category].stockValue += num_(item.ClosingBalance) * num_(item.AvgRate);
  });

  const monthlyDispatch = {};
  dispatch.forEach(function(d) {
    const month = String(d.DispatchDate || '').substring(0, 7);
    if (!month) return;
    monthlyDispatch[month] = (monthlyDispatch[month] || 0) + num_(d.DispatchedQty);
  });

  return {
    reorderCount: alerts.filter(function(a) { return a.type === 'critical'; }).length,
    reorderItems: alerts.filter(function(a) { return a.type === 'critical'; }).map(function(a) { return a.itemCode; }),
    activeOrderCount: activeOrders.length,
    pendingOrderCount: pendingOrders.length,
    completedOrderCount: completedOrders.length,
    totalOrderCount: orders.length,
    fulfilmentRate: round_(fulfilmentRate, 1),
    liveJobCount: jobWork.filter(function(j) { return j.Status !== 'Completed'; }).length,
    jwLiveCount: jobWork.filter(function(j) { return j.Status !== 'Completed'; }).length,
    totalDispatched: totalDispatched,
    totalPurchaseValue: totalPurchaseValue,
    stockValue: stockValue,
    avgWastagePct: totalSent ? round_(totalWastage / totalSent * 100, 2) : 0,
    totalItems: master.length,
    availableStock: sum_(master, 'AvailableStock'),
    alertCount: alerts.length,
    categoryBreakdown: categoryBreakdown,
    topItems: master.slice().sort(function(a, b) { return num_(b.ClosingBalance) - num_(a.ClosingBalance); }).slice(0, 8).map(function(i) {
      return { code: i.ItemCode, balance: num_(i.ClosingBalance), value: num_(i.ClosingBalance) * num_(i.AvgRate) };
    }),
    monthlyDispatch: monthlyDispatch,
    workerPerformance: computeWorkerPerformance_(jobWork),
    clientPerformance: computeClientPerformance_(orders, dispatch)
  };
}

function computeAlerts_(master, orders, jobWork) {
  const alerts = [];
  master.forEach(function(item) {
    const balance = num_(item.ClosingBalance);
    const available = num_(item.AvailableStock);
    if (item.ReorderStatus === 'STOCK OUT' || balance <= 0) {
      alerts.push({ type: 'critical', category: 'Stock', itemCode: item.ItemCode, itemName: item.ItemName, message: 'Stock out. Immediate procurement or production required.', balance: balance, available: available });
    } else if (item.ReorderStatus === 'REORDER (LOW)') {
      alerts.push({ type: 'critical', category: 'Stock', itemCode: item.ItemCode, itemName: item.ItemName, message: 'Below reorder level. Raise purchase or production plan.', balance: balance, available: available });
    } else if (available < 0) {
      alerts.push({ type: 'warning', category: 'Allocation', itemCode: item.ItemCode, itemName: item.ItemName, message: 'Allocated demand is higher than available stock.', balance: balance, available: available });
    }
  });

  const todayDate = new Date();
  orders.forEach(function(order) {
    if (!order.RequiredDate || order.Status === 'Completed') return;
    const due = new Date(order.RequiredDate);
    if (!isNaN(due.getTime()) && due < todayDate) {
      alerts.push({ type: 'warning', category: 'Order', itemCode: order.ItemCode, orderId: order.OrderID, message: 'Order required date is overdue for ' + order.ClientName + '.', dueDate: order.RequiredDate });
    }
  });

  jobWork.forEach(function(job) {
    const sent = num_(job.SentQty || job.SentQtyMtr);
    const wastage = num_(job.WastageQty || job.WastageMtr);
    const pct = sent ? wastage / sent * 100 : 0;
    if (pct > IMS_CONFIG.LOW_WASTAGE_LIMIT) {
      alerts.push({ type: 'warning', category: 'Wastage', itemCode: job.ItemCode, jobId: job.JobID, message: 'Job work wastage above ' + IMS_CONFIG.LOW_WASTAGE_LIMIT + '%.', wastagePct: round_(pct, 2) });
    }
  });
  return alerts;
}

function computeWorkerPerformance_(jobWork) {
  const map = {};
  jobWork.forEach(function(job) {
    const worker = job.WorkerName || 'Unknown';
    if (!map[worker]) map[worker] = { worker: worker, jobs: 0, sent: 0, received: 0, wastage: 0, payment: 0 };
    map[worker].jobs += 1;
    map[worker].sent += num_(job.SentQty || job.SentQtyMtr);
    map[worker].received += num_(job.ReceivedQty || job.ReceivedQtyMtr);
    map[worker].wastage += num_(job.WastageQty || job.WastageMtr);
    map[worker].payment += num_(job.TotalPayment);
  });
  return Object.keys(map).map(function(worker) {
    const data = map[worker];
    data.wastagePct = data.sent ? round_(data.wastage / data.sent * 100, 2) : 0;
    return data;
  }).sort(function(a, b) { return b.received - a.received; });
}

function computeClientPerformance_(orders, dispatch) {
  const map = {};
  orders.forEach(function(order) {
    const client = order.ClientName || 'Unknown';
    if (!map[client]) map[client] = { client: client, orders: 0, orderedQty: 0, dispatchedQty: 0, active: 0 };
    map[client].orders += 1;
    map[client].orderedQty += num_(order.OrderedQty || order.OrderedQtyMtrKG);
    if (order.Status !== 'Completed') map[client].active += 1;
  });
  dispatch.forEach(function(d) {
    const client = d.ClientName || 'Unknown';
    if (!map[client]) map[client] = { client: client, orders: 0, orderedQty: 0, dispatchedQty: 0, active: 0 };
    map[client].dispatchedQty += num_(d.DispatchedQty);
  });
  return Object.keys(map).map(function(client) { return map[client]; }).sort(function(a, b) { return b.orderedQty - a.orderedQty; });
}

function appendStockLedger_(ss, data) {
  const qty = num_(data.qty);
  const rate = num_(data.rate);
  const txnId = generateId_('TXN', ss.getSheetByName(IMS_CONFIG.SHEETS.LEDGER));
  appendRow_(ss, IMS_CONFIG.SHEETS.LEDGER, {
    'Txn ID': txnId,
    'Date': normalizeDate_(data.date),
    'Type': clean_(data.type),
    'Item Code': clean_(data.itemCode),
    'Qty': qty,
    'Unit': clean_(data.unit) || 'Mtr',
    'Reference Type': clean_(data.referenceType),
    'Reference ID': clean_(data.referenceId),
    'Party': clean_(data.party),
    'Rate': rate,
    'Amount': qty * rate,
    'Remarks': clean_(data.remarks),
    'Created At': now_()
  });
  return txnId;
}

function getIMSSpreadsheet_() {
  if (IMS_CONFIG.SPREADSHEET_ID) {
    return SpreadsheetApp.openById(IMS_CONFIG.SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function ensureSheet_(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const existingHeaders = getHeaders_(sheet);
    if (!existingHeaders.length) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      headers.forEach(function(header) {
        if (existingHeaders.indexOf(header) === -1) {
          sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
          existingHeaders.push(header);
        }
      });
    }
  }
  formatSheet_(sheet);
  return sheet;
}

function seedSettings_(ss) {
  const sheet = ss.getSheetByName(IMS_CONFIG.SHEETS.SETTINGS);
  if (sheet.getLastRow() > 1) return;
  sheet.appendRow(['Company Name', IMS_CONFIG.COMPANY, 'Shown in dashboard']);
  sheet.appendRow(['Default Unit', 'Mtr', 'Used for textile stock']);
  sheet.appendRow(['Job Work Payment Rate', '0.25', 'Default per metre rate']);
  sheet.appendRow(['Wastage Alert %', String(IMS_CONFIG.LOW_WASTAGE_LIMIT), 'Flags job work exceptions']);
}

function formatSheet_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  sheet.getRange(1, 1, 1, lastColumn).setFontWeight('bold').setBackground('#0d1b2a').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, lastColumn);
}

function readSheetObjects_(ss, sheetName) {
  const sheet = ensureSheet_(ss, sheetName, IMS_SCHEMAS[sheetName]);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return [];
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  return values.map(function(row) {
    const obj = {};
    let hasData = false;
    headers.forEach(function(header, index) {
      const key = normalizeHeader_(header);
      const value = normalizeCell_(row[index]);
      if (value !== '' && value !== null && value !== undefined) hasData = true;
      obj[key] = value;
    });
    return hasData ? obj : null;
  }).filter(Boolean);
}

function appendRow_(ss, sheetName, rowObject) {
  const sheet = ensureSheet_(ss, sheetName, IMS_SCHEMAS[sheetName]);
  const headers = getHeaders_(sheet);
  const row = headers.map(function(header) {
    return Object.prototype.hasOwnProperty.call(rowObject, header) ? rowObject[header] : '';
  });
  sheet.appendRow(row);
}

function upsertRow_(sheet, rowNumber, rowObject) {
  if (rowNumber) {
    setRowValues_(sheet, rowNumber, rowObject);
  } else {
    const ss = sheet.getParent();
    appendRow_(ss, sheet.getName(), rowObject);
  }
}

function setRowValues_(sheet, rowNumber, rowObject) {
  setRowValuesByMap_(sheet, rowNumber, headerIndexMap_(getHeaders_(sheet)), rowObject);
}

function setRowValuesByMap_(sheet, rowNumber, headerMap, rowObject) {
  Object.keys(rowObject).forEach(function(header) {
    const index = headerMap[header];
    if (!index) return;
    sheet.getRange(rowNumber, index).setValue(rowObject[header]);
  });
}

function findRowByKey_(sheet, headerName, keyValue) {
  const headers = getHeaders_(sheet);
  const keyColumn = headers.indexOf(headerName) + 1;
  if (!keyColumn || sheet.getLastRow() < 2) return null;
  const values = sheet.getRange(2, keyColumn, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim() === String(keyValue).trim()) return i + 2;
  }
  return null;
}

function getHeaders_(sheet) {
  if (sheet.getLastColumn() < 1 || sheet.getLastRow() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

function headerIndexMap_(headers) {
  const map = {};
  headers.forEach(function(header, index) {
    map[header] = index + 1;
  });
  return map;
}

function normalizeHeader_(header) {
  return String(header || '').replace(/[^a-zA-Z0-9]/g, '');
}

function normalizeCell_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return value;
}

function normalizeDate_(value) {
  if (!value) return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(value);
}

function optionalDate_(value) {
  if (!value) return '';
  return normalizeDate_(value);
}

function generateId_(prefix, sheet) {
  const datePart = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  const sequence = Math.max(sheet.getLastRow(), 1);
  return prefix + '-' + datePart + '-' + String(sequence).padStart(4, '0');
}

function now_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function clean_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function num_(value) {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

function round_(value, decimals) {
  const factor = Math.pow(10, decimals || 0);
  return Math.round(num_(value) * factor) / factor;
}

function sum_(rows, key) {
  return rows.reduce(function(total, row) { return total + num_(row[key]); }, 0);
}

function uniqueSorted_(values) {
  const map = {};
  values.forEach(function(value) {
    if (value !== null && value !== undefined && String(value).trim() !== '') map[String(value).trim()] = true;
  });
  return Object.keys(map).sort();
}

function requireFields_(data, fields) {
  fields.forEach(function(field) {
    if (data[field] === null || data[field] === undefined || String(data[field]).trim() === '') {
      throw new Error('Missing required field: ' + field);
    }
  });
}

function isInType_(type) {
  return ['Purchase In', 'Production In', 'Return In', 'Adjustment In'].indexOf(String(type || '')) !== -1;
}

function isOutType_(type) {
  return ['Dispatch Out', 'Sample Out', 'Damage Out', 'Adjustment Out'].indexOf(String(type || '')) !== -1;
}

function error_(err) {
  return { success: false, message: err && err.message ? err.message : String(err) };
}
