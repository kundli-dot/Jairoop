// =====================================================================
//  WhatsApp.gs  —  Add as a separate .gs file. Do NOT touch Code.gs.
//
//  WHAT CHANGED (v2 — bug fixes)
//  ─────────────────────────────────────────────────────────────────
//  BUG 1 FIXED: HOD_NAME_ROW was 2 (pointed at the flow name "BOM")
//               Now 3 (points at the actual HOD name, e.g. "Sumit Mishra")
//               The sheet layout is:
//                 Row 2 → What  → BOM / CRM / System …  (flow type)
//                 Row 3 → Who   → Sumit Mishra / …       (HOD name) ← correct
//                 Row 4 → How   → System / …
//                 Row 5 → When  → 24:00:00 / …
//                 Row 6 → column headers (PI, Act, Status, Form Link, …)
//                 Row 7+ → data rows
//
//  BUG 2 FIXED: Planned dates are formula-generated, so onEdit/onChange
//               do NOT fire when they appear. Previous version relied on
//               a 60-minute trigger — now BOTH triggers are used:
//                 • onChange installable trigger → sends within seconds
//                 • Hourly time-based trigger    → safety net / catch-up
//
//  HOW TO RE-SETUP AFTER THIS UPDATE
//  ─────────────────────────────────────────────────────────────────
//  Run  setupWhatsAppTriggers()  (note the plural) once from the editor.
//  This replaces both old triggers with the corrected ones.
//  Then run  diagnoseFMSSheet()  to verify your column configuration.
// =====================================================================


// ─────────────────────────────────────────────────────────────────
//  CONFIGURATION
// ─────────────────────────────────────────────────────────────────
var WA_CFG = {

  // Sheet names
  FMS_SHEET: "FMS",
  HOD_SHEET: "HOD",
  LOG_SHEET: "WA_Log",

  // ── Task detail columns (1-based: A=1, B=2 … O=15, P=16) ────────
  // Run diagnoseFMSSheet() to verify these are correct for your sheet.
  TASK_ID_COL:       16,   // Column P  — adjust if Task ID is elsewhere
  ITEM_NAME_COL:     7,    // Column G
  CUSTOMER_NAME_COL: 2,    // Column B

  // ── Flow block structure ─────────────────────────────────────────
  //   Each flow block occupies 5 consecutive columns starting at Q (17)
  //     [+0] Planned date (PI)   ← formula-generated; triggers WA send
  //     [+1] Actual date (Act)
  //     [+2] Status
  //     [+3] Form Link           ← sent in the WhatsApp message
  //     [+4] Time Delay
  //
  //   Flow 1: Q–U  (17–21),  HOD in Q3
  //   Flow 2: V–Z  (22–26),  HOD in V3
  //   Flow 3: AA–AE(27–31),  HOD in AA3
  //   Flow 4: AF–AJ(32–36),  HOD in AF3
  //   Flow 5: AK–AO(37–41),  HOD in AK3
  //   Flow 6: AP–AT(42–46),  HOD in AP3
  //   Flow 7: AU–AY(47–51),  HOD in AU3
  //   Flow 8: AZ–BD(52–56),  HOD in AZ3
  FLOW_START_COL: 17,   // Column Q
  FLOW_SIZE:      5,    // Columns per block
  NUM_FLOWS:      8,    // Total flows

  // ── Header row positions ─────────────────────────────────────────
  //   Row 2 = What  (flow type: BOM / CRM / System …)
  //   Row 3 = Who   (HOD name: Sumit Mishra / …)    ← BUG FIX: was 2
  //   Row 4 = How
  //   Row 5 = When
  //   Row 6 = Column headers (PI, Act, Status, …)
  //   Row 7 = First data row
  HOD_NAME_ROW:   3,    // ← FIXED (was 2 — that pointed at "BOM", not the HOD name)
  DATA_START_ROW: 7,    // First row that contains actual task data

  // Offsets within each flow block (0-indexed from block start)
  PLANNED_OFFSET:   0,
  FORM_LINK_OFFSET: 3,

  // ── WhatsApp API ─────────────────────────────────────────────────
  API_URL:  "https://yourdigisathi.in/api/whatsapp-web/send-message",
  APP_KEY:  "c0a32d45-887c-48a7-8a35-1977773f0ebb",
  AUTH_KEY: "abcJnOSJ7zs71D110EXwaS9OkuuS9bEI11",

  TRIGGER_HOURS: 1   // Hourly safety-net trigger (onChange catches the rest)
};


// ─────────────────────────────────────────────────────────────────
//  SETUP — run this once after updating the script
//  Installs BOTH triggers:
//    1. onChange  → near-real-time (seconds after planned date appears)
//    2. Hourly    → safety net / catch-up for any missed events
// ─────────────────────────────────────────────────────────────────
function setupWhatsAppTriggers() {
  // Remove ALL existing WhatsApp triggers first
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === "checkAndSendWhatsApp" || fn === "onChange_WhatsApp") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Trigger 1: onChange — fires within seconds whenever the sheet changes
  // (formula recalculations that produce new planned dates count as changes)
  ScriptApp.newTrigger("onChange_WhatsApp")
    .forSpreadsheet(ss)
    .onChange()
    .create();

  // Trigger 2: Hourly time-based — catches anything the onChange missed
  ScriptApp.newTrigger("checkAndSendWhatsApp")
    .timeBased()
    .everyHours(WA_CFG.TRIGGER_HOURS)
    .create();

  ensureLogSheet_();

  Logger.log("✅ Both triggers installed:");
  Logger.log("   • onChange_WhatsApp  → fires on every sheet change");
  Logger.log("   • checkAndSendWhatsApp → runs every " + WA_CFG.TRIGGER_HOURS + " hour(s)");
  Logger.log("");
  Logger.log("Next step: run diagnoseFMSSheet() to verify your column configuration.");
}

// Removes all WhatsApp triggers (call to pause notifications)
function removeWhatsAppTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === "checkAndSendWhatsApp" || fn === "onChange_WhatsApp") {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  Logger.log(removed + " WhatsApp trigger(s) removed.");
}


// ─────────────────────────────────────────────────────────────────
//  onChange handler — called by the installable onChange trigger
//  Runs the full check every time the spreadsheet changes.
//  WA_Log deduplication ensures each message is sent only once.
// ─────────────────────────────────────────────────────────────────
function onChange_WhatsApp(e) {
  checkAndSendWhatsApp();
}


// ─────────────────────────────────────────────────────────────────
//  MAIN — scan all rows, send WhatsApp for new planned dates
// ─────────────────────────────────────────────────────────────────
function checkAndSendWhatsApp() {

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var fmsSheet = ss.getSheetByName(WA_CFG.FMS_SHEET);
  if (!fmsSheet) { Logger.log("ERROR: Sheet not found → " + WA_CFG.FMS_SHEET); return; }

  var hodSheet = ss.getSheetByName(WA_CFG.HOD_SHEET);
  if (!hodSheet) { Logger.log("ERROR: Sheet not found → " + WA_CFG.HOD_SHEET); return; }

  var lastRow = fmsSheet.getLastRow();
  if (lastRow < WA_CFG.DATA_START_ROW) { Logger.log("No data rows yet."); return; }

  var lastCol = Math.max(
    fmsSheet.getLastColumn(),
    WA_CFG.FLOW_START_COL + WA_CFG.NUM_FLOWS * WA_CFG.FLOW_SIZE
  );

  // ── Batch-read entire sheet (one API call — fast) ────────────────
  var allData = fmsSheet.getRange(1, 1, lastRow, lastCol).getValues();

  // ── HOD directory: name → phone ──────────────────────────────────
  var hodMap = {};
  var hodLR  = hodSheet.getLastRow();
  if (hodLR >= 2) {
    var hodData = hodSheet.getRange(2, 1, hodLR - 1, 2).getValues();
    for (var h = 0; h < hodData.length; h++) {
      var n = hodData[h][0].toString().trim();
      var p = hodData[h][1].toString().trim();
      if (n && p) hodMap[n] = p;
    }
  }

  // ── HOD name for each flow (read from HOD_NAME_ROW) ─────────────
  var hodRowIdx = WA_CFG.HOD_NAME_ROW - 1; // 0-indexed
  var flowHODs  = [];
  for (var fi = 0; fi < WA_CFG.NUM_FLOWS; fi++) {
    var ci = (WA_CFG.FLOW_START_COL - 1) + fi * WA_CFG.FLOW_SIZE + WA_CFG.PLANNED_OFFSET;
    flowHODs.push(ci < allData[hodRowIdx].length ? allData[hodRowIdx][ci].toString().trim() : "");
  }

  // ── Load sent-log deduplication set ─────────────────────────────
  var logSheet  = ensureLogSheet_();
  var sentKeys  = buildSentKeySet_(logSheet);
  var newLogRows = [];

  // ── Scan data rows ───────────────────────────────────────────────
  for (var row = WA_CFG.DATA_START_ROW; row <= lastRow; row++) {
    var ri     = row - 1;
    var taskId = allData[ri][WA_CFG.TASK_ID_COL - 1];
    if (!taskId) continue; // skip blank rows

    var itemName     = allData[ri][WA_CFG.ITEM_NAME_COL - 1];
    var customerName = allData[ri][WA_CFG.CUSTOMER_NAME_COL - 1];

    for (var fi = 0; fi < WA_CFG.NUM_FLOWS; fi++) {
      var pci = (WA_CFG.FLOW_START_COL - 1) + fi * WA_CFG.FLOW_SIZE + WA_CFG.PLANNED_OFFSET;
      var fci = (WA_CFG.FLOW_START_COL - 1) + fi * WA_CFG.FLOW_SIZE + WA_CFG.FORM_LINK_OFFSET;

      var plannedVal = pci < allData[ri].length ? allData[ri][pci] : "";
      if (!plannedVal) continue; // no planned date yet

      var key = taskId.toString().trim() + "|F" + (fi + 1);
      if (sentKeys[key]) continue; // already sent

      var hodName = flowHODs[fi];
      if (!hodName) {
        Logger.log("Row " + row + " Flow " + (fi+1) + ": no HOD name in row " + WA_CFG.HOD_NAME_ROW);
        continue;
      }

      var phone = hodMap[hodName];
      if (!phone) {
        Logger.log("Row " + row + ": no phone for HOD '" + hodName + "' — check HOD sheet");
        continue;
      }

      var formLink = fci < allData[ri].length ? allData[ri][fci] : "";
      var dateStr  = (plannedVal instanceof Date)
        ? Utilities.formatDate(plannedVal, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")
        : plannedVal.toString();

      var ok = wa_send_(phone, hodName, taskId, itemName, customerName, formLink, dateStr, fi + 1);

      if (ok) {
        sentKeys[key] = true;
        newLogRows.push([taskId.toString(), fi + 1, hodName, phone, dateStr, new Date()]);
        Logger.log("✅ Sent | " + key + " → " + hodName + " (" + phone + ")");
      }
    }
  }

  // ── Persist new log rows ─────────────────────────────────────────
  if (newLogRows.length > 0) {
    logSheet
      .getRange(logSheet.getLastRow() + 1, 1, newLogRows.length, newLogRows[0].length)
      .setValues(newLogRows);
    Logger.log("Messages sent this run: " + newLogRows.length);
  } else {
    Logger.log("No new messages to send.");
  }
}


// ─────────────────────────────────────────────────────────────────
//  WhatsApp API call
// ─────────────────────────────────────────────────────────────────
function wa_send_(phone, hodName, taskId, itemName, customerName, formLink, plannedDate, flowNum) {
  var msg =
    "Dear " + hodName + ",\n\n" +
    "A new task has been assigned to you in FMS (Flow " + flowNum + "):\n\n" +
    "Task ID      : " + taskId       + "\n" +
    "Item         : " + itemName     + "\n" +
    "Customer     : " + customerName + "\n" +
    "Planned Date : " + plannedDate  + "\n\n" +
    "Please fill the Google Form:\n" +
    (formLink ? formLink : "(Form link not yet assigned)") + "\n\n" +
    "Regards,\nFMS System";

  var opts = {
    method:             "POST",
    contentType:        "application/x-www-form-urlencoded",
    muteHttpExceptions: true,
    payload: {
      app_key:  WA_CFG.APP_KEY,
      auth_key: WA_CFG.AUTH_KEY,
      to:       phone,
      type:     "text",
      message:  msg
    }
  };

  try {
    var res  = UrlFetchApp.fetch(WA_CFG.API_URL, opts);
    var code = res.getResponseCode();
    var body = res.getContentText();
    Logger.log("WA → " + phone + " | HTTP " + code + " | " + body);
    if (code === 200) {
      return JSON.parse(body).status === "Success";
    }
    return false;
  } catch (err) {
    Logger.log("WA send error (" + phone + "): " + err.toString());
    return false;
  }
}


// ─────────────────────────────────────────────────────────────────
//  DIAGNOSTIC — run this to verify your column configuration
//  Reads the first few data rows and logs what the script sees.
//  Check the Execution Log to confirm Task ID, Item, Customer columns.
// ─────────────────────────────────────────────────────────────────
function diagnoseFMSSheet() {
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var sheet    = ss.getSheetByName(WA_CFG.FMS_SHEET);
  var hodSheet = ss.getSheetByName(WA_CFG.HOD_SHEET);

  if (!sheet)    { Logger.log("❌ FMS sheet not found: "  + WA_CFG.FMS_SHEET); return; }
  if (!hodSheet) { Logger.log("❌ HOD sheet not found: " + WA_CFG.HOD_SHEET); return; }

  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(sheet.getLastColumn(),
    WA_CFG.FLOW_START_COL + WA_CFG.NUM_FLOWS * WA_CFG.FLOW_SIZE);

  var allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();

  Logger.log("════════════════════════════════════════");
  Logger.log("FMS SHEET DIAGNOSTIC");
  Logger.log("════════════════════════════════════════");

  // ── HOD names per flow ───────────────────────────────────────────
  Logger.log("\n── HOD names (row " + WA_CFG.HOD_NAME_ROW + ") ──");
  var hodRowIdx = WA_CFG.HOD_NAME_ROW - 1;
  for (var fi = 0; fi < WA_CFG.NUM_FLOWS; fi++) {
    var ci = (WA_CFG.FLOW_START_COL - 1) + fi * WA_CFG.FLOW_SIZE + WA_CFG.PLANNED_OFFSET;
    var name = ci < allData[hodRowIdx].length ? allData[hodRowIdx][ci] : "(out of range)";
    Logger.log("  Flow " + (fi+1) + " (col " + colLetter_(ci+1) + "): '" + name + "'");
  }

  // ── HOD phone lookup ─────────────────────────────────────────────
  Logger.log("\n── HOD sheet entries ──");
  var hodLR = hodSheet.getLastRow();
  if (hodLR >= 2) {
    var hodData = hodSheet.getRange(2, 1, hodLR - 1, 2).getValues();
    for (var h = 0; h < hodData.length; h++) {
      Logger.log("  '" + hodData[h][0] + "' → " + hodData[h][1]);
    }
  } else {
    Logger.log("  (HOD sheet is empty or has only a header row)");
  }

  // ── Sample data rows ─────────────────────────────────────────────
  Logger.log("\n── First 5 data rows (starting row " + WA_CFG.DATA_START_ROW + ") ──");
  var shown = 0;
  for (var row = WA_CFG.DATA_START_ROW; row <= lastRow && shown < 5; row++) {
    var ri     = row - 1;
    var taskId = allData[ri][WA_CFG.TASK_ID_COL - 1];
    if (!taskId) continue;
    Logger.log(
      "  Row " + row +
      " | TaskID(col " + colLetter_(WA_CFG.TASK_ID_COL) + ")='" + taskId + "'" +
      " | Item(col " + colLetter_(WA_CFG.ITEM_NAME_COL) + ")='" + allData[ri][WA_CFG.ITEM_NAME_COL-1] + "'" +
      " | Customer(col " + colLetter_(WA_CFG.CUSTOMER_NAME_COL) + ")='" + allData[ri][WA_CFG.CUSTOMER_NAME_COL-1] + "'"
    );
    for (var fi = 0; fi < WA_CFG.NUM_FLOWS; fi++) {
      var pci = (WA_CFG.FLOW_START_COL - 1) + fi * WA_CFG.FLOW_SIZE + WA_CFG.PLANNED_OFFSET;
      var fci = (WA_CFG.FLOW_START_COL - 1) + fi * WA_CFG.FLOW_SIZE + WA_CFG.FORM_LINK_OFFSET;
      var planned  = pci < allData[ri].length ? allData[ri][pci]  : "";
      var formLink = fci < allData[ri].length ? allData[ri][fci]  : "";
      if (planned || formLink) {
        Logger.log("    Flow " + (fi+1) + " → PI='" + planned + "' | Form='" + formLink + "'");
      }
    }
    shown++;
  }

  Logger.log("\n════════════════════════════════════════");
  Logger.log("If HOD names or Task IDs look wrong, adjust WA_CFG values.");
  Logger.log("════════════════════════════════════════");
}

// Converts 1-based column number to letter(s): 1→A, 16→P, 27→AA
function colLetter_(n) {
  var s = "";
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}


// ─────────────────────────────────────────────────────────────────
//  Log sheet helpers
// ─────────────────────────────────────────────────────────────────
function ensureLogSheet_() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var log = ss.getSheetByName(WA_CFG.LOG_SHEET);
  if (!log) {
    log = ss.insertSheet(WA_CFG.LOG_SHEET);
    log.appendRow(["Task ID", "Flow #", "HOD Name", "Phone", "Planned Date", "Sent At"]);
    log.setFrozenRows(1);
    log.getRange("1:1").setFontWeight("bold");
  }
  return log;
}

function buildSentKeySet_(logSheet) {
  var keys = {};
  var lr   = logSheet.getLastRow();
  if (lr < 2) return keys;
  var data = logSheet.getRange(2, 1, lr - 1, 2).getValues();
  for (var i = 0; i < data.length; i++) {
    keys[data[i][0].toString().trim() + "|F" + data[i][1]] = true;
  }
  return keys;
}

// Clears the log — next run re-sends all notifications (use with caution!)
function clearWASentLog() {
  var log = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(WA_CFG.LOG_SHEET);
  if (!log) { Logger.log("WA_Log not found."); return; }
  var lr = log.getLastRow();
  if (lr > 1) { log.deleteRows(2, lr - 1); Logger.log("WA_Log cleared."); }
  else { Logger.log("WA_Log already empty."); }
}


// ─────────────────────────────────────────────────────────────────
//  TEST — replace phone number and run to verify API connectivity
// ─────────────────────────────────────────────────────────────────
function testWhatsAppSend() {
  var ok = wa_send_(
    "91XXXXXXXXXX",           // ← replace with a real number (no + or spaces)
    "Test HOD",
    "JRT-TEST",
    "Test Item",
    "Test Customer",
    "https://forms.gle/example",
    "28/05/2026 10:43",
    1
  );
  Logger.log(ok ? "✅ Test sent!" : "❌ Test failed — see logs above");
}
