const IMS_CONFIG = {
  version: '7.0.0',
  appTitle: 'Textile IMS Pro',
  defaultSpreadsheetId: '19DMKtsGlL2GvDAZSW7tfJ8S-8Vi_vk0dka_IG-hIbWw',
  defaultCompanyName: 'Jai Roop Textiles',
  defaultCurrency: 'INR',
  defaultTimeZone: 'Asia/Kolkata',
};

const IMS_SHEETS = {
  master: { name: 'Master', idPrefix: 'SKU' },
  orders: { name: 'Order Book', idPrefix: 'ORD' },
  jobWork: { name: 'Job Work Tracker', idPrefix: 'JOB' },
  dispatch: { name: 'Dispatch Log', idPrefix: 'DISP' },
  movements: { name: 'Stock Movements', idPrefix: 'MOV' },
  purchasePlanner: { name: 'Purchase Planner', idPrefix: 'PLAN' },
  settings: { name: 'Settings', idPrefix: 'SET' },
};

const IMS_SCHEMA = {
  master: [
    { key: 'itemCode', label: 'Item Code', aliases: ['itemcode', 'sku', 'code'] },
    { key: 'itemName', label: 'Item Name', aliases: ['itemname', 'description', 'item'] },
    { key: 'color', label: 'Color', aliases: ['colour', 'shade'] },
    { key: 'category', label: 'Category', aliases: ['categorytype'] },
    { key: 'uom', label: 'UOM', aliases: ['unit', 'unitofmeasure'] },
    { key: 'weightMtr', label: 'Weight/Mtr', aliases: ['weightmtr', 'weightpermeter', 'weightpermetre'] },
    { key: 'openingStock', label: 'Opening Stock', aliases: ['opening', 'openingbalance'] },
    { key: 'totalIn', label: 'Total In (Mtr/KG)', aliases: ['totalin', 'stockin', 'qtyin', 'receiptqty', 'totalinmtrkg'] },
    { key: 'totalOut', label: 'Total Out (Mtr/KG)', aliases: ['totalout', 'stockout', 'qtyout', 'issueqty', 'totaloutmtrkg'] },
    { key: 'closingBalance', label: 'Closing Balance', aliases: ['closingstock', 'balance', 'stockbalance'] },
    { key: 'allocatedToOrders', label: 'Allocated to Orders', aliases: ['allocatedtoorders', 'allocatedorders', 'allocatedqty', 'allocated'] },
    { key: 'availableStock', label: 'Available Stock', aliases: ['availablestock', 'availablebalance', 'freestock'] },
    { key: 'minStockLevel', label: 'Min Stock Level', aliases: ['minstock', 'minimumstock', 'reorderlevel'] },
    { key: 'targetStockLevel', label: 'Target Stock Level', aliases: ['targetstock', 'maxstock', 'targetlevel'] },
    { key: 'reorderQty', label: 'Reorder Qty', aliases: ['suggestedreorderqty', 'reorderquantity'] },
    { key: 'unitRate', label: 'Unit Rate', aliases: ['rate', 'cost', 'unitcost'] },
    { key: 'stockValue', label: 'Stock Value', aliases: ['inventoryvalue', 'value'] },
    { key: 'reorderStatus', label: 'Reorder Status', aliases: ['stockstatus', 'status'] },
    { key: 'notes', label: 'Notes', aliases: ['remarks', 'comment'] },
    { key: 'lastUpdated', label: 'Last Updated', aliases: ['updatedat', 'modifiedat'] },
  ],
  orders: [
    { key: 'orderId', label: 'Order ID', aliases: ['orderid'] },
    { key: 'date', label: 'Date', aliases: ['orderdate', 'createddate'] },
    { key: 'clientName', label: 'Client Name', aliases: ['client', 'customer', 'customername'] },
    { key: 'itemCode', label: 'Item Code', aliases: ['sku', 'code'] },
    { key: 'orderedQty', label: 'Ordered Qty (Mtr/KG)', aliases: ['qty', 'orderqty', 'orderedqtymtrkg', 'orderedquantity'] },
    { key: 'status', label: 'Status', aliases: ['orderstatus'] },
    { key: 'priority', label: 'Priority', aliases: ['urgency'] },
    { key: 'dueDate', label: 'Due Date', aliases: ['deliverydate', 'targetdate'] },
    { key: 'dispatchProgress', label: 'Dispatch Progress %', aliases: ['progress', 'dispatchprogress'] },
    { key: 'remarks', label: 'Remarks', aliases: ['note', 'notes', 'comment'] },
  ],
  jobWork: [
    { key: 'date', label: 'Date', aliases: ['jobdate'] },
    { key: 'jobId', label: 'Job ID', aliases: ['jobid'] },
    { key: 'orderId', label: 'Order ID', aliases: ['linkedorderid'] },
    { key: 'workerName', label: 'Worker Name', aliases: ['worker', 'vendor', 'vendorname'] },
    { key: 'itemCode', label: 'Item Code', aliases: ['sku', 'code'] },
    { key: 'sentQty', label: 'Sent Qty (Mtr)', aliases: ['sentqtymtr', 'sentqty', 'outqty'] },
    { key: 'receivedQty', label: 'Received Qty (Mtr)', aliases: ['receivedqtymtr', 'receivedqty', 'inqty'] },
    { key: 'wastageMtr', label: 'Wastage Mtr', aliases: ['wastage', 'wastageqty'] },
    { key: 'wastagePct', label: 'Wastage %', aliases: ['wastagepercent', 'wastagepercentage'] },
    { key: 'status', label: 'Status', aliases: ['jobstatus'] },
    { key: 'ratePerMtr', label: 'Rate / Mtr', aliases: ['ratepermtr', 'jobrate'] },
    { key: 'totalPayment', label: 'Total Payment', aliases: ['payment', 'amount'] },
    { key: 'notes', label: 'Notes', aliases: ['remarks', 'comment'] },
  ],
  dispatch: [
    { key: 'dispatchId', label: 'Dispatch ID', aliases: ['dispatchid'] },
    { key: 'orderId', label: 'Order ID', aliases: ['linkedorderid'] },
    { key: 'clientName', label: 'Client Name', aliases: ['client', 'customer'] },
    { key: 'itemCode', label: 'Item Code', aliases: ['sku', 'code'] },
    { key: 'dispatchedQty', label: 'Dispatched Qty', aliases: ['dispatchedquantity', 'qty', 'dispatchqty'] },
    { key: 'dispatchDate', label: 'Dispatch Date', aliases: ['date', 'shippingdate'] },
    { key: 'challanNo', label: 'Challan No.', aliases: ['challanno', 'challan', 'dcno'] },
    { key: 'vehicleNo', label: 'Vehicle No.', aliases: ['vehicleno', 'vehicle'] },
    { key: 'destination', label: 'Destination', aliases: ['city', 'shipto'] },
    { key: 'ewayBill', label: 'E-Way Bill', aliases: ['ewaybill', 'ewaybillno'] },
    { key: 'notes', label: 'Notes', aliases: ['remarks', 'comment'] },
  ],
  movements: [
    { key: 'movementId', label: 'Movement ID', aliases: ['movementid'] },
    { key: 'date', label: 'Date', aliases: ['movementdate'] },
    { key: 'movementType', label: 'Movement Type', aliases: ['type', 'transactiontype'] },
    { key: 'itemCode', label: 'Item Code', aliases: ['sku', 'code'] },
    { key: 'itemName', label: 'Item Name', aliases: ['description', 'item'] },
    { key: 'qty', label: 'Qty', aliases: ['quantity'] },
    { key: 'uom', label: 'UOM', aliases: ['unit'] },
    { key: 'referenceId', label: 'Reference ID', aliases: ['reference', 'refid'] },
    { key: 'linkedSheet', label: 'Linked Sheet', aliases: ['source', 'sheetname'] },
    { key: 'direction', label: 'Direction', aliases: ['flow'] },
    { key: 'balanceAfter', label: 'Balance After', aliases: ['closingbalance', 'resultingbalance'] },
    { key: 'remarks', label: 'Remarks', aliases: ['notes', 'comment'] },
    { key: 'createdBy', label: 'Created By', aliases: ['user', 'createduser'] },
  ],
  purchasePlanner: [
    { key: 'planId', label: 'Plan ID', aliases: ['purchaseplanid', 'reorderid'] },
    { key: 'date', label: 'Date', aliases: ['plandate'] },
    { key: 'itemCode', label: 'Item Code', aliases: ['sku', 'code'] },
    { key: 'vendor', label: 'Vendor', aliases: ['supplier', 'vendorname'] },
    { key: 'suggestedQty', label: 'Suggested Qty', aliases: ['qty', 'plannedqty'] },
    { key: 'status', label: 'Status', aliases: ['planstatus'] },
    { key: 'expectedDate', label: 'Expected Date', aliases: ['expecteddelivery', 'eta'] },
    { key: 'notes', label: 'Notes', aliases: ['remarks', 'comment'] },
  ],
  settings: [
    { key: 'key', label: 'Key', aliases: ['settingkey'] },
    { key: 'value', label: 'Value', aliases: ['settingvalue'] },
    { key: 'notes', label: 'Notes', aliases: ['remark', 'comment'] },
  ],
};

const IMS_STATUS_OPTIONS = {
  orderStatus: ['Pending', 'In Production', 'Completed', 'Cancelled'],
  orderPriority: ['Low', 'Medium', 'High', 'Urgent'],
  jobStatus: ['Out', 'Completed', 'Returned'],
  movementDirection: ['In', 'Out', 'Neutral'],
  purchaseStatus: ['Draft', 'Raised', 'Ordered', 'Received', 'Cancelled'],
};

function onOpen() {
  setupWorkbook_();

  SpreadsheetApp.getUi()
    .createMenu('IMS Control Center')
    .addItem('Initialize / Repair Workbook', 'initializeIMSWorkbook')
    .addItem('Refresh Stock Allocation', 'repairIMSWorkbook')
    .addSeparator()
    .addItem('Seed Demo Transactions', 'seedDemoTransactions')
    .addToUi();
}

function onEdit(e) {
  if (!e || !e.range) {
    return;
  }

  try {
    handleSheetEdit_(e);
  } catch (error) {
    Logger.log('onEdit error: ' + error);
  }
}

function doGet() {
  const meta = getAppMeta_();

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(meta.companyName + ' — ' + IMS_CONFIG.appTitle)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function initializeIMSWorkbook() {
  return setupWorkbook_();
}

function repairIMSWorkbook() {
  const report = repairWorkbook_();
  return {
    success: true,
    message: report.message,
    details: report,
  };
}

function getAllIMSData() {
  return getDashboardBundle_();
}

function saveNewOrder(orderData) {
  return saveNewOrder_(orderData || {});
}

function updateOrderStatus(orderId, newStatus) {
  return updateOrderStatus_(orderId, newStatus);
}

function saveNewJobWork(jobData) {
  return saveNewJobWork_(jobData || {});
}

function saveNewDispatch(dispatchData) {
  return saveNewDispatch_(dispatchData || {});
}

function saveStockAdjustment(adjustmentData) {
  return saveStockAdjustment_(adjustmentData || {});
}

function savePurchasePlan(planData) {
  return savePurchasePlan_(planData || {});
}

function updatePurchasePlanStatus(planId, newStatus) {
  return updatePurchasePlanStatus_(planId, newStatus);
}

function seedDemoTransactions() {
  return seedDemoTransactions_();
}
