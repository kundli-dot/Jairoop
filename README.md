# Jai Roop Textiles IMS V7

This repository contains an advanced Google Apps Script inventory management system for the Jai Roop Textiles Google Sheet:

`https://docs.google.com/spreadsheets/d/19DMKtsGlL2GvDAZSW7tfJ8S-8Vi_vk0dka_IG-hIbWw/edit`

## What this IMS includes

- Inventory master with opening stock, reorder level, target stock, average rate, location and supplier.
- Stock ledger for purchase in, production in, returns, samples, damage and manual adjustments.
- Purchase register that automatically posts received quantity into the stock ledger.
- Order book with client, PO, item, quantity, required date, priority and status.
- Job work tracker for worker/process, sent quantity, received quantity, wastage, due date and payment.
- Dispatch log that posts dispatches as stock-out movements and can mark linked orders completed.
- Automated stock calculations:
  - Total In
  - Total Out
  - Allocated To Orders
  - In Job Work
  - Closing Balance
  - Available Stock
  - Reorder Status
- Dashboard KPIs, charts, worker analytics, client analytics and exception alerts.

## Install in Google Sheets

1. Open the linked Google Sheet.
2. Go to **Extensions > Apps Script**.
3. Create/replace these files:
   - `Code.gs` with this repository's `Code.gs`
   - `Index.html` with this repository's `Index.html`
   - `appsscript.json` with this repository's `appsscript.json`  
     If you cannot see the manifest, enable **Project Settings > Show "appsscript.json" manifest file in editor**.
4. Save the Apps Script project.
5. Run `setupIMS()` once from the Apps Script editor.
6. Approve the requested spreadsheet permissions.
7. Deploy using **Deploy > New deployment > Web app**:
   - Execute as: **Me**
   - Who has access: choose your company/domain users, or anyone with the link if appropriate.
8. Open the web app URL.

## Recommended daily workflow

1. Add or update stock items in **Inventory**.
2. Enter purchases through **Purchases** so incoming stock is posted to the ledger.
3. Enter customer orders in **Order Book**.
4. Send material to workers through **Job Work** and update received/wastage quantities.
5. Log shipments in **Dispatch** and mark orders completed where applicable.
6. Review **Alerts** daily for low stock, stock-outs, over-allocation, overdue orders and high wastage.

## Sheet tabs created by setup

`setupIMS()` creates or repairs these tabs:

- `Master`
- `Order Book`
- `Job Work Tracker`
- `Dispatch Log`
- `Purchase Register`
- `Stock Ledger`
- `Settings`

Existing columns are preserved. Missing required columns are appended.

## Important operating notes

- Do not manually edit calculated columns in `Master`: `Total In`, `Total Out`, `Allocated To Orders`, `In Job Work`, `Closing Balance`, `Available Stock`, `Reorder Status`, `Avg Rate`, `Last Updated`.
- Use **Purchase Register** or **Stock Ledger** for stock changes so the audit trail remains clean.
- Active allocation is calculated from orders with status `Pending` or `In Production`.
- Job work quantity reduces available stock until the job is marked `Completed` or received quantity catches up.
- Dispatches reduce closing stock through a `Dispatch Out` ledger entry.

## Customization points

Edit `IMS_CONFIG` at the top of `Code.gs` to change:

- Company name
- Spreadsheet ID
- Active order statuses
- Wastage alert threshold
- Sheet names

## Support checklist

If the dashboard looks wrong:

1. Run `setupIMS()` again.
2. Run `refreshStockBalances()`.
3. Check that item codes match exactly across Master, Orders, Purchases, Job Work and Dispatch.
4. Confirm quantities are numeric and not stored with unit text like `100 mtr`.
5. Review the `Stock Ledger` for duplicate manual entries.
