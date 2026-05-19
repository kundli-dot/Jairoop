# Textile IMS (Inventory & operations dashboard)

This repository packages an **Inventory Management System** tailored for textile operations: **master stock**, **order book**, **job work** (sent/received/wastage/payment), **dispatch** with challan numbers, **KPI dashboard** (Chart.js), **client portfolio** view, **order lifecycle** timeline, and **stock alerts** (reorder + high allocation).

It is designed to sit on top of **Google Sheets** (your single source of truth) and a **Google Apps Script** web app, matching the structure of [your IMS System V2 sheet](https://docs.google.com/spreadsheets/d/19DMKtsGlL2GvDAZSW7tfJ8S-8Vi_vk0dka_IG-hIbWw/edit?usp=sharing).

## What you get

| Piece | Role |
|--------|------|
| `google-apps-script/Code.gs` | Reads/writes the four sheets, computes KPIs, syncs **Allocated to Orders** from open orders, exposes functions to the web UI. |
| `google-apps-script/Index.html` | Full-screen dashboard: dark mode, filters, modals for new order / job work / dispatch, charts, lifecycle modal. |
| `google-apps-script/appsscript.json` | V8 runtime, `Asia/Kolkata` timezone (change if your business is elsewhere). |
| `docs/SHEET_SETUP.md` | Required tab names and header rows. |

## Quick start (do this in order)

1. **Prepare the spreadsheet**  
   Follow [docs/SHEET_SETUP.md](docs/SHEET_SETUP.md): tab names, row 1 headers, and status values must align with what the script expects.

2. **Create the script project (bound to the sheet)**  
   In the spreadsheet: **Extensions → Apps Script**.  
   - Replace default `Code.gs` with the file from `google-apps-script/Code.gs`.  
   - Add **File → New → HTML file**, name it **`Index`**, replace contents with `google-apps-script/Index.html`.  
   - Add **File → Project settings** and confirm **Google Apps Script API** / runtime is V8 (see `appsscript.json` if you use `clasp`).

3. **Authorise Drive (optional logo)**  
   If you set `LOGO_FILE_ID` in Script properties, the first run will request Drive read access for that file.

4. **Deploy the web app**  
   **Deploy → New deployment → Select type: Web app**  
   - Execute as: **Me**  
   - Who has access: choose based on who may open the dashboard (company policy).  
   Open the deployment URL on desktop or tablet; use **Sync** to refresh after sheet edits.

5. **Allocation sync**  
   Changing **Status** in column F of **Order Book** runs allocation sync. You can also use the spreadsheet menu **IMS → Recalculate allocations** after bulk imports.

## Optional: `clasp` (push from your laptop)

If you use the [clasp](https://github.com/google/clasp) CLI, copy `google-apps-script/` to your local Apps Script project and `clasp push`. Do not commit Google credentials to git.

## How “advanced” this is (and what to add next)

**Included:** Multi-module UI, server-side KPI aggregation, order-driven allocation column, lifecycle traceability, wastage % highlighting, dispatch totals, client portfolio cards, reorder / allocation alerts, optional logo, defensive column detection for **Allocated to Orders**.

**Reasonable next steps** (not in this repo): barcode scanning for GRN, role-based login (Google Identity), automated purchase suggestions from lead time, ERP export, WhatsApp/email alerts via triggers, and tighter validation against a canonical item list.

## Licence

Use and modify freely for your business; keep backup copies of your spreadsheet before running one-off migration scripts.
