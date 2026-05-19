// ============================================================
// Audit.gs — every write goes through here
// ============================================================

function logAudit_(action, module, refId, details) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Audit Log");
    if (!sheet) return;
    const email = (Session.getActiveUser().getEmail() || "anonymous");
    sheet.appendRow([new Date(), email, action, module, refId || "", details || ""]);
  } catch (e) {
    // never let audit crash the caller
    console.warn("audit failed: " + e);
  }
}

function getAuditLog(limit) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Audit Log");
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();
  const out = rows.map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h.replace(/[^a-zA-Z0-9]/g, "")] = r[i] instanceof Date
      ? Utilities.formatDate(r[i], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss")
      : r[i]);
    return obj;
  }).reverse();
  return limit ? out.slice(0, limit) : out;
}
