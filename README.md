# Textile IMS for Google Sheets + Apps Script

This repository now contains a real source version of the textile inventory management system instead of only PDF exports.

## What this system includes

- **Dashboard** with textile-focused KPIs
- **Inventory master** with:
  - item code
  - category
  - color
  - reorder level
  - preferred vendor
  - last purchase rate
  - available-to-promise quantity
- **Order book** with:
  - priority
  - due date
  - dispatched quantity
  - balance quantity
  - lifecycle tracking
- **Production planning** view based on open order balance vs available stock
- **Job work tracker** with wastage and payment calculation
- **Dispatch register** with challan, vehicle, and destination
- **Client master** for reusable customer records
- **Stock ledger** for inward/outward adjustments and audit history
- **Auto-repair / setup** logic that creates missing sheets and missing columns

## Files

- `Code.gs` - Google Apps Script backend
- `Index.html` - single-page IMS frontend
- `appsscript.json` - Apps Script manifest
- `Code.pdf` / `index file.pdf` - legacy exported references from the old version

## Recommended sheet tabs

The code automatically creates and maintains these sheets if they do not exist:

1. `Master`
2. `Order Book`
3. `Job Work Tracker`
4. `Dispatch Log`
5. `Client Master`
6. `Stock Ledger`

## How to deploy on your Google Sheet

### Option 1: Directly in the Apps Script editor

1. Open your Google Sheet.
2. Go to **Extensions -> Apps Script**.
3. Replace the existing project files with:
   - `Code.gs`
   - `Index.html`
   - `appsscript.json`
4. Save the project.
5. Run `installIMSWorkspace()` once from the Apps Script editor.
6. Accept authorization prompts.
7. Return to the Google Sheet and refresh it.
8. Use the **Textile IMS** custom menu if needed.
9. Deploy the web app:
   - **Deploy -> New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: as per your business preference

### Option 2: Use clasp for version control

If you use `clasp`, clone or connect this repo to your Apps Script project and push these files into the script project tied to the sheet.

## First-time setup flow

After deployment:

1. Open the web app.
2. Click **Repair Setup** once.
3. Confirm the base sheets and columns are created.
4. Check the `Master` tab and fill:
   - item codes
   - item names
   - category
   - reorder level
   - preferred vendor
5. Add or import clients into `Client Master`.
6. Start entering:
   - new orders
   - stock inward / outward
   - job work
   - dispatch entries

## How the textile workflow works

### Inventory

- `Opening Stock + Total In - Total Out = Closing Balance`
- Open order balance is treated as **Allocated to Orders**
- `Closing Balance - Allocated to Orders = Available to Promise`
- Reorder status is automatically derived from balance, ATP, and reorder level

### Orders

- New orders can be created from the UI
- Status supports:
  - Pending
  - In Production
  - Partially Dispatched
  - Completed
  - Cancelled
- Dispatch automatically updates:
  - dispatched quantity
  - balance quantity
  - completion status when fully served

### Planning

- The planning tab ranks open orders by:
  - priority
  - due date
- It shows shortages when order balance exceeds available stock

### Job work

- Payment defaults to the configured rate in the script
- Wastage percentage is visible in the UI
- If a pending order receives job work, it moves into production

### Stock ledger

- Use this for:
  - purchase inward
  - production return
  - issue to production
  - manual correction
  - opening correction
- Dispatch also writes an outward stock movement

## Suggested next upgrades for your business

If you want to make this more advanced after this version is live, the next best additions are:

1. **Purchase order module**
2. **Supplier master**
3. **Receivables and payment follow-up**
4. **GST invoice / challan print formats**
5. **Role-based access**
6. **WhatsApp / email dispatch notifications**
7. **Daily production planning by machine / contractor**
8. **Lot / batch tracking for dyed shades**

## Notes about your shared Google Sheet

Your shared sheet already contains textile item master data. This upgraded version is designed to work with that sheet-first approach while adding:

- cleaner source control
- editable code files
- additional master data
- more reliable order and dispatch calculations
- better planning visibility

## Operating advice

For a textile company, the most important daily discipline is:

1. keep item codes consistent
2. always log dispatches on the same day
3. log stock inward/outward through the ledger
4. set reorder levels for fast-moving items
5. review the planning and alerts tabs every day

If you want the next pass, the strongest practical expansion is to add **purchase orders + supplier tracking + invoice generation** on top of this base.
