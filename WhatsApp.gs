// =====================================================================
//  WhatsApp.gs  —  Add as a separate .gs file. Do NOT touch Code.gs.
//
//  VERSION 3  — fixes the "150+ messages" flood
//  ─────────────────────────────────────────────────────────────────
//  WHY THE FLOOD HAPPENED
//    The onChange trigger fires 30-50 times per user action (once per
//    formula recalculation). With an empty WA_Log, every concurrent
//    run saw "not sent yet" for all historical rows and sent them all.
//
//  HOW IT'S FIXED
//    1. onChange trigger REMOVED — replaced with a 5-minute time-based
//       trigger. Time-based triggers never run concurrently.
//    2. Activation date filter — setupWhatsAppTriggers() records the
//       current timestamp. checkAndSendWhatsApp() ONLY processes rows
//       whose entry Timestamp (col A) is AFTER that recorded time.
//       All historical rows are permanently ignored.
//    3. WA_Log deduplication — second line of defence: each Task ID +
//       Flow combination is sent exactly once even across many runs.
//
//  CORRECTED COLUMNS (from user confirmation)
//    Task ID   → Column O (15)   ← was incorrectly set to 16
//    Form Link → Column T (20)   ← FORM_LINK_OFFSET 3 = Q(17)+3 = T(20) ✓
//
//  SETUP AFTER UPDATE
//  ─────────────────────────────────────────────────────────────────
//  1. Replace your existing WhatsApp.gs with this version
//  2. Run  setupWhatsAppTriggers()   (removes old triggers, installs new)
//  3. Run  diagnoseFMSSheet()        (verify column config in Execution Log)
//  4. Done — only rows entered from NOW on will trigger messages
// =====================================================================


// ─────────────────────────────────────────────────────────────────
//  CONFIGURATION
// ─────────────────────────────────────────────────────────────────
var WA_CFG = {

  // Sheet names
  FMS_SHEET: "FMS",
  HOD_SHEET: "HOD",
  LOG_SHEET: "WA_Log",

  // ── Task detail columns (1-based: A=1, B=2 … O=15, P=16 …) ─────
  TIMESTAMP_COL:     1,   // Column A — order entry time (used as "new row" filter)
  CUSTOMER_NAME_COL: 2,   // Column B
  ITEM_NAME_COL:     7,   // Column G
  TASK_ID_COL:       15,  // Column O ← confirmed by user

  // ── Flow block structure (Q=17, 5 columns per block, 8 flows) ───
  //   [+0] PI (Planned Date)  ← triggers WhatsApp when populated
  //   [+1] Act (Actual Date)
  //   [+2] Status
  //   [+3] Form Link (col T for Flow 1: Q=17, 17+3=20=T) ← confirmed by user
  //   [+4] Time Delay
  FLOW_START_COL:   17,   // Column Q
  FLOW_SIZE:        5,
  NUM_FLOWS:        8,
  HOD_NAME_ROW:     3,    // Row 3 = "Who" row = HOD name (Sumit Mishra etc.)
  DATA_START_ROW:   7,    // First actual data row (rows 2-6 are headers)
  PLANNED_OFFSET:   0,
  FORM_LINK_OFFSET: 3,    // Q(17)+3 = T(20) ✓

  // ── WhatsApp API ─────────────────────────────────────────────────
  API_URL:  "https://yourdigisathi.in/api/whatsapp-web/send-message",
  APP_KEY:  "c0a32d45-887c-48a7-8a35-1977773f0ebb",
  AUTH_KEY: "abcJnOSJ7zs71D110EXwaS9OkuuS9bEI11"
};


// ─────────────────────────────────────────────────────────────────
//  SETUP — run this ONCE after replacing the script
//
//  What it does:
//    • Removes ALL old WhatsApp triggers (including the onChange one)
//    • Installs a single 5-minute time-based trigger (no concurrency risk)
//    • Stores today's timestamp as the "activation date"
//    • Only rows entered AFTER this moment will ever trigger messages
// ─────────────────────────────────────────────────────────────────
function setupWhatsAppTriggers() {
  // ── Remove every existing WhatsApp trigger ─────────────────────
  var all = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < all.length; i++) {
    var fn = all[i].getHandlerFunction();
    if (fn === "checkAndSendWhatsApp" || fn === "onChange_WhatsApp") {
      ScriptApp.deleteTrigger(all[i]);
      removed++;
    }
  }
  Logger.log("Removed " + removed + " old trigger(s).");

  // ── Install ONE 5-minute time-based trigger ────────────────────
  ScriptApp.newTrigger("checkAndSendWhatsApp")
    .timeBased()
    .everyMinutes(5)
    .create();

  // ── Record activation date ─────────────────────────────────────
  var activationDate = new Date();
  PropertiesService.getScriptProperties()
    .setProperty("wa_activation_date", activationDate.toISOString());

  // ── Ensure log sheet exists ────────────────────────────────────
  ensureLogSheet_();

  Logger.log("════════════════════════════════════════");
  Logger.log("✅ Setup complete.");
  Logger.log("   Trigger: checkAndSendWhatsApp every 5 minutes");
  Logger.log("   Activation date: " + activationDate);
  Logger.log("   Only rows with Timestamp (col A) AFTER this date will");
  Logger.log("   trigger WhatsApp messages. All existing rows are ignored.");
  Logger.log("════════════════════════════════════════");
  Logger.log("Next step: run diagnoseFMSSheet() to verify column config.");
}

// Remove all WhatsApp triggers (call to pause notifications)
function removeWhatsAppTriggers() {
  var all = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < all.length; i++) {
    var fn = all[i].getHandlerFunction();
    if (fn === "checkAndSendWhatsApp" || fn === "onChange_WhatsApp") {
      ScriptApp.deleteTrigger(all[i]);
      removed++;
    }
  }
  Logger.log(removed + " trigger(s) removed. No more WhatsApp notifications will fire.");
}


// ─────────────────────────────────────────────────────────────────
//  MAIN — runs every 5 minutes via time-based trigger
//
//  Only processes rows where column A Timestamp > activation date.
//  Uses WA_Log as a second-line deduplication guard.
// ─────────────────────────────────────────────────────────────────
function checkAndSendWhatsApp() {

  // ── Guard: must have been set up first ────────────────────────
  var props = PropertiesService.getScriptProperties();
  var activationStr = props.getProperty("wa_activation_date");
  if (!activationStr) {
    Logger.log("ERROR: Script not set up. Run setupWhatsAppTriggers() first.");
    return;
  }
  var activationDate = new Date(activationStr);

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var fmsSheet = ss.getSheetByName(WA_CFG.FMS_SHEET);
  if (!fmsSheet) { Logger.log("ERROR: Sheet not found → " + WA_CFG.FMS_SHEET); return; }

  var hodSheet = ss.getSheetByName(WA_CFG.HOD_SHEET);
  if (!hodSheet) { Logger.log("ERROR: Sheet not found → " + WA_CFG.HOD_SHEET); return; }

  var lastRow = fmsSheet.getLastRow();
  if (lastRow < WA_CFG.DATA_START_ROW) { Logger.log("No data rows."); return; }

  var lastCol = Math.max(
    fmsSheet.getLastColumn(),
    WA_CFG.FLOW_START_COL + WA_CFG.NUM_FLOWS * WA_CFG.FLOW_SIZE
  );

  // ── Batch-read entire sheet (one API call) ────────────────────
  var allData = fmsSheet.getRange(1, 1, lastRow, lastCol).getValues();

  // ── HOD directory: name → phone ──────────────────────────────
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

  // ── HOD name for each flow (row 3 of flow's first column) ─────
  var hodRowIdx = WA_CFG.HOD_NAME_ROW - 1;
  var flowHODs  = [];
  for (var fi = 0; fi < WA_CFG.NUM_FLOWS; fi++) {
    var ci = (WA_CFG.FLOW_START_COL - 1) + fi * WA_CFG.FLOW_SIZE + WA_CFG.PLANNED_OFFSET;
    flowHODs.push(ci < allData[hodRowIdx].length ? allData[hodRowIdx][ci].toString().trim() : "");
  }

  // ── Sent-log deduplication ────────────────────────────────────
  var logSheet  = ensureLogSheet_();
  var sentKeys  = buildSentKeySet_(logSheet);
  var newLogRows = [];

  // ── Scan data rows ─────────────────────────────────────────────
  for (var row = WA_CFG.DATA_START_ROW; row <= lastRow; row++) {
    var ri = row - 1;

    // ── FILTER 1: Only rows entered AFTER activation date ────────
    var rowTimestamp = allData[ri][WA_CFG.TIMESTAMP_COL - 1];
    if (!(rowTimestamp instanceof Date) || rowTimestamp <= activationDate) {
      continue; // Historical row — permanently ignored
    }

    var taskId = allData[ri][WA_CFG.TASK_ID_COL - 1];
    if (!taskId) continue; // Empty Task ID — skip

    var itemName     = allData[ri][WA_CFG.ITEM_NAME_COL - 1];
    var customerName = allData[ri][WA_CFG.CUSTOMER_NAME_COL - 1];

    for (var fi = 0; fi < WA_CFG.NUM_FLOWS; fi++) {
      var pci = (WA_CFG.FLOW_START_COL - 1) + fi * WA_CFG.FLOW_SIZE + WA_CFG.PLANNED_OFFSET;
      var fci = (WA_CFG.FLOW_START_COL - 1) + fi * WA_CFG.FLOW_SIZE + WA_CFG.FORM_LINK_OFFSET;

      var plannedVal = pci < allData[ri].length ? allData[ri][pci] : "";
      if (!plannedVal) continue; // No planned date yet for this flow

      // ── FILTER 2: WA_Log deduplication ───────────────────────
      var key = taskId.toString().trim() + "|F" + (fi + 1);
      if (sentKeys[key]) continue; // Already sent — skip

      var hodName = flowHODs[fi];
      if (!hodName) {
        Logger.log("Row " + row + " Flow " + (fi+1) + ": no HOD name at row " + WA_CFG.HOD_NAME_ROW);
        continue;
      }

      var phone = hodMap[hodName];
      if (!phone) {
        Logger.log("Row " + row + ": no phone for HOD '" + hodName + "' in HOD sheet");
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

  // ── Persist log entries ───────────────────────────────────────
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
//  DIAGNOSTIC — run to verify the script is reading correctly
// ─────────────────────────────────────────────────────────────────
function diagnoseFMSSheet() {
  var props         = PropertiesService.getScriptProperties();
  var activationStr = props.getProperty("wa_activation_date");

  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var sheet    = ss.getSheetByName(WA_CFG.FMS_SHEET);
  var hodSheet = ss.getSheetByName(WA_CFG.HOD_SHEET);

  Logger.log("════════════════════════════════════════");
  Logger.log("FMS WhatsApp — DIAGNOSTIC");
  Logger.log("════════════════════════════════════════");
  Logger.log("Activation date : " + (activationStr || "NOT SET — run setupWhatsAppTriggers() first!"));

  if (!sheet)    { Logger.log("❌ FMS sheet not found: "  + WA_CFG.FMS_SHEET); return; }
  if (!hodSheet) { Logger.log("❌ HOD sheet not found: " + WA_CFG.HOD_SHEET); return; }

  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(sheet.getLastColumn(),
    WA_CFG.FLOW_START_COL + WA_CFG.NUM_FLOWS * WA_CFG.FLOW_SIZE);
  var allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();

  // HOD names
  Logger.log("\n── HOD names read from row " + WA_CFG.HOD_NAME_ROW + " ──");
  var hodRowIdx = WA_CFG.HOD_NAME_ROW - 1;
  for (var fi = 0; fi < WA_CFG.NUM_FLOWS; fi++) {
    var ci   = (WA_CFG.FLOW_START_COL - 1) + fi * WA_CFG.FLOW_SIZE;
    var name = ci < allData[hodRowIdx].length ? allData[hodRowIdx][ci] : "(out of range)";
    Logger.log("  Flow " + (fi+1) + " → col " + colLetter_(ci+1) + " → '" + name + "'");
  }

  // HOD phone entries
  Logger.log("\n── HOD sheet entries ──");
  var hodLR = hodSheet.getLastRow();
  if (hodLR >= 2) {
    var hodData = hodSheet.getRange(2, 1, hodLR - 1, 2).getValues();
    for (var h = 0; h < hodData.length; h++) {
      Logger.log("  '" + hodData[h][0] + "' → " + hodData[h][1]);
    }
  } else {
    Logger.log("  (HOD sheet has no entries)");
  }

  // Last 5 data rows
  Logger.log("\n── Last 5 data rows ──");
  var activationDate = activationStr ? new Date(activationStr) : null;
  var shown = 0;
  for (var row = lastRow; row >= WA_CFG.DATA_START_ROW && shown < 5; row--) {
    var ri     = row - 1;
    var taskId = allData[ri][WA_CFG.TASK_ID_COL - 1];
    if (!taskId) continue;
    var ts        = allData[ri][WA_CFG.TIMESTAMP_COL - 1];
    var isNew     = activationDate && ts instanceof Date && ts > activationDate;
    Logger.log(
      "  Row " + row + (isNew ? " [NEW ✓]" : " [OLD — will be skipped]") +
      " | TaskID='" + taskId + "'" +
      " | Customer='" + allData[ri][WA_CFG.CUSTOMER_NAME_COL-1] + "'" +
      " | Timestamp=" + (ts instanceof Date ? Utilities.formatDate(ts, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") : ts)
    );
    for (var fi = 0; fi < WA_CFG.NUM_FLOWS; fi++) {
      var pci = (WA_CFG.FLOW_START_COL - 1) + fi * WA_CFG.FLOW_SIZE + WA_CFG.PLANNED_OFFSET;
      var fci = (WA_CFG.FLOW_START_COL - 1) + fi * WA_CFG.FLOW_SIZE + WA_CFG.FORM_LINK_OFFSET;
      var planned  = pci < allData[ri].length ? allData[ri][pci]  : "";
      var formLink = fci < allData[ri].length ? allData[ri][fci]  : "";
      if (planned || formLink) {
        Logger.log("    Flow " + (fi+1) + " → PI='" + planned + "' | Form(col " + colLetter_(fci+1) + ")='" + formLink + "'");
      }
    }
    shown++;
  }

  Logger.log("\n════════════════════════════════════════");
  Logger.log("If anything looks wrong, adjust WA_CFG and re-run.");
  Logger.log("════════════════════════════════════════");
}

function colLetter_(n) {
  var s = "";
  while (n > 0) { n--; s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26); }
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

// Clears sent log — use only if you want to resend everything (not recommended)
function clearWASentLog() {
  var log = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(WA_CFG.LOG_SHEET);
  if (!log) { Logger.log("WA_Log not found."); return; }
  var lr = log.getLastRow();
  if (lr > 1) { log.deleteRows(2, lr - 1); Logger.log("WA_Log cleared."); }
  else { Logger.log("WA_Log already empty."); }
}


// ─────────────────────────────────────────────────────────────────
//  TEST — verify API connectivity before going live
// ─────────────────────────────────────────────────────────────────
function testWhatsAppSend() {
  var ok = wa_send_(
    "91XXXXXXXXXX",   // ← replace with a real number (digits only, no + or spaces)
    "Test HOD",
    "JRT-TEST",
    "Test Item",
    "Test Customer",
    "https://forms.gle/example",
    "28/05/2026 10:43",
    1
  );
  Logger.log(ok ? "✅ Test sent!" : "❌ Test failed — see API response above");
}
