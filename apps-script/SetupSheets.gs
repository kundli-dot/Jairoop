// ============================================================
// JAI ROOP TEXTILES — IMS V7 (Enterprise Edition)
// SetupSheets.gs
// One-click provisioning of every sheet the app needs.
// Safe to re-run — never deletes data, only adds missing
// sheets/columns and protects header rows.
// ============================================================

const SHEET_SCHEMA = {
  // ----- already in V6 -----
  "Master": [
    "ItemCode", "ItemName", "Category", "WeightMtr", "OpeningStock",
    "TotalInMtrKG", "TotalOutMtrKG", "AllocatedtoOrders", "ClosingBalance",
    "ReorderLevel", "MaxLevel", "ReorderStatus",
    "CostPerMtr", "SellingPricePerMtr", "GSTPct", "HSNCode", "Location", "Notes"
  ],
  "Order Book": [
    "OrderID", "Date", "ClientName", "ItemCode", "OrderedQtyMtrKG",
    "Status", "Remarks",
    "ExpectedDelivery", "Priority", "SalesPerson", "RatePerMtr", "TotalValue",
    "AdvanceReceived", "BalanceDue"
  ],
  "Job Work Tracker": [
    "Date", "JobID", "OrderID", "WorkerName", "ItemCode",
    "SentQtyMtr", "ReceivedQtyMtr", "WastageMtr", "Status", "TotalPayment",
    "RatePerMtr", "ExpectedReturn", "ActualReturn", "QualityGrade", "Remarks"
  ],
  "Dispatch Log": [
    "DispatchID", "OrderID", "ClientName", "ItemCode", "DispatchedQty",
    "DispatchDate", "ChallanNo",
    "Transporter", "VehicleNo", "LRNumber", "InvoiceNo", "InvoiceAmount", "Remarks"
  ],

  // ----- NEW in V7 -----
  "Purchase Orders": [
    "POID", "Date", "VendorName", "ItemCode", "OrderedQty",
    "ReceivedQty", "RatePerMtr", "GSTPct", "TotalValue", "Status",
    "ExpectedDelivery", "ActualDelivery", "InvoiceNo", "PaymentStatus", "Remarks"
  ],
  "Vendors": [
    "VendorID", "VendorName", "ContactPerson", "Phone", "Email",
    "Address", "GSTIN", "PANNumber", "BankAccount", "IFSC",
    "PaymentTerms", "CreditDays", "OutstandingPayable", "Rating", "Notes"
  ],
  "Clients": [
    "ClientID", "ClientName", "ContactPerson", "Phone", "Email",
    "BillingAddress", "ShippingAddress", "GSTIN", "PANNumber",
    "CreditLimit", "CreditDays", "OutstandingReceivable", "Rating", "Notes"
  ],
  "Workers": [
    "WorkerID", "WorkerName", "Phone", "Address", "Skill",
    "DefaultRatePerMtr", "BankAccount", "IFSC", "OutstandingPayable",
    "ActiveJobs", "TotalEarned", "Rating", "Notes"
  ],
  "Payments": [
    "PaymentID", "Date", "Type", "PartyType", "PartyName",
    "RefID", "Amount", "Mode", "TxnReference", "Notes"
  ],
  "Stock Ledger": [
    "TxnID", "Date", "ItemCode", "TxnType", "RefID",
    "QtyIn", "QtyOut", "Balance", "Party", "Notes"
  ],
  "Audit Log": [
    "Timestamp", "User", "Action", "Module", "RefID", "Details"
  ],
  "Users": [
    "Email", "Name", "Role", "PIN", "Active", "LastLogin", "Notes"
  ],
  "Settings": [
    "Key", "Value", "Description"
  ]
};

const DEFAULT_SETTINGS = [
  ["company.name",           "Jai Roop Textiles",          "Company display name"],
  ["company.tagline",        "IMS Tracking System V7",     "Tagline below logo"],
  ["company.address",        "—",                           "Full address on invoices"],
  ["company.gstin",          "—",                           "Your GSTIN"],
  ["company.phone",          "—",                           "Phone shown on invoices"],
  ["company.email",          "—",                           "Email shown on invoices"],
  ["company.logoFileId",     "12xaMnlUBwVFr_kdKYuJozypKuLWPyHmH", "Drive file ID of logo PNG/JPG"],
  ["invoice.prefix",         "INV-",                        "Prefix for invoice numbers"],
  ["invoice.gstPct",         "5",                           "Default GST % for textile sales"],
  ["jobwork.defaultRate",    "0.25",                        "Default ₹ per metre paid to workers"],
  ["jobwork.wastageWarnPct", "4",                           "Wastage % above which to flag critical"],
  ["alert.recipientEmail",   "",                            "Email for daily digest (blank = disabled)"],
  ["alert.digestHour",       "9",                           "Hour (0-23 IST) to send daily digest"],
  ["whatsapp.countryCode",   "91",                          "Default country code for wa.me links"],
  ["theme.accent",           "#c9a84c",                     "Gold accent colour"]
];

// ------------------------------------------------------------
// Entry point. Run once from the editor (Run > setupAll) on
// first install, or from the Web UI's "Run Setup" button.
// ------------------------------------------------------------
function setupAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const created = [];
  const patched = [];

  Object.keys(SHEET_SCHEMA).forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      writeHeader_(sheet, SHEET_SCHEMA[name]);
      created.push(name);
    } else {
      const added = ensureColumns_(sheet, SHEET_SCHEMA[name]);
      if (added.length) patched.push(name + " (+" + added.join(", ") + ")");
    }
  });

  seedSettings_(ss);
  seedFirstAdmin_(ss);

  const summary = {
    created: created,
    patched: patched,
    timestamp: new Date().toISOString()
  };
  logAudit_("SYSTEM", "SETUP", "—", JSON.stringify(summary));
  return summary;
}

function writeHeader_(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight("bold")
    .setBackground("#0d1b2a")
    .setFontColor("#ffffff")
    .setHorizontalAlignment("left");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function ensureColumns_(sheet, desired) {
  const lastCol = Math.max(1, sheet.getLastColumn());
  const current = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(v => String(v || "").trim());
  const added = [];
  desired.forEach(col => {
    if (current.indexOf(col) === -1) {
      const target = sheet.getLastColumn() + 1;
      sheet.getRange(1, target).setValue(col)
        .setFontWeight("bold")
        .setBackground("#0d1b2a")
        .setFontColor("#ffffff");
      current.push(col);
      added.push(col);
    }
  });
  if (added.length) sheet.setFrozenRows(1);
  return added;
}

function seedSettings_(ss) {
  const sheet = ss.getSheetByName("Settings");
  const existing = sheet.getDataRange().getValues();
  const keys = {};
  for (let i = 1; i < existing.length; i++) keys[existing[i][0]] = true;
  const toAdd = DEFAULT_SETTINGS.filter(row => !keys[row[0]]);
  if (toAdd.length) sheet.getRange(sheet.getLastRow() + 1, 1, toAdd.length, 3).setValues(toAdd);
}

function seedFirstAdmin_(ss) {
  const sheet = ss.getSheetByName("Users");
  if (sheet.getLastRow() > 1) return;
  const owner = Session.getEffectiveUser().getEmail() || "owner@local";
  sheet.appendRow([owner, "Owner", "ADMIN", "1234", "Yes", "", "Auto-created on setup. Change PIN!"]);
}

// ------------------------------------------------------------
// Settings helpers used everywhere else
// ------------------------------------------------------------
function getSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Settings");
  if (!sheet) return {};
  const rows = sheet.getDataRange().getValues();
  const out = {};
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0]) out[rows[i][0]] = rows[i][1];
  }
  return out;
}

function setSetting(key, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Settings");
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return true;
    }
  }
  sheet.appendRow([key, value, ""]);
  return true;
}
