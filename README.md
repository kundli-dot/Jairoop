# Textile IMS Pro for Google Sheets

This repository now contains a production-style **Google Apps Script Inventory Management System** for a textile company. It is designed to run on top of your Google Sheet and turn it into a usable operational system for:

- inventory visibility
- order booking
- job work tracking
- dispatch logging
- stock movement audit trail
- low-stock alerts
- reorder planning

The default spreadsheet ID in the code is already set to your sheet:

`19DMKtsGlL2GvDAZSW7tfJ8S-8Vi_vk0dka_IG-hIbWw`

---

## What is included

### Backend

- `Code.gs`  
  Public Apps Script entry points, menu actions, and web-app functions.

- `Services.gs`  
  Workbook setup, schema normalization, KPI computation, write-back actions, stock recalculation, reorder suggestions, and movement logging.

### Frontend

- `Index.html`  
  Web dashboard UI with tabs for dashboard, inventory, orders, job work, dispatch, ledger, planner, and alerts.

### Manifest

- `appsscript.json`  
  Apps Script runtime and scopes.

---

## Major improvements over the PDF version

Compared with the original PDF-based script, this version adds:

- a real source-controlled project structure
- automatic workbook initialization and repair
- backward-tolerant header alias mapping
- advanced inventory columns:
  - allocated stock
  - available stock
  - reorder quantity
  - stock value
  - last updated
- stock movement ledger
- reorder planner and purchase-plan tracker
- due-date aware order management
- dispatch progress sync on orders
- worker performance summary
- client portfolio summary
- better validation and safer write-backs

---

## Required sheets

The script will automatically create or repair these tabs:

1. `Master`
2. `Order Book`
3. `Job Work Tracker`
4. `Dispatch Log`
5. `Stock Movements`
6. `Purchase Planner`
7. `Settings`

If your current inventory tab is not named `Master`, the script will try to promote an existing inventory-like sheet into `Master`.

---

## Quick setup

### Option A - Best for you: bind the script to your existing sheet

1. Open your Google Sheet.
2. Go to **Extensions -> Apps Script**.
3. Delete the default sample files.
4. Create these files in Apps Script and paste the contents from this repo:
   - `Code.gs`
   - `Services.gs`
   - `Index.html`
   - `appsscript.json`
5. Save the project.
6. Run `initializeIMSWorkbook` once from the Apps Script editor.
7. Accept Google authorization prompts.
8. Refresh the spreadsheet.

You will now see a custom menu:

**IMS Control Center**

Use it to initialize/repair the workbook or seed demo transactions.

### Option B - Standalone script project

You can also create a standalone Apps Script project and paste the same files.  
This works because the spreadsheet ID is already configured in `IMS_CONFIG.defaultSpreadsheetId`.

---

## Deploy the dashboard

After saving the script:

1. In Apps Script, click **Deploy -> New deployment**
2. Select **Web app**
3. Execute as: **Me**
4. Who has access: choose what fits your business
5. Deploy

The web app gives you a dashboard for daily operations without manually editing every tab.

---

## How to use it operationally

### 1. Clean up the Master sheet

Make sure the `Master` sheet has reliable SKU rows. The system can tolerate header variations, but each item should ideally have:

- Item Code
- Item Name
- Category
- Opening Stock
- Total In (Mtr/KG)
- Total Out (Mtr/KG)
- Min Stock Level
- Unit Rate

### 2. Start taking orders

Use the dashboard **Order Book** tab or enter directly into the sheet.

This will:

- create an Order ID
- allocate stock against live orders
- reflect shortages in reorder planning

### 3. Track job work

Use the **Job Work** tab to record:

- material sent out
- material received
- wastage
- worker payment

### 4. Log dispatch

Use the **Dispatch** tab to:

- record challan-wise dispatches
- reduce stock automatically
- update dispatch progress on the linked order
- auto-complete the order when fully dispatched

### 5. Raise purchase plans

Use **Reorder Planner** when stock drops below threshold.

You can turn system suggestions into actual purchase plans and track their status:

- Draft
- Raised
- Ordered
- Received
- Cancelled

### 6. Use stock adjustments carefully

The **Stock Ledger** and **Post Adjustment** feature are for:

- purchase receipts
- stock corrections
- returns
- emergency manual fixes

These entries directly affect stock.

---

## Recommended master-data upgrades

To make this more advanced and accurate for a textile business, improve the `Master` tab over time with:

- `Min Stock Level`
- `Target Stock Level`
- `Unit Rate`
- consistent UOM (`Mtr`, `Kg`, etc.)
- proper item code naming
- category grouping such as:
  - Raw
  - Semi Finished
  - Finished
  - Packing
  - Accessories

---

## Suggested business workflow for your textile company

### Raw material flow

Raw material inward -> stock adjustment (In) -> master stock rises

### Production flow

Order received -> order allocation -> job work issue -> job work receipt -> dispatch

### Replenishment flow

Low stock alert -> purchase plan -> PO raised outside the app -> inward adjustment after receipt

---

## Practical next upgrades I recommend for you

If you want this to become a stronger business system, the next best steps are:

1. **Add a Purchase Order sheet**  
   So reorder plans become actual POs with vendor-wise status.

2. **Add batch / lot tracking**  
   Important if the same item code is received in multiple dye lots or finishes.

3. **Add party-wise receivables / billing status**  
   Useful if you want the IMS to move toward ERP-lite.

4. **Add warehouse or rack locations**  
   Very useful once stock volume grows.

5. **Add role-based access**  
   So dispatch, production, and management each see focused workflows.

6. **Add WhatsApp / email alerts**  
   For low stock, overdue orders, and dispatch completion.

---

## Notes

- The system is intentionally built to be compatible with imperfect sheet headers.
- Dispatch and stock adjustments affect stock.
- Job work entries are tracked operationally but do not consume stock by themselves.
- The sheet remains your system of record; the dashboard is the operational layer on top.

---

## If you want me to take it further

The best next phase would be:

- purchase orders
- vendor master
- SKU cost rollups
- rack/location management
- production stage tracking by machine/process
- customer dispatch history and repeat-demand analysis

That would move this from a good IMS into a lightweight textile ERP workflow.
