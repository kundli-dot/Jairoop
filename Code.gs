const IMS_VERSION = '7.0 Textile Control';

const IMS_CONFIG = {
  PAYMENT_RATE: 0.25,
  SHEETS: {
    MASTER: 'Master',
    ORDERS: 'Order Book',
    JOB_WORK: 'Job Work Tracker',
    DISPATCH: 'Dispatch Log',
    CLIENTS: 'Client Master',
    STOCK_LEDGER: 'Stock Ledger'
  },
  SCHEMAS: {
    'Master': [
      'Item Code',
      'Item Name',
      'Color',
      'Category',
      'Weight/Mtr',
      'Opening Stock',
      'Total In (Mtr/KG)',
      'Total Out (Mtr/KG)',
      'Allocated to Orders',
      'Closing Balance',
      'Available to Promise',
      'Reorder Level',
      'Reorder Status',
      'Preferred Vendor',
      'Last Purchase Rate',
      'Last Updated'
    ],
    'Order Book': [
      'Order ID',
      'Date',
      'Client Name',
      'Item Code',
      'Ordered Qty (Mtr/KG)',
      'Status',
      'Remarks',
      'Priority',
      'Due Date',
      'Dispatched Qty',
      'Balance Qty'
    ],
    'Job Work Tracker': [
      'Date',
      'Job ID',
      'Order ID',
      'Worker Name',
      'Item Code',
      'Sent Qty (Mtr)',
      'Received Qty (Mtr)',
      'Wastage (Mtr)',
      'Status',
      'Total Payment',
      'Notes'
    ],
    'Dispatch Log': [
      'Dispatch ID',
      'Order ID',
      'Client Name',
      'Item Code',
      'Dispatched Qty',
      'Dispatch Date',
      'Challan No.',
      'Vehicle No.',
      'Destination',
      'Remarks'
    ],
    'Client Master': [
      'Client Code',
      'Client Name',
      'Contact Person',
      'Phone',
      'GSTIN',
      'City',
      'Credit Days',
      'Notes',
      'Last Order Date'
    ],
    'Stock Ledger': [
      'Entry ID',
      'Date',
      'Item Code',
      'Item Name',
      'Direction',
      'Movement Type',
      'Qty In',
      'Qty Out',
      'Rate',
      'Reference Type',
      'Reference ID',
      'Party Name',
      'Notes'
    ]
  }
};

function onOpen() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureBaseStructure_(ss);
  SpreadsheetApp.getUi()
    .createMenu('Textile IMS')
    .addItem('Setup / Repair Workspace', 'installIMSWorkspace')
    .addItem('Recalculate Inventory & Orders', 'recalculateAllData')
    .addToUi();
}

function onEdit(e) {
  if (!e || !e.source || !e.range) {
    return;
  }

  const sheet = e.source.getActiveSheet();
  if (sheet.getName() === IMS_CONFIG.SHEETS.ORDERS) {
    recalculateAllData(e.source);
  }
}

function installIMSWorkspace() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureBaseStructure_(ss);
  recalculateAllData(ss);
  return {
    success: true,
    message: 'IMS workspace is ready. Sheets, columns, and derived metrics are now synchronized.'
  };
}

function recalculateAllData(ss) {
  const spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  ensureBaseStructure_(spreadsheet);
  syncOrderDispatchMetrics_(spreadsheet);
  updateMasterAllocatedAndStock(spreadsheet);
  refreshClientMaster_(spreadsheet);
  return { success: true, message: 'Inventory, orders, and client data recalculated.' };
}

function doGet() {
  ensureBaseStructure_(SpreadsheetApp.getActiveSpreadsheet());
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Textile IMS Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getAllIMSData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureBaseStructure_(ss);
  recalculateAllData(ss);

  const master = getMasterData_(ss);
  const orders = getOrderData_(ss);
  const jobWork = getJobWorkData_(ss);
  const dispatch = getDispatchData_(ss);
  const clients = getClientData_(ss, orders);
  const stockLedger = getStockLedgerData_(ss);
  const productionQueue = buildProductionQueue_(master, orders);
  const alerts = buildAlerts_(master, orders, productionQueue);
  const workers = uniqueList_(jobWork.map(function(entry) { return entry.workerName; }));
  const kpis = computeKPIs(master, orders, jobWork, dispatch, clients, productionQueue, stockLedger);

  return {
    companyName: ss.getName(),
    version: IMS_VERSION,
    master: master,
    orders: orders,
    jobWork: jobWork,
    dispatch: dispatch,
    clients: clients,
    workers: workers,
    stockLedger: stockLedger,
    productionQueue: productionQueue,
    alerts: alerts,
    kpis: kpis,
    settings: {
      paymentRate: IMS_CONFIG.PAYMENT_RATE
    },
    lastSync: formatDateTime_(new Date())
  };
}

function saveMasterItem(itemData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureBaseStructure_(ss);

    const itemCode = cleanText_(itemData.itemCode);
    const itemName = cleanText_(itemData.itemName);
    if (!itemCode || !itemName) {
      return { success: false, message: 'Item code and item name are required.' };
    }

    const sheet = ss.getSheetByName(IMS_CONFIG.SHEETS.MASTER);
    const existing = findRowByValue_(sheet, 'Item Code', itemCode);
    const now = formatDateTime_(new Date());
    const payload = {
      'Item Code': itemCode,
      'Item Name': itemName,
      'Color': preserveTextValue_(itemData.color, existing ? existing.record.Color : ''),
      'Category': preserveTextValue_(itemData.category, existing ? existing.record.Category : 'General') || 'General',
      'Weight/Mtr': preserveNumberValue_(itemData.weightMtr, existing ? existing.record.WeightMtr : 0),
      'Opening Stock': preserveNumberValue_(itemData.openingStock, existing ? existing.record.OpeningStock : 0),
      'Total In (Mtr/KG)': existing ? toNumber_(existing.record.TotalInMtrKG) : 0,
      'Total Out (Mtr/KG)': existing ? toNumber_(existing.record.TotalOutMtrKG) : 0,
      'Allocated to Orders': existing ? toNumber_(existing.record.AllocatedtoOrders) : 0,
      'Closing Balance': existing ? toNumber_(existing.record.ClosingBalance) : preserveNumberValue_(itemData.openingStock, 0),
      'Available to Promise': existing ? toNumber_(existing.record.AvailabletoPromise) : preserveNumberValue_(itemData.openingStock, 0),
      'Reorder Level': preserveNumberValue_(itemData.reorderLevel, existing ? existing.record.ReorderLevel : 0),
      'Reorder Status': existing ? cleanText_(existing.record.ReorderStatus) : 'NORMAL',
      'Preferred Vendor': preserveTextValue_(itemData.vendor, existing ? existing.record.PreferredVendor : ''),
      'Last Purchase Rate': preserveNumberValue_(itemData.lastRate, existing ? existing.record.LastPurchaseRate : 0),
      'Last Updated': now
    };

    upsertRow_(sheet, 'Item Code', itemCode, payload);
    updateMasterAllocatedAndStock(ss);

    return {
      success: true,
      message: existing ? 'Item updated successfully.' : 'New stock item created successfully.'
    };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.toString() };
  }
}

function saveClient(clientData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureBaseStructure_(ss);

    const clientName = cleanText_(clientData.clientName);
    if (!clientName) {
      return { success: false, message: 'Client name is required.' };
    }

    const sheet = ss.getSheetByName(IMS_CONFIG.SHEETS.CLIENTS);
    const existing = findRowByValue_(sheet, 'Client Name', clientName);
    const payload = {
      'Client Code': existing ? cleanText_(existing.record.ClientCode) : generateSerialId_(sheet, 'CL'),
      'Client Name': clientName,
      'Contact Person': preserveTextValue_(clientData.contactPerson, existing ? existing.record.ContactPerson : ''),
      'Phone': preserveTextValue_(clientData.phone, existing ? existing.record.Phone : ''),
      'GSTIN': preserveTextValue_(clientData.gstin, existing ? existing.record.GSTIN : ''),
      'City': preserveTextValue_(clientData.city, existing ? existing.record.City : ''),
      'Credit Days': preserveNumberValue_(clientData.creditDays, existing ? existing.record.CreditDays : 0),
      'Notes': preserveTextValue_(clientData.notes, existing ? existing.record.Notes : ''),
      'Last Order Date': existing ? cleanText_(existing.record.LastOrderDate) : ''
    };

    upsertRow_(sheet, 'Client Name', clientName, payload);
    return {
      success: true,
      message: existing ? 'Client updated successfully.' : 'Client added to the master successfully.'
    };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.toString() };
  }
}

function saveStockAdjustment(adjustmentData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureBaseStructure_(ss);
    recalculateAllData(ss);

    const itemCode = cleanText_(adjustmentData.itemCode);
    const qty = toNumber_(adjustmentData.qty);
    const direction = cleanText_(adjustmentData.direction).toUpperCase() === 'OUT' ? 'OUT' : 'IN';
    const movementType = cleanText_(adjustmentData.movementType) || (direction === 'IN' ? 'Purchase' : 'Adjustment');
    const item = getMasterData_(ss).filter(function(row) { return row.itemCode === itemCode; })[0];

    if (!item) {
      return { success: false, message: 'Item code not found in Master.' };
    }
    if (qty <= 0) {
      return { success: false, message: 'Quantity must be greater than zero.' };
    }
    if (direction === 'OUT' && movementType !== 'Opening Correction' && qty > item.closingBalance) {
      return { success: false, message: 'Stock out quantity is greater than the current closing balance.' };
    }

    appendStockLedgerEntry_(ss, {
      date: cleanText_(adjustmentData.date) || formatDate_(new Date()),
      itemCode: item.itemCode,
      itemName: item.itemName,
      direction: direction,
      movementType: movementType,
      qtyIn: direction === 'IN' ? qty : 0,
      qtyOut: direction === 'OUT' ? qty : 0,
      rate: toNumber_(adjustmentData.rate),
      referenceType: cleanText_(adjustmentData.referenceType) || 'Manual',
      referenceId: cleanText_(adjustmentData.referenceId),
      partyName: cleanText_(adjustmentData.partyName),
      notes: cleanText_(adjustmentData.notes)
    });

    applyMovementToMaster_(ss, {
      itemCode: itemCode,
      direction: direction,
      qty: qty,
      movementType: movementType,
      rate: toNumber_(adjustmentData.rate)
    });

    updateMasterAllocatedAndStock(ss);
    return { success: true, message: 'Stock movement saved successfully.' };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.toString() };
  }
}

function saveNewOrder(orderData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureBaseStructure_(ss);

    const itemCode = cleanText_(orderData.itemCode);
    const clientName = cleanText_(orderData.clientName);
    const qty = toNumber_(orderData.qty);
    if (!clientName || !itemCode || qty <= 0) {
      return { success: false, message: 'Client, item code, and quantity are required.' };
    }

    const itemExists = getMasterData_(ss).some(function(item) { return item.itemCode === itemCode; });
    if (!itemExists) {
      return { success: false, message: 'Item code is not available in Master. Create the item first.' };
    }

    const orderSheet = ss.getSheetByName(IMS_CONFIG.SHEETS.ORDERS);
    const orderId = generateSerialId_(orderSheet, 'ORD');
    appendObjectRow_(orderSheet, IMS_CONFIG.SCHEMAS[IMS_CONFIG.SHEETS.ORDERS], {
      'Order ID': orderId,
      'Date': cleanText_(orderData.date) || formatDate_(new Date()),
      'Client Name': clientName,
      'Item Code': itemCode,
      'Ordered Qty (Mtr/KG)': qty,
      'Status': cleanText_(orderData.status) || 'Pending',
      'Remarks': cleanText_(orderData.remarks),
      'Priority': cleanText_(orderData.priority) || 'Medium',
      'Due Date': cleanText_(orderData.dueDate),
      'Dispatched Qty': 0,
      'Balance Qty': qty
    });

    ensureClientExists_(ss, clientName);
    recalculateAllData(ss);
    return { success: true, orderId: orderId, message: 'Order ' + orderId + ' saved successfully.' };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.toString() };
  }
}

function updateOrderStatus(orderId, newStatus) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const orderSheet = ss.getSheetByName(IMS_CONFIG.SHEETS.ORDERS);
    const existing = findRowByValue_(orderSheet, 'Order ID', cleanText_(orderId));
    if (!existing) {
      return { success: false, message: 'Order ID not found.' };
    }

    existing.record.Status = cleanText_(newStatus) || existing.record.Status || 'Pending';
    writeRecordToRow_(orderSheet, existing.rowIndex, existing.record);
    recalculateAllData(ss);

    return {
      success: true,
      message: 'Order ' + orderId + ' updated to ' + cleanText_(newStatus) + '.'
    };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.toString() };
  }
}

function saveNewJobWork(jobData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureBaseStructure_(ss);

    const sentQty = toNumber_(jobData.sentQty);
    const receivedQty = toNumber_(jobData.receivedQty);
    const wastageQty = toNumber_(jobData.wastageMtr);
    const orderId = cleanText_(jobData.orderId);
    const workerName = cleanText_(jobData.workerName);
    const itemCode = cleanText_(jobData.itemCode);

    if (!workerName || !itemCode || sentQty <= 0) {
      return { success: false, message: 'Worker, item code, and sent quantity are required.' };
    }

    const orderSheet = ss.getSheetByName(IMS_CONFIG.SHEETS.ORDERS);
    const order = orderId ? findRowByValue_(orderSheet, 'Order ID', orderId) : null;
    const jobSheet = ss.getSheetByName(IMS_CONFIG.SHEETS.JOB_WORK);
    const jobId = generateSerialId_(jobSheet, 'JOB');
    const payment = toNumber_(jobData.totalPayment) || (receivedQty || sentQty) * IMS_CONFIG.PAYMENT_RATE;

    appendObjectRow_(jobSheet, IMS_CONFIG.SCHEMAS[IMS_CONFIG.SHEETS.JOB_WORK], {
      'Date': cleanText_(jobData.date) || formatDate_(new Date()),
      'Job ID': jobId,
      'Order ID': orderId,
      'Worker Name': workerName,
      'Item Code': itemCode,
      'Sent Qty (Mtr)': sentQty,
      'Received Qty (Mtr)': receivedQty,
      'Wastage (Mtr)': wastageQty,
      'Status': cleanText_(jobData.status) || 'Out',
      'Total Payment': payment,
      'Notes': cleanText_(jobData.notes)
    });

    if (order && cleanText_(order.record.Status) === 'Pending') {
      order.record.Status = 'In Production';
      writeRecordToRow_(orderSheet, order.rowIndex, order.record);
    }

    recalculateAllData(ss);
    return { success: true, jobId: jobId, message: 'Job work ' + jobId + ' saved successfully.' };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.toString() };
  }
}

function saveNewDispatch(dispatchData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureBaseStructure_(ss);
    recalculateAllData(ss);

    const orderId = cleanText_(dispatchData.orderId);
    const qty = toNumber_(dispatchData.dispatchedQty);
    const orderSheet = ss.getSheetByName(IMS_CONFIG.SHEETS.ORDERS);
    const order = findRowByValue_(orderSheet, 'Order ID', orderId);
    if (!order) {
      return { success: false, message: 'Order ID not found.' };
    }
    if (qty <= 0) {
      return { success: false, message: 'Dispatch quantity must be greater than zero.' };
    }

    const orderBalance = toNumber_(order.record.BalanceQty) || toNumber_(order.record.OrderedQtyMtrKG);
    if (qty > orderBalance) {
      return { success: false, message: 'Dispatch quantity is greater than the order balance quantity.' };
    }

    const itemCode = cleanText_(dispatchData.itemCode) || cleanText_(order.record.ItemCode);
    const item = getMasterData_(ss).filter(function(row) { return row.itemCode === itemCode; })[0];
    if (!item) {
      return { success: false, message: 'Item code not found in Master.' };
    }
    if (qty > item.closingBalance) {
      return { success: false, message: 'Dispatch quantity is greater than the available stock.' };
    }

    const dispatchSheet = ss.getSheetByName(IMS_CONFIG.SHEETS.DISPATCH);
    const dispatchId = generateSerialId_(dispatchSheet, 'DISP');
    appendObjectRow_(dispatchSheet, IMS_CONFIG.SCHEMAS[IMS_CONFIG.SHEETS.DISPATCH], {
      'Dispatch ID': dispatchId,
      'Order ID': orderId,
      'Client Name': cleanText_(dispatchData.clientName) || cleanText_(order.record.ClientName),
      'Item Code': itemCode,
      'Dispatched Qty': qty,
      'Dispatch Date': cleanText_(dispatchData.dispatchDate) || formatDate_(new Date()),
      'Challan No.': cleanText_(dispatchData.challanNo),
      'Vehicle No.': cleanText_(dispatchData.vehicleNo),
      'Destination': cleanText_(dispatchData.destination),
      'Remarks': cleanText_(dispatchData.remarks)
    });

    appendStockLedgerEntry_(ss, {
      date: cleanText_(dispatchData.dispatchDate) || formatDate_(new Date()),
      itemCode: itemCode,
      itemName: item.itemName,
      direction: 'OUT',
      movementType: 'Dispatch',
      qtyIn: 0,
      qtyOut: qty,
      rate: 0,
      referenceType: 'Dispatch',
      referenceId: dispatchId,
      partyName: cleanText_(dispatchData.clientName) || cleanText_(order.record.ClientName),
      notes: cleanText_(dispatchData.remarks)
    });

    applyMovementToMaster_(ss, {
      itemCode: itemCode,
      direction: 'OUT',
      qty: qty,
      movementType: 'Dispatch',
      rate: 0
    });

    recalculateAllData(ss);
    syncOrderDispatchMetrics_(ss);

    const refreshedOrder = findRowByValue_(orderSheet, 'Order ID', orderId);
    if (cleanText_(dispatchData.markCompleted) === 'true') {
      refreshedOrder.record.Status = 'Completed';
    } else if ((toNumber_(refreshedOrder.record.BalanceQty) || 0) <= 0) {
      refreshedOrder.record.Status = 'Completed';
    } else {
      refreshedOrder.record.Status = 'Partially Dispatched';
    }
    writeRecordToRow_(orderSheet, refreshedOrder.rowIndex, refreshedOrder.record);
    recalculateAllData(ss);

    return { success: true, dispId: dispatchId, message: 'Dispatch ' + dispatchId + ' logged successfully.' };
  } catch (error) {
    return { success: false, message: 'Error: ' + error.toString() };
  }
}

function getStockAlerts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureBaseStructure_(ss);
  recalculateAllData(ss);
  return buildAlerts_(getMasterData_(ss), getOrderData_(ss), buildProductionQueue_(getMasterData_(ss), getOrderData_(ss)));
}

function computeKPIs(master, orders, jobWork, dispatch, clients, productionQueue, stockLedger) {
  const today = formatDate_(new Date());
  const activeOrders = orders.filter(function(order) { return order.status !== 'Completed' && order.status !== 'Cancelled'; });
  const reorderItems = master.filter(function(item) { return item.reorderStatus === 'REORDER (LOW)'; });
  const shortageOrders = productionQueue.filter(function(item) { return item.shortageQty > 0; });
  const overdueOrders = orders.filter(function(order) {
    return order.dueDate && order.balanceQty > 0 && order.dueDate < today && order.status !== 'Completed' && order.status !== 'Cancelled';
  });
  const totalDispatched = dispatch.reduce(function(sum, row) { return sum + row.dispatchedQty; }, 0);
  const totalStock = master.reduce(function(sum, row) { return sum + row.closingBalance; }, 0);
  const totalAvailable = master.reduce(function(sum, row) { return sum + row.availableToPromise; }, 0);
  const totalAllocated = master.reduce(function(sum, row) { return sum + row.allocatedToOrders; }, 0);
  const totalOrderQty = orders.reduce(function(sum, row) { return sum + row.orderedQty; }, 0);
  const totalBalanceQty = orders.reduce(function(sum, row) { return sum + row.balanceQty; }, 0);
  const avgWastagePct = calculateAverageWastage_(jobWork);
  const fulfilmentRate = totalOrderQty > 0 ? round2_(((totalOrderQty - totalBalanceQty) / totalOrderQty) * 100) : 0;
  const categoryBreakdown = {};
  const statusBreakdown = {};
  const clientBreakdown = {};
  const monthlyDispatch = {};

  master.forEach(function(item) {
    const category = item.category || 'Uncategorized';
    if (!categoryBreakdown[category]) {
      categoryBreakdown[category] = { count: 0, totalStock: 0 };
    }
    categoryBreakdown[category].count += 1;
    categoryBreakdown[category].totalStock += item.closingBalance;
  });

  orders.forEach(function(order) {
    statusBreakdown[order.status] = (statusBreakdown[order.status] || 0) + 1;
    clientBreakdown[order.clientName] = (clientBreakdown[order.clientName] || 0) + order.orderedQty;
  });

  dispatch.forEach(function(row) {
    const month = row.dispatchDate ? row.dispatchDate.substring(0, 7) : '';
    if (!month) {
      return;
    }
    monthlyDispatch[month] = (monthlyDispatch[month] || 0) + row.dispatchedQty;
  });

  return {
    totalItems: master.length,
    activeOrders: activeOrders.length,
    completedOrders: orders.filter(function(order) { return order.status === 'Completed'; }).length,
    lowStockCount: reorderItems.length,
    shortageCount: shortageOrders.length,
    overdueCount: overdueOrders.length,
    totalClients: clients.length,
    totalStock: round2_(totalStock),
    totalAvailable: round2_(totalAvailable),
    totalAllocated: round2_(totalAllocated),
    totalDispatched: round2_(totalDispatched),
    totalOrderQty: round2_(totalOrderQty),
    totalBalanceQty: round2_(totalBalanceQty),
    fulfilmentRate: fulfilmentRate,
    avgWastagePct: avgWastagePct,
    liveJobCount: jobWork.filter(function(row) { return row.status !== 'Completed'; }).length,
    recentMovementCount: stockLedger.slice(0, 7).length,
    reorderItems: reorderItems.map(function(item) { return item.itemCode; }),
    topItems: master
      .slice()
      .sort(function(a, b) { return b.closingBalance - a.closingBalance; })
      .slice(0, 5)
      .map(function(item) { return { code: item.itemCode, balance: item.closingBalance }; }),
    topClients: Object.keys(clientBreakdown)
      .map(function(clientName) {
        return { clientName: clientName, qty: round2_(clientBreakdown[clientName]) };
      })
      .sort(function(a, b) { return b.qty - a.qty; })
      .slice(0, 5),
    categoryBreakdown: categoryBreakdown,
    statusBreakdown: statusBreakdown,
    monthlyDispatch: monthlyDispatch
  };
}

function updateMasterAllocatedAndStock(ss) {
  const spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = spreadsheet.getSheetByName(IMS_CONFIG.SHEETS.MASTER);
  const orderData = getOrderData_(spreadsheet);
  const rows = masterSheet.getDataRange().getValues();

  if (rows.length < 2) {
    return;
  }

  const headers = rows[0];
  const allocationMap = {};
  orderData.forEach(function(order) {
    if (order.status === 'Completed' || order.status === 'Cancelled') {
      return;
    }
    allocationMap[order.itemCode] = (allocationMap[order.itemCode] || 0) + order.balanceQty;
  });

  const itemCodeIndex = headerIndex_(headers, 'Item Code');
  const openingIndex = headerIndex_(headers, 'Opening Stock');
  const totalInIndex = headerIndex_(headers, 'Total In (Mtr/KG)');
  const totalOutIndex = headerIndex_(headers, 'Total Out (Mtr/KG)');
  const allocatedIndex = headerIndex_(headers, 'Allocated to Orders');
  const closingIndex = headerIndex_(headers, 'Closing Balance');
  const availableIndex = headerIndex_(headers, 'Available to Promise');
  const reorderLevelIndex = headerIndex_(headers, 'Reorder Level');
  const reorderStatusIndex = headerIndex_(headers, 'Reorder Status');
  const updatedIndex = headerIndex_(headers, 'Last Updated');

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const itemCode = cleanText_(row[itemCodeIndex]);
    if (!itemCode) {
      continue;
    }
    const opening = toNumber_(row[openingIndex]);
    const totalIn = toNumber_(row[totalInIndex]);
    const totalOut = toNumber_(row[totalOutIndex]);
    const closing = round2_(opening + totalIn - totalOut);
    const allocated = round2_(allocationMap[itemCode] || 0);
    const available = round2_(closing - allocated);
    const reorderLevel = toNumber_(row[reorderLevelIndex]);
    const reorderStatus = deriveReorderStatus_(closing, available, reorderLevel);

    row[allocatedIndex] = allocated;
    row[closingIndex] = closing;
    row[availableIndex] = available;
    row[reorderStatusIndex] = reorderStatus;
    row[updatedIndex] = formatDateTime_(new Date());
  }

  masterSheet.getRange(2, 1, rows.length - 1, rows[0].length).setValues(rows.slice(1));
}

function ensureBaseStructure_(ss) {
  const spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(IMS_CONFIG.SCHEMAS).forEach(function(sheetName) {
    ensureSheet_(spreadsheet, sheetName, IMS_CONFIG.SCHEMAS[sheetName]);
  });
}

function ensureSheet_(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const existingHeaders = sheet.getLastRow() > 0
    ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    : [];

  if (!existingHeaders.join('').trim()) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const normalized = existingHeaders.map(normalizeHeader_);
    headers.forEach(function(header) {
      if (normalized.indexOf(normalizeHeader_(header)) === -1) {
        sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
        normalized.push(normalizeHeader_(header));
      }
    });
  }

  sheet.setFrozenRows(1);
}

function getMasterData_(ss) {
  return getSheetDataFast(ss, IMS_CONFIG.SHEETS.MASTER).map(function(row) {
    return {
      itemCode: cleanText_(row.ItemCode),
      itemName: cleanText_(row.ItemName),
      color: cleanText_(row.Color),
      category: cleanText_(row.Category),
      weightMtr: toNumber_(row.WeightMtr),
      openingStock: toNumber_(row.OpeningStock),
      totalIn: toNumber_(row.TotalInMtrKG),
      totalOut: toNumber_(row.TotalOutMtrKG),
      allocatedToOrders: toNumber_(row.AllocatedtoOrders),
      closingBalance: toNumber_(row.ClosingBalance),
      availableToPromise: toNumber_(row.AvailabletoPromise),
      reorderLevel: toNumber_(row.ReorderLevel),
      reorderStatus: cleanText_(row.ReorderStatus) || 'NORMAL',
      preferredVendor: cleanText_(row.PreferredVendor),
      lastPurchaseRate: toNumber_(row.LastPurchaseRate),
      lastUpdated: cleanText_(row.LastUpdated)
    };
  }).filter(function(row) {
    return row.itemCode;
  }).sort(function(a, b) {
    return a.itemCode.localeCompare(b.itemCode);
  });
}

function getOrderData_(ss) {
  const dispatchMap = buildDispatchQtyMap_(getSheetDataFast(ss, IMS_CONFIG.SHEETS.DISPATCH));
  return getSheetDataFast(ss, IMS_CONFIG.SHEETS.ORDERS).map(function(row) {
    const orderedQty = toNumber_(row.OrderedQtyMtrKG);
    const dispatchedQty = dispatchMap[cleanText_(row.OrderID)] || toNumber_(row.DispatchedQty);
    const balanceQty = Math.max(0, round2_(orderedQty - dispatchedQty));
    const status = normalizeOrderStatus_(cleanText_(row.Status), dispatchedQty, balanceQty);
    return {
      orderId: cleanText_(row.OrderID),
      date: cleanText_(row.Date),
      clientName: cleanText_(row.ClientName),
      itemCode: cleanText_(row.ItemCode),
      orderedQty: orderedQty,
      status: status,
      remarks: cleanText_(row.Remarks),
      priority: cleanText_(row.Priority) || 'Medium',
      dueDate: cleanText_(row.DueDate),
      dispatchedQty: round2_(dispatchedQty),
      balanceQty: balanceQty
    };
  }).filter(function(row) {
    return row.orderId;
  }).sort(function(a, b) {
    return (b.date || '').localeCompare(a.date || '');
  });
}

function getJobWorkData_(ss) {
  return getSheetDataFast(ss, IMS_CONFIG.SHEETS.JOB_WORK).map(function(row) {
    return {
      date: cleanText_(row.Date),
      jobId: cleanText_(row.JobID),
      orderId: cleanText_(row.OrderID),
      workerName: cleanText_(row.WorkerName),
      itemCode: cleanText_(row.ItemCode),
      sentQty: toNumber_(row.SentQtyMtr),
      receivedQty: toNumber_(row.ReceivedQtyMtr),
      wastageMtr: toNumber_(row.WastageMtr),
      status: cleanText_(row.Status) || 'Out',
      totalPayment: toNumber_(row.TotalPayment),
      notes: cleanText_(row.Notes)
    };
  }).filter(function(row) {
    return row.jobId;
  }).sort(function(a, b) {
    return (b.date || '').localeCompare(a.date || '');
  });
}

function getDispatchData_(ss) {
  return getSheetDataFast(ss, IMS_CONFIG.SHEETS.DISPATCH).map(function(row) {
    return {
      dispatchId: cleanText_(row.DispatchID),
      orderId: cleanText_(row.OrderID),
      clientName: cleanText_(row.ClientName),
      itemCode: cleanText_(row.ItemCode),
      dispatchedQty: toNumber_(row.DispatchedQty),
      dispatchDate: cleanText_(row.DispatchDate),
      challanNo: cleanText_(row.ChallanNo),
      vehicleNo: cleanText_(row.VehicleNo),
      destination: cleanText_(row.Destination),
      remarks: cleanText_(row.Remarks)
    };
  }).filter(function(row) {
    return row.dispatchId;
  }).sort(function(a, b) {
    return (b.dispatchDate || '').localeCompare(a.dispatchDate || '');
  });
}

function getClientData_(ss, orders) {
  const raw = getSheetDataFast(ss, IMS_CONFIG.SHEETS.CLIENTS);
  const orderList = orders || getOrderData_(ss);
  const orderStats = {};

  orderList.forEach(function(order) {
    const name = order.clientName;
    if (!name) {
      return;
    }
    if (!orderStats[name]) {
      orderStats[name] = {
        totalOrders: 0,
        openOrders: 0,
        pendingQty: 0,
        lastOrderDate: ''
      };
    }
    orderStats[name].totalOrders += 1;
    if (order.balanceQty > 0 && order.status !== 'Completed' && order.status !== 'Cancelled') {
      orderStats[name].openOrders += 1;
      orderStats[name].pendingQty += order.balanceQty;
    }
    if (!orderStats[name].lastOrderDate || (order.date && order.date > orderStats[name].lastOrderDate)) {
      orderStats[name].lastOrderDate = order.date;
    }
  });

  return raw.map(function(row) {
    const clientName = cleanText_(row.ClientName);
    const stats = orderStats[clientName] || { totalOrders: 0, openOrders: 0, pendingQty: 0, lastOrderDate: cleanText_(row.LastOrderDate) };
    return {
      clientCode: cleanText_(row.ClientCode),
      clientName: clientName,
      contactPerson: cleanText_(row.ContactPerson),
      phone: cleanText_(row.Phone),
      gstin: cleanText_(row.GSTIN),
      city: cleanText_(row.City),
      creditDays: toNumber_(row.CreditDays),
      notes: cleanText_(row.Notes),
      lastOrderDate: stats.lastOrderDate || cleanText_(row.LastOrderDate),
      totalOrders: stats.totalOrders,
      openOrders: stats.openOrders,
      pendingQty: round2_(stats.pendingQty)
    };
  }).filter(function(row) {
    return row.clientName;
  }).sort(function(a, b) {
    return a.clientName.localeCompare(b.clientName);
  });
}

function getStockLedgerData_(ss) {
  return getSheetDataFast(ss, IMS_CONFIG.SHEETS.STOCK_LEDGER).map(function(row) {
    return {
      entryId: cleanText_(row.EntryID),
      date: cleanText_(row.Date),
      itemCode: cleanText_(row.ItemCode),
      itemName: cleanText_(row.ItemName),
      direction: cleanText_(row.Direction),
      movementType: cleanText_(row.MovementType),
      qtyIn: toNumber_(row.QtyIn),
      qtyOut: toNumber_(row.QtyOut),
      rate: toNumber_(row.Rate),
      referenceType: cleanText_(row.ReferenceType),
      referenceId: cleanText_(row.ReferenceID),
      partyName: cleanText_(row.PartyName),
      notes: cleanText_(row.Notes)
    };
  }).filter(function(row) {
    return row.entryId;
  }).sort(function(a, b) {
    return (b.date || '').localeCompare(a.date || '') || b.entryId.localeCompare(a.entryId);
  });
}

function buildProductionQueue_(master, orders) {
  const availabilityMap = {};
  const masterLookup = {};
  master.forEach(function(item) {
    availabilityMap[item.itemCode] = item.availableToPromise;
    masterLookup[item.itemCode] = item;
  });

  return orders
    .filter(function(order) {
      return order.status !== 'Completed' && order.status !== 'Cancelled' && order.balanceQty > 0;
    })
    .sort(function(a, b) {
      return comparePriority_(a.priority, b.priority) ||
        (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99') ||
        (a.date || '').localeCompare(b.date || '');
    })
    .map(function(order) {
      const available = round2_(Math.max(availabilityMap[order.itemCode] || 0, 0));
      const shortage = round2_(Math.max(order.balanceQty - available, 0));
      availabilityMap[order.itemCode] = round2_(available - order.balanceQty);
      const masterItem = masterLookup[order.itemCode] || {};

      return {
        orderId: order.orderId,
        date: order.date,
        dueDate: order.dueDate,
        priority: order.priority,
        clientName: order.clientName,
        itemCode: order.itemCode,
        requiredQty: order.balanceQty,
        stockAvailable: available,
        shortageQty: shortage,
        reorderStatus: masterItem.reorderStatus || 'NORMAL',
        stage: order.status,
        suggestedAction: shortage > 0 ? 'Purchase / produce additional stock' : 'Ready to schedule'
      };
    });
}

function buildAlerts_(master, orders, productionQueue) {
  const alerts = [];
  master.forEach(function(item) {
    if (item.reorderStatus === 'REORDER (LOW)') {
      alerts.push({
        type: 'critical',
        title: item.itemCode + ' is below reorder level',
        detail: 'Closing balance: ' + item.closingBalance + ' | Available: ' + item.availableToPromise,
        action: item.preferredVendor ? 'Raise PO with ' + item.preferredVendor : 'Create stock inward / purchase plan'
      });
    } else if (item.availableToPromise < 0) {
      alerts.push({
        type: 'warning',
        title: item.itemCode + ' is over-allocated',
        detail: 'Available to promise is negative. Review open orders and stock movements.',
        action: 'Expedite production or revise delivery commitments'
      });
    }
  });

  productionQueue.forEach(function(item) {
    if (item.shortageQty > 0) {
      alerts.push({
        type: 'warning',
        title: 'Shortage for order ' + item.orderId,
        detail: item.itemCode + ' is short by ' + item.shortageQty + ' Mtr/KG for ' + item.clientName,
        action: item.suggestedAction
      });
    }
  });

  orders.forEach(function(order) {
    if (order.dueDate && order.balanceQty > 0 && order.dueDate < formatDate_(new Date())) {
      alerts.push({
        type: 'warning',
        title: 'Overdue order ' + order.orderId,
        detail: order.clientName + ' | ' + order.itemCode + ' | balance ' + order.balanceQty,
        action: 'Review production and dispatch priority'
      });
    }
  });

  return alerts.slice(0, 50);
}

function syncOrderDispatchMetrics_(ss) {
  const orderSheet = ss.getSheetByName(IMS_CONFIG.SHEETS.ORDERS);
  const dispatchMap = buildDispatchQtyMap_(getSheetDataFast(ss, IMS_CONFIG.SHEETS.DISPATCH));
  const rows = orderSheet.getDataRange().getValues();

  if (rows.length < 2) {
    return;
  }

  const headers = rows[0];
  const orderIdIndex = headerIndex_(headers, 'Order ID');
  const qtyIndex = headerIndex_(headers, 'Ordered Qty (Mtr/KG)');
  const statusIndex = headerIndex_(headers, 'Status');
  const dispatchedIndex = headerIndex_(headers, 'Dispatched Qty');
  const balanceIndex = headerIndex_(headers, 'Balance Qty');

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const orderId = cleanText_(row[orderIdIndex]);
    if (!orderId) {
      continue;
    }

    const orderedQty = toNumber_(row[qtyIndex]);
    const dispatchedQty = round2_(dispatchMap[orderId] || 0);
    const balanceQty = round2_(Math.max(orderedQty - dispatchedQty, 0));
    row[dispatchedIndex] = dispatchedQty;
    row[balanceIndex] = balanceQty;
    row[statusIndex] = normalizeOrderStatus_(cleanText_(row[statusIndex]), dispatchedQty, balanceQty);
  }

  orderSheet.getRange(2, 1, rows.length - 1, rows[0].length).setValues(rows.slice(1));
}

function refreshClientMaster_(ss) {
  const clientSheet = ss.getSheetByName(IMS_CONFIG.SHEETS.CLIENTS);
  const existingRows = getSheetDataFast(ss, IMS_CONFIG.SHEETS.CLIENTS);
  const existingNames = {};
  existingRows.forEach(function(row) {
    existingNames[cleanText_(row.ClientName).toLowerCase()] = true;
  });

  const orders = getSheetDataFast(ss, IMS_CONFIG.SHEETS.ORDERS);
  const latestOrderByClient = {};
  orders.forEach(function(row) {
    const clientName = cleanText_(row.ClientName);
    if (!clientName) {
      return;
    }
    if (!latestOrderByClient[clientName] || cleanText_(row.Date) > latestOrderByClient[clientName]) {
      latestOrderByClient[clientName] = cleanText_(row.Date);
    }
    if (!existingNames[clientName.toLowerCase()]) {
      appendObjectRow_(clientSheet, IMS_CONFIG.SCHEMAS[IMS_CONFIG.SHEETS.CLIENTS], {
        'Client Code': generateSerialId_(clientSheet, 'CL'),
        'Client Name': clientName,
        'Contact Person': '',
        'Phone': '',
        'GSTIN': '',
        'City': '',
        'Credit Days': '',
        'Notes': '',
        'Last Order Date': cleanText_(row.Date)
      });
      existingNames[clientName.toLowerCase()] = true;
    }
  });

  const rows = clientSheet.getDataRange().getValues();
  if (rows.length < 2) {
    return;
  }

  const headers = rows[0];
  const nameIndex = headerIndex_(headers, 'Client Name');
  const lastOrderIndex = headerIndex_(headers, 'Last Order Date');

  for (let i = 1; i < rows.length; i += 1) {
    const clientName = cleanText_(rows[i][nameIndex]);
    if (clientName && latestOrderByClient[clientName]) {
      rows[i][lastOrderIndex] = latestOrderByClient[clientName];
    }
  }

  clientSheet.getRange(2, 1, rows.length - 1, rows[0].length).setValues(rows.slice(1));
}

function appendStockLedgerEntry_(ss, entry) {
  const sheet = ss.getSheetByName(IMS_CONFIG.SHEETS.STOCK_LEDGER);
  appendObjectRow_(sheet, IMS_CONFIG.SCHEMAS[IMS_CONFIG.SHEETS.STOCK_LEDGER], {
    'Entry ID': generateSerialId_(sheet, 'LED'),
    'Date': entry.date || formatDate_(new Date()),
    'Item Code': entry.itemCode,
    'Item Name': entry.itemName,
    'Direction': entry.direction,
    'Movement Type': entry.movementType,
    'Qty In': toNumber_(entry.qtyIn),
    'Qty Out': toNumber_(entry.qtyOut),
    'Rate': toNumber_(entry.rate),
    'Reference Type': entry.referenceType,
    'Reference ID': entry.referenceId,
    'Party Name': entry.partyName,
    'Notes': entry.notes
  });
}

function applyMovementToMaster_(ss, movement) {
  const sheet = ss.getSheetByName(IMS_CONFIG.SHEETS.MASTER);
  const itemRow = findRowByValue_(sheet, 'Item Code', movement.itemCode);
  if (!itemRow) {
    throw new Error('Item not found in Master: ' + movement.itemCode);
  }

  const openingStock = toNumber_(itemRow.record.OpeningStock);
  const totalIn = toNumber_(itemRow.record.TotalInMtrKG);
  const totalOut = toNumber_(itemRow.record.TotalOutMtrKG);

  if (movement.movementType === 'Opening Correction') {
    itemRow.record.OpeningStock = round2_(openingStock + (movement.direction === 'IN' ? movement.qty : movement.qty * -1));
  } else if (movement.direction === 'IN') {
    itemRow.record.TotalInMtrKG = round2_(totalIn + movement.qty);
  } else {
    itemRow.record.TotalOutMtrKG = round2_(totalOut + movement.qty);
  }

  if (movement.direction === 'IN' && movement.rate > 0) {
    itemRow.record.LastPurchaseRate = movement.rate;
  }
  itemRow.record.LastUpdated = formatDateTime_(new Date());
  writeRecordToRow_(sheet, itemRow.rowIndex, itemRow.record);
}

function ensureClientExists_(ss, clientName) {
  if (!clientName) {
    return;
  }
  const sheet = ss.getSheetByName(IMS_CONFIG.SHEETS.CLIENTS);
  const existing = findRowByValue_(sheet, 'Client Name', clientName);
  if (existing) {
    return;
  }
  appendObjectRow_(sheet, IMS_CONFIG.SCHEMAS[IMS_CONFIG.SHEETS.CLIENTS], {
    'Client Code': generateSerialId_(sheet, 'CL'),
    'Client Name': clientName,
    'Contact Person': '',
    'Phone': '',
    'GSTIN': '',
    'City': '',
    'Credit Days': '',
    'Notes': '',
    'Last Order Date': formatDate_(new Date())
  });
}

function appendObjectRow_(sheet, headers, payload) {
  const row = headers.map(function(header) {
    return payload[header] !== undefined ? payload[header] : '';
  });
  sheet.appendRow(row);
}

function upsertRow_(sheet, keyHeader, keyValue, payload) {
  const existing = findRowByValue_(sheet, keyHeader, keyValue);
  if (existing) {
    const merged = {};
    Object.keys(existing.record).forEach(function(key) {
      merged[key] = existing.record[key];
    });
    Object.keys(payload).forEach(function(header) {
      merged[normalizeHeaderToKey_(header)] = payload[header];
    });
    writeRecordToRow_(sheet, existing.rowIndex, merged);
    return existing.rowIndex;
  }

  appendObjectRow_(sheet, IMS_CONFIG.SCHEMAS[sheet.getName()], payload);
  return sheet.getLastRow();
}

function writeRecordToRow_(sheet, rowIndex, record) {
  const headers = IMS_CONFIG.SCHEMAS[sheet.getName()];
  const row = headers.map(function(header) {
    const key = normalizeHeaderToKey_(header);
    return record[key] !== undefined ? record[key] : '';
  });
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
}

function findRowByValue_(sheet, headerName, lookupValue) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return null;
  }

  const headers = data[0];
  const targetIndex = headerIndex_(headers, headerName);
  for (let i = 1; i < data.length; i += 1) {
    if (cleanText_(data[i][targetIndex]) === cleanText_(lookupValue)) {
      const record = {};
      headers.forEach(function(header, columnIndex) {
        record[normalizeHeaderToKey_(header)] = data[i][columnIndex];
      });
      return {
        rowIndex: i + 1,
        record: record
      };
    }
  }
  return null;
}

function buildDispatchQtyMap_(dispatchRows) {
  const map = {};
  dispatchRows.forEach(function(row) {
    const orderId = cleanText_(row.OrderID);
    if (!orderId) {
      return;
    }
    map[orderId] = round2_((map[orderId] || 0) + toNumber_(row.DispatchedQty));
  });
  return map;
}

function getSheetDataFast(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return [];
  }

  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) {
    return [];
  }

  const headers = rows.shift().map(function(header) {
    return normalizeHeaderToKey_(header);
  });

  return rows.map(function(row) {
    const record = {};
    let hasData = false;
    headers.forEach(function(header, index) {
      const value = row[index];
      if (value !== '' && value !== null && value !== undefined) {
        hasData = true;
      }
      if (value instanceof Date) {
        record[header] = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else {
        record[header] = value;
      }
    });
    return hasData ? record : null;
  }).filter(Boolean);
}

function headerIndex_(headers, headerName) {
  const target = normalizeHeader_(headerName);
  for (let i = 0; i < headers.length; i += 1) {
    if (normalizeHeader_(headers[i]) === target) {
      return i;
    }
  }
  throw new Error('Header not found: ' + headerName);
}

function normalizeOrderStatus_(status, dispatchedQty, balanceQty) {
  const cleanStatus = cleanText_(status);
  if (cleanStatus === 'Cancelled') {
    return 'Cancelled';
  }
  if (balanceQty <= 0 && dispatchedQty > 0) {
    return 'Completed';
  }
  if (dispatchedQty > 0 && balanceQty > 0) {
    return 'Partially Dispatched';
  }
  return cleanStatus || 'Pending';
}

function deriveReorderStatus_(closing, available, reorderLevel) {
  if (closing <= 0 || available < 0) {
    return 'REORDER (LOW)';
  }
  if (reorderLevel > 0 && closing <= reorderLevel) {
    return 'REORDER (LOW)';
  }
  if (reorderLevel > 0 && closing >= reorderLevel * 2) {
    return 'ABOVE LEVEL';
  }
  return 'NORMAL';
}

function calculateAverageWastage_(jobWork) {
  let totalSent = 0;
  let totalWastage = 0;
  jobWork.forEach(function(row) {
    totalSent += row.sentQty;
    totalWastage += row.wastageMtr;
  });
  return totalSent > 0 ? round2_((totalWastage / totalSent) * 100) : 0;
}

function comparePriority_(left, right) {
  const rank = { High: 1, Medium: 2, Low: 3 };
  return (rank[left] || 9) - (rank[right] || 9);
}

function generateSerialId_(sheet, prefix) {
  const nextNumber = Math.max(sheet.getLastRow(), 1);
  const datePart = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  return prefix + '-' + datePart + '-' + Utilities.formatString('%03d', nextNumber);
}

function normalizeHeader_(value) {
  return cleanText_(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeHeaderToKey_(value) {
  return cleanText_(value).replace(/[^a-zA-Z0-9]/g, '');
}

function cleanText_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function preserveTextValue_(incomingValue, fallbackValue) {
  const cleanIncoming = cleanText_(incomingValue);
  return cleanIncoming || cleanText_(fallbackValue);
}

function preserveNumberValue_(incomingValue, fallbackValue) {
  const cleanIncoming = cleanText_(incomingValue);
  return cleanIncoming === '' ? toNumber_(fallbackValue) : toNumber_(incomingValue);
}

function toNumber_(value) {
  if (value === '' || value === null || value === undefined) {
    return 0;
  }
  const number = parseFloat(String(value).replace(/,/g, ''));
  return isNaN(number) ? 0 : number;
}

function round2_(value) {
  return Math.round((toNumber_(value) + Number.EPSILON) * 100) / 100;
}

function uniqueList_(items) {
  const seen = {};
  const result = [];
  items.forEach(function(item) {
    const value = cleanText_(item);
    if (!value || seen[value]) {
      return;
    }
    seen[value] = true;
    result.push(value);
  });
  return result.sort();
}

function formatDate_(dateValue) {
  return Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function formatDateTime_(dateValue) {
  return Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'dd MMM yyyy, hh:mm a');
}
