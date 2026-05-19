# Jai Roop Textiles IMS

Advanced inventory management system for a textile business, built as a Google Apps Script web app backed by Google Sheets.

Connected Sheet:

https://docs.google.com/spreadsheets/d/19DMKtsGlL2GvDAZSW7tfJ8S-8Vi_vk0dka_IG-hIbWw/edit

## What is included

- Inventory master with stock levels, values, reorder levels, target levels and location/supplier fields
- Stock ledger for every IN, OUT and ADJUSTMENT movement
- Client order book with due date, priority, status and allocation tracking
- Job work tracker with sent qty, received qty, wastage %, rate and payment
- Dispatch log with challan, transporter and LR number
- Client portfolios and top-client analytics
- KPI dashboard with Chart.js visualizations
- Alerts for low stock, heavy allocation, overdue orders and high wastage
- One-click sheet setup/repair through `setupIMS`

## Files

- `Code.gs` - Apps Script backend, sheet schema, setup, CRUD functions, KPI calculations
- `Index.html` - Single-page dashboard UI
- `appsscript.json` - Apps Script manifest

## Install in Google Sheets

1. Open the connected Google Sheet.
2. Go to **Extensions -> Apps Script**.
3. Create/replace these files in Apps Script:
   - `Code.gs`
   - `Index.html`
   - `appsscript.json` manifest
4. In Apps Script, select the `setupIMS` function and click **Run**.
5. Approve permissions when Google asks.
6. Return to the Sheet and reload. A **Textile IMS** menu appears.
7. Use **Textile IMS -> Open IMS Dashboard** to open the dashboard inside Sheets.

## Deploy as a web app

1. In Apps Script, click **Deploy -> New deployment**.
2. Select **Web app**.
3. Set **Execute as** to **Me**.
4. Set **Who has access** based on your preference:
   - Internal company users only, or
   - Anyone with the link
5. Click **Deploy** and copy the web app URL.

## Recommended daily workflow

1. Add or update inventory items in **Inventory -> Add Item**.
2. Record purchase/production receipts in **Stock Ledger -> New Movement** with type `IN`.
3. Create client orders in **Order Book -> New Order**.
4. Issue production/vendor work in **Job Work -> Add Job Work**.
5. Record received quantity and wastage through job work entries.
6. Log shipping in **Dispatch -> Log Dispatch**.
7. Use **Alerts** every day for reorder and overdue action.

## Sheet tabs created by setup

- `Settings`
- `Master`
- `Stock Ledger`
- `Order Book`
- `Job Work Tracker`
- `Dispatch Log`
- `Clients`
- `Vendors`

`setupIMS` is safe to run again. It repairs missing sheets/headers and keeps existing rows.

## Important operating notes

- Keep system header names unchanged. You can add extra columns to the right if needed.
- Use dashboard forms where possible so stock calculations stay synchronized.
- Dispatch entries automatically create stock `OUT` ledger movements.
- Open orders allocate stock until their status is `Completed` or `Cancelled`.
- Reorder status is recalculated from closing balance against reorder/target levels.

## Suggested future upgrades

- Role-based access for sales, production, store and admin users
- Buyer-wise pricing and quotation module
- Purchase order module for suppliers
- Barcode/QR labels for rolls and bundles
- Payment follow-up and credit-limit tracking
- Looker Studio reporting on the same Google Sheet data
