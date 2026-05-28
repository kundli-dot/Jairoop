// =====================================================================
//  FMSAutofill.gs
//
//  Separate .gs file for the Company → Person cascading dropdown.
//  This uses onEdit (simple trigger) which is correct here because
//  the user manually picks the Company from a dropdown — that IS a
//  direct cell edit, so onEdit fires reliably.
//
//  Do NOT put this logic inside onChange_new — onChange does not
//  receive the edited value reliably for dropdown selections.
//
//  NOTE: If your project already has this onEdit in another file,
//  do NOT add it again — Google Apps Script only allows one onEdit
//  function per project (having two causes a conflict).
// =====================================================================

var AUTOFILL_CFG = {
  FMS_SHEET:    "FMS",     // Sheet where the cascade dropdowns live
  MASTER_SHEET: "Master",  // Lookup: col A=Company, B=Person, C=Details, D=Email

  COMPANY_COL: 2,   // Column B — user selects company here
  PERSON_COL:  3,   // Column C — person dropdown (populated after company)
  DETAILS_COL: 4,   // Column D — auto-filled from Master
  EMAIL_COL:   5    // Column E — auto-filled from Master
};

function onEdit(e) {
  if (!e || !e.range) return;

  var sheet = e.range.getSheet();
  if (sheet.getName() !== AUTOFILL_CFG.FMS_SHEET) return;

  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var row = e.range.getRow();
  var col = e.range.getColumn();

  var master = ss.getSheetByName(AUTOFILL_CFG.MASTER_SHEET);
  if (!master) return;

  var masterLastRow = master.getLastRow();
  if (masterLastRow < 2) return;

  var masterData = master.getRange(2, 1, masterLastRow - 1, 4).getValues();

  // ── Company dropdown changed ──────────────────────────────────────
  if (col === AUTOFILL_CFG.COMPANY_COL) {
    var selectedCompany = sheet.getRange(row, AUTOFILL_CFG.COMPANY_COL).getValue();

    // Clear dependent cells
    sheet.getRange(row, AUTOFILL_CFG.PERSON_COL).clearContent().clearDataValidations();
    sheet.getRange(row, AUTOFILL_CFG.DETAILS_COL).clearContent();
    sheet.getRange(row, AUTOFILL_CFG.EMAIL_COL).clearContent();

    if (!selectedCompany) return;

    // Build unique persons list for the selected company
    var seen    = {};
    var persons = [];
    for (var i = 0; i < masterData.length; i++) {
      if (masterData[i][0] === selectedCompany) {
        var p = masterData[i][1];
        if (!seen[p]) { seen[p] = true; persons.push(p); }
      }
    }

    if (persons.length === 0) return;

    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(persons, true)
      .setAllowInvalid(false)
      .build();

    sheet.getRange(row, AUTOFILL_CFG.PERSON_COL).setDataValidation(rule);
  }

  // ── Person dropdown changed ───────────────────────────────────────
  if (col === AUTOFILL_CFG.PERSON_COL) {
    var company = sheet.getRange(row, AUTOFILL_CFG.COMPANY_COL).getValue();
    var person  = sheet.getRange(row, AUTOFILL_CFG.PERSON_COL).getValue();

    if (!company || !person) return;

    for (var j = 0; j < masterData.length; j++) {
      if (masterData[j][0] === company && masterData[j][1] === person) {
        sheet.getRange(row, AUTOFILL_CFG.DETAILS_COL).setValue(masterData[j][2]);
        sheet.getRange(row, AUTOFILL_CFG.EMAIL_COL).setValue(masterData[j][3]);
        break;
      }
    }
  }
}
