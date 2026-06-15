# Jai Roop Textile Pvt Ltd — Salary Management System

## Overview

A complete, formula-driven **Google Apps Script** for Google Sheets that automates the entire monthly salary workflow for **Jai Roop Textile Pvt Ltd**.

---

## Features

| Feature | Details |
|---|---|
| **Employee Master** | Stores all static employee data — salary structure, bank, PAN, Aadhaar, EPF/ESI flags |
| **Attendance Register** | Monthly attendance with OT hours, short time, half days |
| **Loan & Advance Tracker** | Zero-interest loans and salary advances with auto EMI tracking |
| **Salary Register** | Auto-calculates every earning and deduction for all employees |
| **Payslip View** | Live payslip — type any Employee ID and it renders instantly |
| **Summary Dashboard** | Month-level payroll totals + compliance checklist |
| **PDF Export** | Saves payslip as PDF to Google Drive (per-month folder) |
| **Month Archive** | One-click archive of the monthly salary register |

---

## Deductions Covered

| Deduction | Calculation Method |
|---|---|
| **EPF (Employee)** | 12% × MIN(Basic + DA, ₹15,000 ceiling) |
| **ESI (Employee)** | 0.75% × Gross (only if Gross ≤ ₹21,000/month) |
| **LWF (Labour Welfare Fund)** | Fixed ₹ per month (configurable by state) |
| **TDS (Income Tax)** | Monthly TDS from IT computation (entered per employee) |
| **Absent Deduction** | Gross ÷ Working Days × Absent Days |
| **Short Time Deduction** | Gross ÷ Working Days ÷ Hours/Day × Short Hours |
| **Advance Recovery** | Monthly recovery from active salary advances |
| **Loan EMI** | Zero-interest fixed monthly EMI from loan records |

---

## How to Install

### Step 1 — Create a new Google Sheet
Open [Google Sheets](https://sheets.google.com) and create a blank spreadsheet.

### Step 2 — Open Apps Script
Click **Extensions → Apps Script**.

### Step 3 — Paste the script
1. Delete any existing code in the editor.
2. Open `JaiRoopTextile_SalaryManagement.gs` from this repository.
3. Copy the entire file contents.
4. Paste it into the Apps Script editor.
5. Press **Ctrl+S** (or Cmd+S on Mac) to save.

### Step 4 — Run the Setup
1. Close the Apps Script editor and return to the Google Sheet.
2. Refresh the page (F5). A new menu **"🏭 JRT Salary"** appears.
3. Click **🏭 JRT Salary → 🔧 Initial Setup / Reset Sheets**.
4. When prompted for permissions, click **Review Permissions → Allow**.
5. Run Setup again if the first run was interrupted by the permissions dialog.

---

## Sheet-by-Sheet Guide

### ⚙️ Settings
Update once at the start:
- **Company details** — name, address, PAN, TAN, ESI/PF/LWF registration numbers.
- **Statutory rates** — EPF (12%), ESI (0.75% / 3.25%), LWF (state-specific), EPF wage ceiling (₹15,000), ESI ceiling (₹21,000).
- **Salary structure defaults** — HRA%, DA%, standard working days (26), hours/day (8).
- **TDS slabs** — pre-filled with FY 2024-25 New Regime. Update as needed.

### 👥 Employee Master
Add each employee in a new row:
- **Mandatory columns:** Emp ID, Name, Designation, Department, Basic Salary, EPF Applicable (YES/NO), ESI Applicable (YES/NO), Status (Active/Inactive/Resigned).
- **HRA/DA/Special Allow** — enter fixed ₹ amounts. The Gross (col K) is auto-summed.
- **TDS Monthly (col AC)** — compute annually per employee and divide by 12. Update if annual income changes mid-year.
- **Loan EMI / Advance** — managed in the Loan & Advance sheet; DO NOT enter here manually.

### 📅 Attendance
Fill every month:
- Enter **Emp IDs** in column A (the menu can auto-populate these).
- Fill **Days Present** (col E), **Half Days** (col G), **OT Hours** (col H), **Short Time Hours** (col I).
- **Days Absent** (col F) is auto-calculated: `Total WD − Present − Half Days/2`.
- Verify **Working Days** in cell D2 matches actual monthly working days.

### 💰 Loan & Advance
- Use **Menu → Add New Loan / Advance Entry** for a guided dialog.
- Or fill directly — `Type` = Loan or Advance, `Status` = Active.
- **Outstanding Balance** and **Months Remaining** are auto-calculated.
- After month-end, run **Menu → Post Month-End: Update Balances** to add this month's deductions to Total Paid and auto-close fully recovered entries.

### 📊 Salary Register
**Read-only — all columns are formula-driven.**
- Run **Menu → Generate Monthly Salary Register** to auto-populate Employee IDs.
- All earnings (Basic, HRA, DA, Special Allow, OT) pull from Employee Master.
- All attendance (Present, Absent, OT, Short Time) pull from the Attendance sheet.
- All deductions compute automatically based on the logic in Settings.
- Row 205 shows monthly totals.

### 🧾 Payslip View
- Type any **Employee ID in cell B1**.
- The payslip renders immediately with all earnings, deductions, net pay, and CTC.
- Use **Menu → Export Payslip to PDF** to save a copy to Google Drive.

### 📈 Summary Dashboard
Auto-updates from Salary Register:
- Total Gross, Total Deductions, Net Payroll.
- EPF/ESI employer contributions and Total CTC.
- Head count (active, EPF/ESI enrolled).
- Loan/Advance outstanding summary.
- Monthly compliance checklist.

---

## Month-End Workflow

```
1. Fill 📅 Attendance for the month
2. Update loan/advance entries in 💰 if any new ones
3. Menu → Generate Monthly Salary Register
4. Review 📊 Salary Register — spot check 3-4 employees
5. Check 📈 Summary totals
6. Menu → Post Month-End: Update Balances  (do once only)
7. Menu → Archive Current Month Salary
8. Share payslips: 🧾 Payslip View → Export PDF per employee
9. Tick off 📈 Compliance Checklist
```

---

## Statutory Compliance Notes

### EPF (Employees' Provident Fund)
- **Employee contribution:** 12% of (Basic + DA), calculated on actual wages up to ₹15,000 wage ceiling.
- **Employer contribution:** Also 12% of the same base. Of this: 8.33% (capped at ₹1,250/month) goes to EPS (Employee Pension Scheme); remaining goes to EPF.
- **Challan due date:** 15th of the following month.
- **EPFO portal:** [epfindia.gov.in](https://www.epfindia.gov.in)

### ESI (Employee State Insurance)
- **Employee contribution:** 0.75% of Gross Salary.
- **Employer contribution:** 3.25% of Gross Salary.
- **Applicability:** Only for employees with Gross Salary ≤ ₹21,000/month. Exempt employees have ESI set to NO in the master.
- **Challan due date:** 15th of the following month.
- **ESIC portal:** [esic.gov.in](https://www.esic.gov.in)

### LWF (Labour Welfare Fund)
- Amount and frequency vary by state. Update Settings cells B23/B24.
- Common examples: Haryana ₹25/₹75 monthly; UP ₹10/₹20 half-yearly; Rajasthan ₹25/₹25 annual.

### TDS (Tax Deducted at Source) — Section 192
- Compute projected annual income for each employee at year start (or when salary changes).
- Deduct ₹75,000 standard deduction and annual EPF contribution.
- Apply FY 2024-25 New Regime slabs (in Settings rows 38-43).
- Add 4% Health & Education Cess on the tax.
- Monthly TDS = Annual Tax ÷ 12. Enter in Employee Master column AC.
- **Deposit due date:** 7th of the following month.
- **Form 24Q** must be filed quarterly.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Menu not visible after opening sheet | Refresh the page (F5) |
| `#REF!` errors in Salary Register | Ensure Employee Master and Attendance sheets exist |
| Payslip shows blank | Check Employee ID in B1 exactly matches Emp ID in Employee Master |
| PDF export fails | Run from the same Google account that owns the Sheet; allow Drive permissions |
| ESI showing zero for eligible employee | Verify ESI Applicable = YES in Employee Master col M |
| EPF showing zero | Verify EPF Applicable = YES in Employee Master col L |

---

## File Structure

```
JaiRoopTextile_SalaryManagement.gs   ← Full Google Apps Script (paste into Apps Script editor)
README.md                            ← This documentation
```

---

*Designed for Jai Roop Textile Pvt Ltd. All statutory rates are as per Indian law as of FY 2024-25. Verify rates annually and update in the ⚙️ Settings sheet.*
