# Jai Roop Textiles — Inventory Management System (IMS) V7

A production-ready **Inventory Management System** for textile operations, built on **Google Sheets + Google Apps Script** with a modern web dashboard.

## What it does

| Module | Purpose |
|--------|---------|
| **Master** | Fabric stock levels, categories, reorder status, allocated qty |
| **Order Book** | Client orders with status workflow (Pending → In Production → Completed) |
| **Job Work Tracker** | Production sent to workers, wastage %, payments |
| **Dispatch Log** | Shipments with challan numbers |
| **Stock Movements** *(V7)* | Record stock IN/OUT with audit trail |
| **Dashboard** | KPIs, charts, alerts, client portfolios, order lifecycle |

## Your Google Sheet

Link: https://docs.google.com/spreadsheets/d/19DMKtsGlL2GvDAZSW7tfJ8S-8Vi_vk0dka_IG-hIbWw/edit

Required sheet tabs:
- `Master`
- `Order Book`
- `Job Work Tracker`
- `Dispatch Log`
- `Stock Movements` *(auto-created on first stock movement)*

## Quick deploy (15 minutes)

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for step-by-step setup.

1. Open your Google Sheet → **Extensions → Apps Script**
2. Copy `google-apps-script/Code.gs` → paste into `Code.gs`
3. Add HTML file named **Index** → paste `google-apps-script/Index.html`
4. **Deploy → New deployment → Web app** → Execute as: Me, Access: Anyone with link
5. Open the web app URL on phone or desktop

## V7 enhancements over V6

- Stock movement logging (IN/OUT) with auto sheet creation
- Server-side stock alert API
- Challan data endpoint for printing
- Optional daily reorder email (`sendDailyReorderEmail` + time trigger)
- Cleaner backend config (`CONFIG` object)
- Improved ID generation

## Project structure

```
google-apps-script/
  Code.gs          # Backend API
  Index.html       # Dashboard UI
  appsscript.json  # Project settings
docs/
  DEPLOYMENT.md    # Full setup guide
  SHEET_SCHEMA.md  # Column reference
```

## Business rules (built-in)

- **Allocation sync**: Pending + In Production orders update `Allocated to Orders` on Master
- **Reorder alert**: Items marked `REORDER (LOW)` on Master
- **Wastage flag**: Job work batches above **4%** wastage highlighted
- **Payment default**: ₹0.25 per metre received (configurable in `Code.gs`)

## Support

After deployment, use **Sync** in the dashboard header to refresh data. Changes in the sheet (order status) sync automatically via `onEdit` trigger when you edit column F in Order Book.
