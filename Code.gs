// ============================================================
//  FMS Google Apps Script
//  Features:
//    1. Company → Person cascading dropdown autofill (FMS sheet)
//    2. Auto-send WhatsApp to HOD when Planned Date is entered
//       in any flow block (columns Q onward, 5 cols per flow)
// ============================================================

// -----------------------------------------------------------
//  CONFIGURATION — edit these values to match your sheet
// -----------------------------------------------------------
var CFG = {

  // Sheet names
  FMS_SHEET:    "FMS",      // Sheet with the flow tracking table
  MASTER_SHEET: "Master",   // Lookup sheet for company → person data
  HOD_SHEET:    "HOD",      // Sheet with HOD name → phone mapping

  // ---- FMS autofill columns (Company / Person cascade) ----
  COMPANY_COL: 2,   // Column B
  PERSON_COL:  3,   // Column C
  DETAILS_COL: 4,   // Column D
  EMAIL_COL:   5,   // Column E

  // ---- Task detail columns (used in WhatsApp message) -----
  TASK_ID_COL:       15,  // Column O
  ITEM_NAME_COL:     7,   // Column G
  CUSTOMER_NAME_COL: 2,   // Column B

  // ---- Flow block structure --------------------------------
  //  Each flow occupies 5 consecutive columns:
  //    [0] Planned date (PI)
  //    [1] Actual date  (Act)
  //    [2] Status
  //    [3] Form Link
  //    [4] Time Delay
  FLOW_START_COL:    17,  // Column Q — first flow's first column
  FLOW_SIZE:         5,   // Columns per flow block
  NUM_FLOWS:         8,   // Total number of flow blocks
  HOD_NAME_ROW:      2,   // Row that contains HOD names for each flow
  DATA_START_ROW:    3,   // First row that contains actual task data

  // Offsets within each flow block (0-based)
  PLANNED_OFFSET:   0,
  FORM_LINK_OFFSET: 3,

  // ---- WhatsApp API credentials ---------------------------
  WA_API_URL:  "https://yourdigisathi.in/api/whatsapp-web/send-message",
  WA_APP_KEY:  "c0a32d45-887c-48a7-8a35-1977773f0ebb",
  WA_AUTH_KEY: "abcJnOSJ7zs71D110EXwaS9OkuuS9bEI11"
};


// -----------------------------------------------------------
//  onEdit trigger — fires on every manual cell edit
// -----------------------------------------------------------
function onEdit(e) {
  if (!e || !e.range) return;

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = e.range.getSheet();
  var row   = e.range.getRow();
  var col   = e.range.getColumn();

  // 1. FMS cascading dropdown autofill
  if (sheet.getName() === CFG.FMS_SHEET) {
    handleFMSAutofill(e, ss, sheet, row, col);
  }

  // 2. WhatsApp trigger when a Planned Date is entered in any flow block
  //    (works on whichever sheet holds the flow table — set CFG.FMS_SHEET accordingly)
  if (sheet.getName() === CFG.FMS_SHEET) {
    handleFlowPlannedDate(e, ss, sheet, row, col);
  }
}


// -----------------------------------------------------------
//  1. FMS Autofill — cascading Company → Person dropdown
// -----------------------------------------------------------
function handleFMSAutofill(e, ss, sheet, row, col) {
  var master = ss.getSheetByName(CFG.MASTER_SHEET);
  if (!master) return;

  var lastRow = master.getLastRow();
  if (lastRow < 2) return;

  var masterData = master.getRange(2, 1, lastRow - 1, 4).getValues();

  // ---- Company column changed ----
  if (col === CFG.COMPANY_COL) {
    var selectedCompany = sheet.getRange(row, CFG.COMPANY_COL).getValue();

    // Clear dependent cells
    sheet.getRange(row, CFG.PERSON_COL).clearContent().clearDataValidations();
    sheet.getRange(row, CFG.DETAILS_COL).clearContent();
    sheet.getRange(row, CFG.EMAIL_COL).clearContent();

    if (!selectedCompany) return;

    // Build unique person list for this company
    var persons = masterData
      .filter(function(r) { return r[0] === selectedCompany; })
      .map(function(r)    { return r[1]; });

    persons = persons.filter(function(v, i, a) { return a.indexOf(v) === i; }); // unique

    if (persons.length === 0) return;

    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(persons, true)
      .setAllowInvalid(false)
      .build();

    sheet.getRange(row, CFG.PERSON_COL).setDataValidation(rule);
  }

  // ---- Person column changed ----
  if (col === CFG.PERSON_COL) {
    var company = sheet.getRange(row, CFG.COMPANY_COL).getValue();
    var person  = sheet.getRange(row, CFG.PERSON_COL).getValue();

    if (!company || !person) return;

    var match = null;
    for (var i = 0; i < masterData.length; i++) {
      if (masterData[i][0] === company && masterData[i][1] === person) {
        match = masterData[i];
        break;
      }
    }

    if (match) {
      sheet.getRange(row, CFG.DETAILS_COL).setValue(match[2]);
      sheet.getRange(row, CFG.EMAIL_COL).setValue(match[3]);
    }
  }
}


// -----------------------------------------------------------
//  2. Flow Planned Date → send WhatsApp to HOD
// -----------------------------------------------------------
function handleFlowPlannedDate(e, ss, sheet, row, col) {
  // Skip header rows
  if (row < CFG.DATA_START_ROW) return;

  // Check each flow block to see if the edited cell is a Planned Date cell
  for (var i = 0; i < CFG.NUM_FLOWS; i++) {
    var plannedCol  = CFG.FLOW_START_COL + (i * CFG.FLOW_SIZE) + CFG.PLANNED_OFFSET;
    var formLinkCol = CFG.FLOW_START_COL + (i * CFG.FLOW_SIZE) + CFG.FORM_LINK_OFFSET;

    if (col !== plannedCol) continue;

    // A Planned Date was entered in flow block (i+1)
    var plannedDate = e.value;
    if (!plannedDate) return; // Date was cleared — do nothing

    // Get Form Link
    var formLink = sheet.getRange(row, formLinkCol).getValue();

    // Get HOD name from row 2 of this flow's first column
    var hodName = sheet.getRange(CFG.HOD_NAME_ROW, plannedCol).getValue();
    if (!hodName) {
      Logger.log("Flow " + (i + 1) + ": HOD name not found in row " +
                 CFG.HOD_NAME_ROW + ", col " + plannedCol);
      return;
    }

    // Look up HOD phone number from HOD sheet
    var hodSheet = ss.getSheetByName(CFG.HOD_SHEET);
    if (!hodSheet) {
      Logger.log("HOD sheet not found. Check CFG.HOD_SHEET name.");
      return;
    }

    var hodLastRow = hodSheet.getLastRow();
    if (hodLastRow < 2) {
      Logger.log("HOD sheet is empty.");
      return;
    }

    var hodData  = hodSheet.getRange(2, 1, hodLastRow - 1, 2).getValues();
    var hodPhone = null;

    for (var h = 0; h < hodData.length; h++) {
      if (hodData[h][0].toString().trim() === hodName.toString().trim()) {
        hodPhone = hodData[h][1].toString().trim();
        break;
      }
    }

    if (!hodPhone) {
      Logger.log("Phone number not found for HOD: " + hodName);
      return;
    }

    // Get task details
    var taskId       = sheet.getRange(row, CFG.TASK_ID_COL).getValue();
    var itemName     = sheet.getRange(row, CFG.ITEM_NAME_COL).getValue();
    var customerName = sheet.getRange(row, CFG.CUSTOMER_NAME_COL).getValue();

    // Send WhatsApp
    sendWhatsAppMessage(hodPhone, hodName, taskId, itemName, customerName, formLink, plannedDate, i + 1);

    break; // Matched flow found — no need to check remaining flows
  }
}


// -----------------------------------------------------------
//  WhatsApp API call via YourDigiSathi
// -----------------------------------------------------------
function sendWhatsAppMessage(phone, hodName, taskId, itemName, customerName, formLink, plannedDate, flowNumber) {

  var message =
    "Dear " + hodName + ",\n\n" +
    "A new task has been planned for you in the FMS system (Flow " + flowNumber + ").\n\n" +
    "Task ID      : " + taskId       + "\n" +
    "Item Name    : " + itemName     + "\n" +
    "Customer     : " + customerName + "\n" +
    "Planned Date : " + plannedDate  + "\n\n" +
    "Please complete the form using the link below:\n" +
    (formLink ? formLink : "No form link assigned yet") + "\n\n" +
    "Regards,\nFMS System";

  var payload = {
    app_key:  CFG.WA_APP_KEY,
    auth_key: CFG.WA_AUTH_KEY,
    to:       phone,
    type:     "text",
    message:  message
  };

  var options = {
    method:           "POST",
    contentType:      "application/x-www-form-urlencoded",
    payload:          payload,
    muteHttpExceptions: true
  };

  try {
    var response     = UrlFetchApp.fetch(CFG.WA_API_URL, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();

    Logger.log("WhatsApp → " + hodName + " (" + phone + ")" +
               " | HTTP " + responseCode + " | " + responseText);

    // Log success/failure clearly
    if (responseCode === 200) {
      try {
        var json = JSON.parse(responseText);
        if (json.status === "Success") {
          Logger.log("SUCCESS: Message delivered to " + hodName);
        } else {
          Logger.log("API WARNING: " + responseText);
        }
      } catch (parseErr) {
        Logger.log("Response parse error: " + parseErr);
      }
    } else {
      Logger.log("HTTP ERROR " + responseCode + ": " + responseText);
    }

  } catch (err) {
    Logger.log("FETCH ERROR sending WhatsApp to " + hodName + ": " + err.toString());
  }
}


// -----------------------------------------------------------
//  UTILITY — run this manually to test a WhatsApp send
//  without needing to edit a cell. Fill in test values below.
// -----------------------------------------------------------
function testWhatsAppSend() {
  sendWhatsAppMessage(
    "91XXXXXXXXXX",    // ← Replace with HOD's phone in international format (no +)
    "Test HOD",        // HOD name
    "TASK-001",        // Task ID
    "Sample Item",     // Item name
    "Sample Customer", // Customer name
    "https://forms.gle/example",  // Form link
    new Date().toLocaleDateString("en-IN"),
    1                  // Flow number
  );
}
