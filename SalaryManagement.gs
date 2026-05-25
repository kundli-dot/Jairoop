// ============================================================
//  JAI ROOP TEXTILE PVT LTD
//  SALARY MANAGEMENT SYSTEM — Google Apps Script
//  Author: HR / Accounts Department
//
//  HOW TO USE:
//  1. Open a new Google Sheet.
//  2. Go to Extensions → Apps Script.
//  3. Paste this entire file, save (Ctrl+S), then run setupSalarySystem().
//  4. Allow the requested permissions when prompted.
//  5. Follow the on-screen guide printed in the ⚙️ Settings sheet.
//
//  COMPANY-SPECIFIC RULES APPLIED:
//  • No EPS (Employee Pension Scheme) — full 12% employer EPF goes to EPF A/C
//  • No ESI Gross Ceiling — ESI applies to all ESI-enrolled employees
//  • No EPF Wage Ceiling — EPF computed on actual Basic + DA
//  • Per-employee Fixed Working Hours (col F in Employee Master)
//  • OT at 1× standard rate (not double time)
// ============================================================

// ── Branding ────────────────────────────────────────────────
const CO_NAME   = "Jai Roop Textile Pvt Ltd";
const CO_SHORT  = "JRT";

// ── Sheet names (emoji prefixes aid visual navigation) ──────
const SH = {
  SETTINGS : "⚙️ Settings",
  EMP      : "👥 Employee Master",
  ATTEND   : "📅 Attendance",
  LOAN     : "💰 Loan & Advance",
  SALARY   : "📊 Salary Register",
  PAYSLIP  : "🧾 Payslip View",
  SUMMARY  : "📈 Summary Dashboard",
};

// ── Colour palette ──────────────────────────────────────────
const C = {
  DARK_BLUE  : "#0D47A1",
  MID_BLUE   : "#1565C0",
  LIGHT_BLUE : "#E3F2FD",
  DARK_GREEN : "#1B5E20",
  EARN_BG    : "#E8F5E9",
  EARN_ALT   : "#F1F8E9",
  DED_BG     : "#FFEBEE",
  DED_ALT    : "#FFF3F3",
  TOTAL_BG   : "#FFF9C4",
  NET_BG     : "#FFD700",
  WHITE      : "#FFFFFF",
  GREY_ROW   : "#F5F5F5",
};

// ── Statutory default rates (can be overridden in Settings) ─
// NOTE: No EPS, no ESI ceiling, no EPF wage ceiling per company policy.
const DEF = {
  EPF_EMP     : 12,       // %  employee EPF (on actual Basic+DA, no ceiling)
  EPF_EMP_LBL : "12%",
  EPF_EMPR    : 12,       // %  employer EPF (full 12% to EPF — no EPS split)
  EPF_EMPR_LBL: "12%",
  ESI_EMP     : 0.75,     // %  employee ESI (applies to all ESI-enrolled, no ceiling)
  ESI_EMP_LBL : "0.75%",
  ESI_EMPR    : 3.25,     // %  employer ESI
  ESI_EMPR_LBL: "3.25%",
  LWF_EMP     : 25,       // ₹  LWF employee (state-specific)
  LWF_EMPR    : 75,       // ₹  LWF employer (state-specific)
  HRA_PCT     : 40,       // %  HRA of basic (40% non-metro, 50% metro)
  DA_PCT      : 0,        // %  DA of basic
  WORK_DAYS   : 26,       // standard working days per month
  WORK_HRS    : 8,        // default working hours per day (overridden per employee)
  OT_MULT     : 1,        // OT at standard rate (1×); change to 2 for double time
};

// ── Settings sheet cell references (used in Salary Register formulas) ──
// These must stay in sync with the rows produced by createSettingsSheet().
const S = {
  EPF_EMP  : "'⚙️ Settings'!$B$16",
  EPF_EMPR : "'⚙️ Settings'!$B$17",
  ESI_EMP  : "'⚙️ Settings'!$B$18",
  ESI_EMPR : "'⚙️ Settings'!$B$19",
  LWF_EMP  : "'⚙️ Settings'!$B$20",
  WORK_DAY : "'⚙️ Settings'!$B$29",
  WORK_HRS : "'⚙️ Settings'!$B$30",  // Default; overridden by per-employee col F
  OT_MULT  : "'⚙️ Settings'!$B$31",
};

// ============================================================
//  MENU
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🏭 " + CO_SHORT + " Salary")
    .addItem("🔧  Initial Setup / Reset Sheets",      "setupSalarySystem")
    .addSeparator()
    .addItem("📅  Generate Monthly Salary Register",  "generateMonthlySalary")
    .addItem("🧾  Preview Payslip (enter Emp ID)",    "activatePayslip")
    .addItem("📄  Export Payslip to PDF (Drive)",     "exportPayslipPDF")
    .addSeparator()
    .addItem("💰  Add New Loan / Advance Entry",      "addLoanAdvanceEntry")
    .addItem("🔄  Post Month-End: Update Balances",   "updateLoanAdvanceBalances")
    .addSeparator()
    .addItem("📈  Open Summary Dashboard",            "openSummary")
    .addItem("🗄️  Archive Current Month Salary",     "archiveCurrentMonth")
    .addSeparator()
    .addItem("ℹ️  Help & Documentation",              "showHelp")
    .addToUi();
}

// ============================================================
//  MASTER SETUP
// ============================================================
function setupSalarySystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setName("Salary Management — " + CO_NAME);

  const ui = SpreadsheetApp.getUi();
  const go = ui.alert(
    "⚙️  Setup Salary System",
    "This will create (or refresh) all required sheets for:\n" + CO_NAME +
    "\n\nExisting employee/loan data will be preserved.\nContinue?",
    ui.ButtonSet.YES_NO
  );
  if (go !== ui.Button.YES) return;

  createSettingsSheet(ss);
  createEmployeeMasterSheet(ss);
  createAttendanceSheet(ss);
  createLoanAdvanceSheet(ss);
  createSalaryRegisterSheet(ss);
  createPayslipSheet(ss);
  createSummarySheet(ss);

  // Remove blank default sheet if still present
  ["Sheet1", "Sheet 1"].forEach(n => {
    try { const s = ss.getSheetByName(n); if (s) ss.deleteSheet(s); } catch (_) {}
  });

  ss.getSheetByName(SH.SETTINGS).activate();
  SpreadsheetApp.flush();

  ui.alert(
    "✅  Setup Complete!",
    "All sheets created for " + CO_NAME + ".\n\n" +
    "Next steps:\n" +
    "1. ⚙️ Settings  — update company details & statutory rates\n" +
    "2. 👥 Employee Master — add all employees (set Fixed Working Hours per employee)\n" +
    "3. 📅 Attendance — fill attendance each month\n" +
    "4. 💰 Loan & Advance — record advances / loan EMIs\n" +
    "5. Menu → Generate Monthly Salary Register\n" +
    "6. Menu → Preview / Export Payslips",
    ui.ButtonSet.OK
  );
}

// ============================================================
//  SHEET: ⚙️ Settings
//
//  Row reference map (S.* constants must match these):
//  Row 16 : EPF Employee Rate      → S.EPF_EMP
//  Row 17 : EPF Employer Rate      → S.EPF_EMPR
//  Row 18 : ESI Employee Rate      → S.ESI_EMP
//  Row 19 : ESI Employer Rate      → S.ESI_EMPR
//  Row 20 : LWF Employee           → S.LWF_EMP
//  Row 29 : Standard Working Days  → S.WORK_DAY
//  Row 30 : Default Working Hrs    → S.WORK_HRS
//  Row 31 : Overtime Multiplier    → S.OT_MULT
// ============================================================
function createSettingsSheet(ss) {
  let sh = ss.getSheetByName(SH.SETTINGS);
  if (!sh) { sh = ss.insertSheet(SH.SETTINGS, 0); }
  sh.clear();
  sh.setTabColor(C.MID_BLUE);

  const rows = [
    /* 1  */ [CO_NAME, "", "", ""],
    /* 2  */ ["SALARY MANAGEMENT SYSTEM — SETTINGS", "", "", ""],
    /* 3  */ ["", "", "", ""],
    /* 4  */ ["COMPANY INFORMATION", "", "", ""],
    /* 5  */ ["Company Name",           CO_NAME,                       "", ""],
    /* 6  */ ["Registered Address",     "Enter full registered address","", ""],
    /* 7  */ ["City / State / PIN",     "Enter City, State — PIN",     "", ""],
    /* 8  */ ["Company PAN",            "Enter Company PAN No.",       "", ""],
    /* 9  */ ["Company TAN",            "Enter Company TAN No.",       "", ""],
    /* 10 */ ["ESI Registration No.",   "Enter ESI Reg. No.",          "", ""],
    /* 11 */ ["PF Registration No.",    "Enter PF Reg. No.",           "", ""],
    /* 12 */ ["LWF Registration No.",   "Enter LWF Reg. No.",          "", ""],
    /* 13 */ ["", "", "", ""],
    /* 14 */ ["STATUTORY DEDUCTION RATES", "", "", ""],
    /* 15 */ ["Parameter",              "Rate / Amount",    "Applicability Rule",                                           "Notes / Reference"],
    /* 16 */ ["EPF Employee Rate (%)",  DEF.EPF_EMP,        "12% on actual Basic + DA (no wage ceiling)",                   "Section 6 — EPF Act 1952"],
    /* 17 */ ["EPF Employer Rate (%)",  DEF.EPF_EMPR,       "12% on actual Basic + DA — full amount to EPF A/C (no EPS)",  "No EPS as per company policy"],
    /* 18 */ ["ESI Employee Rate (%)",  DEF.ESI_EMP,        "0.75% of Gross Salary — all ESI-enrolled employees",           "No gross ceiling applied; ESI Act 1948"],
    /* 19 */ ["ESI Employer Rate (%)",  DEF.ESI_EMPR,       "3.25% of Gross Salary — all ESI-enrolled employees",           "No gross ceiling applied; ESI Act 1948"],
    /* 20 */ ["LWF Employee (₹/month)", DEF.LWF_EMP,        "Fixed per employee per month",                                 "Update as per your state rules"],
    /* 21 */ ["LWF Employer (₹/month)", DEF.LWF_EMPR,       "Fixed per employee per month",                                 "Update as per your state rules"],
    /* 22 */ ["LWF Deduction Cycle",    "Monthly",          "Monthly / Half-Yearly / Yearly",                               "As applicable in your state"],
    /* 23 */ ["", "", "", ""],
    /* 24 */ ["SALARY STRUCTURE DEFAULTS", "", "", ""],
    /* 25 */ ["Parameter",              "Value",            "Notes",                                                        ""],
    /* 26 */ ["HRA % of Basic",         DEF.HRA_PCT,        "40% for non-metro; 50% for metro cities",                      "Used in Employee Master auto-fill"],
    /* 27 */ ["DA % of Basic",          DEF.DA_PCT,         "0% currently; update if DA is paid",                           ""],
    /* 28 */ ["Special Allow. Mode",    "Auto",             "'Auto' = Gross − Basic − HRA − DA; else enter ₹",              ""],
    /* 29 */ ["Standard Working Days",  DEF.WORK_DAYS,      "Days used for per-day salary calculation",                     "26 days standard for India"],
    /* 30 */ ["Default Working Hours/Day", DEF.WORK_HRS,    "Fallback hours/day when employee-specific hours are not set",  "Override per employee in Employee Master col F"],
    /* 31 */ ["Overtime Multiplier",    DEF.OT_MULT,        "OT = (Basic ÷ WD ÷ Emp.WH) × OT Hrs × Multiplier",            "1 = standard rate; set 2 for double time"],
    /* 32 */ ["", "", "", ""],
    /* 33 */ ["INCOME TAX SLABS — FY 2024-25 (NEW REGIME)", "", "", ""],
    /* 34 */ ["Slab Description",       "Income From (₹)", "Income Up To (₹)", "Tax Rate (%)"],
    /* 35 */ ["Nil Slab",               0,                 300000,              0],
    /* 36 */ ["5% Slab",                300001,            700000,              5],
    /* 37 */ ["10% Slab",               700001,            1000000,             10],
    /* 38 */ ["15% Slab",               1000001,           1200000,             15],
    /* 39 */ ["20% Slab",               1200001,           1500000,             20],
    /* 40 */ ["30% Slab",               1500001,           99999999,            30],
    /* 41 */ ["Standard Deduction (₹)", "75,000",          "(FY 2024-25)",      "Deduct before tax computation"],
    /* 42 */ ["", "", "", ""],
    /* 43 */ ["TDS CALCULATION NOTES", "", "", ""],
    /* 44 */ ["Step 1", "Compute projected annual gross salary (×12)", "", ""],
    /* 45 */ ["Step 2", "Deduct Standard Deduction ₹75,000", "", ""],
    /* 46 */ ["Step 3", "Deduct EPF (employee) annual contribution", "", ""],
    /* 47 */ ["Step 4", "Apply IT slabs above to get annual tax", "", ""],
    /* 48 */ ["Step 5", "Add surcharge/cess if applicable (4% health & edu cess)", "", ""],
    /* 49 */ ["Step 6", "Divide by 12 → enter monthly TDS in Employee Master col AD (TDS Monthly)", "", ""],
    /* 50 */ ["", "", "", ""],
    /* 51 */ ["IMPORTANT CONTACTS / FOOTER", "", "", ""],
    /* 52 */ ["HR Email",               "hr@jairoop.com",              "", ""],
    /* 53 */ ["Accounts Email",         "accounts@jairoop.com",        "", ""],
    /* 54 */ ["Payslip Footer Note",    "This is a computer-generated payslip. No signature required.", "", ""],
  ];

  sh.getRange(1, 1, rows.length, 4).setValues(rows);

  // Title rows
  sh.getRange(1, 1, 1, 4).merge().setBackground(C.DARK_BLUE).setFontColor(C.WHITE)
    .setFontSize(16).setFontWeight("bold").setHorizontalAlignment("center");
  sh.getRange(2, 1, 1, 4).merge().setBackground(C.MID_BLUE).setFontColor(C.WHITE)
    .setFontSize(12).setFontWeight("bold").setHorizontalAlignment("center");

  // Section headers
  [4, 14, 24, 33, 43, 51].forEach(r => {
    sh.getRange(r, 1, 1, 4).merge().setBackground(C.MID_BLUE).setFontColor(C.WHITE)
      .setFontWeight("bold").setFontSize(11);
  });

  // Column sub-headers
  [15, 25, 34].forEach(r => {
    sh.getRange(r, 1, 1, 4).setBackground(C.LIGHT_BLUE).setFontWeight("bold");
  });

  // Number formats
  sh.getRange("B16:B17").setNumberFormat("0");
  sh.getRange("B18:B19").setNumberFormat("0.00");
  sh.getRange("B20:B21").setNumberFormat("₹#,##0");
  sh.getRange("B29:B31").setNumberFormat("0");
  sh.getRange("C35:D40").setNumberFormat("#,##0");

  sh.setColumnWidth(1, 280); sh.setColumnWidth(2, 180);
  sh.setColumnWidth(3, 340); sh.setColumnWidth(4, 320);
  sh.setFrozenRows(2);
  sh.getRange(1, 1, rows.length, 4).setBorder(true, true, true, true, true, true,
    "#BBDEFB", SpreadsheetApp.BorderStyle.SOLID);

  SpreadsheetApp.flush();
}

// ============================================================
//  SHEET: 👥 Employee Master
//
//  Column map (31 cols — used by Salary Register VLOOKUPs):
//  A(1)  Emp ID            B(2)  Name             C(3)  Designation
//  D(4)  Department        E(5)  Date of Joining   F(6)  Fixed Working Hrs ← NEW
//  G(7)  Basic Salary      H(8)  HRA               I(9)  DA
//  J(10) Special Allow     K(11) Other Allow        L(12) Gross (formula)
//  M(13) EPF Applicable    N(14) ESI Applicable     O(15) Father/Husband
//  P(16) Gender            Q(17) Date of Birth      R(18) Mobile
//  S(19) Email             T(20) PAN                U(21) Aadhaar
//  V(22) Bank Name         W(23) Account No.        X(24) IFSC Code
//  Y(25) EPF UAN           Z(26) ESI IP No.         AA(27) Advance O/S
//  AB(28) Loan O/S         AC(29) Loan EMI           AD(30) TDS Monthly
//  AE(31) Status
// ============================================================
function createEmployeeMasterSheet(ss) {
  let sh = ss.getSheetByName(SH.EMP);
  const isNew = !sh;
  if (isNew) { sh = ss.insertSheet(SH.EMP, 1); }

  sh.setTabColor(C.DARK_GREEN);

  const hdrs = [
    "Emp ID", "Employee Name", "Designation", "Department", "Date of Joining",
    "Fixed Working\nHours (Hrs/Day)",
    "Basic Salary (₹)", "HRA (₹)", "DA (₹)", "Special Allowance (₹)", "Other Allowance (₹)",
    "Gross Salary (₹)", "EPF\nApplicable", "ESI\nApplicable",
    "Father's / Husband's Name", "Gender", "Date of Birth", "Mobile No.",
    "Email ID", "PAN Number", "Aadhaar Number",
    "Bank Name", "Account Number", "IFSC Code", "EPF UAN", "ESI IP No.",
    "Advance\nO/S (₹)", "Loan\nO/S (₹)", "Monthly\nLoan EMI (₹)", "TDS\nMonthly (₹)", "Status"
  ];

  sh.getRange(1, 1, 1, hdrs.length)
    .setBackground(C.DARK_BLUE).setFontColor(C.WHITE)
    .setFontSize(14).setFontWeight("bold").setHorizontalAlignment("center");
  sh.getRange(1, 1).setValue("👥  EMPLOYEE MASTER — " + CO_NAME);

  sh.getRange(2, 1, 1, hdrs.length).setValues([hdrs])
    .setBackground(C.MID_BLUE).setFontColor(C.WHITE)
    .setFontWeight("bold").setHorizontalAlignment("center").setWrap(true);

  if (isNew) {
    // Demo employee (col F = 8 hours/day working)
    const demo = [
      "JRT001", "Ramesh Kumar Sharma", "Sr. Operator", "Production", "01/04/2022",
      8,
      15000, 6000, 0, 4000, 500,
      "=SUM(G3:K3)", "YES", "YES",
      "Suresh Kumar", "Male", "15/06/1988", "9876543210",
      "ramesh@example.com", "ABCDE1234F", "123456789012",
      "SBI", "00000000000", "SBIN0001234",
      "100000000001", "1001234567",
      0, 0, 2000, 0, "Active"
    ];
    sh.getRange(3, 1, 1, hdrs.length).setValues([demo]);
  }

  // Gross formula for all data rows (Basic G through Other Allow K = cols 7–11)
  for (let r = 3; r <= 200; r++) {
    if (sh.getRange(r, 1).getValue() !== "" || r === 3) {
      sh.getRange(r, 12).setFormula(`=IF(A${r}="","",SUM(G${r}:K${r}))`);
    }
  }

  sh.setFrozenRows(2);
  sh.setFrozenColumns(2);

  // Data validations
  const yesNo  = SpreadsheetApp.newDataValidation().requireValueInList(["YES", "NO"], true).build();
  const status = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Active", "Inactive", "Resigned", "On Leave"], true).build();
  const gender = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Male", "Female", "Other"], true).build();

  sh.getRange(3, 13, 198, 1).setDataValidation(yesNo);   // EPF Applicable  (M)
  sh.getRange(3, 14, 198, 1).setDataValidation(yesNo);   // ESI Applicable  (N)
  sh.getRange(3, 16, 198, 1).setDataValidation(gender);  // Gender          (P)
  sh.getRange(3, 31, 198, 1).setDataValidation(status);  // Status          (AE)

  // Number formats
  sh.getRange(3,  5, 198, 1).setNumberFormat("dd/mm/yyyy");  // Date of Joining (E)
  sh.getRange(3,  6, 198, 1).setNumberFormat("0");            // Fixed Working Hrs (F)
  sh.getRange(3, 17, 198, 1).setNumberFormat("dd/mm/yyyy");  // Date of Birth   (Q)
  sh.getRange(3,  7, 198, 6).setNumberFormat("₹#,##0.00");   // Basic→Other Allow (G–L)
  sh.getRange(3, 12, 198, 1).setNumberFormat("₹#,##0.00");   // Gross           (L)
  sh.getRange(3, 27, 198, 4).setNumberFormat("₹#,##0.00");   // Advance→TDS     (AA–AD)

  // Section colour bands on header row
  [
    [1,  5, "#0D47A1"],   // Employee ID details
    [6,  1, "#E65100"],   // Fixed Working Hours (highlighted)
    [7,  6, "#1B5E20"],   // Salary structure
    [13, 2, "#4A148C"],   // EPF / ESI applicable
    [15, 6, "#BF360C"],   // Personal info
    [22, 5, "#006064"],   // Bank / statutory IDs
    [27, 4, "#B71C1C"],   // Advance / Loan / TDS
    [31, 1, "#37474F"],   // Status
  ].forEach(([c, n, bg]) => {
    sh.getRange(2, c, 1, n).setBackground(bg);
  });

  // Column widths (31 columns)
  [80, 180, 140, 130, 110,
    90,
    100, 80, 70, 120, 110, 100, 70, 70,
    170, 70, 100, 110, 170, 120, 140,
    130, 150, 100, 140, 110,
    90, 80, 100, 80, 80
  ].forEach((w, i) => sh.setColumnWidth(i + 1, w));

  // Alternate row shading
  for (let r = 3; r <= 200; r += 2) {
    sh.getRange(r, 1, 1, hdrs.length).setBackground(C.GREY_ROW);
  }

  SpreadsheetApp.flush();
}

// ============================================================
//  SHEET: 📅 Attendance
//
//  Column map (used by Salary Register VLOOKUPs):
//  A(1) Emp ID          B(2) Name (auto)       C(3) Desig (auto)
//  D(4) Total Work Days E(5) Days Present       F(6) Days Absent (auto)
//  G(7) Half Days       H(8) OT Hours           I(9) Short Time Hours
//  J(10) Late Count     K(11) Notes
// ============================================================
function createAttendanceSheet(ss) {
  let sh = ss.getSheetByName(SH.ATTEND);
  const isNew = !sh;
  if (isNew) { sh = ss.insertSheet(SH.ATTEND, 2); }
  sh.clear();
  sh.setTabColor("#F57F17");

  const tz   = Session.getScriptTimeZone();
  const now  = new Date();
  const mLbl = Utilities.formatDate(now, tz, "MMMM yyyy");

  sh.getRange(1, 1, 1, 11)
    .setBackground(C.DARK_BLUE).setFontColor(C.WHITE)
    .setFontSize(13).setFontWeight("bold").setHorizontalAlignment("center");
  sh.getRange(1, 1).setValue("📅  ATTENDANCE REGISTER — " + CO_NAME + " | " + mLbl);

  // Control row
  sh.getRange(2, 1).setValue("Month:");
  sh.getRange(2, 2).setValue(now).setNumberFormat("MMMM yyyy").setBackground("#FFFF99").setFontWeight("bold");
  sh.getRange(2, 3).setValue("Working Days:");
  sh.getRange(2, 4).setValue(DEF.WORK_DAYS).setBackground("#FFFF99").setFontWeight("bold");
  sh.getRange(2, 5).setValue("Default Work Hrs/Day:");
  sh.getRange(2, 6).setValue(DEF.WORK_HRS).setBackground("#FFFF99").setFontWeight("bold");
  sh.getRange(2, 7, 1, 5).merge()
    .setValue("📌 Fill: Emp ID, Days Present, Half Days, OT Hrs, Short Time Hrs. " +
              "Working hours per employee are set in Employee Master (col F).")
    .setBackground("#FFF9C4").setFontStyle("italic").setFontSize(9).setWrap(true);

  const hdrs = [
    "Emp ID", "Employee Name", "Designation",
    "Total Working\nDays", "Days\nPresent", "Days\nAbsent", "Half\nDays",
    "OT Hours", "Short Time\nHours", "Late\nCount", "Notes"
  ];
  sh.getRange(3, 1, 1, hdrs.length).setValues([hdrs])
    .setBackground(C.MID_BLUE).setFontColor(C.WHITE)
    .setFontWeight("bold").setHorizontalAlignment("center").setWrap(true);

  for (let r = 4; r <= 200; r++) {
    sh.getRange(r, 2).setFormula(
      `=IFERROR(IF(A${r}="","",VLOOKUP(A${r},'👥 Employee Master'!$A:$B,2,0)),"")`);
    sh.getRange(r, 3).setFormula(
      `=IFERROR(IF(A${r}="","",VLOOKUP(A${r},'👥 Employee Master'!$A:$C,3,0)),"")`);
    sh.getRange(r, 4).setFormula(`=IF(A${r}="","",$D$2)`);
    sh.getRange(r, 6).setFormula(`=IF(A${r}="","",D${r}-E${r}-G${r}/2)`);
  }

  // Pre-fill demo row
  sh.getRange(4, 1).setValue("JRT001");
  sh.getRange(4, 5).setValue(25);
  sh.getRange(4, 7).setValue(0);
  sh.getRange(4, 8).setValue(2);
  sh.getRange(4, 9).setValue(1);
  sh.getRange(4, 10).setValue(0);

  sh.setFrozenRows(3);
  sh.setFrozenColumns(2);

  [80, 180, 140, 90, 90, 90, 80, 80, 100, 80, 160].forEach((w, i) => sh.setColumnWidth(i + 1, w));

  SpreadsheetApp.flush();
}

// ============================================================
//  SHEET: 💰 Loan & Advance
//
//  Column map:
//  A(1) Emp ID          B(2) Name (auto)     C(3) Type (Loan/Advance)
//  D(4) Date Issued     E(5) Total Amount     F(6) Monthly Deduction
//  G(7) Total Paid      H(8) Outstanding      I(9) Months Remaining
//  J(10) Interest Rate  K(11) Remarks         L(12) Status
// ============================================================
function createLoanAdvanceSheet(ss) {
  let sh = ss.getSheetByName(SH.LOAN);
  const isNew = !sh;
  if (isNew) { sh = ss.insertSheet(SH.LOAN, 3); }
  sh.clear();
  sh.setTabColor("#B71C1C");

  sh.getRange(1, 1, 1, 12).merge()
    .setValue("💰  LOAN & ADVANCE TRACKER — " + CO_NAME)
    .setBackground(C.DARK_BLUE).setFontColor(C.WHITE)
    .setFontSize(14).setFontWeight("bold").setHorizontalAlignment("center");

  sh.getRange(2, 1, 1, 12).merge()
    .setValue("📌 All loans are ZERO INTEREST as per company policy. " +
              "Advance is a salary advance with no charges. " +
              "Run 'Post Month-End: Update Balances' from the menu after each month closure.")
    .setBackground("#FFEBEE").setFontSize(9).setFontStyle("italic").setWrap(true);

  const hdrs = [
    "Emp ID", "Employee Name", "Type\n(Loan/Advance)",
    "Date Issued", "Total Amount\n(₹)", "Monthly Deduction\n(₹)",
    "Total Paid\n(₹)", "Outstanding\nBalance (₹)", "Months\nRemaining",
    "Interest Rate", "Remarks", "Status"
  ];
  sh.getRange(3, 1, 1, hdrs.length).setValues([hdrs])
    .setBackground(C.MID_BLUE).setFontColor(C.WHITE)
    .setFontWeight("bold").setHorizontalAlignment("center").setWrap(true);

  const demo = [
    ["JRT001", "=IFERROR(VLOOKUP(A4,'👥 Employee Master'!$A:$B,2,0),\"\")", "Loan",
     "01/04/2024", 50000, 2000, 4000, "=E4-G4", "=IFERROR(CEILING((E4-G4)/F4,1),0)", "0% (Zero Interest)", "Vehicle Loan", "Active"],
    ["JRT001", "=IFERROR(VLOOKUP(A5,'👥 Employee Master'!$A:$B,2,0),\"\")", "Advance",
     "01/05/2024", 10000, 2500, 0, "=E5-G5", "=IFERROR(CEILING((E5-G5)/F5,1),0)", "0%", "Medical Advance", "Active"],
  ];
  sh.getRange(4, 1, demo.length, hdrs.length).setValues(demo);

  for (let r = 6; r <= 200; r++) {
    sh.getRange(r, 2).setFormula(
      `=IFERROR(IF(A${r}="","",VLOOKUP(A${r},'👥 Employee Master'!$A:$B,2,0)),"")`);
    sh.getRange(r, 8).setFormula(`=IF(A${r}="","",E${r}-G${r})`);
    sh.getRange(r, 9).setFormula(`=IFERROR(IF(A${r}="","",CEILING((E${r}-G${r})/F${r},1)),0)`);
  }

  sh.setFrozenRows(3);

  sh.getRange(4, 3, 197, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(["Loan", "Advance"], true).build());
  sh.getRange(4, 12, 197, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(["Active", "Closed", "On Hold"], true).build());

  sh.getRange(4, 4, 197, 1).setNumberFormat("dd/mm/yyyy");
  sh.getRange(4, 5, 197, 4).setNumberFormat("₹#,##0.00");

  [80, 180, 100, 100, 130, 160, 100, 130, 100, 110, 180, 80].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.setRowHeight(2, 50);

  SpreadsheetApp.flush();
}

// ============================================================
//  SHEET: 📊 Salary Register
//
//  Column map (30 cols):
//  A(1)  S.No.           B(2)  Emp ID          C(3)  Name
//  D(4)  Designation     E(5)  Department       F(6)  Total WD
//  G(7)  Days Present    H(8)  Days Absent      I(9)  Half Days
//  J(10) OT Hours        K(11) Short-Time Hrs
//  L(12) Basic           M(13) HRA              N(14) DA
//  O(15) Special Allow   P(16) Other Allow      Q(17) OT Amount
//  R(18) Gross Salary
//  S(19) EPF Emp         T(20) ESI Emp          U(21) LWF Emp
//  V(22) TDS             W(23) Absent Dedn      X(24) Short-Time Dedn
//  Y(25) Advance Recov   Z(26) Loan EMI Recov
//  AA(27) Total Deductions  AB(28) NET PAY
//  AC(29) EPF Employer   AD(30) ESI Employer
//
//  EPF: 12% of actual Basic+DA (no wage ceiling)
//  ESI: 0.75%/3.25% of Gross (no gross ceiling)
//  OT:  (Basic ÷ WD ÷ EmpWorkingHrs) × OT Hrs × OT Multiplier (default 1×)
// ============================================================
function createSalaryRegisterSheet(ss) {
  let sh = ss.getSheetByName(SH.SALARY);
  if (!sh) { sh = ss.insertSheet(SH.SALARY, 4); }
  sh.clear();
  sh.setTabColor(C.MID_BLUE);

  const tz   = Session.getScriptTimeZone();
  const now  = new Date();
  const mLbl = Utilities.formatDate(now, tz, "MMMM yyyy");

  sh.getRange(1, 1, 1, 30)
    .setBackground(C.DARK_BLUE).setFontColor(C.WHITE)
    .setFontSize(14).setFontWeight("bold").setHorizontalAlignment("center");
  sh.getRange(1, 1).setValue("📊  SALARY REGISTER — " + CO_NAME + " | " + mLbl);

  sh.getRange(2, 1, 1, 30)
    .setBackground(C.LIGHT_BLUE).setFontSize(10).setHorizontalAlignment("center");
  sh.getRange(2, 1).setValue("Month: " + mLbl + "  |  Generated: " +
    Utilities.formatDate(now, tz, "dd/MM/yyyy HH:mm"));

  // Row 3: Group headers
  sh.getRange(3, 1, 1, 3).merge()
    .setValue("EMPLOYEE DETAILS").setBackground("#0D47A1").setFontColor(C.WHITE)
    .setFontWeight("bold").setHorizontalAlignment("center");
  sh.getRange(3, 4, 1, 2).setBackground("#0D47A1");
  [[6, 6, "ATTENDANCE", "#E65100"], [12, 7, "EARNINGS", "#1B5E20"],
   [19, 8, "DEDUCTIONS", "#B71C1C"], [27, 2, "NET PAY", "#4A148C"],
   [29, 2, "EMPLOYER CONTRIBUTION", "#006064"]].forEach(([col, span, label, bg]) => {
    sh.getRange(3, col, 1, span).merge()
      .setValue(label).setBackground(bg).setFontColor(C.WHITE)
      .setFontWeight("bold").setHorizontalAlignment("center");
  });

  // Row 4: Column headers
  const hdrs = [
    "S.No.", "Emp ID", "Employee Name", "Designation", "Department",
    "Total\nWD", "Days\nPresent", "Days\nAbsent", "Half\nDays", "OT\nHrs", "Short\nTime Hrs",
    "Basic (₹)", "HRA (₹)", "DA (₹)", "Special\nAllow (₹)", "Other\nAllow (₹)", "OT\nAmount (₹)", "Gross\nSalary (₹)",
    "EPF Emp\n(₹)", "ESI Emp\n(₹)", "LWF\n(₹)", "TDS\n(₹)", "Absent\nDedn (₹)", "Short Time\nDedn (₹)", "Advance\nRecov (₹)", "Loan EMI\nRecov (₹)",
    "Total\nDeductions (₹)", "NET\nPAY (₹)",
    "EPF\nEmployer (₹)", "ESI\nEmployer (₹)"
  ];
  sh.getRange(4, 1, 1, hdrs.length).setValues([hdrs])
    .setBackground(C.MID_BLUE).setFontColor(C.WHITE)
    .setFontWeight("bold").setHorizontalAlignment("center").setWrap(true);
  sh.setRowHeight(4, 50);

  const EMP  = "'👥 Employee Master'";
  const ATT  = "'📅 Attendance'";
  const LOAN = "'💰 Loan & Advance'";

  for (let r = 5; r <= 204; r++) {
    const n = r;

    // Per-employee working hours from Employee Master col F(6); fallback to Settings default
    const empWH =
      `IFERROR(IF(VLOOKUP(B${n},${EMP}!$A:$F,6,0)="",${S.WORK_HRS},` +
      `VLOOKUP(B${n},${EMP}!$A:$F,6,0)),${S.WORK_HRS})`;

    // S.No.
    sh.getRange(r, 1).setFormula(`=IF(B${n}="","",ROW()-4)`);

    // Employee info from master
    sh.getRange(r, 3).setFormula(
      `=IFERROR(IF(B${n}="","",VLOOKUP(B${n},${EMP}!$A:$B,2,0)),"")`);
    sh.getRange(r, 4).setFormula(
      `=IFERROR(IF(B${n}="","",VLOOKUP(B${n},${EMP}!$A:$C,3,0)),"")`);
    sh.getRange(r, 5).setFormula(
      `=IFERROR(IF(B${n}="","",VLOOKUP(B${n},${EMP}!$A:$D,4,0)),"")`);

    // Attendance from attendance sheet
    sh.getRange(r, 6).setFormula(
      `=IFERROR(IF(B${n}="","",VLOOKUP(B${n},${ATT}!$A:$D,4,0)),${S.WORK_DAY})`);
    sh.getRange(r, 7).setFormula(
      `=IFERROR(IF(B${n}="","",VLOOKUP(B${n},${ATT}!$A:$E,5,0)),"")`);
    sh.getRange(r, 8).setFormula(
      `=IFERROR(IF(B${n}="","",VLOOKUP(B${n},${ATT}!$A:$F,6,0)),"")`);
    sh.getRange(r, 9).setFormula(
      `=IFERROR(IF(B${n}="","",VLOOKUP(B${n},${ATT}!$A:$G,7,0)),0)`);
    sh.getRange(r, 10).setFormula(
      `=IFERROR(IF(B${n}="","",VLOOKUP(B${n},${ATT}!$A:$H,8,0)),0)`);
    sh.getRange(r, 11).setFormula(
      `=IFERROR(IF(B${n}="","",VLOOKUP(B${n},${ATT}!$A:$I,9,0)),0)`);

    // ── EARNINGS ──────────────────────────────────────────
    // Basic is now EMP col G(7)
    sh.getRange(r, 12).setFormula(
      `=IFERROR(IF(B${n}="","",VLOOKUP(B${n},${EMP}!$A:$G,7,0)),"")`);
    // HRA is EMP col H(8)
    sh.getRange(r, 13).setFormula(
      `=IFERROR(IF(B${n}="","",VLOOKUP(B${n},${EMP}!$A:$H,8,0)),"")`);
    // DA is EMP col I(9)
    sh.getRange(r, 14).setFormula(
      `=IFERROR(IF(B${n}="","",VLOOKUP(B${n},${EMP}!$A:$I,9,0)),"")`);
    // Special Allow is EMP col J(10)
    sh.getRange(r, 15).setFormula(
      `=IFERROR(IF(B${n}="","",VLOOKUP(B${n},${EMP}!$A:$J,10,0)),"")`);
    // Other Allow is EMP col K(11)
    sh.getRange(r, 16).setFormula(
      `=IFERROR(IF(B${n}="","",VLOOKUP(B${n},${EMP}!$A:$K,11,0)),"")`);
    // OT Amount: (Basic ÷ WD ÷ EmpWorkingHours) × OT Hrs × Multiplier
    sh.getRange(r, 17).setFormula(
      `=IFERROR(IF(B${n}="","",IF(J${n}=0,0,ROUND(` +
      `VLOOKUP(B${n},${EMP}!$A:$G,7,0)/` +
      `IF(F${n}=0,${S.WORK_DAY},F${n})/` +
      `(${empWH})*J${n}*${S.OT_MULT},2))),"")`);
    // Gross
    sh.getRange(r, 18).setFormula(`=IF(B${n}="","",SUM(L${n}:Q${n}))`);

    // ── DEDUCTIONS ────────────────────────────────────────
    // EPF Employee: 12% of actual Basic+DA (no ceiling — EMP col M(13) for flag)
    sh.getRange(r, 19).setFormula(
      `=IFERROR(IF(B${n}="","",` +
      `IF(VLOOKUP(B${n},${EMP}!$A:$M,13,0)="YES",` +
      `ROUND((L${n}+N${n})*${S.EPF_EMP}/100,0),0)),"")`);

    // ESI Employee: 0.75% of Gross — no ceiling, all ESI-enrolled staff (EMP col N(14) for flag)
    sh.getRange(r, 20).setFormula(
      `=IFERROR(IF(B${n}="","",` +
      `IF(VLOOKUP(B${n},${EMP}!$A:$N,14,0)="YES",` +
      `ROUND(R${n}*${S.ESI_EMP}/100,0),0)),"")`);

    // LWF Employee: Fixed ₹ per month (tied to ESI Applicable flag, EMP col N(14))
    sh.getRange(r, 21).setFormula(
      `=IFERROR(IF(B${n}="","",` +
      `IF(VLOOKUP(B${n},${EMP}!$A:$N,14,0)="YES",${S.LWF_EMP},0)),"")`);

    // TDS: Monthly TDS from EMP col AD(30)
    sh.getRange(r, 22).setFormula(
      `=IFERROR(IF(B${n}="","",VLOOKUP(B${n},${EMP}!$A:$AD,30,0)),"")`);

    // Absent Deduction: (Gross ÷ WD) × Absent Days
    sh.getRange(r, 23).setFormula(
      `=IFERROR(IF(B${n}="","",` +
      `IF(H${n}=0,0,ROUND(R${n}/IF(F${n}=0,${S.WORK_DAY},F${n})*H${n},2))),"")`);

    // Short Time Deduction: (Gross ÷ WD ÷ EmpWorkingHours) × Short Time Hrs
    sh.getRange(r, 24).setFormula(
      `=IFERROR(IF(B${n}="","",` +
      `IF(K${n}=0,0,ROUND(R${n}/IF(F${n}=0,${S.WORK_DAY},F${n})/(${empWH})*K${n},2))),"")`);

    // Advance Recovery
    sh.getRange(r, 25).setFormula(
      `=IFERROR(IF(B${n}="","",` +
      `SUMPRODUCT((${LOAN}!$A$4:$A$200=B${n})*` +
      `(${LOAN}!$C$4:$C$200="Advance")*` +
      `(${LOAN}!$L$4:$L$200="Active")*` +
      `${LOAN}!$F$4:$F$200)),"")`);

    // Loan EMI Recovery
    sh.getRange(r, 26).setFormula(
      `=IFERROR(IF(B${n}="","",` +
      `SUMPRODUCT((${LOAN}!$A$4:$A$200=B${n})*` +
      `(${LOAN}!$C$4:$C$200="Loan")*` +
      `(${LOAN}!$L$4:$L$200="Active")*` +
      `${LOAN}!$F$4:$F$200)),"")`);

    // Total Deductions
    sh.getRange(r, 27).setFormula(`=IF(B${n}="","",SUM(S${n}:Z${n}))`);

    // NET PAY
    sh.getRange(r, 28).setFormula(`=IF(B${n}="","",R${n}-AA${n})`);

    // EPF Employer: 12% of actual Basic+DA (no ceiling, no EPS split — EMP col M(13))
    sh.getRange(r, 29).setFormula(
      `=IFERROR(IF(B${n}="","",` +
      `IF(VLOOKUP(B${n},${EMP}!$A:$M,13,0)="YES",` +
      `ROUND((L${n}+N${n})*${S.EPF_EMPR}/100,0),0)),"")`);

    // ESI Employer: 3.25% of Gross — no ceiling (EMP col N(14))
    sh.getRange(r, 30).setFormula(
      `=IFERROR(IF(B${n}="","",` +
      `IF(VLOOKUP(B${n},${EMP}!$A:$N,14,0)="YES",` +
      `ROUND(R${n}*${S.ESI_EMPR}/100,0),0)),"")`);
  }

  // Row 205: Totals
  const TR = 205;
  sh.getRange(TR, 1, 1, 2).merge().setValue("MONTHLY TOTAL")
    .setBackground(C.TOTAL_BG).setFontWeight("bold");
  let colIdx = 6;
  ["F", "G", "H", "I", "J", "K",
   "L", "M", "N", "O", "P", "Q", "R",
   "S", "T", "U", "V", "W", "X", "Y", "Z",
   "AA", "AB", "AC", "AD"].forEach(col => {
    sh.getRange(TR, colIdx).setFormula(`=IFERROR(SUM(${col}5:${col}204),0)`);
    colIdx++;
  });
  sh.getRange(TR, 1, 1, 30).setBackground(C.TOTAL_BG).setFontWeight("bold");

  // Formatting
  sh.setFrozenRows(4);
  sh.setFrozenColumns(3);

  sh.getRange(5, 12, 200, 7).setNumberFormat("₹#,##0.00");   // Earnings
  sh.getRange(5, 19, 200, 10).setNumberFormat("₹#,##0.00");  // Deductions + Net
  sh.getRange(5, 29, 200, 2).setNumberFormat("₹#,##0.00");   // Employer
  sh.getRange(TR, 6, 1, 25).setNumberFormat("₹#,##0.00");    // Totals row

  for (let r = 5; r <= 204; r++) {
    const isAlt = r % 2 === 0;
    sh.getRange(r, 12, 1, 7).setBackground(isAlt ? C.EARN_BG : C.EARN_ALT);
    sh.getRange(r, 19, 1, 8).setBackground(isAlt ? C.DED_BG : C.DED_ALT);
    sh.getRange(r, 27, 1, 1).setBackground("#EDE7F6");
    sh.getRange(r, 28, 1, 1).setBackground(isAlt ? "#FFFDE7" : "#FFFFF0");
    sh.getRange(r, 29, 1, 2).setBackground(isAlt ? "#E0F2F1" : "#F1FFFE");
  }
  sh.getRange(5, 28, 200, 1).setFontWeight("bold");
  sh.getRange(4, 28, 1, 1).setBackground("#FBC02D");

  [50, 75, 160, 130, 110, 65, 75, 75, 65, 65, 75,
   95, 75, 65, 110, 100, 80, 100,
   85, 75, 65, 65, 90, 100, 90, 85,
   110, 110, 95, 95].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.setRowHeight(3, 30);

  SpreadsheetApp.flush();
}

// ============================================================
//  SHEET: 🧾 Payslip View
//  Dynamic payslip — enter Emp ID in B1; all data auto-fills
// ============================================================
function createPayslipSheet(ss) {
  let sh = ss.getSheetByName(SH.PAYSLIP);
  if (!sh) { sh = ss.insertSheet(SH.PAYSLIP, 5); }
  sh.clear();
  sh.setTabColor("#6A1B9A");

  const SAL = "'📊 Salary Register'";
  const EMP = "'👥 Employee Master'";

  sh.getRange(1, 1).setValue("Employee ID:");
  sh.getRange(1, 2).setValue("JRT001")
    .setBackground("#FFFF99").setFontWeight("bold").setFontSize(12);
  sh.getRange(1, 3, 1, 6).merge()
    .setValue("⬅  Type any Employee ID here; payslip updates automatically.")
    .setBackground("#FFF9C4").setFontStyle("italic").setFontSize(9);

  // Lookup from Salary Register (col B = key)
  const sl = (colIdx) =>
    `=IFERROR(VLOOKUP($B$1,${SAL}!$B:${colLetter(colIdx)},${colIdx - 1},0),"")`;

  // Lookup from Employee Master (col A = key)
  // Column indices updated for new 31-col Employee Master layout
  const em = (col, idx) =>
    `=IFERROR(VLOOKUP($B$1,${EMP}!$A:${col},${idx},0),"")`;

  const P = 3;

  // Company header
  sh.getRange(P, 1, 1, 8).merge()
    .setValue(CO_NAME)
    .setBackground(C.DARK_BLUE).setFontColor(C.WHITE)
    .setFontSize(20).setFontWeight("bold").setHorizontalAlignment("center");
  sh.setRowHeight(P, 45);

  sh.getRange(P + 1, 1, 1, 8).merge()
    .setFormula("=\"SALARY SLIP — \"&UPPER(TEXT('📅 Attendance'!$B$2,\"MMMM YYYY\"))")
    .setBackground(C.MID_BLUE).setFontColor(C.WHITE)
    .setFontSize(12).setFontWeight("bold").setHorizontalAlignment("center");

  sh.getRange(P + 2, 1, 1, 8).merge()
    .setFormula("=\"Generated on: \"&TEXT(NOW(),\"dd/MM/yyyy HH:mm\")")
    .setBackground(C.LIGHT_BLUE).setFontSize(9).setHorizontalAlignment("right")
    .setFontStyle("italic");

  sh.getRange(P + 3, 1, 1, 8).merge()
    .setValue("EMPLOYEE INFORMATION & ATTENDANCE")
    .setBackground(C.MID_BLUE).setFontColor(C.WHITE).setFontWeight("bold");

  // Employee info — updated column refs for new Employee Master layout
  const empInfo = [
    ["Employee Name:",      sl(3),       "Employee ID:",       "=$B$1"],
    ["Designation:",        sl(4),       "Department:",        sl(5)],
    ["Date of Joining:",    em("E", 5),  "PAN No.:",           em("T", 20)],  // PAN → col T(20)
    ["Bank Name:",          em("V", 22), "Account No.:",       em("W", 23)],  // Bank→V(22), Acct→W(23)
    ["EPF UAN:",            em("Y", 25), "ESI IP No.:",        em("Z", 26)],  // UAN→Y(25), ESI→Z(26)
    ["Total Working Days:", sl(6),       "Days Present:",      sl(7)],
    ["Days Absent:",        sl(8),       "OT Hours:",          sl(10)],
    ["Half Days:",          sl(9),       "Short Time (Hrs):",  sl(11)],
  ];
  empInfo.forEach((row, i) => {
    const r = P + 4 + i;
    sh.getRange(r, 1, 1, 2).merge().setValue(row[0]).setFontWeight("bold").setBackground(C.LIGHT_BLUE);
    sh.getRange(r, 3, 1, 2).merge().setFormula(row[1]);
    sh.getRange(r, 5, 1, 2).merge().setValue(row[2]).setFontWeight("bold").setBackground(C.LIGHT_BLUE);
    sh.getRange(r, 7, 1, 2).merge().setFormula(row[3]);
  });

  const TS = P + 13;

  sh.getRange(TS, 1, 1, 4).merge().setValue("EARNINGS")
    .setBackground(C.DARK_GREEN).setFontColor(C.WHITE).setFontWeight("bold").setHorizontalAlignment("center");
  sh.getRange(TS, 5, 1, 4).merge().setValue("DEDUCTIONS")
    .setBackground("#B71C1C").setFontColor(C.WHITE).setFontWeight("bold").setHorizontalAlignment("center");

  sh.getRange(TS + 1, 1, 1, 3).merge().setValue("Description").setFontWeight("bold").setBackground(C.EARN_BG);
  sh.getRange(TS + 1, 4).setValue("Amount (₹)").setFontWeight("bold").setBackground(C.EARN_BG).setHorizontalAlignment("right");
  sh.getRange(TS + 1, 5, 1, 3).merge().setValue("Description").setFontWeight("bold").setBackground(C.DED_BG);
  sh.getRange(TS + 1, 8).setValue("Amount (₹)").setFontWeight("bold").setBackground(C.DED_BG).setHorizontalAlignment("right");

  const earns = [
    ["Basic Salary",           sl(12)],
    ["HRA (House Rent Allow.)", sl(13)],
    ["Dearness Allowance (DA)", sl(14)],
    ["Special Allowance",      sl(15)],
    ["Other Allowances",       sl(16)],
    ["Overtime Allowance",     sl(17)],
  ];
  const dedns = [
    ["EPF — Employee (12%)",     sl(19)],
    ["ESI — Employee (0.75%)",   sl(20)],
    ["Labour Welfare Fund (LWF)", sl(21)],
    ["TDS (Income Tax)",         sl(22)],
    ["Absent Deduction",         sl(23)],
    ["Short Time Deduction",     sl(24)],
    ["Advance Recovery",         sl(25)],
    ["Loan EMI Recovery",        sl(26)],
  ];

  earns.forEach((row, i) => {
    const r = TS + 2 + i;
    sh.getRange(r, 1, 1, 3).merge().setValue(row[0]).setBackground(i % 2 === 0 ? C.EARN_BG : C.EARN_ALT);
    sh.getRange(r, 4).setFormula(row[1]).setNumberFormat("₹#,##0.00")
      .setHorizontalAlignment("right").setBackground(i % 2 === 0 ? C.EARN_BG : C.EARN_ALT);
  });
  dedns.forEach((row, i) => {
    const r = TS + 2 + i;
    sh.getRange(r, 5, 1, 3).merge().setValue(row[0]).setBackground(i % 2 === 0 ? C.DED_BG : C.DED_ALT);
    sh.getRange(r, 8).setFormula(row[1]).setNumberFormat("₹#,##0.00")
      .setHorizontalAlignment("right").setBackground(i % 2 === 0 ? C.DED_BG : C.DED_ALT);
  });

  const TR2 = TS + 10;
  sh.getRange(TR2, 1, 1, 3).merge().setValue("GROSS SALARY")
    .setFontWeight("bold").setBackground("#A5D6A7");
  sh.getRange(TR2, 4).setFormula(sl(18)).setNumberFormat("₹#,##0.00")
    .setFontWeight("bold").setBackground("#A5D6A7").setHorizontalAlignment("right");
  sh.getRange(TR2, 5, 1, 3).merge().setValue("TOTAL DEDUCTIONS")
    .setFontWeight("bold").setBackground("#EF9A9A");
  sh.getRange(TR2, 8).setFormula(sl(27)).setNumberFormat("₹#,##0.00")
    .setFontWeight("bold").setBackground("#EF9A9A").setHorizontalAlignment("right");

  const NR = TR2 + 1;
  sh.getRange(NR, 1, 1, 4).merge().setValue("NET PAY (TAKE HOME)")
    .setBackground(C.DARK_BLUE).setFontColor(C.WHITE).setFontSize(13).setFontWeight("bold");
  sh.getRange(NR, 5, 1, 4).merge().setFormula(sl(28))
    .setNumberFormat("₹#,##0.00").setFontSize(16).setFontWeight("bold")
    .setBackground(C.NET_BG).setHorizontalAlignment("center");
  sh.setRowHeight(NR, 35);

  const WR = NR + 1;
  sh.getRange(WR, 1, 1, 8).merge()
    .setFormula(`=IF($B$1="","","Amount in Words: "` +
      `&IFERROR(VLOOKUP($B$1,${SAL}!$B:$AB,27,0),"")&" Rupees"`)
    .setBackground(C.LIGHT_BLUE).setFontStyle("italic").setFontSize(10).setWrap(true);

  const ER = WR + 1;
  sh.getRange(ER, 1, 1, 2).merge().setValue("EPF — Employer Contribution:").setFontWeight("bold").setBackground("#E0F7FA");
  sh.getRange(ER, 3, 1, 2).merge().setFormula(sl(29)).setNumberFormat("₹#,##0.00").setBackground("#E0F7FA");
  sh.getRange(ER, 5, 1, 2).merge().setValue("ESI — Employer Contribution:").setFontWeight("bold").setBackground("#E0F7FA");
  sh.getRange(ER, 7, 1, 2).merge().setFormula(sl(30)).setNumberFormat("₹#,##0.00").setBackground("#E0F7FA");

  const CR = ER + 1;
  sh.getRange(CR, 1, 1, 4).merge().setValue("TOTAL CTC (Cost to Company):")
    .setFontWeight("bold").setBackground("#E3F2FD");
  sh.getRange(CR, 5, 1, 4).merge()
    .setFormula(`=IFERROR(VLOOKUP($B$1,${SAL}!$B:$R,17,0),0)+` +
                `IFERROR(VLOOKUP($B$1,${SAL}!$B:$AC,28,0),0)+` +
                `IFERROR(VLOOKUP($B$1,${SAL}!$B:$AD,29,0),0)`)
    .setNumberFormat("₹#,##0.00").setFontWeight("bold").setBackground("#E3F2FD");

  const SR = CR + 2;
  ["Employee Signature", "", "", "HR Manager", "", "", "Authorised Signatory", ""].forEach((lbl, i) => {
    if (lbl) sh.getRange(SR, i + 1).setValue(lbl).setHorizontalAlignment("center").setFontWeight("bold");
  });
  sh.getRange(SR + 2, 1, 1, 8).merge()
    .setFormula(`='⚙️ Settings'!$B$54`)
    .setBackground("#F5F5F5").setFontStyle("italic")
    .setFontSize(9).setHorizontalAlignment("center");

  [130, 100, 120, 120, 130, 100, 120, 120].forEach((w, i) => sh.setColumnWidth(i + 1, w));

  SpreadsheetApp.flush();
}

// ============================================================
//  SHEET: 📈 Summary Dashboard
// ============================================================
function createSummarySheet(ss) {
  let sh = ss.getSheetByName(SH.SUMMARY);
  if (!sh) { sh = ss.insertSheet(SH.SUMMARY, 6); }
  sh.clear();
  sh.setTabColor("#00695C");

  const tz   = Session.getScriptTimeZone();
  const mLbl = Utilities.formatDate(new Date(), tz, "MMMM yyyy");
  const SAL  = "'📊 Salary Register'";
  const EMP  = "'👥 Employee Master'";
  const LOAN = "'💰 Loan & Advance'";

  sh.getRange(1, 1, 1, 8).merge()
    .setValue("📈  MONTHLY SALARY SUMMARY DASHBOARD — " + CO_NAME + " | " + mLbl)
    .setBackground(C.DARK_BLUE).setFontColor(C.WHITE)
    .setFontSize(14).setFontWeight("bold").setHorizontalAlignment("center");

  const payrollRows = [
    ["PAYROLL SUMMARY",                "",                         "DEDUCTION BREAKUP",                     ""],
    ["Total Gross Payroll (₹)",        `=SUM(${SAL}!R5:R204)`,    "EPF Employee Total (₹)",                `=SUM(${SAL}!S5:S204)`],
    ["Total All Deductions (₹)",       `=SUM(${SAL}!AA5:AA204)`,  "ESI Employee Total (₹)",                `=SUM(${SAL}!T5:T204)`],
    ["Total NET Payroll (₹)",          `=SUM(${SAL}!AB5:AB204)`,  "LWF Employee Total (₹)",                `=SUM(${SAL}!U5:U204)`],
    ["EPF Employer Contribution (₹)",  `=SUM(${SAL}!AC5:AC204)`,  "TDS Total (₹)",                         `=SUM(${SAL}!V5:V204)`],
    ["ESI Employer Contribution (₹)",  `=SUM(${SAL}!AD5:AD204)`,  "Absent Deduction Total (₹)",            `=SUM(${SAL}!W5:W204)`],
    ["Total CTC (₹)",                  `=B3+B6+B7`,               "Short Time Dedn Total (₹)",             `=SUM(${SAL}!X5:X204)`],
    ["",                               "",                         "Advance Recovery Total (₹)",            `=SUM(${SAL}!Y5:Y204)`],
    ["",                               "",                         "Loan EMI Recovery Total (₹)",           `=SUM(${SAL}!Z5:Z204)`],
  ];

  sh.getRange(2, 1, 1, 4).setValues([payrollRows[0]]);
  sh.getRange(2, 1).setBackground(C.MID_BLUE).setFontColor(C.WHITE).setFontWeight("bold").setFontSize(11);
  sh.getRange(2, 3).setBackground(C.MID_BLUE).setFontColor(C.WHITE).setFontWeight("bold").setFontSize(11);

  payrollRows.slice(1).forEach((row, i) => {
    const r = 3 + i;
    sh.getRange(r, 1).setValue(row[0]).setFontWeight("bold").setBackground(C.LIGHT_BLUE);
    if (row[1]) sh.getRange(r, 2).setFormula(row[1]).setNumberFormat("₹#,##0.00").setBackground("#E8F5E9");
    sh.getRange(r, 3).setValue(row[2]).setFontWeight("bold").setBackground(C.DED_BG);
    if (row[3]) sh.getRange(r, 4).setFormula(row[3]).setNumberFormat("₹#,##0.00").setBackground("#FFEBEE");
  });

  // Head count
  sh.getRange(12, 1, 1, 4).merge().setValue("EMPLOYEE HEAD COUNT")
    .setBackground(C.MID_BLUE).setFontColor(C.WHITE).setFontWeight("bold");

  const headRows = [
    ["Total Employees in Master",      `=COUNTA(${EMP}!A3:A200)`],
    ["Active Employees",               `=COUNTIF(${EMP}!AE3:AE200,"Active")`],         // Status → AE(31)
    ["Resigned / Inactive",            `=COUNTIF(${EMP}!AE3:AE200,"Resigned")+COUNTIF(${EMP}!AE3:AE200,"Inactive")`],
    ["EPF Enrolled",                   `=COUNTIF(${EMP}!M3:M200,"YES")`],              // EPF Applicable → M(13)
    ["ESI Enrolled",                   `=COUNTIF(${EMP}!N3:N200,"YES")`],              // ESI Applicable → N(14)
    ["Employees Processed This Month", `=COUNTA(${SAL}!B5:B204)`],
  ];
  headRows.forEach((row, i) => {
    sh.getRange(13 + i, 1).setValue(row[0]).setFontWeight("bold").setBackground(C.LIGHT_BLUE);
    sh.getRange(13 + i, 2).setFormula(row[1]).setBackground("#E8F5E9");
  });

  // Loan & Advance
  sh.getRange(20, 1, 1, 4).merge().setValue("LOAN & ADVANCE STATUS")
    .setBackground(C.MID_BLUE).setFontColor(C.WHITE).setFontWeight("bold");

  const loanRows = [
    ["Active Loans (count)",           `=COUNTIFS(${LOAN}!C4:C200,"Loan",${LOAN}!L4:L200,"Active")`],
    ["Active Advances (count)",        `=COUNTIFS(${LOAN}!C4:C200,"Advance",${LOAN}!L4:L200,"Active")`],
    ["Total Loan Outstanding (₹)",     `=SUMIF(${LOAN}!L4:L200,"Active",${LOAN}!H4:H200)`],
    ["Total EMI This Month (₹)",       `=SUMIF(${LOAN}!L4:L200,"Active",${LOAN}!F4:F200)`],
  ];
  loanRows.forEach((row, i) => {
    sh.getRange(21 + i, 1).setValue(row[0]).setFontWeight("bold").setBackground(C.LIGHT_BLUE);
    sh.getRange(21 + i, 2).setFormula(row[1]).setBackground("#E8F5E9");
  });
  sh.getRange(23, 2, 2, 1).setNumberFormat("₹#,##0.00");

  // Compliance checklist
  sh.getRange(26, 1, 1, 4).merge().setValue("MONTHLY COMPLIANCE CHECKLIST")
    .setBackground(C.MID_BLUE).setFontColor(C.WHITE).setFontWeight("bold");

  const checks = [
    ["☐ EPF challan generated and deposited (by 15th of next month)",  ""],
    ["☐ ESI challan generated and deposited (by 15th of next month)",  ""],
    ["☐ LWF remitted as per state schedule",                           ""],
    ["☐ TDS deposited to government (by 7th of next month)",           ""],
    ["☐ Professional Tax deposited (if applicable)",                    ""],
    ["☐ Payslips distributed to all employees",                        ""],
    ["☐ Loan/Advance balances updated (menu → Post Month-End)",        ""],
    ["☐ Salary register archived for records",                         ""],
  ];
  checks.forEach((row, i) => {
    sh.getRange(27 + i, 1, 1, 4).merge().setValue(row[0])
      .setBackground(i % 2 === 0 ? "#FFF9C4" : "#FFFDE7").setWrap(true);
  });

  sh.setColumnWidth(1, 280); sh.setColumnWidth(2, 160);
  sh.setColumnWidth(3, 30);  sh.setColumnWidth(4, 160);
  sh.setFrozenRows(1);

  SpreadsheetApp.flush();
}

// ============================================================
//  MENU ACTION: Generate Monthly Salary
// ============================================================
function generateMonthlySalary() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const empSh = ss.getSheetByName(SH.EMP);
  const salSh = ss.getSheetByName(SH.SALARY);
  const attSh = ss.getSheetByName(SH.ATTEND);
  const ui    = SpreadsheetApp.getUi();

  if (!empSh || !salSh) {
    ui.alert("❌  Please run Setup first from the menu.");
    return;
  }

  // 31 columns in new Employee Master; Status is index 30 (0-based)
  const empData = empSh.getRange(3, 1, Math.max(empSh.getLastRow() - 2, 1), 31).getValues();
  const active  = empData.filter(r => r[0] !== "" && r[30] === "Active");

  const salIds = salSh.getRange(5, 2, 200, 1).getValues().map(r => r[0]);
  const attIds = attSh.getRange(4, 1, 197, 1).getValues().map(r => r[0]);

  let added = 0;
  active.forEach(emp => {
    const id = emp[0];
    if (!salIds.includes(id)) {
      const emptyIdx = salIds.indexOf("");
      if (emptyIdx !== -1) {
        salSh.getRange(5 + emptyIdx, 2).setValue(id);
        salIds[emptyIdx] = id;
        added++;
      }
    }
    if (!attIds.includes(id)) {
      const emptyAttIdx = attIds.indexOf("");
      if (emptyAttIdx !== -1) {
        attSh.getRange(4 + emptyAttIdx, 1).setValue(id);
        attIds[emptyAttIdx] = id;
      }
    }
  });

  SpreadsheetApp.flush();
  const tz   = Session.getScriptTimeZone();
  const mLbl = Utilities.formatDate(new Date(), tz, "MMMM yyyy");

  ui.alert(
    "✅  Salary Register Ready",
    `Month: ${mLbl}\n\n` +
    `Active employees: ${active.length}\n` +
    `Newly added to register: ${added}\n\n` +
    "Next:\n" +
    "1. Verify attendance data in 📅 Attendance sheet.\n" +
    "2. Update monthly TDS in 👥 Employee Master (col AD) if changed.\n" +
    "3. Check 💰 Loan & Advance entries are current.\n" +
    "4. Review 📊 Salary Register — all columns auto-calculate.\n" +
    "5. View/export individual payslips from 🧾 Payslip View.",
    ui.ButtonSet.OK
  );
}

// ============================================================
//  MENU ACTION: Activate Payslip View
// ============================================================
function activatePayslip() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SH.PAYSLIP);
  if (!sh) { SpreadsheetApp.getUi().alert("Run Setup first."); return; }
  sh.activate();
  SpreadsheetApp.getUi().alert(
    "🧾  Payslip View",
    "Enter the Employee ID in cell B1.\nThe payslip updates automatically.",
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ============================================================
//  MENU ACTION: Export Payslip to PDF
// ============================================================
function exportPayslipPDF() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SH.PAYSLIP);
  const ui = SpreadsheetApp.getUi();

  if (!sh) { ui.alert("Run Setup first."); return; }

  const empId = sh.getRange("B1").getValue();
  if (!empId) {
    ui.alert("Enter an Employee ID in cell B1 of the Payslip View sheet first.");
    return;
  }

  try {
    const tz   = Session.getScriptTimeZone();
    const mLbl = Utilities.formatDate(new Date(), tz, "MMM-yyyy");
    const url  = "https://docs.google.com/spreadsheets/d/" + ss.getId() +
      "/export?format=pdf&size=A4&portrait=true&fitw=true" +
      "&sheetnames=false&printtitle=false&gridlines=false" +
      "&gid=" + sh.getSheetId();

    const pdf = UrlFetchApp.fetch(url, {
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() }
    }).getBlob().setName("Payslip_" + empId + "_" + mLbl + ".pdf");

    let folder;
    const folderName = "Payslips — " + Utilities.formatDate(new Date(), tz, "MMMM yyyy");
    const iter = DriveApp.getFoldersByName(folderName);
    folder = iter.hasNext() ? iter.next() : DriveApp.createFolder(folderName);

    const file = folder.createFile(pdf);
    ui.alert("✅  PDF Saved",
      "File: " + file.getName() + "\nFolder: " + folderName, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert("❌  PDF Export Error:\n" + e.message);
  }
}

// ============================================================
//  MENU ACTION: Add Loan / Advance Entry
// ============================================================
function addLoanAdvanceEntry() {
  const ui = SpreadsheetApp.getUi();

  const empId  = ui.prompt("Add Loan / Advance (1/5)", "Employee ID:", ui.ButtonSet.OK_CANCEL);
  if (empId.getSelectedButton() !== ui.Button.OK) return;

  const type   = ui.prompt("Type (2/5)", "Loan  or  Advance :", ui.ButtonSet.OK_CANCEL);
  if (type.getSelectedButton() !== ui.Button.OK) return;

  const amount = ui.prompt("Total Amount (3/5)", "Total amount sanctioned (₹):", ui.ButtonSet.OK_CANCEL);
  if (amount.getSelectedButton() !== ui.Button.OK) return;

  const emi    = ui.prompt("Monthly Deduction (4/5)", "Monthly recovery / EMI amount (₹):", ui.ButtonSet.OK_CANCEL);
  if (emi.getSelectedButton() !== ui.Button.OK) return;

  const note   = ui.prompt("Remarks (5/5)", "Purpose / remarks:", ui.ButtonSet.OK_CANCEL);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SH.LOAN);
  if (!sh) { ui.alert("Loan sheet not found. Run Setup first."); return; }

  const lr = sh.getLastRow() + 1;
  const id = empId.getResponseText().trim().toUpperCase();
  sh.getRange(lr, 1).setValue(id);
  sh.getRange(lr, 2).setFormula(
    `=IFERROR(VLOOKUP(A${lr},'👥 Employee Master'!$A:$B,2,0),"")`);
  sh.getRange(lr, 3).setValue(type.getResponseText().trim());
  sh.getRange(lr, 4).setValue(new Date()).setNumberFormat("dd/mm/yyyy");
  sh.getRange(lr, 5).setValue(parseFloat(amount.getResponseText()) || 0);
  sh.getRange(lr, 6).setValue(parseFloat(emi.getResponseText()) || 0);
  sh.getRange(lr, 7).setValue(0);
  sh.getRange(lr, 8).setFormula(`=E${lr}-G${lr}`);
  sh.getRange(lr, 9).setFormula(`=IFERROR(CEILING((E${lr}-G${lr})/F${lr},1),0)`);
  sh.getRange(lr, 10).setValue("0% (Zero Interest)");
  sh.getRange(lr, 11).setValue(note ? note.getResponseText() : "");
  sh.getRange(lr, 12).setValue("Active");
  sh.getRange(lr, 5, 1, 4).setNumberFormat("₹#,##0.00");

  ui.alert("✅  Entry Added",
    type.getResponseText() + " for " + id + " (₹" + amount.getResponseText() + ") recorded.",
    ui.ButtonSet.OK);
}

// ============================================================
//  MENU ACTION: Post Month-End — Update Loan/Advance Balances
// ============================================================
function updateLoanAdvanceBalances() {
  const ui = SpreadsheetApp.getUi();
  const go = ui.alert(
    "⚠️  Post Month-End Balance Update",
    "This adds this month's deductions to 'Total Paid' in the Loan & Advance sheet " +
    "and closes fully-recovered entries.\n\n" +
    "Run this ONCE per month after finalising the salary register.\n\nContinue?",
    ui.ButtonSet.YES_NO
  );
  if (go !== ui.Button.YES) return;

  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const salSh  = ss.getSheetByName(SH.SALARY);
  const loanSh = ss.getSheetByName(SH.LOAN);
  if (!salSh || !loanSh) { ui.alert("Required sheets not found."); return; }

  const salData  = salSh.getRange(5, 2, 200, 27).getValues();   // B:AB
  const loanData = loanSh.getRange(4, 1, 197, 12).getValues();  // rows 4..200

  const salMap = {};
  salData.forEach(row => {
    const id = row[0];  // col B
    if (!id) return;
    salMap[id] = { advance: row[23], loan: row[24] }; // cols Y(25), Z(26)
  });

  let updated = 0, closed = 0;
  loanData.forEach((loan, i) => {
    const id     = loan[0];
    const type   = loan[2];
    const status = loan[11];
    const emi    = parseFloat(loan[5]) || 0;
    const paid   = parseFloat(loan[6]) || 0;
    const total  = parseFloat(loan[4]) || 0;
    if (!id || status !== "Active" || emi === 0) return;

    const sal = salMap[id];
    if (!sal) return;

    const deducted = type === "Loan" ? sal.loan : sal.advance;
    if (!deducted || deducted === 0) return;

    const newPaid = paid + emi;
    loanSh.getRange(4 + i, 7).setValue(newPaid);
    updated++;
    if (newPaid >= total) {
      loanSh.getRange(4 + i, 12).setValue("Closed");
      closed++;
    }
  });

  SpreadsheetApp.flush();
  ui.alert("✅  Balances Updated",
    `Updated: ${updated} records\nClosed (fully repaid): ${closed} entries`, ui.ButtonSet.OK);
}

// ============================================================
//  MENU ACTION: Archive Current Month Salary
// ============================================================
function archiveCurrentMonth() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const src = ss.getSheetByName(SH.SALARY);
  const ui  = SpreadsheetApp.getUi();
  if (!src) { ui.alert("Salary Register not found."); return; }

  const tz   = Session.getScriptTimeZone();
  const mLbl = Utilities.formatDate(new Date(), tz, "MMM-yyyy");
  const name = "Archive-Salary-" + mLbl;

  if (ss.getSheetByName(name)) {
    ui.alert("Archive for " + mLbl + " already exists.");
    return;
  }

  const copy = src.copyTo(ss);
  copy.setName(name);
  copy.setTabColor("#78909C");

  ss.moveActiveSheet(ss.getSheets().length);

  SpreadsheetApp.flush();
  ui.alert("✅  Archived", "Salary Register copied to sheet: " + name, ui.ButtonSet.OK);
}

// ============================================================
//  MENU ACTION: Open Summary
// ============================================================
function openSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SH.SUMMARY);
  if (!sh) { SpreadsheetApp.getUi().alert("Run Setup first."); return; }
  sh.activate();
}

// ============================================================
//  MENU ACTION: Help & Documentation
// ============================================================
function showHelp() {
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;font-size:13px;padding:18px;color:#212121}
  h2{color:#0D47A1;border-bottom:2px solid #0D47A1;padding-bottom:4px}
  h3{color:#1B5E20;margin-top:16px}
  table{border-collapse:collapse;width:100%;margin:8px 0}
  th{background:#1565C0;color:#fff;padding:7px 10px;text-align:left}
  td{border:1px solid #ddd;padding:6px 10px}
  tr:nth-child(even){background:#f9f9f9}
  .note{background:#FFF9C4;border-left:4px solid #F57F17;padding:10px;margin:10px 0;border-radius:4px}
  .red{color:#B71C1C;font-weight:bold}
  .green{color:#1B5E20;font-weight:bold}
  ol li{margin-bottom:6px}
</style>
</head><body>
<h2>🏭 ${CO_NAME} — Salary System Help</h2>

<div class="note">
  <b>📌 Company-Specific Rules in This System:</b><br>
  ✅ No EPS — full 12% employer EPF goes directly to EPF A/C (no Pension Scheme split)<br>
  ✅ No ESI Gross Ceiling — ESI applies to all ESI-enrolled employees regardless of salary<br>
  ✅ No EPF Wage Ceiling — EPF calculated on actual Basic + DA (no ₹15,000 cap)<br>
  ✅ Per-employee Fixed Working Hours — set in Employee Master col F (different employees can have different hours)<br>
  ✅ OT at standard rate (1×) — not double time
</div>

<h3>📋 Quick Start (First Time)</h3>
<ol>
  <li>Run <b>Menu → Setup / Reset Sheets</b> — creates all sheets.</li>
  <li>Open <b>⚙️ Settings</b> — fill company details, verify statutory rates.</li>
  <li>Open <b>👥 Employee Master</b> — add each employee; set <b>col F (Fixed Working Hours)</b> per employee, fill salary, EPF/ESI flag, TDS (col AD).</li>
  <li>Each month: open <b>📅 Attendance</b> — fill Emp IDs, Days Present, Half Days, OT, Short Time.</li>
  <li>Open <b>💰 Loan & Advance</b> — add new loans/advances via menu or directly.</li>
  <li>Run <b>Menu → Generate Monthly Salary Register</b>.</li>
  <li>Review <b>📊 Salary Register</b> — all earnings, deductions, net pay auto-calculated.</li>
  <li>View payslip: open <b>🧾 Payslip View</b>, type Emp ID in B1.</li>
  <li>End of month: run <b>Menu → Post Month-End: Update Balances</b>.</li>
  <li>Archive: run <b>Menu → Archive Current Month Salary</b>.</li>
</ol>

<h3 class="red">💰 Deductions — Calculation Logic</h3>
<table>
  <tr><th>Deduction</th><th>Formula / Rule</th><th>Reference</th></tr>
  <tr><td><b>EPF (Employee)</b></td>
      <td>12% × (Basic + DA) — <b>no wage ceiling</b></td>
      <td>EPF & MP Act 1952, Section 6</td></tr>
  <tr><td><b>ESI (Employee)</b></td>
      <td>0.75% × Gross Salary — <b>all ESI-enrolled employees; no gross ceiling</b></td>
      <td>ESI Act 1948</td></tr>
  <tr><td><b>LWF (Employee)</b></td>
      <td>Fixed ₹ (see Settings B20) per month</td>
      <td>State-specific Labour Welfare Fund Act</td></tr>
  <tr><td><b>TDS</b></td>
      <td>Monthly TDS entered in Employee Master col AD.<br>
          Calculate: Annual Tax ÷ 12 (see Settings for slabs)</td>
      <td>Income Tax Act 1961, Sec 192</td></tr>
  <tr><td><b>Absent Deduction</b></td>
      <td>Gross ÷ Working Days × Absent Days</td>
      <td>Company policy</td></tr>
  <tr><td><b>Short Time Deduction</b></td>
      <td>Gross ÷ WD ÷ <b>Employee's Fixed Working Hours</b> × Short Hours</td>
      <td>Company policy (per-employee hours from col F)</td></tr>
  <tr><td><b>Advance Recovery</b></td>
      <td>Monthly deduction from active Advance records</td>
      <td>Company policy (zero interest)</td></tr>
  <tr><td><b>Loan EMI</b></td>
      <td>Monthly EMI from active Loan records</td>
      <td>Company policy (zero interest)</td></tr>
</table>

<h3 class="green">✅ Employer Contributions (not deducted from employee)</h3>
<table>
  <tr><th>Contribution</th><th>Rate</th><th>Notes</th></tr>
  <tr><td>EPF Employer</td><td>12% × (Basic + DA) — <b>no wage ceiling</b></td>
      <td>Full 12% to EPF A/C. <b>No EPS split</b> per company policy.</td></tr>
  <tr><td>ESI Employer</td><td>3.25% × Gross — <b>all ESI-enrolled employees</b></td>
      <td>No gross ceiling. Shown in CTC.</td></tr>
  <tr><td>LWF Employer</td><td>₹75/month (Settings B21)</td>
      <td>State-specific. Update in Settings.</td></tr>
</table>

<h3>⏱️ OT & Working Hours Calculation</h3>
<table>
  <tr><th>Field</th><th>Where to Set</th><th>Formula</th></tr>
  <tr><td><b>Fixed Working Hours</b></td>
      <td>Employee Master col F — set individually per employee</td>
      <td>Used for OT and short-time calculations</td></tr>
  <tr><td><b>OT Amount</b></td>
      <td>Auto-calculated in Salary Register</td>
      <td>(Basic ÷ Working Days ÷ Emp.Working Hrs) × OT Hrs × 1× (standard rate)</td></tr>
  <tr><td><b>Short Time Deduction</b></td>
      <td>Auto-calculated in Salary Register</td>
      <td>(Gross ÷ WD ÷ Emp.Working Hrs) × Short Time Hrs</td></tr>
  <tr><td><b>Default Hrs/Day</b></td>
      <td>Settings B30</td>
      <td>Used as fallback if employee's col F is blank</td></tr>
  <tr><td><b>OT Multiplier</b></td>
      <td>Settings B31 (currently 1)</td>
      <td>Change to 2 for double time; 1.5 for time-and-a-half</td></tr>
</table>

<div class="note">
  <b>📌 TDS Calculation (Simple Steps):</b><br>
  Annual Gross = Monthly Gross × 12<br>
  Taxable Income = Annual Gross − ₹75,000 (standard deduction) − Annual EPF (employee)<br>
  Tax = Apply slabs from Settings sheet rows 35–40<br>
  Add 4% Health & Education Cess on tax amount<br>
  Monthly TDS = Total Annual Tax ÷ 12 → Enter in Employee Master <b>col AD</b>
</div>

<div class="note">
  <b>📌 LWF State Reference (as of 2024):</b><br>
  Uttar Pradesh: ₹10 (emp) + ₹20 (empr) — Half-yearly (Jun & Dec)<br>
  Rajasthan: ₹25 (emp) + ₹25 (empr) — Annual<br>
  Punjab: ₹20 (emp) + ₹40 (empr) — Monthly<br>
  Haryana: ₹25 (emp) + ₹75 (empr) — Monthly<br>
  <i>Update Settings B20/B21 and B22 to match your state.</i>
</div>

<h3>🗂️ Sheet Purpose Summary</h3>
<table>
  <tr><th>Sheet</th><th>Purpose</th><th>Who fills it</th></tr>
  <tr><td>⚙️ Settings</td><td>Company info, statutory rates, tax slabs</td><td>HR/Accounts (once)</td></tr>
  <tr><td>👥 Employee Master</td><td>All employee data, salary, working hours (col F), TDS (col AD)</td><td>HR</td></tr>
  <tr><td>📅 Attendance</td><td>Monthly attendance, OT, short time</td><td>HR/Supervisor (monthly)</td></tr>
  <tr><td>💰 Loan & Advance</td><td>Loan & advance records, EMI tracking</td><td>Accounts</td></tr>
  <tr><td>📊 Salary Register</td><td>Auto-calculated salary — all deductions, net pay</td><td>Auto (read-only)</td></tr>
  <tr><td>🧾 Payslip View</td><td>Live payslip for any employee</td><td>Auto (enter Emp ID)</td></tr>
  <tr><td>📈 Summary</td><td>Payroll totals, compliance checklist</td><td>Auto</td></tr>
</table>

</body></html>
`).setWidth(800).setHeight(580).setTitle("📖 Help — " + CO_NAME + " Salary System");

  SpreadsheetApp.getUi().showModelessDialog(html, "📖 Help & Documentation");
}

// ============================================================
//  UTILITY: column number → letter (1→A, 27→AA, etc.)
// ============================================================
function colLetter(n) {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ============================================================
//  UTILITY: Amount to Indian words (Rupees)
// ============================================================
function amountToWords(num) {
  if (!num || num === 0) return "Zero Rupees Only";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function below100(n) {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  }
  function below1000(n) {
    if (n < 100) return below100(n);
    return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + below100(n % 100) : "");
  }

  const paise = Math.round((Math.abs(num) % 1) * 100);
  let n       = Math.floor(Math.abs(num));
  const neg   = num < 0;
  let result  = "";

  if (n >= 10000000) { result += below1000(Math.floor(n / 10000000)) + " Crore "; n %= 10000000; }
  if (n >= 100000)   { result += below1000(Math.floor(n / 100000))   + " Lakh ";  n %= 100000;   }
  if (n >= 1000)     { result += below100(Math.floor(n / 1000))      + " Thousand "; n %= 1000;  }
  if (n > 0)         { result += below1000(n); }

  result = (neg ? "Minus " : "") + result.trim() + " Rupees";
  if (paise > 0) result += " and " + below100(paise) + " Paise";
  return result + " Only";
}
