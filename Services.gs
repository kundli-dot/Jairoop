function getSpreadsheet_() {
  const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (activeSpreadsheet) {
    return activeSpreadsheet;
  }

  return SpreadsheetApp.openById(IMS_CONFIG.defaultSpreadsheetId);
}

function getAppMeta_() {
  const ss = getSpreadsheet_();
  const settings = loadSettingsMap_();

  return {
    companyName: settings.companyname || IMS_CONFIG.defaultCompanyName,
    currency: settings.currency || IMS_CONFIG.defaultCurrency,
    timeZone: settings.timezone || ss.getSpreadsheetTimeZone() || IMS_CONFIG.defaultTimeZone,
    spreadsheetUrl: ss.getUrl(),
    spreadsheetId: ss.getId(),
    appTitle: IMS_CONFIG.appTitle,
    version: IMS_CONFIG.version,
    supportSheetId: IMS_CONFIG.defaultSpreadsheetId,
  };
}

function setupWorkbook_() {
  const ss = getSpreadsheet_();
  bootstrapMasterSheet_(ss);

  Object.keys(IMS_SHEETS).forEach(function(sheetKey) {
    ensureSheetStructure_(sheetKey);
  });

  ensureDefaultSettings_();

  Object.keys(IMS_SHEETS).forEach(function(sheetKey) {
    applySheetValidation_(sheetKey);
  });

  recalculateMasterMetrics_();

  return {
    success: true,
    message: 'IMS workbook is initialized and ready to use.',
    spreadsheetUrl: ss.getUrl(),
  };
}

function repairWorkbook_() {
  Object.keys(IMS_SHEETS).forEach(function(sheetKey) {
    ensureSheetStructure_(sheetKey);
    applySheetValidation_(sheetKey);
  });

  const master = recalculateMasterMetrics_();

  return {
    message: 'Workbook headers, validations, and stock calculations were refreshed.',
    masterRowCount: master.length,
  };
}

function bootstrapMasterSheet_(ss) {
  if (ss.getSheetByName(IMS_SHEETS.master.name)) {
    return;
  }

  const reservedNames = Object.keys(IMS_SHEETS).map(function(key) {
    return IMS_SHEETS[key].name;
  });

  const candidate = ss.getSheets().find(function(sheet) {
    if (reservedNames.indexOf(sheet.getName()) !== -1) {
      return false;
    }

    const lastColumn = Math.max(1, sheet.getLastColumn());
    const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
    const normalized = headers.map(sanitizeHeader_);

    return normalized.indexOf('itemcode') !== -1 &&
      (normalized.indexOf('closingbalance') !== -1 ||
      normalized.indexOf('itemname') !== -1 ||
      normalized.indexOf('category') !== -1);
  });

  if (candidate) {
    candidate.setName(IMS_SHEETS.master.name);
  }
}

function ensureSheetStructure_(sheetKey) {
  const ss = getSpreadsheet_();
  const schema = IMS_SCHEMA[sheetKey];
  if (!schema) {
    throw new Error('Unknown sheet key: ' + sheetKey);
  }

  let sheet = ss.getSheetByName(IMS_SHEETS[sheetKey].name);
  if (!sheet) {
    sheet = ss.insertSheet(IMS_SHEETS[sheetKey].name);
  }

  const lastColumn = sheet.getLastColumn();
  if (!lastColumn) {
    sheet.getRange(1, 1, 1, schema.length).setValues([schema.map(function(col) {
      return col.label;
    })]);
    styleSheetHeader_(sheet);
    return sheet;
  }

  const headerRange = sheet.getRange(1, 1, 1, lastColumn);
  const headerValues = headerRange.getDisplayValues()[0];
  const mutableHeaders = headerValues.slice();

  schema.forEach(function(column) {
    const existingIndex = findHeaderMatchIndex_(mutableHeaders, column);
    if (existingIndex === -1) {
      mutableHeaders.push(column.label);
    } else if (mutableHeaders[existingIndex] !== column.label) {
      mutableHeaders[existingIndex] = column.label;
    }
  });

  sheet.getRange(1, 1, 1, mutableHeaders.length).setValues([mutableHeaders]);
  styleSheetHeader_(sheet);

  return sheet;
}

function styleSheetHeader_(sheet) {
  const lastColumn = Math.max(1, sheet.getLastColumn());
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, lastColumn)
    .setFontWeight('bold')
    .setBackground('#0d1b2a')
    .setFontColor('#ffffff');

  if (sheet.getLastRow() > 0 && !sheet.getFilter()) {
    sheet.getRange(1, 1, sheet.getLastRow(), lastColumn).createFilter();
  }
}

function applySheetValidation_(sheetKey) {
  const sheet = ensureSheetStructure_(sheetKey);
  const map = getColumnIndexMap_(sheetKey);
  const rowCount = Math.max(sheet.getMaxRows() - 1, 1);

  if (sheetKey === 'orders' && map.status) {
    applyValidationToColumn_(sheet, map.status, rowCount, IMS_STATUS_OPTIONS.orderStatus);
  }

  if (sheetKey === 'orders' && map.priority) {
    applyValidationToColumn_(sheet, map.priority, rowCount, IMS_STATUS_OPTIONS.orderPriority);
  }

  if (sheetKey === 'jobWork' && map.status) {
    applyValidationToColumn_(sheet, map.status, rowCount, IMS_STATUS_OPTIONS.jobStatus);
  }

  if (sheetKey === 'purchasePlanner' && map.status) {
    applyValidationToColumn_(sheet, map.status, rowCount, IMS_STATUS_OPTIONS.purchaseStatus);
  }

  if (sheetKey === 'movements' && map.direction) {
    applyValidationToColumn_(sheet, map.direction, rowCount, IMS_STATUS_OPTIONS.movementDirection);
  }
}

function applyValidationToColumn_(sheet, columnIndex, rowCount, allowedValues) {
  const validation = SpreadsheetApp.newDataValidation()
    .requireValueInList(allowedValues, true)
    .setAllowInvalid(false)
    .build();

  sheet.getRange(2, columnIndex, rowCount, 1).setDataValidation(validation);
}

function ensureDefaultSettings_() {
  const sheet = ensureSheetStructure_('settings');
  const existing = loadSettingsMap_();

  const defaults = [
    ['companyName', IMS_CONFIG.defaultCompanyName, 'Brand shown in the dashboard'],
    ['currency', IMS_CONFIG.defaultCurrency, 'Currency code used in KPI labels'],
    ['timeZone', IMS_CONFIG.defaultTimeZone, 'Formatting timezone'],
    ['defaultMinStockLevel', 0, 'Fallback minimum stock if SKU-level value is blank'],
    ['targetStockMultiplier', 1.5, 'Target stock = min stock x multiplier'],
    ['defaultJobRatePerMtr', 0.25, 'Auto payment rate if job payment is blank'],
    ['spreadsheetId', getSpreadsheet_().getId(), 'Used when the script is copied as a standalone project'],
    ['companyLogoUrl', '', 'Optional image URL to show in the dashboard header'],
  ];

  defaults.forEach(function(row) {
    if (!Object.prototype.hasOwnProperty.call(existing, sanitizeHeader_(row[0]))) {
      sheet.appendRow(row);
    }
  });
}

function loadSettingsMap_() {
  const rows = readSheetRows_('settings');
  const settings = {};

  rows.forEach(function(row) {
    if (row.key !== '' && row.key != null) {
      settings[sanitizeHeader_(row.key)] = row.value;
    }
  });

  return settings;
}

function getSettingNumber_(settings, key, fallbackValue) {
  const value = settings[sanitizeHeader_(key)];
  const numeric = toNumber_(value);
  return (numeric || numeric === 0) ? numeric : fallbackValue;
}

function handleSheetEdit_(e) {
  const sheetName = e.range.getSheet().getName();

  if (
    sheetName === IMS_SHEETS.master.name ||
    sheetName === IMS_SHEETS.orders.name ||
    sheetName === IMS_SHEETS.dispatch.name ||
    sheetName === IMS_SHEETS.settings.name
  ) {
    recalculateMasterMetrics_();
  }
}

function readSheetRows_(sheetKey) {
  const sheet = ensureSheetStructure_(sheetKey);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) {
    return [];
  }

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values[0];
  const columnKeys = headers.map(function(header) {
    return resolveHeaderKey_(sheetKey, header);
  });
  const timeZone = getSpreadsheet_().getSpreadsheetTimeZone() || IMS_CONFIG.defaultTimeZone;

  return values.slice(1).map(function(row, index) {
    const item = {
      _rowNumber: index + 2,
      _sheetKey: sheetKey,
    };
    let hasData = false;

    row.forEach(function(value, columnIndex) {
      const key = columnKeys[columnIndex];
      if (!key) {
        return;
      }

      const normalized = normalizeCellValue_(value, timeZone);
      item[key] = normalized;
      if (normalized !== '' && normalized != null) {
        hasData = true;
      }
    });

    return hasData ? item : null;
  }).filter(Boolean);
}

function normalizeCellValue_(value, timeZone) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, timeZone, 'yyyy-MM-dd');
  }
  return value;
}

function resolveHeaderKey_(sheetKey, header) {
  const schema = IMS_SCHEMA[sheetKey];
  const normalized = sanitizeHeader_(header);
  const match = schema.find(function(column) {
    return headerMatches_(header, column) || column.key === normalized;
  });
  return match ? match.key : null;
}

function getColumnIndexMap_(sheetKey) {
  const sheet = ensureSheetStructure_(sheetKey);
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const map = {};

  headers.forEach(function(header, index) {
    const key = resolveHeaderKey_(sheetKey, header);
    if (key && !map[key]) {
      map[key] = index + 1;
    }
  });

  return map;
}

function findHeaderMatchIndex_(headers, columnDef) {
  for (let index = 0; index < headers.length; index += 1) {
    if (headerMatches_(headers[index], columnDef)) {
      return index;
    }
  }

  return -1;
}

function headerMatches_(header, columnDef) {
  const normalizedHeader = sanitizeHeader_(header);
  if (normalizedHeader === sanitizeHeader_(columnDef.label)) {
    return true;
  }

  return columnDef.aliases.some(function(alias) {
    return normalizedHeader === sanitizeHeader_(alias);
  });
}

function sanitizeHeader_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeLookupValue_(value) {
  return String(value || '').trim().toLowerCase();
}

function toNumber_(value) {
  if (typeof value === 'number') {
    return value;
  }

  const numeric = parseFloat(String(value || '').replace(/,/g, ''));
  return isNaN(numeric) ? 0 : numeric;
}

function toDateString_(value) {
  const timeZone = getSpreadsheet_().getSpreadsheetTimeZone() || IMS_CONFIG.defaultTimeZone;

  if (!value) {
    return Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd');
  }

  if (value instanceof Date) {
    return Utilities.formatDate(value, timeZone, 'yyyy-MM-dd');
  }

  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, timeZone, 'yyyy-MM-dd');
  }

  return String(value);
}

function formatTimestamp_(date) {
  const timeZone = getSpreadsheet_().getSpreadsheetTimeZone() || IMS_CONFIG.defaultTimeZone;
  return Utilities.formatDate(date, timeZone, 'dd MMM yyyy, hh:mm a');
}

function appendRowByKey_(sheetKey, data) {
  const sheet = ensureSheetStructure_(sheetKey);
  const map = getColumnIndexMap_(sheetKey);
  const row = new Array(sheet.getLastColumn()).fill('');

  Object.keys(data).forEach(function(key) {
    const columnIndex = map[key];
    if (columnIndex) {
      row[columnIndex - 1] = data[key];
    }
  });

  sheet.appendRow(row);
  return sheet.getLastRow();
}

function updateRowByLookup_(sheetKey, lookupKey, lookupValue, updates) {
  const sheet = ensureSheetStructure_(sheetKey);
  const map = getColumnIndexMap_(sheetKey);
  const lookupColumn = map[lookupKey];
  if (!lookupColumn) {
    throw new Error('Lookup column not found: ' + lookupKey);
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    throw new Error('No rows found in ' + IMS_SHEETS[sheetKey].name);
  }

  const columnValues = sheet.getRange(2, lookupColumn, lastRow - 1, 1).getDisplayValues();
  const target = normalizeLookupValue_(lookupValue);

  for (let rowIndex = 0; rowIndex < columnValues.length; rowIndex += 1) {
    if (normalizeLookupValue_(columnValues[rowIndex][0]) === target) {
      const actualRow = rowIndex + 2;
      Object.keys(updates).forEach(function(key) {
        if (map[key]) {
          sheet.getRange(actualRow, map[key]).setValue(updates[key]);
        }
      });
      return actualRow;
    }
  }

  throw new Error('Row not found for ' + lookupValue);
}

function generateSequentialId_(sheetKey, idKey, prefix) {
  const rows = readSheetRows_(sheetKey);
  const timeZone = getSpreadsheet_().getSpreadsheetTimeZone() || IMS_CONFIG.defaultTimeZone;
  const datePrefix = Utilities.formatDate(new Date(), timeZone, 'yyyyMMdd');

  const existingCount = rows.filter(function(row) {
    return String(row[idKey] || '').indexOf(prefix + '-' + datePrefix + '-') === 0;
  }).length + 1;

  return prefix + '-' + datePrefix + '-' + Utilities.formatString('%03d', existingCount);
}

function getMasterItemMap_() {
  const items = readSheetRows_('master');
  const map = {};

  items.forEach(function(item) {
    if (item.itemCode) {
      map[normalizeLookupValue_(item.itemCode)] = item;
    }
  });

  return map;
}

function getOrderMap_() {
  const rows = readSheetRows_('orders');
  const map = {};

  rows.forEach(function(row) {
    if (row.orderId) {
      map[normalizeLookupValue_(row.orderId)] = row;
    }
  });

  return map;
}

function syncOrderProgress_() {
  const orders = readSheetRows_('orders');
  const dispatchRows = readSheetRows_('dispatch');
  const dispatchQtyByOrder = {};

  dispatchRows.forEach(function(row) {
    const key = normalizeLookupValue_(row.orderId);
    if (!key) {
      return;
    }
    dispatchQtyByOrder[key] = (dispatchQtyByOrder[key] || 0) + toNumber_(row.dispatchedQty);
  });

  const sheet = ensureSheetStructure_('orders');
  const map = getColumnIndexMap_('orders');
  const progressValues = [];
  const statusValues = [];
  const updatedOrders = [];

  orders.forEach(function(order) {
    const orderQty = toNumber_(order.orderedQty);
    const dispatchedQty = dispatchQtyByOrder[normalizeLookupValue_(order.orderId)] || 0;
    const progress = orderQty > 0 ? Math.min(100, Math.round((dispatchedQty / orderQty) * 100)) : 0;
    let status = order.status || 'Pending';

    if (status !== 'Cancelled' && orderQty > 0 && dispatchedQty >= orderQty) {
      status = 'Completed';
    }

    progressValues.push([progress]);
    statusValues.push([status]);
    updatedOrders.push(Object.assign({}, order, {
      dispatchProgress: progress,
      status: status,
      dispatchedQty: dispatchedQty,
    }));
  });

  if (orders.length && map.dispatchProgress) {
    sheet.getRange(2, map.dispatchProgress, progressValues.length, 1).setValues(progressValues);
  }

  if (orders.length && map.status) {
    sheet.getRange(2, map.status, statusValues.length, 1).setValues(statusValues);
  }

  return updatedOrders;
}

function recalculateMasterMetrics_() {
  syncOrderProgress_();

  const settings = loadSettingsMap_();
  const defaultMinStockLevel = getSettingNumber_(settings, 'defaultMinStockLevel', 0);
  const targetStockMultiplier = getSettingNumber_(settings, 'targetStockMultiplier', 1.5);
  const timestamp = formatTimestamp_(new Date());

  const masterSheet = ensureSheetStructure_('master');
  const masterRows = readSheetRows_('master');
  const orders = readSheetRows_('orders');
  const map = getColumnIndexMap_('master');
  const allocationMap = {};

  orders.forEach(function(order) {
    const status = String(order.status || '').trim();
    if (status === 'Cancelled' || status === 'Completed') {
      return;
    }

    const remainingQty = Math.max(toNumber_(order.orderedQty) - toNumber_(order.dispatchProgress) / 100 * toNumber_(order.orderedQty), 0);
    const itemKey = normalizeLookupValue_(order.itemCode);
    allocationMap[itemKey] = (allocationMap[itemKey] || 0) + remainingQty;
  });

  const computedRows = [];
  const closingValues = [];
  const allocatedValues = [];
  const availableValues = [];
  const reorderQtyValues = [];
  const stockValueValues = [];
  const reorderStatusValues = [];
  const lastUpdatedValues = [];

  masterRows.forEach(function(row) {
    const opening = toNumber_(row.openingStock);
    const totalIn = toNumber_(row.totalIn);
    const totalOut = toNumber_(row.totalOut);
    const importedClosing = toNumber_(row.closingBalance);
    let closingBalance = opening + totalIn - totalOut;

    if (!closingBalance && importedClosing) {
      closingBalance = importedClosing;
    }

    const allocatedToOrders = allocationMap[normalizeLookupValue_(row.itemCode)] || 0;
    const rawAvailable = closingBalance - allocatedToOrders;
    const availableStock = rawAvailable < 0 ? 0 : rawAvailable;

    const explicitMinStock = toNumber_(row.minStockLevel);
    const minStockLevel = (explicitMinStock || explicitMinStock === 0) ? explicitMinStock : defaultMinStockLevel;
    const explicitTargetStock = toNumber_(row.targetStockLevel);
    const targetStockLevel = (explicitTargetStock || explicitTargetStock === 0) ? explicitTargetStock :
      (minStockLevel > 0 ? minStockLevel * targetStockMultiplier : closingBalance);

    const reorderQty = availableStock < minStockLevel ? Math.max(targetStockLevel - availableStock, 0) : 0;
    const unitRate = toNumber_(row.unitRate);
    const stockValue = closingBalance * unitRate;

    let reorderStatus = 'NORMAL';
    if (availableStock <= 0 || (minStockLevel > 0 && availableStock <= minStockLevel)) {
      reorderStatus = 'REORDER (LOW)';
    } else if (targetStockLevel > 0 && availableStock >= targetStockLevel) {
      reorderStatus = 'ABOVE LEVEL';
    }

    closingValues.push([closingBalance]);
    allocatedValues.push([allocatedToOrders]);
    availableValues.push([availableStock]);
    reorderQtyValues.push([reorderQty]);
    stockValueValues.push([stockValue]);
    reorderStatusValues.push([reorderStatus]);
    lastUpdatedValues.push([timestamp]);

    computedRows.push(Object.assign({}, row, {
      closingBalance: closingBalance,
      allocatedToOrders: allocatedToOrders,
      availableStock: availableStock,
      reorderQty: reorderQty,
      stockValue: stockValue,
      reorderStatus: reorderStatus,
      effectiveMinStockLevel: minStockLevel,
      effectiveTargetStockLevel: targetStockLevel,
      lastUpdated: timestamp,
    }));
  });

  if (masterRows.length && map.closingBalance) {
    masterSheet.getRange(2, map.closingBalance, closingValues.length, 1).setValues(closingValues);
  }
  if (masterRows.length && map.allocatedToOrders) {
    masterSheet.getRange(2, map.allocatedToOrders, allocatedValues.length, 1).setValues(allocatedValues);
  }
  if (masterRows.length && map.availableStock) {
    masterSheet.getRange(2, map.availableStock, availableValues.length, 1).setValues(availableValues);
  }
  if (masterRows.length && map.reorderQty) {
    masterSheet.getRange(2, map.reorderQty, reorderQtyValues.length, 1).setValues(reorderQtyValues);
  }
  if (masterRows.length && map.stockValue) {
    masterSheet.getRange(2, map.stockValue, stockValueValues.length, 1).setValues(stockValueValues);
  }
  if (masterRows.length && map.reorderStatus) {
    masterSheet.getRange(2, map.reorderStatus, reorderStatusValues.length, 1).setValues(reorderStatusValues);
  }
  if (masterRows.length && map.lastUpdated) {
    masterSheet.getRange(2, map.lastUpdated, lastUpdatedValues.length, 1).setValues(lastUpdatedValues);
  }

  return computedRows;
}

function getDashboardBundle_() {
  setupWorkbook_();

  const master = recalculateMasterMetrics_();
  const orders = readSheetRows_('orders');
  const jobWork = readSheetRows_('jobWork');
  const dispatch = readSheetRows_('dispatch');
  const movements = readSheetRows_('movements');
  const purchasePlans = readSheetRows_('purchasePlanner');

  const clientSummary = buildClientSummary_(orders, dispatch);
  const workerSummary = buildWorkerSummary_(jobWork);
  const reorderPlans = buildReorderPlans_(master);
  const alerts = buildAlerts_(master, orders);
  const kpis = buildKpis_(master, orders, jobWork, dispatch, purchasePlans, reorderPlans);
  const meta = getAppMeta_();

  return {
    meta: Object.assign({}, meta, {
      lastSync: formatTimestamp_(new Date()),
    }),
    master: master,
    orders: orders,
    jobWork: jobWork,
    dispatch: dispatch,
    movements: movements,
    purchasePlans: purchasePlans,
    clientSummary: clientSummary,
    workerSummary: workerSummary,
    reorderPlans: reorderPlans,
    alerts: alerts,
    kpis: kpis,
    statusOptions: IMS_STATUS_OPTIONS,
  };
}

function buildKpis_(master, orders, jobWork, dispatch, purchasePlans, reorderPlans) {
  const activeOrders = orders.filter(function(order) {
    return order.status === 'In Production';
  });
  const pendingOrders = orders.filter(function(order) {
    return order.status === 'Pending';
  });
  const completedOrders = orders.filter(function(order) {
    return order.status === 'Completed';
  });
  const cancelledOrders = orders.filter(function(order) {
    return order.status === 'Cancelled';
  });

  const totalInventoryValue = master.reduce(function(sum, item) {
    return sum + toNumber_(item.stockValue);
  }, 0);

  const totalAvailableStock = master.reduce(function(sum, item) {
    return sum + toNumber_(item.availableStock);
  }, 0);

  const totalAllocated = master.reduce(function(sum, item) {
    return sum + toNumber_(item.allocatedToOrders);
  }, 0);

  const dispatchThisMonth = buildMonthlyDispatchMap_(dispatch);
  const currentMonth = toDateString_(new Date()).substring(0, 7);
  const totalDispatchedThisMonth = dispatchThisMonth[currentMonth] || 0;

  let totalSent = 0;
  let totalWastage = 0;
  jobWork.forEach(function(row) {
    totalSent += toNumber_(row.sentQty);
    totalWastage += toNumber_(row.wastageMtr);
  });

  const avgWastagePct = totalSent > 0 ? (totalWastage / totalSent) * 100 : 0;
  const openPlans = purchasePlans.filter(function(plan) {
    return ['Received', 'Cancelled'].indexOf(plan.status) === -1;
  });

  const categoryBreakdown = {};
  master.forEach(function(item) {
    const category = item.category || 'Uncategorized';
    if (!categoryBreakdown[category]) {
      categoryBreakdown[category] = {
        skuCount: 0,
        availableStock: 0,
      };
    }

    categoryBreakdown[category].skuCount += 1;
    categoryBreakdown[category].availableStock += toNumber_(item.availableStock);
  });

  const topItems = master.slice().sort(function(a, b) {
    return toNumber_(b.availableStock) - toNumber_(a.availableStock);
  }).slice(0, 5).map(function(item) {
    return {
      itemCode: item.itemCode,
      itemName: item.itemName,
      availableStock: toNumber_(item.availableStock),
    };
  });

  return {
    totalSkus: master.length,
    reorderCount: reorderPlans.length,
    activeOrderCount: activeOrders.length,
    pendingOrderCount: pendingOrders.length,
    completedOrderCount: completedOrders.length,
    cancelledOrderCount: cancelledOrders.length,
    totalInventoryValue: totalInventoryValue,
    totalAvailableStock: totalAvailableStock,
    totalAllocated: totalAllocated,
    totalDispatchedThisMonth: totalDispatchedThisMonth,
    avgWastagePct: avgWastagePct,
    openPurchasePlans: openPlans.length,
    categoryBreakdown: categoryBreakdown,
    topItems: topItems,
    monthlyDispatch: dispatchThisMonth,
  };
}

function buildMonthlyDispatchMap_(dispatch) {
  const monthlyDispatch = {};

  dispatch.forEach(function(row) {
    const dispatchDate = String(row.dispatchDate || '');
    if (!dispatchDate) {
      return;
    }
    const monthKey = dispatchDate.substring(0, 7);
    monthlyDispatch[monthKey] = (monthlyDispatch[monthKey] || 0) + toNumber_(row.dispatchedQty);
  });

  return monthlyDispatch;
}

function buildClientSummary_(orders, dispatch) {
  const dispatchedByOrder = {};
  dispatch.forEach(function(row) {
    const orderKey = normalizeLookupValue_(row.orderId);
    dispatchedByOrder[orderKey] = (dispatchedByOrder[orderKey] || 0) + toNumber_(row.dispatchedQty);
  });

  const summary = {};
  orders.forEach(function(order) {
    const clientName = order.clientName || 'Unknown Client';
    if (!summary[clientName]) {
      summary[clientName] = {
        clientName: clientName,
        orderCount: 0,
        orderQty: 0,
        dispatchedQty: 0,
        activeOrders: 0,
        completedOrders: 0,
      };
    }

    summary[clientName].orderCount += 1;
    summary[clientName].orderQty += toNumber_(order.orderedQty);
    summary[clientName].dispatchedQty += dispatchedByOrder[normalizeLookupValue_(order.orderId)] || 0;
    if (order.status === 'Completed') {
      summary[clientName].completedOrders += 1;
    }
    if (order.status === 'Pending' || order.status === 'In Production') {
      summary[clientName].activeOrders += 1;
    }
  });

  return Object.keys(summary).map(function(key) {
    return summary[key];
  }).sort(function(a, b) {
    return b.orderQty - a.orderQty;
  });
}

function buildWorkerSummary_(jobWork) {
  const summary = {};

  jobWork.forEach(function(row) {
    const workerName = row.workerName || 'Unassigned';
    if (!summary[workerName]) {
      summary[workerName] = {
        workerName: workerName,
        batches: 0,
        sentQty: 0,
        receivedQty: 0,
        wastageMtr: 0,
        totalPayment: 0,
        activeBatches: 0,
      };
    }

    summary[workerName].batches += 1;
    summary[workerName].sentQty += toNumber_(row.sentQty);
    summary[workerName].receivedQty += toNumber_(row.receivedQty);
    summary[workerName].wastageMtr += toNumber_(row.wastageMtr);
    summary[workerName].totalPayment += toNumber_(row.totalPayment);
    if (row.status === 'Out') {
      summary[workerName].activeBatches += 1;
    }
  });

  return Object.keys(summary).map(function(key) {
    const worker = summary[key];
    worker.wastagePct = worker.sentQty > 0 ? (worker.wastageMtr / worker.sentQty) * 100 : 0;
    return worker;
  }).sort(function(a, b) {
    return b.sentQty - a.sentQty;
  });
}

function buildReorderPlans_(master) {
  return master.filter(function(item) {
    return toNumber_(item.reorderQty) > 0;
  }).map(function(item) {
    return {
      itemCode: item.itemCode,
      itemName: item.itemName,
      category: item.category,
      availableStock: toNumber_(item.availableStock),
      minStockLevel: toNumber_(item.effectiveMinStockLevel),
      targetStockLevel: toNumber_(item.effectiveTargetStockLevel),
      reorderQty: toNumber_(item.reorderQty),
      reorderStatus: item.reorderStatus,
    };
  }).sort(function(a, b) {
    return b.reorderQty - a.reorderQty;
  });
}

function buildAlerts_(master, orders) {
  const alerts = [];
  const today = toDateString_(new Date());

  master.forEach(function(item) {
    const available = toNumber_(item.availableStock);
    const allocated = toNumber_(item.allocatedToOrders);
    const minStockLevel = toNumber_(item.effectiveMinStockLevel);

    if (item.reorderStatus === 'REORDER (LOW)') {
      alerts.push({
        severity: 'critical',
        title: 'Low stock risk on ' + item.itemCode,
        detail: 'Available stock is ' + available + ' against min stock ' + minStockLevel + '.',
      });
    } else if (available > 0 && allocated / available > 0.8) {
      alerts.push({
        severity: 'warning',
        title: 'High allocation pressure on ' + item.itemCode,
        detail: 'More than 80% of available stock is reserved against live orders.',
      });
    }
  });

  orders.forEach(function(order) {
    if (order.dueDate && order.dueDate < today && order.status !== 'Completed' && order.status !== 'Cancelled') {
      alerts.push({
        severity: 'warning',
        title: 'Order overdue: ' + order.orderId,
        detail: (order.clientName || 'Client') + ' order is overdue since ' + order.dueDate + '.',
      });
    }
  });

  return alerts;
}

function ensureMasterItemExists_(itemCode) {
  const item = getMasterItemMap_()[normalizeLookupValue_(itemCode)];
  if (!item) {
    throw new Error('Item Code not found in Master sheet: ' + itemCode);
  }
  return item;
}

function incrementMasterTotals_(itemCode, totalInDelta, totalOutDelta) {
  const sheet = ensureSheetStructure_('master');
  const map = getColumnIndexMap_('master');
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    throw new Error('Master sheet is empty.');
  }

  const itemCodeValues = sheet.getRange(2, map.itemCode, lastRow - 1, 1).getDisplayValues();
  const target = normalizeLookupValue_(itemCode);

  for (let index = 0; index < itemCodeValues.length; index += 1) {
    if (normalizeLookupValue_(itemCodeValues[index][0]) === target) {
      const rowNumber = index + 2;
      const currentIn = toNumber_(sheet.getRange(rowNumber, map.totalIn).getValue());
      const currentOut = toNumber_(sheet.getRange(rowNumber, map.totalOut).getValue());

      if (totalInDelta) {
        sheet.getRange(rowNumber, map.totalIn).setValue(currentIn + totalInDelta);
      }
      if (totalOutDelta) {
        sheet.getRange(rowNumber, map.totalOut).setValue(currentOut + totalOutDelta);
      }
      return rowNumber;
    }
  }

  throw new Error('Item not found in Master sheet: ' + itemCode);
}

function findBalanceAfter_(masterRows, itemCode) {
  const item = masterRows.find(function(row) {
    return normalizeLookupValue_(row.itemCode) === normalizeLookupValue_(itemCode);
  });
  return item ? toNumber_(item.closingBalance) : '';
}

function appendMovement_(movementData) {
  const movementId = movementData.movementId || generateSequentialId_('movements', 'movementId', IMS_SHEETS.movements.idPrefix);

  appendRowByKey_('movements', {
    movementId: movementId,
    date: toDateString_(movementData.date),
    movementType: movementData.movementType,
    itemCode: movementData.itemCode,
    itemName: movementData.itemName || '',
    qty: toNumber_(movementData.qty),
    uom: movementData.uom || 'Mtr',
    referenceId: movementData.referenceId || '',
    linkedSheet: movementData.linkedSheet || '',
    direction: movementData.direction || 'Neutral',
    balanceAfter: movementData.balanceAfter,
    remarks: movementData.remarks || '',
    createdBy: movementData.createdBy || Session.getEffectiveUser().getEmail() || 'System',
  });

  return movementId;
}

function saveNewOrder_(orderData) {
  setupWorkbook_();

  const clientName = String(orderData.clientName || '').trim();
  const itemCode = String(orderData.itemCode || '').trim();
  const qty = toNumber_(orderData.qty);
  if (!clientName || !itemCode || qty <= 0) {
    throw new Error('Client name, item code, and order quantity are required.');
  }

  const masterItem = ensureMasterItemExists_(itemCode);
  const orderId = generateSequentialId_('orders', 'orderId', IMS_SHEETS.orders.idPrefix);
  const status = IMS_STATUS_OPTIONS.orderStatus.indexOf(orderData.status) !== -1 ? orderData.status : 'Pending';
  const priority = IMS_STATUS_OPTIONS.orderPriority.indexOf(orderData.priority) !== -1 ? orderData.priority : 'Medium';

  appendRowByKey_('orders', {
    orderId: orderId,
    date: toDateString_(orderData.date),
    clientName: clientName,
    itemCode: masterItem.itemCode,
    orderedQty: qty,
    status: status,
    priority: priority,
    dueDate: orderData.dueDate ? toDateString_(orderData.dueDate) : '',
    dispatchProgress: 0,
    remarks: String(orderData.remarks || '').trim(),
  });

  recalculateMasterMetrics_();

  return {
    success: true,
    orderId: orderId,
    message: 'Order ' + orderId + ' created successfully.',
  };
}

function updateOrderStatus_(orderId, newStatus) {
  if (IMS_STATUS_OPTIONS.orderStatus.indexOf(newStatus) === -1) {
    throw new Error('Invalid order status: ' + newStatus);
  }

  updateRowByLookup_('orders', 'orderId', orderId, { status: newStatus });
  recalculateMasterMetrics_();

  return {
    success: true,
    message: 'Order ' + orderId + ' updated to ' + newStatus + '.',
  };
}

function saveNewJobWork_(jobData) {
  setupWorkbook_();

  const workerName = String(jobData.workerName || '').trim();
  const itemCode = String(jobData.itemCode || '').trim();
  const sentQty = toNumber_(jobData.sentQty);
  const receivedQty = toNumber_(jobData.receivedQty);
  const wastageMtr = toNumber_(jobData.wastageMtr);
  const settings = loadSettingsMap_();

  if (!workerName || !itemCode || sentQty <= 0) {
    throw new Error('Worker name, item code, and sent quantity are required.');
  }

  const masterItem = ensureMasterItemExists_(itemCode);
  const jobId = generateSequentialId_('jobWork', 'jobId', IMS_SHEETS.jobWork.idPrefix);
  const ratePerMtr = toNumber_(jobData.ratePerMtr) || getSettingNumber_(settings, 'defaultJobRatePerMtr', 0.25);
  const totalPayment = toNumber_(jobData.totalPayment) || (receivedQty * ratePerMtr);
  const wastagePct = sentQty > 0 ? (wastageMtr / sentQty) * 100 : 0;
  const status = IMS_STATUS_OPTIONS.jobStatus.indexOf(jobData.status) !== -1
    ? jobData.status
    : (receivedQty >= sentQty ? 'Completed' : 'Out');

  appendRowByKey_('jobWork', {
    date: toDateString_(jobData.date),
    jobId: jobId,
    orderId: String(jobData.orderId || '').trim(),
    workerName: workerName,
    itemCode: masterItem.itemCode,
    sentQty: sentQty,
    receivedQty: receivedQty,
    wastageMtr: wastageMtr,
    wastagePct: wastagePct,
    status: status,
    ratePerMtr: ratePerMtr,
    totalPayment: totalPayment,
    notes: String(jobData.notes || '').trim(),
  });

  appendMovement_({
    date: jobData.date,
    movementType: 'Job Work Out',
    itemCode: masterItem.itemCode,
    itemName: masterItem.itemName,
    qty: sentQty,
    uom: masterItem.uom || 'Mtr',
    referenceId: jobId,
    linkedSheet: IMS_SHEETS.jobWork.name,
    direction: 'Out',
    balanceAfter: '',
    remarks: 'Material issued to ' + workerName,
  });

  if (receivedQty > 0) {
    appendMovement_({
      date: jobData.date,
      movementType: 'Job Work In',
      itemCode: masterItem.itemCode,
      itemName: masterItem.itemName,
      qty: receivedQty,
      uom: masterItem.uom || 'Mtr',
      referenceId: jobId,
      linkedSheet: IMS_SHEETS.jobWork.name,
      direction: 'In',
      balanceAfter: '',
      remarks: 'Finished material received from ' + workerName,
    });
  }

  return {
    success: true,
    jobId: jobId,
    message: 'Job work ' + jobId + ' recorded successfully.',
  };
}

function saveNewDispatch_(dispatchData) {
  setupWorkbook_();

  const orderId = String(dispatchData.orderId || '').trim();
  const order = getOrderMap_()[normalizeLookupValue_(orderId)];
  const clientName = String(dispatchData.clientName || order && order.clientName || '').trim();
  const itemCode = String(dispatchData.itemCode || order && order.itemCode || '').trim();
  const dispatchedQty = toNumber_(dispatchData.dispatchedQty);

  if (!orderId || !clientName || !itemCode || dispatchedQty <= 0) {
    throw new Error('Order ID, client name, item code, and dispatched quantity are required.');
  }

  const masterItem = ensureMasterItemExists_(itemCode);
  const dispatchId = generateSequentialId_('dispatch', 'dispatchId', IMS_SHEETS.dispatch.idPrefix);

  appendRowByKey_('dispatch', {
    dispatchId: dispatchId,
    orderId: orderId,
    clientName: clientName,
    itemCode: masterItem.itemCode,
    dispatchedQty: dispatchedQty,
    dispatchDate: toDateString_(dispatchData.dispatchDate),
    challanNo: String(dispatchData.challanNo || '').trim(),
    vehicleNo: String(dispatchData.vehicleNo || '').trim(),
    destination: String(dispatchData.destination || '').trim(),
    ewayBill: String(dispatchData.ewayBill || '').trim(),
    notes: String(dispatchData.notes || '').trim(),
  });

  incrementMasterTotals_(masterItem.itemCode, 0, dispatchedQty);

  if (dispatchData.markCompleted && order) {
    updateRowByLookup_('orders', 'orderId', orderId, { status: 'Completed' });
  }

  const master = recalculateMasterMetrics_();
  const balanceAfter = findBalanceAfter_(master, masterItem.itemCode);

  appendMovement_({
    date: dispatchData.dispatchDate,
    movementType: 'Dispatch',
    itemCode: masterItem.itemCode,
    itemName: masterItem.itemName,
    qty: dispatchedQty,
    uom: masterItem.uom || 'Mtr',
    referenceId: dispatchId,
    linkedSheet: IMS_SHEETS.dispatch.name,
    direction: 'Out',
    balanceAfter: balanceAfter,
    remarks: 'Dispatch against order ' + orderId,
  });

  return {
    success: true,
    dispatchId: dispatchId,
    message: 'Dispatch ' + dispatchId + ' logged successfully.',
  };
}

function saveStockAdjustment_(adjustmentData) {
  setupWorkbook_();

  const itemCode = String(adjustmentData.itemCode || '').trim();
  const qty = toNumber_(adjustmentData.qty);
  const direction = adjustmentData.direction === 'Out' ? 'Out' : 'In';
  const movementType = String(adjustmentData.movementType || 'Manual Adjustment').trim();

  if (!itemCode || qty <= 0) {
    throw new Error('Item code and quantity are required for stock adjustment.');
  }

  const masterItem = ensureMasterItemExists_(itemCode);

  if (direction === 'In') {
    incrementMasterTotals_(masterItem.itemCode, qty, 0);
  } else {
    incrementMasterTotals_(masterItem.itemCode, 0, qty);
  }

  const master = recalculateMasterMetrics_();
  const balanceAfter = findBalanceAfter_(master, masterItem.itemCode);

  const movementId = appendMovement_({
    date: adjustmentData.date,
    movementType: movementType,
    itemCode: masterItem.itemCode,
    itemName: masterItem.itemName,
    qty: qty,
    uom: masterItem.uom || 'Mtr',
    referenceId: String(adjustmentData.referenceId || '').trim(),
    linkedSheet: IMS_SHEETS.movements.name,
    direction: direction,
    balanceAfter: balanceAfter,
    remarks: String(adjustmentData.remarks || '').trim(),
  });

  return {
    success: true,
    movementId: movementId,
    message: 'Stock adjustment saved for ' + masterItem.itemCode + '.',
  };
}

function savePurchasePlan_(planData) {
  setupWorkbook_();

  const itemCode = String(planData.itemCode || '').trim();
  const suggestedQty = toNumber_(planData.suggestedQty);
  if (!itemCode || suggestedQty <= 0) {
    throw new Error('Item code and suggested quantity are required.');
  }

  const masterItem = ensureMasterItemExists_(itemCode);
  const planId = generateSequentialId_('purchasePlanner', 'planId', IMS_SHEETS.purchasePlanner.idPrefix);
  const status = IMS_STATUS_OPTIONS.purchaseStatus.indexOf(planData.status) !== -1 ? planData.status : 'Draft';

  appendRowByKey_('purchasePlanner', {
    planId: planId,
    date: toDateString_(planData.date),
    itemCode: masterItem.itemCode,
    vendor: String(planData.vendor || '').trim(),
    suggestedQty: suggestedQty,
    status: status,
    expectedDate: planData.expectedDate ? toDateString_(planData.expectedDate) : '',
    notes: String(planData.notes || '').trim(),
  });

  return {
    success: true,
    planId: planId,
    message: 'Purchase plan ' + planId + ' saved successfully.',
  };
}

function updatePurchasePlanStatus_(planId, newStatus) {
  if (IMS_STATUS_OPTIONS.purchaseStatus.indexOf(newStatus) === -1) {
    throw new Error('Invalid purchase plan status.');
  }

  updateRowByLookup_('purchasePlanner', 'planId', planId, { status: newStatus });

  return {
    success: true,
    message: 'Purchase plan ' + planId + ' updated to ' + newStatus + '.',
  };
}

function seedDemoTransactions_() {
  setupWorkbook_();

  const master = readSheetRows_('master');
  if (!master.length) {
    throw new Error('Add at least one SKU to the Master sheet before seeding demo data.');
  }

  if (readSheetRows_('orders').length || readSheetRows_('dispatch').length || readSheetRows_('jobWork').length) {
    return {
      success: false,
      message: 'Demo seed skipped because transactions already exist.',
    };
  }

  const sampleItem = master.find(function(item) {
    return item.itemCode;
  });

  const order = saveNewOrder_({
    date: toDateString_(new Date()),
    clientName: 'Demo Retailer',
    itemCode: sampleItem.itemCode,
    qty: 125,
    status: 'Pending',
    priority: 'High',
    dueDate: toDateString_(new Date()),
    remarks: 'Seeded demo order',
  });

  saveNewJobWork_({
    date: toDateString_(new Date()),
    orderId: order.orderId,
    workerName: 'Demo Worker',
    itemCode: sampleItem.itemCode,
    sentQty: 90,
    receivedQty: 82,
    wastageMtr: 3,
    status: 'Out',
    notes: 'Seeded demo job work',
  });

  savePurchasePlan_({
    date: toDateString_(new Date()),
    itemCode: sampleItem.itemCode,
    vendor: 'Demo Supplier',
    suggestedQty: 250,
    status: 'Draft',
    expectedDate: toDateString_(new Date()),
    notes: 'Seeded reorder plan',
  });

  return {
    success: true,
    message: 'Demo transactions were created successfully.',
  };
}
