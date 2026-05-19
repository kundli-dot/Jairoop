# Jai Roop Textile IMS - Advanced Google Sheet System

This repository contains a production-ready **Inventory Management System (IMS)** for your textile business, built on top of Google Sheets + Google Apps Script.

## What is included

- `apps-script/Code.gs` - backend logic
  - Live KPI engine
  - Order, Job Work, Dispatch, Purchase entry APIs
  - Master stock rollups (Allocated / In / Out / Closing / Reorder status)
  - Activity/audit log
  - Low stock coverage analytics (consumption-aware)
- `apps-script/Index.html` - responsive dashboard web app UI
- `apps-script/appsscript.json` - Apps Script project config

---

## Expected sheet tabs

Your current sheet already has most of these:

1. `Master`
2. `Order Book`
3. `Job Work Tracker`
4. `Dispatch Log`

The script auto-creates:

5. `Purchase Log`
6. `Activity Log`
7. `Settings`

> Safety default: `ENABLE_MASTER_AUTO_ROLLUP=false`, so your existing Master stock math is not overwritten unexpectedly.  
> You can turn it on later from `Settings` when you want full auto stock in/out/closing rollup.

---

## Quick deployment guide (for your shared Google Sheet)

1. Open your sheet:
   - `https://docs.google.com/spreadsheets/d/19DMKtsGlL2GvDAZSW7tfJ8S-8Vi_vk0dka_IG-hIbWw/edit`
2. Go to **Extensions -> Apps Script**
3. Replace existing `Code.gs` with `apps-script/Code.gs`
4. Add new HTML file named `Index` and paste `apps-script/Index.html`
5. Replace `appsscript.json` from Project Settings (show manifest)
6. Save all files
7. Run `initializeIMS()` once (first-time setup)
8. Deploy:
   - **Deploy -> New deployment -> Web app**
   - Execute as: **Me**
   - Who has access: **Anyone with link** (or restricted if preferred)
9. Open web app URL and start using the IMS dashboard

---

## Column compatibility notes

The backend uses header-name matching (sanitized), so spacing/symbols are tolerated.
It expects these logical fields:

- **Master**: `Item Code`, `Opening Stock`, `Total In (Mtr/KG)`, `Total Out (Mtr/KG)`, `Allocated to Orders`, `Closing Balance`, `Reorder Status`
- **Order Book**: `Order ID`, `Date`, `Client Name`, `Item Code`, `Ordered Qty (Mtr/KG)`, `Status`, `Remarks`
- **Job Work Tracker**: `Date`, `Job ID`, `Order ID`, `Worker Name`, `Item Code`, `Sent Qty (Mtr)`, `Received Qty (Mtr)`, `Wastage (Mtr)`, `Status`, `Total Payment`
- **Dispatch Log**: `Dispatch ID`, `Order ID`, `Client Name`, `Item Code`, `Dispatched Qty`, `Dispatch Date`, `Challan No`
- **Purchase Log**: auto-created if missing

---

## Advanced capabilities now available

1. **Unified operational flow**
   - Purchase -> Stock rollup -> Order allocation -> Dispatch -> Completion
2. **Real-time tactical KPIs**
   - Fulfilment rate, pending load, active production, avg wastage
3. **Low coverage forecasting**
   - Coverage days by item based on recent dispatch consumption
4. **Auditability**
   - Every major action is logged to `Activity Log`
5. **Manual + automatic stock recalculation**
   - Trigger from dashboard anytime

---

## Recommended next upgrades (Phase 2)

- Multi-role login view (owner / production / dispatch)
- WhatsApp alerts for low stock + delayed orders
- GST-ready purchase/sales invoice export
- QR or barcode scanning for item movement
- Vendor scorecard and worker efficiency trend

